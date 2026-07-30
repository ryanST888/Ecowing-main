import json
import random
import time
import uuid
from typing import List, Optional, Dict
from fastapi import FastAPI, UploadFile, File, Form, Request, HTTPException, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from datetime import datetime
from PIL import Image, UnidentifiedImageError
import io
import os
import requests
import base64

# For Qwen API
import dashscope
from dashscope import MultiModalConversation

# Supabase
from supabase import create_client, Client

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
    public_url = upload_image_to_supabase(file_bytes, filename, content_type, user_id)
    if public_url:
        return public_url

    file_path = UPLOAD_DIR / filename
    with open(file_path, "wb") as local_file:
        local_file.write(file_bytes)
    return f"{get_public_base_url(request)}/uploads/{filename}"

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
        
        supabase.table("reports").upsert(db_record).execute()
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
        user_ids = [
            str(row.get("user_id"))
            for row in response.data
            if row.get("user_id")
        ]
        profile_map = {}

        if user_ids:
            try:
                profile_response = supabase.table("profiles").select("id, username").in_("id", user_ids).execute()
                profile_map = {
                    str(profile.get("id")): profile.get("username", "User")
                    for profile in profile_response.data
                }
            except Exception as profile_err:
                print(f"Supabase profile load warning: {profile_err}")
        
        # Map database column names back to frontend field names
        reports = []
        for row in response.data:
            user_id = row.get("user_id")
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
                "user_id": user_id,
                "username": profile_map.get(str(user_id), "Anonymous") if user_id else "Anonymous",
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
            try:
                supabase.table("profiles").upsert({
                    "id": str(response.user.id),
                    "username": req.username or "User",
                }).execute()
            except Exception as profile_err:
                print(f"Supabase profile save warning: {profile_err}")

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
            username = "User"
            try:
                profile_response = supabase.table("profiles").select("username").eq("id", str(response.user.id)).limit(1).execute()
                if profile_response.data:
                    username = profile_response.data[0].get("username") or username
                else:
                    metadata = getattr(response.user, "user_metadata", {}) or {}
                    username = metadata.get("username") or username
            except Exception as profile_err:
                print(f"Supabase profile login warning: {profile_err}")

            return {
                "status": "success",
                "user": {
                    "id": str(response.user.id),
                    "email": response.user.email,
                    "username": username,
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
        metadata = getattr(user, "user_metadata", {}) or {}
        return {
            "id": str(user.id),
            "email": user.email,
            "username": metadata.get("username", "User"),
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
    """Saves the final, user-edited report to Supabase."""
    report_id = report_data.get("id")
    if report_id:
        existing = supabase.table("reports").select("user_id").eq("id", report_id).limit(1).execute()
        if existing.data:
            owner_id = existing.data[0].get("user_id")
            if owner_id and owner_id != str(user.id):
                raise HTTPException(status_code=403, detail="You can only update your own reports")

    report_data["user_id"] = str(user.id)
    
    success = save_report_to_supabase(report_data)
    if success:
        return {"status": "success", "message": "Report saved to Supabase"}
    raise HTTPException(status_code=500, detail="Failed to save report")

# --- DELETE REPORT ---
@app.delete("/api/reports/{report_id}")
async def delete_report(report_id: str, user=Depends(require_auth)):
    """Delete a report. Users can delete their own reports; legacy unowned reports are removable by logged-in users."""
    try:
        if not supabase:
            raise HTTPException(status_code=500, detail="Supabase not configured")

        # First check if the report belongs to a user.
        report_response = supabase.table("reports").select("user_id, image_url").eq("id", report_id).limit(1).execute()
        
        if not report_response.data:
            raise HTTPException(status_code=404, detail="Report not found")

        report = report_response.data[0]
        
        report_user_id = report.get("user_id")
        if report_user_id and report_user_id != str(user.id):
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
        username = "Anonymous"
        if row.get("user_id"):
            try:
                profile_response = supabase.table("profiles").select("username").eq("id", str(row.get("user_id"))).limit(1).execute()
                if profile_response.data:
                    username = profile_response.data[0].get("username") or username
            except Exception as profile_err:
                print(f"Supabase profile load warning: {profile_err}")

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
            "username": username,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
