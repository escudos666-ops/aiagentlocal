FROM python:3.11-slim

WORKDIR /app

# Copy requirements
COPY dashboard/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend service
COPY dashboard/backend.py .

# Copy frontend
COPY dashboard/index.html dashboard/
COPY dashboard/styles.css dashboard/
COPY dashboard/app.js dashboard/

EXPOSE 8080

CMD ["python", "backend.py"]
