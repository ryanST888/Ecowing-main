import json
import random
import time
import uuid
from typing import List, Optional, Dict
from fastapi import FastAPI, UploadFile, File, Form, Request, HTTPException, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from datetime import datetime, timezone, timedelta
from PIL import Image, UnidentifiedImageError
import io
import os
import requests
import base64
import hashlib
import hmac
from urllib.parse import quote, unquote

# For Qwen API
import dashscope
from dashscope import MultiModalConversation

# Supabase
from supabase import create_client, Client

# Azure Blob Storage
from azure.storage.blob import BlobServiceClient, ContentSettings
from azure.identity import DefaultAzureCredential
from azure.cosmos import CosmosClient, exceptions as cosmos_exceptions

# Application authentication
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError
from google.auth.transport import requests as google_auth_requests
from google.auth.exceptions import GoogleAuthError
from google.oauth2 import id_token as google_id_token

import pathlib
from dotenv import load_dotenv

BACKEND_DIR = pathlib.Path(__file__).resolve().parent
load_dotenv(dotenv_path=BACKEND_DIR / ".env", override=True)

app = FastAPI()
dashscope.api_key = os.getenv("QWEN_API_KEY", "")

# --- Supabase Client ---
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY) if SUPABASE_URL and SUPABASE_SERVICE_KEY else None

# --- Azure Identity ---
azure_credential = DefaultAzureCredential(exclude_interactive_browser_credential=True)

# --- Media Storage Client ---
STORAGE_PROVIDER = os.getenv("STORAGE_PROVIDER", "azure").strip().lower()
AZURE_STORAGE_AUTH_MODE = os.getenv("AZURE_STORAGE_AUTH_MODE", "auto").strip().lower()
AZURE_STORAGE_ACCOUNT_URL = os.getenv("AZURE_STORAGE_ACCOUNT_URL", "").strip().rstrip("/")
AZURE_STORAGE_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "").strip()
AZURE_STORAGE_CONTAINER = os.getenv("AZURE_STORAGE_CONTAINER", "report-images").strip()
AZURE_STORAGE_PUBLIC_URL = os.getenv("AZURE_STORAGE_PUBLIC_URL", "").strip().rstrip("/")

azure_blob_service = None
azure_container = None
azure_storage_auth = "not configured"
if STORAGE_PROVIDER == "azure" and AZURE_STORAGE_CONTAINER:
    try:
        if AZURE_STORAGE_ACCOUNT_URL and AZURE_STORAGE_AUTH_MODE in {"auto", "default_credential"}:
            azure_blob_service = BlobServiceClient(
                account_url=AZURE_STORAGE_ACCOUNT_URL,
                credential=azure_credential,
            )
            azure_storage_auth = "default_credential"
        elif AZURE_STORAGE_CONNECTION_STRING and AZURE_STORAGE_AUTH_MODE in {"auto", "connection_string"}:
            azure_blob_service = BlobServiceClient.from_connection_string(AZURE_STORAGE_CONNECTION_STRING)
            azure_storage_auth = "connection_string"
        elif AZURE_STORAGE_AUTH_MODE not in {"auto", "default_credential", "connection_string"}:
            raise ValueError(f"Unsupported AZURE_STORAGE_AUTH_MODE: {AZURE_STORAGE_AUTH_MODE}")

        if azure_blob_service and not AZURE_STORAGE_PUBLIC_URL:
            AZURE_STORAGE_PUBLIC_URL = f"{azure_blob_service.url.rstrip('/')}/{quote(AZURE_STORAGE_CONTAINER, safe='')}"

        if not azure_blob_service:
            raise ValueError(
                "Azure Blob Storage requires AZURE_STORAGE_ACCOUNT_URL for default credentials "
                "or AZURE_STORAGE_CONNECTION_STRING for account-key authentication"
            )

        azure_container = azure_blob_service.get_container_client(AZURE_STORAGE_CONTAINER)
    except Exception as e:
        print(f"Azure Blob Storage configuration error: {e}")

# --- Azure Cosmos DB Client ---
AZURE_COSMOS_ENDPOINT = os.getenv("AZURE_COSMOS_ENDPOINT", "").strip().rstrip("/")
AZURE_COSMOS_DATABASE = os.getenv("AZURE_COSMOS_DATABASE", "ecowing").strip()
AZURE_COSMOS_REPORTS_CONTAINER = os.getenv("AZURE_COSMOS_REPORTS_CONTAINER", "reports").strip()
AZURE_COSMOS_PROFILES_CONTAINER = os.getenv("AZURE_COSMOS_PROFILES_CONTAINER", "profiles").strip()
AZURE_COSMOS_IDENTITIES_CONTAINER = os.getenv("AZURE_COSMOS_IDENTITIES_CONTAINER", "auth-identities").strip()
AZURE_COSMOS_SESSIONS_CONTAINER = os.getenv("AZURE_COSMOS_SESSIONS_CONTAINER", "auth-sessions").strip()

cosmos_client = None
cosmos_database = None
cosmos_reports = None
cosmos_profiles = None
cosmos_identities = None
cosmos_sessions = None
if AZURE_COSMOS_ENDPOINT and AZURE_COSMOS_DATABASE:
    try:
        cosmos_client = CosmosClient(AZURE_COSMOS_ENDPOINT, credential=azure_credential)
        cosmos_database = cosmos_client.get_database_client(AZURE_COSMOS_DATABASE)
        cosmos_reports = cosmos_database.get_container_client(AZURE_COSMOS_REPORTS_CONTAINER)
        cosmos_profiles = cosmos_database.get_container_client(AZURE_COSMOS_PROFILES_CONTAINER)
        cosmos_identities = cosmos_database.get_container_client(AZURE_COSMOS_IDENTITIES_CONTAINER)
        cosmos_sessions = cosmos_database.get_container_client(AZURE_COSMOS_SESSIONS_CONTAINER)
    except Exception as e:
        print(f"Azure Cosmos DB configuration error: {e}")

