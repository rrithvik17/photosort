import logging
import traceback
from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
import os
import shutil
import uuid
import zipfile
import json
from pathlib import Path
from ml_pipeline import generate_thumbnail, analyze_image, cluster_images

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("photosort_api")

app = FastAPI(title="Photosort API")
logger.info("Application started")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = Path(__file__).resolve().parent / "data" / "sessions"
DATA_DIR.mkdir(parents=True, exist_ok=True)

def get_session_dir(session_id: str) -> Path:
    try:
        return DATA_DIR / str(uuid.UUID(session_id))
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(status_code=400, detail="Invalid session ID")

class SessionStatus(BaseModel):
    session_id: str
    status: str
    progress: float
    message: str
    groups: list = []
    unique_photos: list = []
    blur_scores: dict = {}

session_store = {}

@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Incoming request: {request.method} {request.url}")
    try:
        response = await call_next(request)
        logger.info(f"Response status: {response.status_code}")
        return response
    except Exception as e:
        logger.error(f"Unhandled Exception: {str(e)}")
        logger.error(traceback.format_exc())
        return JSONResponse(status_code=500, content={"detail": f"Internal Server Error: {str(e)}"})

@app.post("/api/session/new")
async def create_session():
    try:
        logger.info("Creating new session")
        session_id = str(uuid.uuid4())
        session_dir = get_session_dir(session_id)
        (session_dir / "originals").mkdir(parents=True, exist_ok=True)
        (session_dir / "thumbnails").mkdir(parents=True, exist_ok=True)
        
        session_store[session_id] = {
            "status": "uploading",
            "progress": 0.0,
            "message": "Waiting for uploads...",
            "groups": [],
            "unique_photos": [],
            "blur_scores": {}
        }
        logger.info(f"Session created: {session_id}")
        return {"session_id": session_id}
    except Exception as e:
        logger.error(f"Error in create_session: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/upload/{session_id}")
async def upload_image(session_id: str, file: UploadFile = File(...)):
    try:
        logger.info(f"Upload called for session {session_id}, file: {file.filename}")
        if session_id not in session_store:
            logger.warning(f"Session {session_id} not found during upload")
            raise HTTPException(status_code=404, detail="Session not found")
            
        session_dir = get_session_dir(session_id) / "originals"
        filename = Path(file.filename or "").name
        if not filename or filename in {".", ".."}:
            raise HTTPException(status_code=400, detail="Invalid filename")
        file_path = session_dir / filename
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        logger.info(f"File {file.filename} saved successfully")
        return {"filename": file.filename, "status": "uploaded"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in upload_image: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

def process_session_background(session_id: str):
    logger.info(f"Background analysis started for session {session_id}")
    session_dir = get_session_dir(session_id)
    originals_dir = session_dir / "originals"
    thumbnails_dir = session_dir / "thumbnails"
    
    try:
        session_store[session_id]["status"] = "processing"
        
        images = os.listdir(originals_dir)
        total = len(images)
        if total == 0:
            logger.info("No images to process")
            session_store[session_id]["status"] = "completed"
            session_store[session_id]["message"] = "No images to process."
            return

        features = {}
        blur_scores = {}
        
        for idx, filename in enumerate(images):
            logger.info(f"Processing {idx+1}/{total}: {filename}")
            session_store[session_id]["progress"] = (idx / total) * 0.8
            session_store[session_id]["message"] = f"Processing {idx+1}/{total}: {filename}"
            
            orig_path = os.path.join(originals_dir, filename)
            thumb_path = os.path.join(thumbnails_dir, filename)
            
            generate_thumbnail(orig_path, thumb_path)
            
            vec, quality = analyze_image(thumb_path)
            blur_scores[filename] = quality
            
            if vec is not None:
                features[filename] = vec

        logger.info("Clustering images")
        session_store[session_id]["message"] = "Clustering images..."
        session_store[session_id]["progress"] = 0.9
        
        groups, unique_photos = cluster_images(features)
        
        session_store[session_id]["groups"] = groups
        session_store[session_id]["unique_photos"] = unique_photos
        session_store[session_id]["blur_scores"] = blur_scores
        
        logger.info("Saving results to disk")
        with open(session_dir / "results.json", "w") as f:
            json.dump({
                "groups": groups,
                "unique_photos": unique_photos,
                "blur_scores": blur_scores
            }, f)
            
        session_store[session_id]["status"] = "completed"
        session_store[session_id]["progress"] = 1.0
        session_store[session_id]["message"] = "Processing complete."
        logger.info("Background analysis completed successfully")
        
    except Exception as e:
        session_store[session_id]["status"] = "error"
        session_store[session_id]["message"] = str(e)
        logger.error(f"Error processing session {session_id}: {e}")
        logger.error(traceback.format_exc())

@app.post("/api/analyze/{session_id}")
async def start_analysis(session_id: str, background_tasks: BackgroundTasks):
    try:
        logger.info(f"Start analysis called for session {session_id}")
        if session_id not in session_store:
            logger.warning(f"Session {session_id} not found during start_analysis")
            raise HTTPException(status_code=404, detail="Session not found")
            
        background_tasks.add_task(process_session_background, session_id)
        return {"message": "Analysis started"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in start_analysis: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/status/{session_id}")
async def get_status(session_id: str):
    try:
        if session_id not in session_store:
            raise HTTPException(status_code=404, detail="Session not found")
        return session_store[session_id]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_status: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/results/{session_id}")
async def get_results(session_id: str):
    try:
        logger.info(f"Fetching results for session {session_id}")
        results_file = get_session_dir(session_id) / "results.json"
        
        if not os.path.exists(results_file):
            logger.warning(f"Results file not found for session {session_id}")
            raise HTTPException(status_code=404, detail="Results not found. Processing may have failed.")
            
        with open(results_file, "r") as f:
            data = json.load(f)
        return data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_results: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/thumbnail/{session_id}/{filename}")
async def get_thumbnail(session_id: str, filename: str):
    try:
        safe_filename = Path(filename).name
        if safe_filename != filename:
            raise HTTPException(status_code=400, detail="Invalid filename")
        thumb_path = get_session_dir(session_id) / "thumbnails" / safe_filename
        if os.path.exists(thumb_path):
            return FileResponse(thumb_path)
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_thumbnail: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

class DownloadRequest(BaseModel):
    keepers: list[str]

@app.post("/api/download/{session_id}")
async def download_keepers(session_id: str, req: DownloadRequest):
    try:
        logger.info(f"Download called for session {session_id}")
        session_dir = get_session_dir(session_id)
        originals_dir = session_dir / "originals"
        zip_path = session_dir / "photosort_export.zip"
        
        with zipfile.ZipFile(zip_path, 'w') as zipf:
            for filename in req.keepers:
                safe_filename = Path(filename).name
                if safe_filename != filename:
                    continue
                file_path = originals_dir / safe_filename
                if os.path.exists(file_path):
                    zipf.write(file_path, arcname=safe_filename)
                    
        return FileResponse(zip_path, media_type="application/zip", filename="photosort_export.zip")
    except Exception as e:
        logger.error(f"Error in download_keepers: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
