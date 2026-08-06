#!/usr/bin/env bash

set -Eeuo pipefail

: "${CF_API_TOKEN:?Export CF_API_TOKEN before running this script}"

RG="ecowing-storage-rg"
ENV_NAME="ecowing-env"
APP="ecowing-frontend"
DOMAIN="ecowing.hk"
OLD_APEX_IP="216.198.79.1"
OLD_WWW_TARGET="cname.vercel-dns.com"
CF_API="https://api.cloudflare.com/client/v4"

FRONTEND_FQDN=$(az containerapp show \
  --resource-group "$RG" \
  --name "$APP" \
  --query properties.configuration.ingress.fqdn \
  --output tsv)

ENV_STATIC_IP=$(az containerapp env show \
  --resource-group "$RG" \
  --name "$ENV_NAME" \
  --query properties.staticIp \
  --output tsv)

VERIFY_ID=$(az containerapp show \
  --resource-group "$RG" \
  --name "$APP" \
  --query properties.customDomainVerificationId \
  --output tsv)

ZONE_RESPONSE=$(curl -fsS -G "$CF_API/zones" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  --data-urlencode "name=$DOMAIN")

CF_ZONE_ID=$(jq -er \
  'if .success and (.result | length > 0) then .result[0].id else error("Cloudflare zone not found") end' \
  <<<"$ZONE_RESPONSE")

cf_upsert() {
  local type="$1"
  local name="$2"
  local content="$3"
  local lookup_response record_id payload method url response

  lookup_response=$(curl -fsS -G \
    "$CF_API/zones/$CF_ZONE_ID/dns_records" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    --data-urlencode "type=$type" \
    --data-urlencode "name=$name")

  record_id=$(jq -r '.result[0].id // empty' <<<"$lookup_response")

  if [[ "$type" == "A" || "$type" == "CNAME" ]]; then
    payload=$(jq -nc \
      --arg type "$type" \
      --arg name "$name" \
      --arg content "$content" \
      '{type:$type,name:$name,content:$content,ttl:300,proxied:false}')
  else
    payload=$(jq -nc \
      --arg type "$type" \
      --arg name "$name" \
      --arg content "$content" \
      '{type:$type,name:$name,content:$content,ttl:300}')
  fi

  if [[ -n "$record_id" ]]; then
    method="PATCH"
    url="$CF_API/zones/$CF_ZONE_ID/dns_records/$record_id"
  else
    method="POST"
    url="$CF_API/zones/$CF_ZONE_ID/dns_records"
  fi

  response=$(curl -fsS -X "$method" "$url" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
    --data "$payload")

  if ! jq -e '.success == true' >/dev/null <<<"$response"; then
    jq . <<<"$response" >&2
    return 1
  fi

  printf 'DNS set: %s %s -> %s\n' "$type" "$name" "$content"
}

wait_dns() {
  local type="$1"
  local name="$2"
  local expected="$3"
  local current

  for _ in $(seq 1 36); do
    current=$(dig +short "$type" "$name" @1.1.1.1 \
      | tr -d '"' \
      | sed 's/\.$//' \
      | tr '\n' ' ')

    if [[ "$current" == *"$expected"* ]]; then
      return 0
    fi

    sleep 10
  done

  printf 'DNS propagation timed out for %s\n' "$name" >&2
  return 1
}

ensure_hostname() {
  local hostname="$1"
  local count

  count=$(az containerapp hostname list \
    --resource-group "$RG" \
    --name "$APP" \
    --query "[?name=='$hostname'] | length(@)" \
    --output tsv)

  if [[ "$count" != "0" ]]; then
    printf 'Azure hostname already registered: %s\n' "$hostname"
    return 0
  fi

  az containerapp hostname add \
    --resource-group "$RG" \
    --name "$APP" \
    --hostname "$hostname" \
    --output none \
    --only-show-errors

  printf 'Azure hostname registered: %s\n' "$hostname"
}

bind_hostname() {
  local hostname="$1"
  local method="$2"
  local last_output=""

  for attempt in $(seq 1 20); do
    if last_output=$(az containerapp hostname bind \
      --resource-group "$RG" \
      --name "$APP" \
      --environment "$ENV_NAME" \
      --hostname "$hostname" \
      --validation-method "$method" \
      --output none \
      --only-show-errors 2>&1); then
      printf 'HTTPS bound: %s\n' "$hostname"
      return 0
    fi

    printf 'Waiting for Azure certificate: %s (%s/20)\n' "$hostname" "$attempt"
    sleep 15
  done

  printf '%s\n' "$last_output" >&2
  return 1
}

www_changed=0
apex_changed=0
complete=0

rollback() {
  local status=$?
  trap - EXIT

  if [[ "$complete" != "1" ]]; then
    set +e
    printf 'Cutover failed; restoring Vercel DNS.\n' >&2

    if [[ "$apex_changed" == "1" ]]; then
      cf_upsert A "$DOMAIN" "$OLD_APEX_IP"
    fi

    if [[ "$www_changed" == "1" ]]; then
      cf_upsert CNAME "www.$DOMAIN" "$OLD_WWW_TARGET"
    fi
  fi

  exit "$status"
}

trap rollback EXIT

printf '1/5 Creating domain verification records...\n'
cf_upsert TXT "asuid.$DOMAIN" "$VERIFY_ID"
cf_upsert TXT "asuid.www.$DOMAIN" "$VERIFY_ID"
wait_dns TXT "asuid.$DOMAIN" "$VERIFY_ID"
wait_dns TXT "asuid.www.$DOMAIN" "$VERIFY_ID"

printf '2/5 Registering hostnames in Azure...\n'
ensure_hostname "$DOMAIN"
ensure_hostname "www.$DOMAIN"

printf '3/5 Moving www to Azure...\n'
cf_upsert CNAME "www.$DOMAIN" "$FRONTEND_FQDN"
www_changed=1
wait_dns CNAME "www.$DOMAIN" "$FRONTEND_FQDN"
bind_hostname "www.$DOMAIN" CNAME

printf '4/5 Moving apex domain to Azure...\n'
cf_upsert A "$DOMAIN" "$ENV_STATIC_IP"
apex_changed=1
wait_dns A "$DOMAIN" "$ENV_STATIC_IP"
bind_hostname "$DOMAIN" HTTP

complete=1
trap - EXIT

printf '%s\n' '================================'
printf '%s\n' '5/5 Cutover complete'
printf 'https://%s\n' "$DOMAIN"
printf 'https://www.%s\n' "$DOMAIN"
printf '%s\n' 'Keep Cloudflare records DNS-only (grey cloud).'
printf '%s\n' '================================'
