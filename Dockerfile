# Build Stage
FROM node:20-slim AS build-stage
WORKDIR /app
COPY dashboard/package*.json ./
RUN npm install
COPY dashboard/ ./
RUN npm run build

# Production Stage
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY run_page/ ./run_page/
COPY run_web.py .

# Copy frontend build
COPY --from=build-stage /app/dist ./run_page/static/dashboard

# Expose port and start
EXPOSE 8000
CMD ["python", "-m", "run_page.web_api"]