# --- Application Authentication Configuration ---
AUTH_JWT_SECRET = os.getenv("AUTH_JWT_SECRET", "").strip()
AUTH_JWT_ISSUER = os.getenv("AUTH_JWT_ISSUER", "ecowing-api").strip()
AUTH_JWT_AUDIENCE = os.getenv("AUTH_JWT_AUDIENCE", "ecowing-web").strip()
AUTH_ACCESS_TOKEN_MINUTES = int(os.getenv("AUTH_ACCESS_TOKEN_MINUTES", "15"))
AUTH_REFRESH_TOKEN_DAYS = int(os.getenv("AUTH_REFRESH_TOKEN_DAYS", "30"))
AUTH_JWT_ALGORITHM = "HS256"
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()

password_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    salt_len=16,
)

# Security scheme for JWT auth
security = HTTPBearer(auto_error=False)

def get_allowed_origins():
    origins = os.getenv("FRONTEND_ORIGINS", "").strip()
    if origins:
        return [origin.strip().rstrip("/") for origin in origins.split(",") if origin.strip()]
    return [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://ecowing.hk",
        "https://ecowing.hk",
        "https://www.ecowing.hk",
        "https://ecowing-main.vercel.app",
    ]

def get_public_base_url(request: Request) -> str:
    public_base_url = os.getenv("PUBLIC_BACKEND_URL", "").strip().rstrip("/")
    if public_base_url:
        return public_base_url
    return str(request.base_url).rstrip("/")

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CREATE AND MOUNT UPLOADS DIRECTORY (kept as local fallback) ---
UPLOAD_DIR = BACKEND_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

MAX_UPLOAD_BYTES = 20 * 1024 * 1024
MAX_IMAGE_PIXELS = 40_000_000
ALLOWED_IMAGE_FORMATS = {
    "JPEG": ("image/jpeg", ".jpg"),
    "PNG": ("image/png", ".png"),
    "WEBP": ("image/webp", ".webp"),
}
ALLOWED_VIDEO_TYPES = {
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/webm": ".webm",
}

# --- Data Structures ---
TAXONOMY: Dict[str, List[str]] = {
    "Plastic": ["Bottle", "Bag", "Box", "Fishing Gear", "Microplastic", "Container", "Fragment", "Bottle Cap", "Sheet", "Styrofoam"],
    "Metal": ["Can", "Scrap", "Wire"],
    "Glass": ["Bottle", "Shard"],
    "Paper": ["Paper", "Cardboard", "Box", "Carton"],
    "Fabric": ["Clothing", "Net", "Towel"],
    "Rubber": ["Rubber", "Ball", "Shoe"],
    "Wood": ["Plank", "Driftwood"],
    "Other": ["Mixed"]
}

# --- Auth Helpers ---
class AuthenticatedUser(BaseModel):
    id: str
    email: str
    username: str


def auth_is_configured() -> bool:
    return all((AUTH_JWT_SECRET, cosmos_profiles, cosmos_identities, cosmos_sessions))


def normalize_email(email: str) -> str:
    return email.strip().lower()


def get_identity(login_key: str) -> Optional[dict]:
    if cosmos_identities is None:
        return None
    try:
        return cosmos_identities.read_item(item=login_key, partition_key=login_key)
    except cosmos_exceptions.CosmosResourceNotFoundError:
        return None


def add_profile_provider(profile: dict, provider: str) -> dict:
    providers = [str(item) for item in profile.get("providers", []) if item]
    if provider not in providers:
        providers.append(provider)
    profile["providers"] = providers
    profile["updated_at"] = utc_now_iso()
    return profile


def verify_google_credential(credential: str) -> dict:
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google authentication is not configured")
    if not credential.strip():
        raise HTTPException(status_code=400, detail="Google credential is required")
    try:
        claims = google_id_token.verify_oauth2_token(
            credential,
            google_auth_requests.Request(),
            GOOGLE_CLIENT_ID,
        )
    except (ValueError, TypeError, GoogleAuthError):
        raise HTTPException(status_code=401, detail="Invalid Google credential")

    issuer = str(claims.get("iss") or "")
    if issuer not in {"accounts.google.com", "https://accounts.google.com"}:
        raise HTTPException(status_code=401, detail="Invalid Google credential issuer")
    if not claims.get("email_verified"):
        raise HTTPException(status_code=401, detail="Google email is not verified")
    if not claims.get("sub") or not claims.get("email"):
        raise HTTPException(status_code=401, detail="Google account information is incomplete")
    return claims


