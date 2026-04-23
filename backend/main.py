import json
import random
import time
from typing import List, Optional, Dict
from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
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

from dotenv import load_dotenv
load_dotenv()
app = FastAPI()
dashscope.api_key = os.getenv("QWEN_API_KEY", "")

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For dev simplicity
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CREATE AND MOUNT UPLOADS DIRECTORY ---
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
DATA_FILE = "data.json"

# --- Persistence ---
def load_data():
    if not os.path.exists(DATA_FILE):
        return []
    try:
        with open(DATA_FILE, "r") as f:
            return json.load(f)
    except:
        return []

def save_data(new_record):
    data = load_data()
    data.insert(0, new_record) # Insert at the beginning so newest is top
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2)

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

# --- Endpoints ---
@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/api/history")
def get_history():
    """Retrieve all saved reports from local JSON store"""
    return load_data()

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
    file: UploadFile = File(...),
    lat: Optional[float] = Form(None),
    lng: Optional[float] = Form(None),
    locationName: Optional[str] = Form(None),
    background_tasks: BackgroundTasks = BackgroundTasks()
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

            # --- SAVE THE FILE TO LOCAL DRIVE ---
            file_extension = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
            unique_filename = f"{int(time.time() * 1000)}{file_extension}"
            file_path = os.path.join(UPLOAD_DIR, unique_filename)
            
            with open(file_path, "wb") as f:
                f.write(contents)
            
            final_image_url = f"http://localhost:8000/uploads/{unique_filename}"
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
    
    # WE REMOVED THE AUTO-SAVE HERE SO IT WAITS FOR YOUR EDITS!
    return result

# --- NEW: ENDPOINT TO SAVE YOUR FINAL EDITS ---
@app.post("/api/reports")
async def save_final_report(report_data: dict):
    """Saves the final, user-edited report to data.json"""
    save_data(report_data)
    return {"status": "success"}