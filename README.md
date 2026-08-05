# EcoWing

EcoWing is a React and FastAPI coastal-waste reporting system with image analysis, report history, interactive mapping, Supabase authentication/database persistence, and Azure Blob media storage.

## Prerequisites

- Node.js 20+
- Python 3.10+
- Supabase project credentials
- Azure Storage account and Blob container
- Qwen API key for image analysis

## Setup

```bash
npm install
python -m venv backend/.venv
```

Activate the Python environment, then install the backend dependencies:

```bash
pip install -r backend/requirements.txt
```

Copy `.env.example` to `.env` and `backend/.env.example` to `backend/.env`. Add the backend API, Supabase, Azure Storage, and allowed-origin values to `backend/.env`. Azure Storage uses managed identity or service-principal credentials by default; connection strings only work when shared-key access is enabled on the storage account.

## Run locally

Start the backend from the repository root:

```bash
python -m uvicorn backend.main:app --reload --port 8000
```

Start the frontend in another terminal:

```bash
npm run dev -- --host 127.0.0.1 --port 5174
```

Open `http://127.0.0.1:5174/`.

## Production build

```bash
npm run build
```

Deployment details for the API are in [backend/DEPLOY.md](backend/DEPLOY.md).
