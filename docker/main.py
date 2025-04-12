from fastapi import FastAPI, Request
from pydantic import BaseModel
from InstructorEmbedding import INSTRUCTOR
import threading

app = FastAPI()
model = None
model_loading = False
model_loaded = False

def load_model():
    global model, model_loading, model_loaded
    model_loading = True
    try:
        model = INSTRUCTOR("hkunlp/instructor-xl")
        model_loaded = True
    except Exception as e:
        print(f"Error loading model: {e}")
    finally:
        model_loading = False

# Start model loading in background
threading.Thread(target=load_model).start()

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