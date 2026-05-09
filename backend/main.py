import json
import random
import time
from typing import List, Optional, Dict
from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, Request, HTTPException, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from datetime import datetime
from PIL import Image
import io
import os
import requests
import base64
import re

# For Qwen API
import dashscope
from dashscope import MultiModalConversation

# Supabase
from supabase import create_client, Client

from dotenv import load_dotenv
import pathlib
load_dotenv(dotenv_path=pathlib.Path(__file__).parent / ".env", override=True)

app = FastAPI()
dashscope.api_key = os.getenv("QWEN_API_KEY", "")

# --- Supabase Client ---
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY) if SUPABASE_URL and SUPABASE_SERVICE_KEY else None

# Security scheme for JWT auth
security = HTTPBearer(auto_error=False)

def get_allowed_origins():
    origins = os.getenv("FRONTEND_ORIGINS", "").strip()
    if not origins:
        return ["*"]
    return [origin.strip().rstrip("/") for origin in origins.split(",") if origin.strip()]

def get_public_base_url(request: Request) -> str:
    public_base_url = os.getenv("PUBLIC_BACKEND_URL", "").strip().rstrip("/")
    if public_base_url:
        return public_base_url
    return str(request.base_url).rstrip("/")

# Allow CORS for frontend
# 刪除 get_allowed_origins 函數，直接使用寫死的陣列
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://ecowing.hk",
        "https://ecowing.hk",
        "https://www.ecowing.hk",
        "https://ecowing-main.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CREATE AND MOUNT UPLOADS DIRECTORY (kept as local fallback) ---
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

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

SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

