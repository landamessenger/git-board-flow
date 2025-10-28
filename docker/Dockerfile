FROM python:3.11-slim

# ---- Configuración base ----
ENV HF_HOME=/cache/huggingface
WORKDIR /app

# ---- Sistema base ----
RUN apt-get update
RUN apt-get install -y --no-install-recommends git
RUN apt-get install -y --no-install-recommends gcc
RUN apt-get install -y --no-install-recommends python3-dev
RUN apt-get install -y --no-install-recommends libffi-dev
RUN apt-get install -y --no-install-recommends libssl-dev
RUN apt-get install -y --no-install-recommends curl
RUN apt-get install -y --no-install-recommends ca-certificates
RUN rm -rf /var/lib/apt/lists/*

# ---- Python base ----
COPY requirements.txt requirements.txt
RUN pip install --upgrade pip
RUN pip install wheel
RUN pip install setuptools
RUN pip install --no-cache-dir -r requirements.txt

# ---- Copiar código en varias capas ----
COPY . .

# ---- Cache del modelo ----
# Ejecuta la función load_model() para que descargue el modelo y lo deje cacheado
RUN python -c "from main import load_model; load_model()"
RUN echo 'Modelo descargado correctamente'
RUN ls -lh /cache/huggingface || true
RUN du -sh /cache/huggingface || true

# ---- Configuración final ----
EXPOSE 8000
RUN echo 'Puerto expuesto: 8000'

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
