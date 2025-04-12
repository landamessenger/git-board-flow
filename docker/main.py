from fastapi import FastAPI, Request
from pydantic import BaseModel
from InstructorEmbedding import INSTRUCTOR

app = FastAPI()
model = INSTRUCTOR("hkunlp/instructor-xl")

class EmbedRequest(BaseModel):
    instruction: str
    text: str

class EmbedResponse(BaseModel):
    vector: list

@app.post("/embed", response_model=EmbedResponse)
async def embed(request: EmbedRequest):
    embedding = model.encode([[request.instruction, request.text]])
    return {"vector": embedding[0].tolist()}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 