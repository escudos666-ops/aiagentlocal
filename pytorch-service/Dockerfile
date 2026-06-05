FROM pytorch/pytorch:2.12.0-cuda12.6-cudnn9-devel

WORKDIR /app

# Install additional dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --break-system-packages -r requirements.txt

# Copy application code
COPY app.py .

EXPOSE 8888

# Run the inference server
CMD ["python", "app.py"]
