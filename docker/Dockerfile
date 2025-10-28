# ===== STAGE 1: Modelo compartido =====
FROM python:3.11-slim as model-base

# Define la ruta de cache huggingface
ENV HF_HOME=/cache/huggingface

# Instala dependencias mínimas para descargar el modelo
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Instala dependencias para descargar el modelo
RUN pip install --no-cache-dir huggingface-hub InstructorEmbedding

# Pre-descarga el modelo (layer compartida entre arquitecturas)
RUN python -c "from InstructorEmbedding import INSTRUCTOR; model = INSTRUCTOR('hkunlp/instructor-xl', device='cpu'); print('Model downloaded and cached')"

# ===== STAGE 2: Runtime específico =====
FROM python:3.11-slim as runtime

# Define la ruta de cache huggingface
ENV HF_HOME=/cache/huggingface

# Instala dependencias del sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    gcc \
    python3-dev \
    libffi-dev \
    libssl-dev \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Crea directorios
WORKDIR /app

# Copia dependencias e instala
COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install wheel
RUN pip install setuptools
RUN pip install --no-cache-dir -r requirements.txt

# Copia el modelo desde el stage anterior (layer compartida)
COPY --from=model-base /cache/huggingface /cache/huggingface

# Copia el código de la aplicación
COPY . .

# Expone el puerto de la API
EXPOSE 8000

# Comando para ejecutar la aplicación
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]