def refresh_token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def decode_auth_token(token: str, expected_type: str) -> dict:
    if not AUTH_JWT_SECRET:
        raise HTTPException(status_code=500, detail="Application authentication is not configured")
    try:
        claims = jwt.decode(
            token,
            AUTH_JWT_SECRET,
            algorithms=[AUTH_JWT_ALGORITHM],
            audience=AUTH_JWT_AUDIENCE,
            issuer=AUTH_JWT_ISSUER,
            options={"require": ["exp", "iat", "iss", "aud", "sub", "type"]},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    if claims.get("type") != expected_type:
        raise HTTPException(status_code=401, detail="Invalid token type")
    return claims


def authenticated_user_from_claims(claims: dict) -> AuthenticatedUser:
    return AuthenticatedUser(
        id=str(claims.get("sub")),
        email=str(claims.get("email") or ""),
        username=str(claims.get("username") or "User"),
    )


def issue_auth_session(user: AuthenticatedUser, session_id: Optional[str] = None) -> dict:
    if cosmos_sessions is None or not AUTH_JWT_SECRET:
        raise HTTPException(status_code=500, detail="Application authentication is not configured")

    now = datetime.now(timezone.utc)
    session_id = session_id or uuid.uuid4().hex
    access_expires = now + timedelta(minutes=AUTH_ACCESS_TOKEN_MINUTES)
    refresh_expires = now + timedelta(days=AUTH_REFRESH_TOKEN_DAYS)
    shared_claims = {
        "sub": user.id,
        "email": user.email,
        "username": user.username,
        "sid": session_id,
        "iss": AUTH_JWT_ISSUER,
        "aud": AUTH_JWT_AUDIENCE,
        "iat": now,
    }
    access_token = jwt.encode(
        {**shared_claims, "type": "access", "exp": access_expires},
        AUTH_JWT_SECRET,
        algorithm=AUTH_JWT_ALGORITHM,
    )
    refresh_token = jwt.encode(
        {**shared_claims, "type": "refresh", "exp": refresh_expires},
        AUTH_JWT_SECRET,
        algorithm=AUTH_JWT_ALGORITHM,
    )
    cosmos_sessions.upsert_item({
        "id": session_id,
        "user_id": user.id,
        "refresh_token_hash": refresh_token_hash(refresh_token),
        "created_at": now.isoformat(),
        "expires_at": refresh_expires.isoformat(),
        "revoked": False,
    })
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_in": AUTH_ACCESS_TOKEN_MINUTES * 60,
    }


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Return the authenticated user, or None when no valid access token is present."""
    if not credentials:
        return None
    try:
        return authenticated_user_from_claims(decode_auth_token(credentials.credentials, "access"))
    except HTTPException:
        return None


async def require_auth(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Require a valid EcoWing access token."""
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")
    return authenticated_user_from_claims(decode_auth_token(credentials.credentials, "access"))

# --- Media Storage Helpers ---
def upload_image_to_supabase(file_bytes: bytes, filename: str, content_type: str, user_id: str = "anonymous") -> str:
    """Legacy Supabase Storage upload helper."""
    if not supabase:
        return ""
    try:
        # Store under user_id folder for RLS policy matching
        storage_path = f"{user_id}/{filename}"
        
        # Upload to Supabase Storage
        supabase.storage.from_("report-images").upload(
            path=storage_path,
            file=file_bytes,
            file_options={"content-type": content_type}
        )
        
        # Get public URL
        public_url = supabase.storage.from_("report-images").get_public_url(storage_path)
        return public_url
    except Exception as e:
        print(f"Supabase Storage upload error: {e}")
        return ""


def upload_media_to_azure(file_bytes: bytes, filename: str, content_type: str, user_id: str = "anonymous") -> str:
    """Upload media to Azure Blob Storage and return its public URL."""
    if not azure_container or not AZURE_STORAGE_PUBLIC_URL:
        return ""

    storage_path = f"{user_id}/{filename}"

    try:
        blob_client = azure_container.get_blob_client(storage_path)
        blob_client.upload_blob(
            file_bytes,
            overwrite=False,
            content_settings=ContentSettings(
                content_type=content_type,
                cache_control="public, max-age=31536000",
            ),
        )
        return f"{AZURE_STORAGE_PUBLIC_URL}/{quote(storage_path, safe='/')}"
    except Exception as e:
        print(f"Azure Blob Storage upload error: {e}")
        return ""


def upload_media_to_storage(file_bytes: bytes, filename: str, content_type: str, user_id: str = "anonymous") -> str:
    """Upload media using the configured storage provider."""
    if STORAGE_PROVIDER == "azure":
        return upload_media_to_azure(file_bytes, filename, content_type, user_id)
    if STORAGE_PROVIDER == "supabase":
        return upload_image_to_supabase(file_bytes, filename, content_type, user_id)

    print(f"Unsupported storage provider: {STORAGE_PROVIDER}")
    return ""


def delete_media_from_storage(image_url: str) -> None:
    """Delete media from Azure, while retaining support for legacy Supabase URLs."""
    azure_prefix = f"{AZURE_STORAGE_PUBLIC_URL}/" if AZURE_STORAGE_PUBLIC_URL else ""

    if azure_container and azure_prefix and image_url.startswith(azure_prefix):
        storage_path = unquote(image_url[len(azure_prefix):].split("?", 1)[0])
        azure_container.get_blob_client(storage_path).delete_blob(delete_snapshots="include")
        print(f"Deleted image from Azure Blob Storage: {storage_path}")
        return

    supabase_marker = "/storage/v1/object/public/report-images/"
    if supabase and supabase_marker in image_url:
        storage_path = unquote(image_url.split(supabase_marker, 1)[1].split("?", 1)[0])
        supabase.storage.from_("report-images").remove([storage_path])
        print(f"Deleted image from Supabase Storage: {storage_path}")


