# Backend Dockerfile for L2VE
FROM python:3.12-slim

WORKDIR /app

# Use Korean mirror for faster downloads and configure apt
RUN echo 'Acquire::Retries "10";' > /etc/apt/apt.conf.d/80-retries && \
    echo 'Acquire::http::Timeout "300";' >> /etc/apt/apt.conf.d/80-retries && \
    echo 'Acquire::https::Timeout "300";' >> /etc/apt/apt.conf.d/80-retries && \
    echo "deb http://mirror.kakao.com/debian/ trixie main" > /etc/apt/sources.list.d/kakao.list && \
    echo "deb http://ftp.kr.debian.org/debian/ trixie main" >> /etc/apt/sources.list.d/korea.list

# Install system dependencies with multiple retries
RUN apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    (apt-get update || sleep 10 && apt-get update || sleep 30 && apt-get update) && \
    apt-get install -y --no-install-recommends \
        gcc \
        default-libmysqlclient-dev \
        pkg-config \
    && apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies with timeout and retry
RUN pip install --no-cache-dir --default-timeout=100 --retries 5 -r requirements.txt

# Copy application
COPY . .

# Expose port
EXPOSE 3000

# Run application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3000"]

