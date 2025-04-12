from fastapi import FastAPI, Request, HTTPException
from pydantic import BaseModel
from InstructorEmbedding import INSTRUCTOR
import threading
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()
model = None
model_loading = False
model_loaded = False

def load_model():
    global model, model_loading, model_loaded
    model_loading = True
    try:
        logger.info("Starting model loading...")
        model = INSTRUCTOR("hkunlp/instructor-xl")
        model_loaded = True
        logger.info("Model loaded successfully")
    except Exception as e:
        logger.error(f"Error loading model: {e}")
        model_loaded = False
    finally:
        model_loading = False

# Start model loading in background
threading.Thread(target=load_model, daemon=True).start()

class EmbedRequest(BaseModel):
    instruction: str
    text: str

class EmbedResponse(BaseModel):
    vector: list

@app.post("/embed", response_model=EmbedResponse)
async def embed(request: EmbedRequest):
    if not model_loaded:
        raise HTTPException(status_code=503, detail="Model is still loading")
    embedding = model.encode([[request.instruction, request.text]])
    return {"vector": embedding[0].tolist()}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/ready")
async def ready_check():
    if model_loading:
        return {"status": "loading", "message": "Model is still loading"}
    if model_loaded:
        return {"status": "ready", "message": "Model is loaded and ready"}
    return {"status": "error", "message": "Model failed to load"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 