def validate_upload(file_bytes: bytes, declared_content_type: str) -> tuple[str, str, bool]:
    """Validate uploaded media and return its canonical MIME type, extension, and video flag."""
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    content_type = declared_content_type.split(";", 1)[0].strip().lower()

    if content_type.startswith("image/"):
        try:
            with Image.open(io.BytesIO(file_bytes)) as image:
                image_format = (image.format or "").upper()
                width, height = image.size
                if width <= 0 or height <= 0 or width * height > MAX_IMAGE_PIXELS:
                    raise HTTPException(status_code=413, detail="Image dimensions are too large")
                image.verify()
        except HTTPException:
            raise
        except (UnidentifiedImageError, Image.DecompressionBombError, OSError, SyntaxError, ValueError):
            raise HTTPException(status_code=415, detail="Invalid or unsupported image file")

        image_type = ALLOWED_IMAGE_FORMATS.get(image_format)
        if not image_type:
            raise HTTPException(status_code=415, detail="Only JPEG, PNG, and WebP images are supported")

        canonical_type, extension = image_type
        accepted_declared_types = {canonical_type}
        if canonical_type == "image/jpeg":
            accepted_declared_types.update({"image/jpg", "image/pjpeg"})
        if content_type not in accepted_declared_types:
            raise HTTPException(status_code=415, detail="File content does not match its media type")
        return canonical_type, extension, False

    extension = ALLOWED_VIDEO_TYPES.get(content_type)
    if extension:
        header = file_bytes[:4096]
        if content_type == "video/webm":
            is_valid_video = header.startswith(b"\x1a\x45\xdf\xa3") and b"webm" in header.lower()
        else:
            is_valid_video = len(header) >= 12 and header[4:8] == b"ftyp"
        if not is_valid_video:
            raise HTTPException(status_code=415, detail="Invalid or unsupported video file")
        return content_type, extension, True

    raise HTTPException(status_code=415, detail="Only JPEG, PNG, WebP, MP4, MOV, and WebM files are supported")


def persist_upload(file_bytes: bytes, extension: str, content_type: str, request: Request, user_id: str) -> str:
    filename = f"{uuid.uuid4().hex}{extension}"
    public_url = upload_media_to_storage(file_bytes, filename, content_type, user_id)
    if public_url:
        return public_url

    file_path = UPLOAD_DIR / filename
    with open(file_path, "wb") as local_file:
        local_file.write(file_bytes)
    return f"{get_public_base_url(request)}/uploads/{filename}"

# --- Azure Cosmos DB Data Helpers ---
def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_report_document(report_id: str) -> Optional[dict]:
    """Find a report by ID across user partitions."""
    if cosmos_reports is None:
        raise RuntimeError("Azure Cosmos DB reports container is not configured")

    query = "SELECT TOP 1 * FROM c WHERE c.id = @report_id"
    parameters = [{"name": "@report_id", "value": report_id}]
    items = list(cosmos_reports.query_items(
        query=query,
        parameters=parameters,
        enable_cross_partition_query=True,
    ))
    return items[0] if items else None


def get_profile_document(user_id: str) -> Optional[dict]:
    """Read a profile using its ID as both item ID and partition key."""
    if cosmos_profiles is None:
        return None
    try:
        return cosmos_profiles.read_item(item=user_id, partition_key=user_id)
    except cosmos_exceptions.CosmosResourceNotFoundError:
        return None


def save_report_to_cosmos(report_data: dict, existing: Optional[dict] = None) -> bool:
    """Create or update a report in Azure Cosmos DB."""
    if cosmos_reports is None:
        return False

    try:
        now = utc_now_iso()
        db_record = {
            "id": str(report_data.get("id") or f"RPT-{int(time.time() * 1000)}"),
            "user_id": str(report_data.get("user_id") or ""),
            "category": report_data.get("category", "Other"),
            "sub_category": report_data.get("subCategory"),
            "severity": report_data.get("severity", "MEDIUM"),
            "description": report_data.get("description", ""),
            "estimated_weight_kg": report_data.get("estimatedWeightKg", 0),
            "cleanup_priority": report_data.get("cleanupPriority", "Medium"),
            "waste_type": report_data.get("wasteType", []),
            "waste_distribution": report_data.get("waste_distribution", {}),
            "bounding_boxes": report_data.get("boundingBoxes", []),
            "unique_item_count": report_data.get("unique_item_count"),
            "image_url": report_data.get("imageUrl", ""),
            "latitude": report_data.get("latitude"),
            "longitude": report_data.get("longitude"),
            "location_name": report_data.get("locationName", "Unknown"),
            "verified": report_data.get("verified", True),
            "message": report_data.get("message", ""),
            "status": report_data.get("status", "pending"),
            "created_at": (existing or {}).get("created_at") or report_data.get("timestamp") or now,
            "updated_at": now,
        }
        db_record = {key: value for key, value in db_record.items() if value is not None}

        if not db_record["user_id"]:
            raise ValueError("A report must have a user_id partition key")

        cosmos_reports.upsert_item(db_record)
        return True
    except Exception as e:
        print(f"Azure Cosmos DB save error: {e}")
        return False


