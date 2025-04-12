from fastapi import FastAPI
from pydantic import BaseModel
import threading
import time
import logging
import os
from InstructorEmbedding import INSTRUCTOR

# Configure logs
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Global model state
model_state = {
    "status": "starting",  # starting, downloading, loading, warming_up, ready, error
    "progress": 0,
    "message": "Starting up...",
    "model": None
}

# Input of the endpoint
class VectorizeRequest(BaseModel):
    texts: list
    instructions: list

# Function to load the model
def load_model():
    try:
        model_state["status"] = "downloading"
        model_state["message"] = "Downloading model..."
        logger.info(model_state["message"])

        try:
            # Instance of the model with different initialization
            model = INSTRUCTOR('hkunlp/instructor-xl', device='cpu')
            logger.info("Model initialized successfully")
        except Exception as e:
            logger.error(f"Error during model initialization: {str(e)}")
            raise

        model_state["progress"] = 50
        model_state["status"] = "warming_up"
        model_state["message"] = "Warming up model..."
        logger.info(model_state["message"])

        try:
            test_text = "This is a test sentence"
            test_instruction = "Represent the following sentence for retrieval:"
            logger.info("Starting warm-up encoding")
            embeddings = model.encode(
                [
                    [test_text, test_instruction]
                ]
            )
            logger.info(f"Warm-up successful. Embedding shape: {embeddings.shape}")
        except Exception as e:
            logger.error(f"Error during warm-up: {str(e)}")
            raise

        model_state["progress"] = 100
        model_state["status"] = "ready"
        model_state["message"] = "Model is ready!"
        model_state["model"] = model

        logger.info(model_state["message"])

    except Exception as e:
        model_state["status"] = "error"
        model_state["message"] = f"Error loading model: {str(e)}"
        logger.error(model_state["message"])

# Load the model in background when the app starts
@app.on_event("startup")
def startup_event():
    threading.Thread(target=load_model, daemon=True).start()

@app.get("/")
async def root():
    return {"message": "Hello World"}

@app.get("/health")
async def health_check():
    return {
        "status": model_state["status"],
        "message": model_state["message"],
        "progress": model_state["progress"]
    }

@app.post("/vectorize")
async def vectorize(req: VectorizeRequest):
    if model_state["status"] != "ready":
        return {
            "error": "Model not ready",
            "status": model_state["status"],
            "message": model_state["message"]
        }
    embeddings = model_state["model"].encode([
        [req.texts, req.instructions]
    ])
    return {"embeddings": embeddings.tolist()}