# --- Auth Helpers ---
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Extract user from JWT token. Returns None if no token provided."""
    if not credentials or not supabase:
        return None
    try:
        token = credentials.credentials
        # Verify the token using Supabase
        user_response = supabase.auth.get_user(token)
        if user_response and user_response.user:
            return user_response.user
        return None
    except Exception as e:
        print(f"Auth error: {e}")
        return None

async def require_auth(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Require authentication. Raises 401 if not authenticated."""
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    try:
        token = credentials.credentials
        user_response = supabase.auth.get_user(token)
        if user_response and user_response.user:
            return user_response.user
        raise HTTPException(status_code=401, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")

# --- Supabase Storage Helper ---
def upload_image_to_supabase(file_bytes: bytes, filename: str, content_type: str, user_id: str = "anonymous") -> str:
    """Upload an image to Supabase Storage and return the public URL."""
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

# --- Supabase Data Helpers ---
def save_report_to_supabase(report_data: dict) -> bool:
    """Save a report to Supabase reports table."""
    if not supabase:
        return False
    try:
        # Map frontend field names to database column names
        db_record = {
            "id": report_data.get("id", f"RPT-{int(time.time() * 1000)}"),
            "user_id": report_data.get("user_id"),
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
        }
        
        # Remove None values so defaults kick in
        db_record = {k: v for k, v in db_record.items() if v is not None}
        
        supabase.table("reports").insert(db_record).execute()
        return True
    except Exception as e:
        print(f"Supabase save error: {e}")
        return False

def load_reports_from_supabase() -> list:
    """Load all reports from Supabase, ordered by newest first."""
    if not supabase:
        return []
    try:
        response = supabase.table("reports").select("*").order("created_at", desc=True).execute()
        
        # Map database column names back to frontend field names
        reports = []
        for row in response.data:
            report = {
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
                "latitude": float(row.get("latitude", 0)) if row.get("latitude") else None,
                "longitude": float(row.get("longitude", 0)) if row.get("longitude") else None,
                "locationName": row.get("location_name"),
                "verified": row.get("verified"),
                "message": row.get("message"),
                "status": row.get("status"),
                "timestamp": row.get("created_at"),
                "user_id": row.get("user_id"),
            }
            reports.append(report)
        
        return reports
    except Exception as e:
        print(f"Supabase load error: {e}")
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
    email: str
    password: str
    username: Optional[str] = "User"

class LoginRequest(BaseModel):
    email: str
    password: str

# --- Auth Endpoints ---
@app.post("/api/auth/signup")
async def sign_up(req: SignUpRequest):
    """Register a new user via Supabase Auth."""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    try:
        response = supabase.auth.sign_up({
            "email": req.email,
            "password": req.password,
            "options": {
                "data": {
                    "username": req.username
                }
            }
        })
        
        if response.user:
            return {
                "status": "success",
                "message": "User registered successfully",
                "user": {
                    "id": str(response.user.id),
                    "email": response.user.email,
                    "username": req.username,
                },
                "session": {
                    "access_token": response.session.access_token if response.session else None,
                    "refresh_token": response.session.refresh_token if response.session else None,
                } if response.session else None
            }
        else:
            raise HTTPException(status_code=400, detail="Registration failed")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/auth/login")
async def login(req: LoginRequest):
    """Log in with email and password."""
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    try:
        response = supabase.auth.sign_in_with_password({
            "email": req.email,
            "password": req.password,
        })
        
        if response.user and response.session:
            return {
                "status": "success",
                "user": {
                    "id": str(response.user.id),
                    "email": response.user.email,
                },
                "session": {
                    "access_token": response.session.access_token,
                    "refresh_token": response.session.refresh_token,
                    "expires_in": response.session.expires_in,
                }
            }
        else:
            raise HTTPException(status_code=401, detail="Invalid credentials")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

@app.get("/api/auth/me")
async def get_me(user=Depends(require_auth)):
    """Get current logged-in user info."""
    try:
        # Fetch profile from Supabase
        profile_response = supabase.table("profiles").select("*").eq("id", str(user.id)).single().execute()
        profile = profile_response.data if profile_response.data else {}
        
        return {
            "id": str(user.id),
            "email": user.email,
            "username": profile.get("username", "User"),
            "avatar": profile.get("avatar", "icon/default.png"),
            "created_at": profile.get("created_at"),
        }
    except Exception as e:
        return {
            "id": str(user.id),
            "email": user.email,
        }

@app.post("/api/auth/logout")
async def logout():
    """Log out (client should discard token)."""
    return {"status": "success", "message": "Logged out"}

# --- Endpoints ---
@app.get("/health")
def health_check():
    supabase_connected = supabase is not None
    return {
        "status": "ok",
        "supabase": "connected" if supabase_connected else "not configured"
    }

@app.get("/api/history")
def get_history():
    """Retrieve all saved reports from Supabase."""
    reports = load_reports_from_supabase()
    if reports:
        return reports
    # Fallback: if Supabase returns empty, it might just be empty
    return reports

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
    background_tasks: BackgroundTasks = BackgroundTasks(),
    user=Depends(get_current_user),
):
    result = None
    category_name = "Other"
    sub_category_name = None
    severity = "MEDIUM"
    waste_distribution = {}
    unique_item_count = 0
    boxes = []
    final_image_url = ""

    is_video = file.content_type.startswith('video/')
    
    try:
        if is_video:
            print(f"Video detected: {file.content_type}")
            raise Exception("Video processing temporarily disabled for stability")

        else:
            contents = await file.read()

            # --- SAVE THE FILE ---
            file_extension = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
            unique_filename = f"{int(time.time() * 1000)}{file_extension}"
            
            # Try uploading to Supabase Storage first
            user_id = str(user.id) if user else "anonymous"
            supabase_url = upload_image_to_supabase(
                contents, unique_filename, file.content_type, user_id
            )
            
            if supabase_url:
                final_image_url = supabase_url
                print(f"File uploaded to Supabase Storage: {final_image_url}")
            else:
                # Fallback to local storage
                file_path = os.path.join(UPLOAD_DIR, unique_filename)
                with open(file_path, "wb") as f:
                    f.write(contents)
                final_image_url = f"{get_public_base_url(request)}/uploads/{unique_filename}"
                print(f"File saved locally at: {file_path}")

            try:
                contents = compress_image_if_needed(contents)
            except Exception as compress_err:
                print(f"Compression warning: {compress_err}")

            base64_image = base64.b64encode(contents).decode('utf-8')
            TAXONOMY_CATEGORIES = ["Plastic", "Metal", "Glass", "Paper", "Fabric", "Rubber", "Wood", "Other"]
    
            messages = [{
                "role": "user",
                "content": [
                    {"image": f"data:{file.content_type};base64,{base64_image}"},
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
                for i, box in enumerate(boxes_data):
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
async def save_final_report(report_data: dict, user=Depends(get_current_user)):
    """Saves the final, user-edited report to Supabase."""
    # Attach user_id if authenticated
    if user:
        report_data["user_id"] = str(user.id)
    
    success = save_report_to_supabase(report_data)
    if success:
        return {"status": "success", "message": "Report saved to Supabase"}
    else:
        return {"status": "error", "message": "Failed to save report"}

# --- DELETE REPORT ---
@app.delete("/api/reports/{report_id}")
async def delete_report(report_id: str, user=Depends(get_current_user)):
    """Delete a report. Owner auth is required only for user-owned reports."""
    try:
        if not supabase:
            raise HTTPException(status_code=500, detail="Supabase not configured")

        # First check if the report belongs to a user.
        report_response = supabase.table("reports").select("user_id, image_url").eq("id", report_id).limit(1).execute()
        
        if not report_response.data:
            raise HTTPException(status_code=404, detail="Report not found")

        report = report_response.data[0]
        
        report_user_id = report.get("user_id")
        if report_user_id:
            if not user:
                raise HTTPException(status_code=401, detail="Authentication required")
            if report_user_id != str(user.id):
                raise HTTPException(status_code=403, detail="You can only delete your own reports")
        
        # Try to delete the associated image from Supabase Storage
        image_url = report.get("image_url", "")
        if image_url and "report-images" in image_url:
            try:
                # Extract the path from the URL
                # URL format: .../storage/v1/object/public/report-images/user_id/filename
                path_match = image_url.split("report-images/")
                if len(path_match) > 1:
                    storage_path = path_match[1]
                    supabase.storage.from_("report-images").remove([storage_path])
                    print(f"Deleted image from storage: {storage_path}")
            except Exception as img_err:
                print(f"Warning: Could not delete image: {img_err}")
        
        # Delete the report
        supabase.table("reports").delete().eq("id", report_id).execute()
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
        response = supabase.table("reports").select("*").eq("id", report_id).single().execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Report not found")
        
        row = response.data
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
            "latitude": float(row.get("latitude", 0)) if row.get("latitude") else None,
            "longitude": float(row.get("longitude", 0)) if row.get("longitude") else None,
            "locationName": row.get("location_name"),
            "verified": row.get("verified"),
            "message": row.get("message"),
            "status": row.get("status"),
            "timestamp": row.get("created_at"),
            "user_id": row.get("user_id"),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
