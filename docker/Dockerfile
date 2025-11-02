FROM python:3.11-slim

ENV HF_HOME=/cache/huggingface

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Create working directory
WORKDIR /app

# Copy and install dependencies
COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Copy code
COPY . .

# Pre-download the model during build
RUN python -c "from InstructorEmbedding import INSTRUCTOR; model = INSTRUCTOR('hkunlp/instructor-xl', device='cpu'); print('Model downloaded and cached during build')"

# Expose port
EXPOSE 8000

# Command to execute the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]