def report_document_to_api(row: dict, username: str = "Anonymous") -> dict:
    """Map a Cosmos DB report document to the existing frontend API shape."""
    return {
        "id": row.get("id"),
        "category": row.get("category"),
        "subCategory": row.get("sub_category"),
        "severity": row.get("severity"),
        "description": row.get("description"),
        "estimatedWeightKg": float(row.get("estimated_weight_kg") or 0),
        "cleanupPriority": row.get("cleanup_priority"),
        "wasteType": row.get("waste_type", []),
        "waste_distribution": row.get("waste_distribution", {}),
        "boundingBoxes": row.get("bounding_boxes", []),
        "unique_item_count": row.get("unique_item_count"),
        "imageUrl": row.get("image_url"),
        "latitude": float(row.get("latitude", 0)) if row.get("latitude") is not None else None,
        "longitude": float(row.get("longitude", 0)) if row.get("longitude") is not None else None,
        "locationName": row.get("location_name"),
        "verified": row.get("verified"),
        "message": row.get("message"),
        "status": row.get("status"),
        "timestamp": row.get("created_at"),
        "user_id": row.get("user_id"),
        "username": username,
    }


def load_reports_from_cosmos() -> list:
    """Load all reports from Azure Cosmos DB, newest first."""
    if cosmos_reports is None:
        return []

    try:
        rows = list(cosmos_reports.query_items(
            query="SELECT * FROM c ORDER BY c.created_at DESC",
            enable_cross_partition_query=True,
        ))
        profile_map = {}
        for user_id in {str(row.get("user_id")) for row in rows if row.get("user_id")}:
            profile = get_profile_document(user_id)
            if profile:
                profile_map[user_id] = profile.get("username") or profile.get("display_name") or "User"

        return [
            report_document_to_api(
                row,
                profile_map.get(str(row.get("user_id")), "Anonymous") if row.get("user_id") else "Anonymous",
            )
            for row in rows
        ]
    except Exception as e:
        print(f"Azure Cosmos DB load error: {e}")
        return []

# --- Models ---
class BoundingBox(BaseModel):
    ymin: float
    xmin: float
    ymax: float
    xmax: float
    label: str

class DetectionResult(BaseModel):
    wasteType: List[str] 
    category: str
    subCategory: Optional[str]
    severity: str
    description: str
    estimatedWeightKg: float
    cleanupPriority: str
    boundingBoxes: List[BoundingBox]
    timestamp: str
    waste_distribution: Optional[Dict[str, int]] = None
    unique_item_count: Optional[int] = None
    imageUrl: Optional[str] = None

class SignUpRequest(BaseModel):
    email: EmailStr
    password: str
    username: Optional[str] = "User"

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RefreshRequest(BaseModel):
    refresh_token: str

class GoogleLoginRequest(BaseModel):
    credential: str

# --- Auth Endpoints ---
@app.post("/api/auth/signup")
async def sign_up(req: SignUpRequest):
    """Register a local email account in Azure Cosmos DB."""
    if not auth_is_configured():
        raise HTTPException(status_code=500, detail="Application authentication is not configured")

    email = normalize_email(str(req.email))
    username = (req.username or "").strip() or email.split("@", 1)[0]
    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if len(req.password) > 256:
        raise HTTPException(status_code=400, detail="Password is too long")

    login_key = f"email:{email}"
    if get_identity(login_key):
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    user_id = uuid.uuid4().hex
    now = utc_now_iso()
    profile_created = False
    try:
        cosmos_profiles.create_item({
            "id": user_id,
            "email": email,
            "username": username,
            "avatar": "icon/default.png",
            "providers": ["email"],
            "created_at": now,
            "updated_at": now,
        })
        profile_created = True
        cosmos_identities.create_item({
            "id": login_key,
            "login_key": login_key,
            "user_id": user_id,
            "provider": "email",
            "email": email,
            "password_hash": password_hasher.hash(req.password),
            "created_at": now,
            "updated_at": now,
        })

        user = AuthenticatedUser(id=user_id, email=email, username=username)
        return {
            "status": "success",
            "message": "User registered successfully",
            "user": user.model_dump(),
            "session": issue_auth_session(user),
        }
    except cosmos_exceptions.CosmosResourceExistsError:
        if profile_created:
            try:
                cosmos_profiles.delete_item(item=user_id, partition_key=user_id)
            except Exception:
                pass
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    except HTTPException:
        raise
    except Exception as e:
        if profile_created:
            try:
                cosmos_profiles.delete_item(item=user_id, partition_key=user_id)
            except Exception:
                pass
        print(f"Registration error: {e}")
        raise HTTPException(status_code=500, detail="Registration failed")

@app.post("/api/auth/login")
async def login(req: LoginRequest):
    """Log in with email and password."""
    if not auth_is_configured():
        raise HTTPException(status_code=500, detail="Application authentication is not configured")

    email = normalize_email(str(req.email))
    login_key = f"email:{email}"
    identity = get_identity(login_key)
    if not identity or identity.get("provider") != "email" or not identity.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    try:
        password_hasher.verify(identity["password_hash"], req.password)
    except (VerifyMismatchError, VerificationError):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if password_hasher.check_needs_rehash(identity["password_hash"]):
        identity["password_hash"] = password_hasher.hash(req.password)
        identity["updated_at"] = utc_now_iso()
        cosmos_identities.upsert_item(identity)

    user_id = str(identity.get("user_id"))
    profile = get_profile_document(user_id)
    if not profile:
        raise HTTPException(status_code=500, detail="User profile not found")

    user = AuthenticatedUser(
        id=user_id,
        email=str(profile.get("email") or email),
        username=str(profile.get("username") or "User"),
    )
    return {
        "status": "success",
        "user": user.model_dump(),
        "session": issue_auth_session(user),
    }


