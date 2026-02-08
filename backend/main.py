import json
import random
import time
from typing import List, Optional, Dict
from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
from PIL import Image
import io
import os
import requests

# Video handling
import cv2
import numpy as np
import tempfile

# For Qwen API
import dashscope
from dashscope import MultiModalConversation
import base64
import re

import os
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

# --- Data Structures ---

# Level 1 Taxonomy with potential Level 2 examples for future proofing
# The mock logic will select a random Category and a random SubCategory from it
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
    data.append(new_record)
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
    wasteType: List[str] # Kept for compatibility, can be deprecated later
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
    """Resolve shortened URLs (like maps.app.goo.gl) to get full coordinates"""
    try:
        response = requests.get(url, allow_redirects=True, timeout=5)
        return {"url": response.url}
    except Exception as e:
        return {"error": str(e)}
#for compress
def compress_image_if_needed(image_bytes, max_size_mb=9.5):
    """
    Check if image is > max_size_mb. If so, resize and compress until it fits.
    Target 9.5MB to be safe under the 10MB limit.
    """
    current_size = len(image_bytes)
    limit_bytes = max_size_mb * 1024 * 1024

    if current_size <= limit_bytes:
        return image_bytes  # No changes needed

    print(f"Compressing image: {current_size / (1024*1024):.2f}MB -> Target: {max_size_mb}MB")

    # Open the image from bytes
    img = Image.open(io.BytesIO(image_bytes))
    
    # Convert PNG/RGBA to RGB (JPEG doesn't support transparency)
    if img.mode in ('RGBA', 'P'):
        img = img.convert('RGB')

    # 1. Resize if dimensions are huge (larger than 1920px)
    # Most AI models don't need 4K resolution to detect trash
    if max(img.size) > 1920:
        img.thumbnail((1920, 1920))

    # 2. Lower quality loop
    # We start at 85% quality and go down until it fits
    quality = 85
    output = io.BytesIO()
    
    while quality > 10:
        output.seek(0)
        output.truncate(0) # Clear buffer
        img.save(output, format='JPEG', quality=quality)
        
        compressed_size = output.tell()
        if compressed_size <= limit_bytes:
            print(f"Compression success: {compressed_size / (1024*1024):.2f}MB at quality {quality}")
            return output.getvalue()
        
        quality -= 10 # Reduce quality step

    # If we get here, return the best we could do (even if slightly over, usually unlikely)
    return output.getvalue()
