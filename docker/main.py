from fastapi import FastAPI
from pydantic import BaseModel
import threading
import time
import logging
from instructor_emb import INSTRUCTOR

# configure logs for the action
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# global variable to store the model state
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

# Background thread to load the model
def load_model():
    try:
        model_state["status"] = "downloading"
        model_state["message"] = "Downloading model..."
        logger.info(model_state["message"])

        model = INSTRUCTOR("hkunlp/instructor-xl")

        model_state["progress"] = 50
        model_state["status"] = "warming_up"
        model_state["message"] = "Warming up model..."
        logger.info(model_state["message"])

        # Warm-up of the model
        model.encode(["Warm-up input"], [["Instruction for warm-up"]])

        model_state["progress"] = 100
        model_state["status"] = "ready"
        model_state["message"] = "Model is ready!"
        model_state["model"] = model

        logger.info(model_state["message"])

    except Exception as e:
        model_state["status"] = "error"
        model_state["message"] = f"Error loading model: {str(e)}"
        logger.error(model_state["message"])

# Launch model loading in background
threading.Thread(target=load_model, daemon=True).start()

@app.get("/")
async def root():
    return {"message": "Hello World"}

@app.get("/health")
async def health_check():
    return {"status": model_state["status"], "message": model_state["message"], "progress": model_state["progress"]}

@app.post("/vectorize")
async def vectorize(req: VectorizeRequest):
    if model_state["status"] != "ready":
        return {"error": "Model not ready", "status": model_state["status"], "message": model_state["message"]}
    embeddings = model_state["model"].encode(req.texts, req.instructions)
    return {"embeddings": embeddings.tolist()}
