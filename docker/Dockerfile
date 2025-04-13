FROM python:3.11-slim

# Opcional: define la ruta de cache huggingface
ENV HF_HOME=/cache/huggingface

# Configuración de memoria para PyTorch
ENV PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512
ENV MAX_MEMORY=8g

# Instala dependencias necesarias
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    && rm -rf /var/lib/apt/lists/*

# Crea directorios
WORKDIR /app

# Copia dependencias e instala
COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Copia el código
COPY . .

# Pre-descarga el modelo durante la build
RUN python -c "from main import load_model; load_model()"

# Expone el puerto de la API
EXPOSE 8000

# Comando para ejecutar la aplicación
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