'''
@app.post("/api/detect")
async def detect_waste(
    file: UploadFile = File(...),
    lat: Optional[float] = Form(None),
    lng: Optional[float] = Form(None),
    locationName: Optional[str] = Form(None),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
'''
@app.post("/api/detect")
async def detect_waste(
    file: UploadFile = File(...),
    lat: Optional[float] = Form(None),
    lng: Optional[float] = Form(None),
    locationName: Optional[str] = Form(None),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    # 1. INITIALIZE VARIABLES (Prevents "UnboundLocalError")
    result = None
    category_name = "Other"
    sub_category_name = None
    severity = "MEDIUM"
    waste_distribution = {}
    unique_item_count = 0
    boxes = []

    # Check if it's a video
    is_video = file.content_type.startswith('video/')
    
    try:
        # --- VIDEO LOGIC (Simplified for stability) ---
        if is_video:
            print(f"Video detected: {file.content_type}")
            # For now, let's use the fallback logic for videos to prevent crashes
            # untill you implement the full video handling
            raise Exception("Video processing temporarily disabled for stability")

        # --- IMAGE LOGIC ---
        else:
            # Read file
            contents = await file.read()

            # COMPRESSION STEP (Crucial for preventing Timeouts)
            try:
                contents = compress_image_if_needed(contents)
            except Exception as compress_err:
                print(f"Compression skipped: {compress_err}")

            # Encode image for API
            base64_image = base64.b64encode(contents).decode('utf-8')
    
            # Define Taxonomy
            TAXONOMY_CATEGORIES = ["Plastic", "Metal", "Glass", "Paper", "Fabric", "Rubber", "Wood", "Other"]
    
            # Prepare Qwen API Request
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
                    8. "bounding_boxes": (array) Each with: "ymin", "xmin", "ymax", "xmax" (0-1000 scale), "label"
                    """}
                ]
            }]
        
            # Call Qwen API
            response = MultiModalConversation.call(
                model='qwen-vl-plus',
                messages=messages
            )
        
            if response.status_code == 200:
                # Parse Response
                content_list = response.output.choices[0].message.content
                result_text = ""
                for item in content_list:
                    if isinstance(item, dict) and 'text' in item:
                        result_text = item['text']
                        break
                
                # Clean and Parse JSON
                result_text = result_text.replace('```json', '').replace('```', '').strip()
                qwen_result = json.loads(result_text)
                
                # Extract Data
                category_name = qwen_result.get("primary_waste", "Other")
                sub_category_name = qwen_result.get("sub_category", None)
                unique_item_count = qwen_result.get("items_count", 1)
                waste_distribution = qwen_result.get("waste_distribution", {})
                
                # Extract Boxes
                boxes_data = qwen_result.get("bounding_boxes", [])
                for box in boxes_data:
                    boxes.append(BoundingBox(
                        ymin=box.get("ymin", 0),
                        xmin=box.get("xmin", 0),
                        ymax=box.get("ymax", 100),
                        xmax=box.get("xmax", 100),
                        label=box.get("label", category_name)
                    ))

                # Create Successful Result
                result = DetectionResult(
                    wasteType=[category_name],
                    category=category_name,
                    subCategory=sub_category_name,
                    severity=qwen_result.get("severity", "MEDIUM"),
                    description=qwen_result.get("description", f"Detected {category_name}"),
                    estimatedWeightKg=round(qwen_result.get("weight_kg", 1.0), 2),
                    cleanupPriority="High" if qwen_result.get("severity") in ["HIGH", "CRITICAL"] else "Medium",
                    boundingBoxes=boxes,
                    waste_distribution=waste_distribution,
                    unique_item_count=unique_item_count,
                    timestamp=datetime.now().isoformat()
                )
            else:
                raise Exception(f"API Error: {response.code} - {response.message}")

    except Exception as e:
        # --- THE SAFETY NET (This was missing before!) ---
        print(f"AI Detection failed ({e}). Switching to Mock Mode.")
        
        # 1. Pick random fallback data
        category_name = random.choice(list(TAXONOMY.keys()))
        sub_category_name = random.choice(TAXONOMY[category_name]) if TAXONOMY[category_name] else "Generic"
        
        # 2. Create fake boxes so the UI has something to show
        boxes = []
        for _ in range(random.randint(1, 2)):
            ym = random.randint(200, 600)
            xm = random.randint(200, 600)
            boxes.append(BoundingBox(
                ymin=ym, xmin=xm, 
                ymax=ym+150, xmax=xm+150, 
                label=category_name
            ))

        # 3. CRITICAL: Create the result object here
        result = DetectionResult(
            wasteType=[category_name],
            category=category_name,
            subCategory=sub_category_name,
            severity="MEDIUM",
            description=f"Detected {category_name} (Backup Mode: {str(e)[:50]}...)",
            estimatedWeightKg=1.5,
            cleanupPriority="Medium",
            boundingBoxes=boxes,
            waste_distribution={category_name: 1},
            unique_item_count=1,
            timestamp=datetime.now().isoformat()
        )

    # Save to database (Now guaranteed to work because result is never None)
    if result:
        record = result.dict()
        record["id"] = str(int(time.time() * 1000))
        record["lat"] = lat
        record["lng"] = lng
        record["locationName"] = locationName or "Unknown"
        record["verified"] = True 
        record["type"] = category_name
        
        background_tasks.add_task(save_data, record)

    return result

    # Check if it's a video
    is_video = file.content_type.startswith('video/')
    
    # Define variables at the start
    result = None
    category_name = "Other"
    sub_category_name = None
    severity = "MEDIUM"
    description = ""
    boxes = []
    
    try:
        if is_video:
            '''
            print(f"Video detected: {file.content_type}, analyzing frames...")
            
            # Save video temporarily
            import tempfile
            import cv2
            import numpy as np
            
            with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as tmp:
                content = await file.read()
                tmp.write(content)
                video_path = tmp.name
            
            # Extract 3 key frames
            cap = cv2.VideoCapture(video_path)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fps = cap.get(cv2.CAP_PROP_FPS) or 30
            
            frames_to_analyze = []
            frame_positions = []
            
            # Get frames at 0%, 50%, 90% of video
            for percent in [0, 0.5, 0.9]:
                frame_pos = int(total_frames * percent)
                cap.set(cv2.CAP_PROP_POS_FRAMES, frame_pos)
                ret, frame = cap.read()
                if ret:
                    # Convert to base64
                    _, buffer = cv2.imencode('.jpg', frame)
                    frame_base64 = base64.b64encode(buffer).decode('utf-8')
                    frames_to_analyze.append(frame_base64)
                    frame_positions.append(frame_pos)
            
            cap.release()
            os.unlink(video_path)  # Clean up
            
            # Analyze each frame with Qwen
            all_waste_items = []
            for i, frame_base64 in enumerate(frames_to_analyze):
                try:
                    print(f"Analyzing video frame {i+1}/{len(frames_to_analyze)}...")
                    
                    messages = [{
                        "role": "user",
                        "content": [
                            {"image": f"data:image/jpeg;base64,{frame_base64}"},
                            {"text": f"""Analyze this coastal waste photo from a video.
                            Return ONLY a JSON object with these exact fields:
                            1. "primary_waste": (string) Choose from: Plastic, Metal, Styrofoam, Cloth, Glass/Ceramic, Wood, Paper/Cardboard, Other
                            2. "sub_category": (string) Specific type like 'Bottle', 'Can', etc.
                            3. "severity": (string) 'LOW', 'MEDIUM', 'HIGH', or 'CRITICAL'
                            4. "description": (string) Brief description in English
                            5. "items_count": (integer) How many waste items visible
                            6. "bounding_boxes": (array) Each with: "ymin", "xmin", "ymax", "xmax" (0-1000 scale), "label"
                            """}
                        ]
                    }]
                    
                    response = MultiModalConversation.call(
                        model='qwen-vl-plus', 
                        messages=messages,
                        timeout=30
                    )

                    # Debug: Print raw response
                    print("Qwen RAW response:", response)
                    
                    if response.status_code == 200:
                        # Parse Qwen response
                        content_list = response.output.choices[0].message.content
                        result_text = ""
                        for item in content_list:
                            if isinstance(item, dict) and 'text' in item:
                                result_text = item['text']
                                break
                        
                        if result_text:
                            result_text = result_text.replace('```json', '').replace('```', '').strip()
                            frame_result = json.loads(result_text)
                            all_waste_items.append(frame_result)
                            
                except Exception as frame_error:
                    print(f"Frame {i+1} analysis failed: {frame_error}")
            
            # Combine results from all frames
            if all_waste_items:
                # Get most common waste type
                waste_types = [item.get("primary_waste", "Other") for item in all_waste_items]
                category_name = max(set(waste_types), key=waste_types.count)
                
                # Sum items count
                total_items = sum(item.get("items_count", 0) for item in all_waste_items)
                
                # Get highest severity
                severities = [item.get("severity", "MEDIUM") for item in all_waste_items]
                severity_order = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}
                severity = max(severities, key=lambda x: severity_order.get(x, 0))
                
                # Combine bounding boxes (take from first frame with boxes)
                for item in all_waste_items:
                    if item.get("bounding_boxes"):
                        boxes_data = item.get("bounding_boxes", [])
                        for box in boxes_data:
                            boxes.append(BoundingBox(
                                ymin=box.get("ymin", random.randint(100, 800)),
                                xmin=box.get("xmin", random.randint(100, 800)),
                                ymax=box.get("ymax", min(box.get("ymin", 100) + random.randint(50, 200), 1000)),
                                xmax=box.get("xmax", min(box.get("xmin", 100) + random.randint(50, 200), 1000)),
                                label=box.get("label", f"{category_name}")
                            ))
                        break
                
                description = f"Detected {total_items} waste items across {len(frames_to_analyze)} frames. Primary waste: {category_name}"
                
            else:
                # Fallback if all frames fail
                category_name = random.choice(list(TAXONOMY.keys()))
                sub_category_name = random.choice(TAXONOMY[category_name]) if TAXONOMY[category_name] else None
                severity = random.choice(SEVERITIES)
                description = f"Detected {category_name} waste."
            
            # If no boxes, create mock
            if not boxes:
                num_items = random.randint(1, 3)
                for _ in range(num_items):
                    ym = random.randint(100, 800)
                    xm = random.randint(100, 800)
                    boxes.append(BoundingBox(
                        ymin=ym,
                        xmin=xm,
                        ymax=min(ym + random.randint(50, 200), 1000),
                        xmax=min(xm + random.randint(50, 200), 1000),
                        label=f"{category_name} ({sub_category_name})" if sub_category_name else category_name
                    ))

            result = DetectionResult(
                wasteType=[category_name],
                category=category_name,
                subCategory=sub_category_name,
                severity=severity,
                description=description,
                estimatedWeightKg=round(random.uniform(0.5, 5.0), 2),
                cleanupPriority="High" if severity in ["HIGH", "CRITICAL"] else "Medium",
                boundingBoxes=boxes,
                timestamp=datetime.now().isoformat()
            )
            '''
            print(f"Video detected: {file.content_type}, using Qwen2.5-VL for direct video analysis...")
    
            try:
            # Save video temporarily
                import tempfile
            
                with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as tmp:
                    content = await file.read()
                    tmp.write(content)
                    video_path = tmp.name
        
                # Read video file as base64
                with open(video_path, 'rb') as video_file:
                    video_bytes = video_file.read()
                    video_base64 = base64.b64encode(video_bytes).decode('utf-8')
        
                # Clean up
                os.unlink(video_path)
        
                # Use Qwen2.5-VL with video
                messages = [{
                    "role": "user",
                    "content": [
                        {"video": f"data:{file.content_type};base64,{video_base64}"},
                        {"text": f"""Analyze this coastal waste drone video.

                        **INSTRUCTIONS:**
                        1. Identify ALL waste items throughout the ENTIRE video
                        2. Count each UNIQUE physical waste item ONLY ONCE (deduplicate across frames)
                        3. For each unique item, provide:
                        - Waste type (Plastic, Metal, Glass, Paper, Fabric, Rubber, Wood, Other)
                        - Specific subtype (Bottle, Can, Bag, etc.)
                        - When it appears in the video (timestamps or frame range)
                        - Confidence level (0-100%)

                        4. Overall assessment:
                        - Most common waste type
                        - Total unique item count
                        - Severity level (LOW, MEDIUM, HIGH, CRITICAL)
                        - Cleanup priority

                        Return ONLY a JSON object with these exact fields:
                        1. "unique_item_count": (integer) Total unique waste items
                        2. "primary_waste": (string) Most common type
                        3. "waste_distribution": (object) Count by type: {{"Plastic": 3, "Metal": 1, ...}}
                        4. "severity": (string) Overall severity
                        5. "description": (string) Analysis summary
                        6. "items": (array) List of unique items, each with:
                        - "type": (string) Waste type
                        - "subtype": (string) Specific type
                        - "appearance": (string) When seen (e.g., "0:05-0:15")
                        - "confidence": (integer) 0-100%
                        7. "sample_bounding_boxes": (array) Sample detections from clearest frame, each with:
                        - "ymin", "xmin", "ymax", "xmax" (0-1000 scale)
                        - "label": (string) Waste label
                        - "timestamp": (string) When detected
                        """
                        }
                    ]
                }]
        
                response = MultiModalConversation.call(
                    model='qwen2.5-vl-72b-instruct',  # Use video-capable model
                    messages=messages,
                    timeout=120  # Videos take longer
                )
        
                if response.status_code == 200:
                    # Parse response
                    content_list = response.output.choices[0].message.content
                    result_text = ""
                    for item in content_list:
                        if isinstance(item, dict) and 'text' in item:
                            result_text = item['text']
                            break
            
                    if result_text:
                        result_text = result_text.replace('```json', '').replace('```', '').strip()
                        video_result = json.loads(result_text)
                
                        print("Qwen2.5-VL video analysis result:", video_result)
                
                        # Extract data
                        unique_item_count = video_result.get("unique_item_count", 0)
                        category_name = video_result.get("primary_waste", "Other")
                        severity = video_result.get("severity", "MEDIUM")
                        description = video_result.get("description", 
                            f"Video analysis: {unique_item_count} unique waste items detected")
                        # [New] Count item in each type
                        waste_distribution = video_result.get("waste_distribution", {})
                        '''
                        # [New] Convert to standard format
                        standardized_dist = {}
                        for waste_type, count in waste_distribution.items():
                            # Standardize names
                            if 'Plastic' in waste_type.lower():
                                key = 'Plastic'
                            elif 'Metal' in waste_type.lower():
                                key = 'Metal'
                            elif 'Glass' in waste_type.lower() or 'Ceramic' in waste_type.lower():
                                key = 'Glass'
                            elif 'Paper' in waste_type.lower() or 'Cardboard' in waste_type.lower():
                                key = 'Paper'
                            elif 'Fabric' in waste_type.lower() or 'Cloth' in waste_type.lower():
                                key = 'Fabric'
                            elif 'Rubber' in waste_type.lower():
                                key = 'Rubber'
                            elif 'Wood' in waste_type.lower():
                                key = 'Wood'
                            else:
                                key = 'Other'
                            
                            standardized_dist[key] = standardized_dist.get(key, 0) + count
                        '''
                        # Create bounding boxes from sample detections
                        boxes_data = video_result.get("sample_bounding_boxes", [])
                        boxes = []
                        for box in boxes_data:
                            boxes.append(BoundingBox(
                                ymin=box.get("ymin", random.randint(100, 800)),
                                xmin=box.get("xmin", random.randint(100, 800)),
                                ymax=box.get("ymax", min(box.get("ymin", 100) + random.randint(50, 200), 1000)),
                                xmax=box.get("xmax", min(box.get("xmin", 100) + random.randint(50, 200), 1000)),
                                label=box.get("label", f"{category_name} (video)")
                            ))
                
                        # If no boxes, create based on item count
                        if not boxes and unique_item_count > 0:
                            for i in range(min(unique_item_count, 5)):
                                ym = random.randint(100, 800)
                                xm = random.randint(100, 800)
                                boxes.append(BoundingBox(
                                    ymin=ym,
                                    xmin=xm,
                                    ymax=min(ym + random.randint(50, 200), 1000),
                                    xmax=min(xm + random.randint(50, 200), 1000),
                                    label=f"{category_name} (video)"
                                ))
                
                        # Create result
                        result = DetectionResult(
                            wasteType=[category_name],
                            category=category_name,
                            subCategory=None,
                            severity=severity,
                            description=description,
                            estimatedWeightKg=round(random.uniform(0.5, 5.0) * max(1, unique_item_count), 2),
                            cleanupPriority="High" if severity in ["HIGH", "CRITICAL"] else "Medium",
                            boundingBoxes=boxes,
                            waste_distribution=waste_distribution,
                            unique_item_count=unique_item_count,
                            timestamp=datetime.now().isoformat()
                        )
                
                    else:
                        raise Exception("No text in Qwen response")
                else:
                    raise Exception(f"Qwen API error: {response.code}")
            
            except Exception as video_error:
                print(f"Qwen2.5-VL video analysis failed: {video_error}")
                # Fallback to frame extraction method
                print("Falling back to frame extraction method...")
        
        else:
            # Simulate processing delay
            time.sleep(0.5)

            '''
            # Mock AI Logic: Randomly select a category
            category_name = random.choice(list(TAXONOMY.keys()))
            sub_category_name = random.choice(TAXONOMY[category_name]) if TAXONOMY[category_name] else None
            severity = random.choice(SEVERITIES)
            '''
            '''
            # Qwen AI Logic
            # Read and encode image
            contents = await file.read()
            base64_image = base64.b64encode(contents).decode('utf-8')
    '''
    # Qwen AI Logic
            # Read file
            contents = await file.read()

            # --- NEW: COMPRESS IF TOO BIG ---
            try:
                contents = compress_image_if_needed(contents)
            except Exception as compress_err:
                print(f"Compression warning: {compress_err}")
                # If compression fails, we just proceed with original and hope for the best
            # --------------------------------

            # Encode image
            base64_image = base64.b64encode(contents).decode('utf-8')
            # Your existing taxonomy for categorization
            TAXONOMY_CATEGORIES = ["Plastic", "Metal", "Glass", "Paper", 
                        "Fabric", "Rubber", "Wood", "Other"]
    
            # Call Qwen API: Prompt
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
                
                Also detect individual waste items and return bounding boxes:
                8. "bounding_boxes": (array) Each with: "ymin" (in 0-1000 scale with height=1000), "xmin" (in 0-1000 scale with width=1000), "ymax" (in 0-1000 scale with height=1000), "xmax" (in 0-1000 scale with width=1000), "label"
                """}
                ]
            }
            ]
        
            response = MultiModalConversation.call(
                model='qwen-vl-plus',
                # model='qwen2.5-vl-72b-instruct',
                messages=messages
            )
        
            # Debug: Print raw response
            print("Qwen RAW response:", response)
        
            # Parse Qwen response
            # result_text = response.output.choices[0].message.content

            if response.status_code == 200:
                # Extract content from LIST format
                content_list = response.output.choices[0].message.content
            
                # Find the text item in the list
                result_text = ""
                for item in content_list:
                    if isinstance(item, dict) and 'text' in item:
                        result_text = item['text']
                        break
    
                if not result_text:
                    # Try alternative extraction
                    result_text = str(content_list)
    
                print("Extracted text:", result_text[:500])
    
                # Clean the JSON (remove ```json and ```)
                result_text = result_text.replace('```json', '').replace('```', '').strip()
    
                # Parse JSON
                qwen_result = json.loads(result_text)
    
                print("Parsed Qwen result:", qwen_result)
    
                # Now use qwen_result to create your DetectionResult...
    
            else:
                print(f"Qwen API error: {response.code} - {response.message}")
                raise Exception(f"Qwen API error: {response.code}")
        
            # Extract JSON from response (Qwen might add extra text)
            json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
            if not json_match:
                raise ValueError("No JSON found in response")
            
            qwen_result = json.loads(json_match.group())
        
            # Map Qwen response to your format
            category_name = qwen_result.get("primary_waste", "Other")
            if category_name not in TAXONOMY_CATEGORIES:
                category_name = "Other"
            
            sub_category_name = qwen_result.get("sub_category", None)
            unique_item_count=qwen_result.get("items_count", 0)
            waste_distribution = qwen_result.get("waste_distribution", {})
            
            # [New] Convert to standard format
            '''
            standardized_dist = {}
            for waste_type, count in waste_distribution.items():
                # Standardize names
                if 'Plastic' in waste_type.lower():
                    key = 'Plastic'
                elif 'Metal' in waste_type.lower():
                    key = 'Metal'
                elif 'Glass' in waste_type.lower() or 'Ceramic' in waste_type.lower():
                    key = 'Glass'
                elif 'Paper' in waste_type.lower() or 'Cardboard' in waste_type.lower():
                    key = 'Paper'
                elif 'Fabric' in waste_type.lower() or 'Cloth' in waste_type.lower():
                    key = 'Fabric'
                elif 'Rubber' in waste_type.lower():
                    key = 'Rubber'
                elif 'Wood' in waste_type.lower():
                    key = 'Wood'
                else:
                    key = 'Other'
                
                standardized_dist[key] = standardized_dist.get(key, 0) + count
            '''
            # Get or generate bounding boxes
            boxes_data = qwen_result.get("bounding_boxes", [])
            boxes = []
            for i, box in enumerate(boxes_data):
                boxes.append(BoundingBox(
                    ymin=box.get("ymin", random.randint(100, 800)),
                    xmin=box.get("xmin", random.randint(100, 800)),
                    ymax=box.get("ymax", min(box.get("ymin", 100) + random.randint(50, 200), 1000)),
                    xmax=box.get("xmax", min(box.get("xmin", 100) + random.randint(50, 200), 1000)),
                    label=box.get("label", "")
                    # label=f"{category_name} ({sub_category_name})" if sub_category_name else category_name
                ))
        
            # If no boxes from AI, create mock ones
            if not boxes:
                num_items = qwen_result.get("items_count", 1)
                for _ in range(min(num_items, 3)):
                    ym = random.randint(100, 800)
                    xm = random.randint(100, 800)
                    boxes.append(BoundingBox(
                        ymin=ym,
                        xmin=xm,
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
                timestamp=datetime.now().isoformat()
            )
        
    except Exception as e:
        print(f"Qwen API failed, falling back to mock: {e}")
        # Fallback to your original mock logic
        category_name = random.choice(list(TAXONOMY.keys()))
        sub_category_name = random.choice(TAXONOMY[category_name]) if TAXONOMY[category_name] else None    

    # Qwen code insersion ends here
    '''
    # Generate mock bounding boxes (1 or 2 items)
    boxes = []
    num_items = random.randint(1, 3)
    for _ in range(num_items):
        # Random coordinates 0-1000 normalized
        ym = random.randint(100, 800)
        xm = random.randint(100, 800)
        h = random.randint(50, 200)
        w = random.randint(50, 200)
        
        boxes.append(BoundingBox(
            ymin=ym,
            xmin=xm,
            ymax=min(ym+h, 1000),
            xmax=min(xm+w, 1000),
            label=f"{category_name} ({sub_category_name})" if sub_category_name else category_name
        ))

    result = DetectionResult(
        wasteType=[category_name],
        category=category_name,
        subCategory=sub_category_name,
        severity=severity,
        description=f"Detected {category_name} waste ({sub_category_name}) scattered in the area.",
        estimatedWeightKg=round(random.uniform(0.5, 5.0), 2),
        cleanupPriority="Medium" if severity == "MEDIUM" else "High",
        boundingBoxes=boxes,
        timestamp=datetime.now().isoformat()
    )
    '''
    
    # Persist data if location is provided
    record = result.dict()
    record["id"] = str(int(time.time() * 1000))
    record["lat"] = lat
    record["lng"] = lng
    record["locationName"] = locationName or "Unknown"
    record["verified"] = True # Auto-verify for mock
    record["type"] = category_name
    record["severity"] = severity
    record["waste_distribution"] = waste_distribution
    record["unique_item_count"] = unique_item_count

    # Debugging
    print(waste_distribution)
    print(unique_item_count)
    
    # Save asynchronously
    background_tasks.add_task(save_data, record)

    return result