@app.post("/api/auth/google")
async def google_login(req: GoogleLoginRequest):
    """Verify a Google ID token, create or link the user, and issue an EcoWing session."""
    if not auth_is_configured():
        raise HTTPException(status_code=500, detail="Application authentication is not configured")

    claims = verify_google_credential(req.credential)
    google_subject = str(claims["sub"])
    email = normalize_email(str(claims["email"]))
    google_login_key = f"google:{google_subject}"
    email_login_key = f"email:{email}"
    username = str(claims.get("name") or email.split("@", 1)[0]).strip() or "User"
    avatar = str(claims.get("picture") or "icon/default.png").strip()
    now = utc_now_iso()

    google_identity = get_identity(google_login_key)
    if google_identity:
        user_id = str(google_identity.get("user_id") or "")
        profile = get_profile_document(user_id)
        if not profile:
            raise HTTPException(status_code=500, detail="User profile not found")
        profile = add_profile_provider(profile, "google")
        if not profile.get("email"):
            profile["email"] = email
        cosmos_profiles.upsert_item(profile)
    else:
        email_identity = get_identity(email_login_key)
        if email_identity:
            user_id = str(email_identity.get("user_id") or "")
            profile = get_profile_document(user_id)
            if not profile:
                raise HTTPException(status_code=500, detail="User profile not found")
            profile = add_profile_provider(profile, "google")
            if not profile.get("avatar") or profile.get("avatar") == "icon/default.png":
                profile["avatar"] = avatar
            cosmos_identities.create_item({
                "id": google_login_key,
                "login_key": google_login_key,
                "user_id": user_id,
                "provider": "google",
                "email": email,
                "google_sub": google_subject,
                "created_at": now,
                "updated_at": now,
            })
            cosmos_profiles.upsert_item(profile)
        else:
            user_id = uuid.uuid4().hex
            profile_created = False
            email_marker_created = False
            profile = {
                "id": user_id,
                "email": email,
                "username": username,
                "avatar": avatar,
                "providers": ["google"],
                "created_at": now,
                "updated_at": now,
            }
            try:
                cosmos_profiles.create_item(profile)
                profile_created = True
                cosmos_identities.create_item({
                    "id": email_login_key,
                    "login_key": email_login_key,
                    "user_id": user_id,
                    "provider": "google_email",
                    "email": email,
                    "created_at": now,
                    "updated_at": now,
                })
                email_marker_created = True
                cosmos_identities.create_item({
                    "id": google_login_key,
                    "login_key": google_login_key,
                    "user_id": user_id,
                    "provider": "google",
                    "email": email,
                    "google_sub": google_subject,
                    "created_at": now,
                    "updated_at": now,
                })
            except cosmos_exceptions.CosmosResourceExistsError:
                if email_marker_created:
                    try:
                        cosmos_identities.delete_item(item=email_login_key, partition_key=email_login_key)
                    except Exception:
                        pass
                if profile_created:
                    try:
                        cosmos_profiles.delete_item(item=user_id, partition_key=user_id)
                    except Exception:
                        pass
                raise HTTPException(status_code=409, detail="Google account is already linked")
            except Exception as e:
                if email_marker_created:
                    try:
                        cosmos_identities.delete_item(item=email_login_key, partition_key=email_login_key)
                    except Exception:
                        pass
                if profile_created:
                    try:
                        cosmos_profiles.delete_item(item=user_id, partition_key=user_id)
                    except Exception:
                        pass
                print(f"Google registration error: {e}")
                raise HTTPException(status_code=500, detail="Google login failed")

    user = AuthenticatedUser(
        id=user_id,
        email=str(profile.get("email") or email),
        username=str(profile.get("username") or username),
    )
    return {
        "status": "success",
        "user": user.model_dump(),
        "session": issue_auth_session(user),
    }


@app.post("/api/auth/refresh")
async def refresh_session(req: RefreshRequest):
    """Rotate a refresh token and issue a new access token."""
    if not auth_is_configured():
        raise HTTPException(status_code=500, detail="Application authentication is not configured")

    claims = decode_auth_token(req.refresh_token, "refresh")
    user_id = str(claims.get("sub"))
    session_id = str(claims.get("sid"))
    try:
        session = cosmos_sessions.read_item(item=session_id, partition_key=user_id)
    except cosmos_exceptions.CosmosResourceNotFoundError:
        raise HTTPException(status_code=401, detail="Session not found")

    if session.get("revoked") or not hmac.compare_digest(
        str(session.get("refresh_token_hash") or ""),
        refresh_token_hash(req.refresh_token),
    ):
        raise HTTPException(status_code=401, detail="Session has been revoked")

    profile = get_profile_document(user_id)
    if not profile:
        raise HTTPException(status_code=401, detail="User profile not found")
    user = AuthenticatedUser(
        id=user_id,
        email=str(profile.get("email") or claims.get("email") or ""),
        username=str(profile.get("username") or claims.get("username") or "User"),
    )
    return {
        "user": user.model_dump(),
        "session": issue_auth_session(user, session_id=session_id),
    }

@app.get("/api/auth/me")
async def get_me(user=Depends(require_auth)):
    """Get current logged-in user info."""
    profile = get_profile_document(user.id) or {}
    return {
        "id": user.id,
        "email": profile.get("email", user.email),
        "username": profile.get("username", user.username),
        "avatar": profile.get("avatar", "icon/default.png"),
        "created_at": profile.get("created_at"),
    }

@app.post("/api/auth/logout")
async def logout(req: RefreshRequest):
    """Revoke the current refresh-token session."""
    if cosmos_sessions is not None and AUTH_JWT_SECRET:
        try:
            claims = decode_auth_token(req.refresh_token, "refresh")
            cosmos_sessions.delete_item(
                item=str(claims.get("sid")),
                partition_key=str(claims.get("sub")),
            )
        except (HTTPException, cosmos_exceptions.CosmosResourceNotFoundError):
            pass
    return {"status": "success", "message": "Logged out"}

