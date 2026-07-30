# Backend Deployment Guide

This API is ready to be deployed to any container-based cloud provider. Here are instructions for **Render**, a popular and easy-to-use option with a free tier.

## Environment Variables

Set these on the backend server:

```env
QWEN_API_KEY=your_qwen_api_key
PUBLIC_BACKEND_URL=https://your-backend-domain.example
FRONTEND_ORIGINS=https://your-frontend-domain.example
```

Set this on the frontend build:

```env
VITE_API_URL=https://your-backend-domain.example
```

## Option 1: Deploy to Render (Recommended)

1.  **Push your code to GitHub/GitLab**.
    *   Make sure your `ecowing/ecowing-app/backend` folder is in your repo.
2.  **Sign up/Log in to [Render.com](https://render.com/)**.
3.  Click **"New +"** and select **"Web Service"**.
4.  Connect your repository.
5.  **Configure the Service**:
    *   **Name**: `ecowing-api` (or whatever you like).
    *   **Region**: Choose one close to you.
    *   **Branch**: `main` (or your working branch).
    *   **Root Directory**: `backend` if this project folder is the repository root. If you push the parent folder instead, use `Ecowing-main-orin/backend`.
    *   **Runtime**: Select **Docker**.
    *   **Instance Type**: Free (if available/sufficient) or Starter.
    *   **Environment Variables**: Add the backend variables listed above.
6.  Click **Create Web Service**.

Render will automatically build your Docker image and deploy it. Once done, it will give you a URL like `https://ecowing-api.onrender.com`.

After the backend is deployed, update the frontend environment variable:

```env
VITE_API_URL=https://ecowing-api.onrender.com
```

## Option 2: Deploy to Railway

1.  Sign up at [Railway.app](https://railway.app/).
2.  Click **"New Project"** -> **"Deploy from GitHub repo"**.
3.  Select your repo.
4.  Railway usually auto-detects the Dockerfile. If not, go to Settings -> Root Directory and set it to `backend`.
5.  Add the backend environment variables listed above.
6.  It should deploy automatically.

## Option 3: Run on Your Own VPS

From the `backend` directory:

```bash
cp .env.example .env
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --proxy-headers
```

Then point your frontend to:

```env
VITE_API_URL=http://your-server-ip:8000
```

For production, put Nginx or another reverse proxy in front of it and use HTTPS.

## Data Persistence

Reports and primary images are stored in Supabase. The backend filesystem is only a fallback when storage upload fails; fallback files may disappear when a cloud instance restarts. Configure `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` for persistent operation.
