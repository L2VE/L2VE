# Frontend Dockerfile for L2VE
# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Configure npm for better timeout handling
RUN npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-retries 3

# Copy package files
COPY package*.json ./

# Install dependencies with retry
RUN npm ci --prefer-offline --no-audit

# Copy source
COPY . .

# Build argument for API URL (docker-compose.yml에서 전달)
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# 빌드 시 확인용 로그
RUN echo "Building with API URL: ${VITE_API_BASE_URL}"

# Build app
RUN npm run build

# Stage 2: Production
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Ensure fonts directory exists and copy fonts explicitly
RUN mkdir -p /usr/share/nginx/html/fonts
COPY --from=builder /app/public/fonts /usr/share/nginx/html/fonts

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

