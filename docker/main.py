from fastapi import FastAPI
from pydantic import BaseModel
import threading
import time
import logging
import os
import multiprocessing
import psutil
from concurrent.futures import ThreadPoolExecutor
from InstructorEmbedding import INSTRUCTOR

# Configure logs
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

def get_system_resources():
    """Obtiene información sobre los recursos del sistema"""
    cpu_count = multiprocessing.cpu_count()
    memory = psutil.virtual_memory()
    return {
        "cpu_count": cpu_count,
        "memory_total": memory.total,
        "memory_available": memory.available
    }

def calculate_optimal_parameters(system_resources):
    """Calcula los parámetros óptimos basados en los recursos del sistema"""
    # Usamos el 75% de los núcleos disponibles para workers
    max_workers = max(1, int(system_resources["cpu_count"] * 0.75))
    
    # Calculamos el tamaño de chunk basado en la memoria disponible
    # Asumimos que cada embedding ocupa aproximadamente 1MB
    # y dejamos un margen de seguridad del 50%
    memory_per_chunk = 1024 * 1024  # 1MB por chunk
    available_chunks = int((system_resources["memory_available"] * 0.5) / memory_per_chunk)
    chunk_size = max(4, min(32, available_chunks // max_workers))
    
    logger.info(f"System resources: {system_resources}")
    logger.info(f"Calculated parameters - max_workers: {max_workers}, chunk_size: {chunk_size}")
    
    return max_workers, chunk_size

# Obtener recursos del sistema y calcular parámetros óptimos
system_resources = get_system_resources()
max_workers, chunk_size = calculate_optimal_parameters(system_resources)

# Global model state
model_state = {
    "status": "starting",  # starting, downloading, loading, warming_up, ready, error
    "progress": 0,
    "message": "Starting up...",
    "model": None,
    "executor": ThreadPoolExecutor(max_workers=max_workers),
    "chunk_size": chunk_size,
    "system_resources": system_resources
}

# Input of the endpoint
class VectorizeRequest(BaseModel):
    instructions: list[str]
    texts: list[str]

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
                    [test_instruction, test_text]
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

@app.post("/embed")
async def vectorize(req: VectorizeRequest):
    if model_state["status"] != "ready":
        return {
            "error": "Model not ready",
            "status": model_state["status"],
            "message": model_state["message"]
        }
    
    # Pair each text with its corresponding instruction
    pairs = [[instruction, text] for text, instruction in zip(req.instructions, req.texts)]
    
    # Dividir los pares en chunks para procesamiento paralelo
    chunks = [pairs[i:i + model_state["chunk_size"]] for i in range(0, len(pairs), model_state["chunk_size"])]
    
    # Procesar chunks en paralelo
    futures = []
    for chunk in chunks:
        future = model_state["executor"].submit(model_state["model"].encode, chunk)
        futures.append(future)
    
    # Recolectar resultados
    embeddings = []
    for future in futures:
        embeddings.extend(future.result().tolist())
    
    return {"embeddings": embeddings}

@app.get("/system-info")
async def get_system_info():
    """Endpoint para obtener información del sistema y parámetros actuales"""
    return {
        "system_resources": model_state["system_resources"],
        "parameters": {
            "max_workers": model_state["executor"]._max_workers,
            "chunk_size": model_state["chunk_size"]
        }
    }

@app.on_event("shutdown")
async def shutdown_event():
    model_state["executor"].shutdown(wait=True)
