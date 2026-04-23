# Deployment Guide

This API is ready to be deployed to any container-based cloud provider. Here are instructions for **Render**, a popular and easy-to-use option with a free tier.

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
    *   **Root Directory**: `ecowing-app/backend` (This is important! Point to where the Dockerfile is).
    *   **Runtime**: Select **Docker**.
    *   **Instance Type**: Free (if available/sufficient) or Starter.
6.  Click **Create Web Service**.

Render will automatically build your Docker image and deploy it. Once done, it will give you a URL like `https://ecowing-api.onrender.com`.

## Option 2: Deploy to Railway

1.  Sign up at [Railway.app](https://railway.app/).
2.  Click **"New Project"** -> **"Deploy from GitHub repo"**.
3.  Select your repo.
4.  Railway usually auto-detects the Dockerfile. If not, go to Settings -> Root Directory and set it to `ecowing-app/backend`.
5.  It should deploy automatically.

## Important Note on Data Persistence

**Warning**: These serverless/cloud platforms often have "ephemeral" filesystems. This means:
*   When the server restarts or redeploys, **`data.json` will be reset to empty!**
*   If you need to keep your history permanently, you should upgrade to use a real database (like PostgreSQL or MongoDB) instead of a JSON file.

For this prototype, the JSON file is fine, but just know that your scan history might disappear if the server restarts.
