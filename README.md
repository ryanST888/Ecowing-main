<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1oOziLY2BeAfvcbmm4QnVOcpoaxFEiTNk

## Quick Start for New Developers

**1. Clone the repo:**
```bash
git clone <your-repo-url>
cd ecowing-app
```

**2. One-Time Setup:**
```bash
# Frontend
npm install

# Backend
cd backend
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts/activate
pip install -r requirements.txt
cd ..
```

**3. Setup API Key:**
Copy `.env.example` to `.env` and paste the API key (ask the admin for it).
```bash
cp .env.example .env
```

**4. Run the App:**
```bash
# Terminal 1: Frontend
npm run dev

# Terminal 2: Backend
cd backend
source venv/bin/activate
uvicorn main:app --reload
```

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `VITE_GEMINI_API_KEY` in [.env](.env) to your Gemini API key
3. Run the app:
   `npm run dev`