# --- Endpoints ---
@app.get("/health")
def health_check():
    cosmos_configured = all((cosmos_reports, cosmos_profiles, cosmos_identities, cosmos_sessions))
    media_storage_configured = azure_container is not None if STORAGE_PROVIDER == "azure" else False
    return {
        "status": "ok",
        "database_provider": "azure_cosmos",
        "cosmos_db": "configured" if cosmos_configured else "not configured",
        "auth_provider": "azure_cosmos_jwt",
        "authentication": "configured" if auth_is_configured() else "not configured",
        "google_login": "configured" if GOOGLE_CLIENT_ID else "not configured",
        "storage_provider": STORAGE_PROVIDER,
        "storage_auth": azure_storage_auth if STORAGE_PROVIDER == "azure" else "not configured",
        "media_storage": "configured" if media_storage_configured else "not configured",
    }

@app.get("/api/history")
def get_history():
    """Retrieve all saved reports from Azure Cosmos DB."""
    return load_reports_from_cosmos()

@app.get("/api/expand-url")
def expand_url(url: str):
    try:
        response = requests.get(url, allow_redirects=True, timeout=5)
        return {"url": response.url}
    except Exception as e:
        return {"error": str(e)}

def compress_image_if_needed(image_bytes, max_size_mb=9.5):
    current_size = len(image_bytes)
    limit_bytes = max_size_mb * 1024 * 1024

    if current_size <= limit_bytes:
        return image_bytes  

    print(f"Compressing image: {current_size / (1024*1024):.2f}MB -> Target: {max_size_mb}MB")

    img = Image.open(io.BytesIO(image_bytes))
    if img.mode in ('RGBA', 'P'):
        img = img.convert('RGB')

    if max(img.size) > 1920:
        img.thumbnail((1920, 1920))

    quality = 85
    output = io.BytesIO()
    
    while quality > 10:
        output.seek(0)
        output.truncate(0)
        img.save(output, format='JPEG', quality=quality)
        
        compressed_size = output.tell()
        if compressed_size <= limit_bytes:
            print(f"Compression success: {compressed_size / (1024*1024):.2f}MB at quality {quality}")
            return output.getvalue()
        
        quality -= 10 

    return output.getvalue()

@app.post("/api/detect")
async def detect_waste(
    request: Request,
    file: UploadFile = File(...),
    lat: Optional[float] = Form(None),
    lng: Optional[float] = Form(None),
    locationName: Optional[str] = Form(None),
    user=Depends(require_auth),
):
    result = None
    category_name = "Other"
    sub_category_name = None
    waste_distribution = {}
    unique_item_count = 0
    boxes = []
    final_image_url = ""

    try:
        contents = await file.read(MAX_UPLOAD_BYTES + 1)
    finally:
        await file.close()

    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large (maximum 20 MB)")

    content_type, extension, is_video = validate_upload(
        contents,
        file.content_type or "application/octet-stream",
    )
    user_id = str(user.id)
    final_image_url = persist_upload(contents, extension, content_type, request, user_id)

    if is_video:
        return DetectionResult(
            wasteType=["Other"],
            category="Other",
            subCategory="Video evidence",
            severity="MEDIUM",
            description="Video evidence uploaded for manual review.",
            estimatedWeightKg=0,
            cleanupPriority="Medium",
            boundingBoxes=[],
            waste_distribution={},
            unique_item_count=0,
            imageUrl=final_image_url,
            timestamp=datetime.now().isoformat(),
        )
    
    try:
        try:
            contents = compress_image_if_needed(contents)
        except Exception as compress_err:
            print(f"Compression warning: {compress_err}")

        base64_image = base64.b64encode(contents).decode('utf-8')
        TAXONOMY_CATEGORIES = ["Plastic", "Metal", "Glass", "Paper", "Fabric", "Rubber", "Wood", "Other"]
    
        messages = [{
                "role": "user",
                "content": [
                    {"image": f"data:{content_type};base64,{base64_image}"},
                    {"text": f"""Analyze this coastal waste photo. 
                    Return ONLY a JSON object with these exact fields:
                    1. "primary_waste": (string) Choose from: {', '.join(TAXONOMY_CATEGORIES)}
                    2. "sub_category": (string) Specific type like 'Bottle', 'Can', etc.
                    3. "severity": (string) 'LOW', 'MEDIUM', 'HIGH', or 'CRITICAL'
                    4. "description": (string) Brief description in English
                    5. "weight_kg": (float) Estimated weight
                    6. "items_count": (integer) How many waste items visible
                    7. "waste_distribution": (object) Count by type: {{"Plastic": 3, "Metal": 1, ...}}
                    8. "bounding_boxes": (array) Each with: "ymin" (in 0-1000 scale with height=1000), "xmin" (in 0-1000 scale with width=1000), "ymax" (in 0-1000 scale with height=1000), "xmax" (in 0-1000 scale with width=1000), "label"
                    """}
                ]
        }]
        
        response = MultiModalConversation.call(
            model='qwen-vl-plus',
            messages=messages
        )

        if response.status_code == 200:
                content_list = response.output.choices[0].message.content
                result_text = ""
                for item in content_list:
                    if isinstance(item, dict) and 'text' in item:
                        result_text = item['text']
                        break
    
                if not result_text:
                    result_text = str(content_list)
    
                result_text = result_text.replace('```json', '').replace('```', '').strip()
                qwen_result = json.loads(result_text)
            
                category_name = qwen_result.get("primary_waste", "Other")
                if category_name not in TAXONOMY_CATEGORIES:
                    category_name = "Other"
            
                sub_category_name = qwen_result.get("sub_category", None)
                unique_item_count = qwen_result.get("items_count", 0)
                waste_distribution = qwen_result.get("waste_distribution", {})
            
                boxes_data = qwen_result.get("bounding_boxes", [])
                boxes = []
                for box in boxes_data:
                    boxes.append(BoundingBox(
                        ymin=box.get("ymin", random.randint(100, 800)),
                        xmin=box.get("xmin", random.randint(100, 800)),
                        ymax=box.get("ymax", min(box.get("ymin", 100) + random.randint(50, 200), 1000)),
                        xmax=box.get("xmax", min(box.get("xmin", 100) + random.randint(50, 200), 1000)),
                        label=box.get("label", "")
                    ))
        
                if not boxes:
                    num_items = qwen_result.get("items_count", 1)
                    for _ in range(min(num_items, 3)):
                        ym = random.randint(100, 800)
                        xm = random.randint(100, 800)
                        boxes.append(BoundingBox(
                            ymin=ym, xmin=xm,
                            ymax=min(ym + random.randint(50, 200), 1000),
                            xmax=min(xm + random.randint(50, 200), 1000),
                            label=f"{category_name} ({sub_category_name})" if sub_category_name else category_name
                        ))
        
                result = DetectionResult(
                    wasteType=[category_name],
                    category=category_name,
                    subCategory=sub_category_name,
                    severity=qwen_result.get("severity", "MEDIUM"),
                    description=qwen_result.get("description", f"Detected {category_name} waste"),
                    estimatedWeightKg=round(qwen_result.get("weight_kg", random.uniform(0.5, 5.0)), 2),
                    cleanupPriority="High" if qwen_result.get("severity") in ["HIGH", "CRITICAL"] else "Medium",
                    boundingBoxes=boxes,
                    waste_distribution=waste_distribution,
                    unique_item_count=unique_item_count,
                    imageUrl=final_image_url, 
                    timestamp=datetime.now().isoformat()
                )
        else:
            raise Exception(f"Qwen API error: {response.code}")
        
    except Exception as e:
        print(f"Qwen API failed, falling back to mock: {e}")
        category_name = random.choice(list(TAXONOMY.keys()))
        sub_category_name = random.choice(TAXONOMY[category_name]) if TAXONOMY[category_name] else None    
        
        boxes = [BoundingBox(
            ymin=200, xmin=200, ymax=350, xmax=350, 
            label=f"{category_name} ({sub_category_name})" if sub_category_name else category_name
        )]

        result = DetectionResult(
            wasteType=[category_name],
            category=category_name,
            subCategory=sub_category_name,
            severity="MEDIUM",
            description=f"Detected {category_name} waste (Backup Mode).",
            estimatedWeightKg=round(random.uniform(0.5, 5.0), 2),
            cleanupPriority="Medium",
            boundingBoxes=boxes,
            imageUrl=final_image_url, 
            timestamp=datetime.now().isoformat()
        )
    
    return result

# --- SAVE FINAL REPORT ---
@app.post("/api/reports")
async def save_final_report(report_data: dict, user=Depends(require_auth)):
    """Save the final, user-edited report to Azure Cosmos DB."""
    report_id = report_data.get("id")
    existing = None
    if report_id:
        existing = get_report_document(report_id)
        if existing:
            owner_id = existing.get("user_id")
            if owner_id and owner_id != str(user.id):
                raise HTTPException(status_code=403, detail="You can only update your own reports")

    report_data["user_id"] = str(user.id)
    
    success = save_report_to_cosmos(report_data, existing)
    if success:
        return {"status": "success", "message": "Report saved to Azure Cosmos DB"}
    raise HTTPException(status_code=500, detail="Failed to save report")

# --- DELETE REPORT ---
@app.delete("/api/reports/{report_id}")
async def delete_report(report_id: str, user=Depends(require_auth)):
    """Delete a report. Users can delete their own reports; legacy unowned reports are removable by logged-in users."""
    try:
        if cosmos_reports is None:
            raise HTTPException(status_code=500, detail="Azure Cosmos DB not configured")

        report = get_report_document(report_id)
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        
        report_user_id = report.get("user_id")
        if report_user_id and report_user_id != str(user.id):
            raise HTTPException(status_code=403, detail="You can only delete your own reports")
        
        # Delete the associated image from its storage provider.
        image_url = report.get("image_url", "")
        if image_url:
            try:
                delete_media_from_storage(image_url)
            except Exception as img_err:
                print(f"Warning: Could not delete image: {img_err}")
        
        cosmos_reports.delete_item(item=report_id, partition_key=report_user_id)
        return {"status": "success", "message": "Report deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- GET SINGLE REPORT ---
@app.get("/api/reports/{report_id}")
async def get_report(report_id: str):
    """Get a single report by ID."""
    try:
        row = get_report_document(report_id)
        if not row:
            raise HTTPException(status_code=404, detail="Report not found")

        username = "Anonymous"
        if row.get("user_id"):
            profile = get_profile_document(str(row.get("user_id")))
            if profile:
                username = profile.get("username") or profile.get("display_name") or username

        return report_document_to_api(row, username)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
