# Deployment Guide

This guide covers deploying AI Code Editor in various environments, from development to production.

## 📋 **Prerequisites**

### System Requirements
- **CPU**: 2+ cores (4+ recommended)
- **Memory**: 4GB RAM minimum (8GB+ recommended)
- **Storage**: 10GB free space (SSD recommended)
- **Network**: Stable internet connection for AI providers

### Software Requirements
- **Node.js**: 18.0.0 or higher
- **Python**: 3.11.0 or higher  
- **Git**: Latest version
- **Docker** (optional): For containerized deployment

## 🏃 **Quick Deployment**

### Development Deployment
```bash
# Clone and setup
git clone https://github.com/user/ai-code-editor.git
cd ai-code-editor
npm install
cd server && pip install -r requirements.txt && cd ..

# Start development servers
npm run dev
```

### Production Build
```bash
# Build for production
npm run quality:fix        # Fix any quality issues
npm run test               # Ensure all tests pass
npm run build:client       # Build React frontend
npm run build:electron     # Build Electron app
npm run dist               # Create distributables
```

## 🐳 **Docker Deployment**

### Single Container (Development)
```dockerfile
# Dockerfile.dev
FROM node:18-alpine

WORKDIR /app

# Install Python
RUN apk add --no-cache python3 py3-pip

# Copy and install dependencies
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/requirements.txt ./server/
RUN npm ci && cd client && npm ci && cd ..
RUN pip install -r server/requirements.txt

# Copy source code
COPY . .

# Expose ports
EXPOSE 8000 5173

# Start development servers
CMD ["npm", "run", "dev"]
```

```bash
# Build and run
docker build -f Dockerfile.dev -t ai-code-editor:dev .
docker run -p 8000:8000 -p 5173:5173 ai-code-editor:dev
```

### Multi-Stage Production Build
```dockerfile
# Dockerfile.prod
FROM node:18-alpine AS frontend-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci --only=production
COPY client/ ./
RUN npm run build

FROM python:3.11-alpine AS backend-builder
WORKDIR /app/server
COPY server/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY server/ ./

FROM node:18-alpine AS production
WORKDIR /app

# Install Python runtime
RUN apk add --no-cache python3 py3-pip

# Copy built frontend
COPY --from=frontend-builder /app/client/dist ./client/dist

# Copy backend with dependencies
COPY --from=backend-builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=backend-builder /app/server ./server

# Copy production package.json
COPY package*.json ./
RUN npm ci --only=production

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8000/health || exit 1

# Expose ports
EXPOSE 8000

# Start application
CMD ["npm", "run", "start:prod"]
```

### Docker Compose
```yaml
# docker-compose.yml
version: '3.8'

services:
  ai-code-editor:
    build:
      context: .
      dockerfile: Dockerfile.prod
    ports:
      - "8000:8000"
      - "5173:5173"
    environment:
      - NODE_ENV=production
      - PYTHON_ENV=production
      - LOG_LEVEL=info
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Optional: Ollama service for local AI
  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    restart: unless-stopped

  # Optional: Redis for caching
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  ollama_data:
  redis_data:
```

```bash
# Deploy with Docker Compose
docker-compose up -d
docker-compose logs -f  # View logs
```

## ☸️ **Kubernetes Deployment**

### Kubernetes Manifests
```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: ai-code-editor
---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: ai-code-editor-config
  namespace: ai-code-editor
data:
  NODE_ENV: "production"
  PYTHON_ENV: "production"
  LOG_LEVEL: "info"
  CORS_ORIGINS: "https://your-domain.com"
---
# k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: ai-code-editor-secrets
  namespace: ai-code-editor
type: Opaque
data:
  OPENAI_API_KEY: <base64-encoded-key>
  ANTHROPIC_API_KEY: <base64-encoded-key>
  SECRET_KEY: <base64-encoded-secret>
---
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-code-editor
  namespace: ai-code-editor
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ai-code-editor
  template:
    metadata:
      labels:
        app: ai-code-editor
    spec:
      containers:
      - name: ai-code-editor
        image: ai-code-editor:latest
        ports:
        - containerPort: 8000
          name: api
        - containerPort: 5173
          name: frontend
        envFrom:
        - configMapRef:
            name: ai-code-editor-config
        - secretRef:
            name: ai-code-editor-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        volumeMounts:
        - name: data-volume
          mountPath: /app/data
        - name: logs-volume
          mountPath: /app/logs
      volumes:
      - name: data-volume
        persistentVolumeClaim:
          claimName: ai-code-editor-data
      - name: logs-volume
        persistentVolumeClaim:
          claimName: ai-code-editor-logs
---
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: ai-code-editor-service
  namespace: ai-code-editor
spec:
  selector:
    app: ai-code-editor
  ports:
  - name: api
    port: 8000
    targetPort: 8000
    protocol: TCP
  - name: frontend
    port: 5173
    targetPort: 5173
    protocol: TCP
  type: ClusterIP
---
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ai-code-editor-ingress
  namespace: ai-code-editor
  annotations:
    kubernetes.io/ingress.class: "nginx"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - your-domain.com
    secretName: ai-code-editor-tls
  rules:
  - host: your-domain.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: ai-code-editor-service
            port:
              number: 8000
      - path: /
        pathType: Prefix
        backend:
          service:
            name: ai-code-editor-service
            port:
              number: 5173
---
# k8s/pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: ai-code-editor-data
  namespace: ai-code-editor
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: ai-code-editor-logs
  namespace: ai-code-editor
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
```

### Deploy to Kubernetes
```bash
# Apply manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n ai-code-editor
kubectl logs -f deployment/ai-code-editor -n ai-code-editor

# Scale deployment
kubectl scale deployment ai-code-editor --replicas=5 -n ai-code-editor

# Update deployment
kubectl set image deployment/ai-code-editor ai-code-editor=ai-code-editor:v1.1.0 -n ai-code-editor
```

## 🌐 **Cloud Deployment**

### AWS ECS with Fargate
```json
{
  "family": "ai-code-editor",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::account:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "ai-code-editor",
      "image": "your-account.dkr.ecr.region.amazonaws.com/ai-code-editor:latest",
      "portMappings": [
        {
          "containerPort": 8000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "OPENAI_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:openai-key"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/ai-code-editor",
          "awslogs-region": "us-west-2",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": [
          "CMD-SHELL",
          "curl -f http://localhost:8000/health || exit 1"
        ],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

### Google Cloud Run
```yaml
# cloudrun.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: ai-code-editor
  annotations:
    run.googleapis.com/ingress: all
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/maxScale: "10"
        run.googleapis.com/memory: "2Gi"
        run.googleapis.com/cpu: "2"
    spec:
      containerConcurrency: 80
      timeoutSeconds: 300
      containers:
      - image: gcr.io/project-id/ai-code-editor:latest
        ports:
        - containerPort: 8000
        env:
        - name: NODE_ENV
          value: "production"
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: openai-secret
              key: api-key
        resources:
          limits:
            memory: "2Gi"
            cpu: "2000m"
          requests:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
```

```bash
# Deploy to Cloud Run
gcloud run deploy ai-code-editor \
  --image gcr.io/project-id/ai-code-editor:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --max-instances 10
```

## 🔧 **Environment Configuration**

### Production Environment Variables
```bash
# Application Settings
NODE_ENV=production
PYTHON_ENV=production
LOG_LEVEL=info
DEBUG=false

# Security Settings
SECRET_KEY=your-secure-secret-key-here
CORS_ORIGINS=https://your-domain.com,https://app.your-domain.com
ALLOWED_HOSTS=your-domain.com,app.your-domain.com

# AI Provider Configuration
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
OLLAMA_HOST=http://ollama:11434

# Database Configuration (if applicable)
DATABASE_URL=postgresql://user:password@localhost:5432/ai_code_editor
REDIS_URL=redis://localhost:6379/0

# Performance Settings
MAX_REQUEST_SIZE=10MB
RATE_LIMIT=100/minute
CACHE_TTL=3600
WORKER_PROCESSES=4

# Monitoring Configuration
SENTRY_DSN=your-sentry-dsn
PROMETHEUS_ENABLED=true
METRICS_PORT=9090

# Feature Flags
ENABLE_AI_FEATURES=true
ENABLE_GITHUB_INTEGRATION=true
ENABLE_PERFORMANCE_MONITORING=true
```

### Configuration File
```json
{
  "server": {
    "host": "0.0.0.0",
    "port": 8000,
    "workers": 4,
    "timeout": 30,
    "keepalive": 2
  },
  "security": {
    "cors_origins": ["https://your-domain.com"],
    "max_request_size": "10MB",
    "rate_limit": "100/minute",
    "enable_csrf": true
  },
  "ai": {
    "default_provider": "ollama",
    "providers": {
      "ollama": {
        "enabled": true,
        "host": "http://localhost:11434",
        "models": ["deepseek-coder:latest", "dolphin-phi:latest"]
      },
      "openai": {
        "enabled": true,
        "api_key": "${OPENAI_API_KEY}",
        "models": ["gpt-4o-mini", "gpt-4"]
      }
    }
  },
  "monitoring": {
    "enabled": true,
    "metrics_endpoint": "/metrics",
    "health_endpoint": "/health",
    "performance_monitoring": true
  },
  "logging": {
    "level": "info",
    "format": "json",
    "output": "stdout",
    "file": "/app/logs/app.log"
  }
}
```

## 📈 **Performance Optimization**

### Production Optimizations
```bash
# Build optimizations
npm run build:client -- --mode production
npm run build:electron -- --mode production

# Python optimizations
export PYTHONOPTIMIZE=2
export PYTHONDONTWRITEBYTECODE=1

# Node.js optimizations
export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=4096"
```

### Nginx Configuration
```nginx
# nginx.conf
upstream ai_code_editor {
    server 127.0.0.1:8000;
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=1r/s;

    # Static files
    location /static/ {
        alias /app/client/dist/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API routes
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://ai_code_editor;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # WebSocket support
    location /ws/ {
        proxy_pass http://ai_code_editor;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    # Frontend
    location / {
        try_files $uri $uri/ /index.html;
        root /app/client/dist/;
        index index.html;
    }
}
```

## 🔒 **Security Configuration**

### SSL/TLS Configuration
```bash
# Generate SSL certificate with Let's Encrypt
sudo apt update
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Firewall Configuration
```bash
# UFW (Ubuntu)
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw --force enable

# Fail2ban for intrusion prevention
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### Security Headers
```python
# security_middleware.py
from fastapi import Request, Response
from fastapi.middleware.base import BaseHTTPMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
        
        return response
```

## 📊 **Monitoring & Logging**

### Application Monitoring
```python
# monitoring.py
import logging
from prometheus_client import Counter, Histogram, Gauge, start_http_server

# Metrics
REQUEST_COUNT = Counter('requests_total', 'Total requests', ['method', 'endpoint'])
REQUEST_DURATION = Histogram('request_duration_seconds', 'Request duration')
ACTIVE_CONNECTIONS = Gauge('active_connections', 'Active WebSocket connections')

# Start metrics server
start_http_server(9090)
```

### Structured Logging
```python
# logging_config.py
import logging
import json
from datetime import datetime

class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_entry = {
            'timestamp': datetime.utcnow().isoformat(),
            'level': record.levelname,
            'message': record.getMessage(),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno
        }
        
        if hasattr(record, 'user_id'):
            log_entry['user_id'] = record.user_id
            
        if hasattr(record, 'request_id'):
            log_entry['request_id'] = record.request_id
            
        return json.dumps(log_entry)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    handlers=[logging.StreamHandler()],
    format='%(message)s'
)

for handler in logging.root.handlers:
    handler.setFormatter(JSONFormatter())
```

## 🚀 **Deployment Scripts**

### Automated Deployment Script
```bash
#!/bin/bash
# deploy.sh

set -e

# Configuration
APP_NAME="ai-code-editor"
VERSION=$(git describe --tags --always)
REGISTRY="your-registry.com"
NAMESPACE="ai-code-editor"

echo "🚀 Deploying $APP_NAME version $VERSION"

# Build and test
echo "📦 Building application..."
npm run quality:fix
npm run test
npm run build:client
npm run build:electron

# Build Docker image
echo "🐳 Building Docker image..."
docker build -t $REGISTRY/$APP_NAME:$VERSION .
docker build -t $REGISTRY/$APP_NAME:latest .

# Push to registry
echo "📤 Pushing to registry..."
docker push $REGISTRY/$APP_NAME:$VERSION
docker push $REGISTRY/$APP_NAME:latest

# Deploy to Kubernetes
echo "☸️ Deploying to Kubernetes..."
kubectl set image deployment/$APP_NAME $APP_NAME=$REGISTRY/$APP_NAME:$VERSION -n $NAMESPACE

# Wait for rollout
echo "⏳ Waiting for rollout to complete..."
kubectl rollout status deployment/$APP_NAME -n $NAMESPACE --timeout=300s

# Health check
echo "🏥 Performing health check..."
kubectl wait --for=condition=ready pod -l app=$APP_NAME -n $NAMESPACE --timeout=60s

echo "✅ Deployment completed successfully!"
echo "🌐 Application available at: https://your-domain.com"
```

### Zero-Downtime Deployment
```bash
#!/bin/bash
# zero-downtime-deploy.sh

set -e

APP_NAME="ai-code-editor"
NEW_VERSION=$1
CURRENT_VERSION=$(kubectl get deployment $APP_NAME -o jsonpath='{.spec.template.spec.containers[0].image}' | cut -d':' -f2)

echo "🔄 Rolling update from $CURRENT_VERSION to $NEW_VERSION"

# Update deployment
kubectl set image deployment/$APP_NAME $APP_NAME=your-registry.com/$APP_NAME:$NEW_VERSION

# Monitor rollout
kubectl rollout status deployment/$APP_NAME --watch=true

# Verify deployment
if kubectl rollout status deployment/$APP_NAME | grep -q "successfully rolled out"; then
    echo "✅ Deployment successful!"
    
    # Run smoke tests
    echo "🧪 Running smoke tests..."
    ./smoke-tests.sh
    
    if [ $? -eq 0 ]; then
        echo "✅ Smoke tests passed!"
    else
        echo "❌ Smoke tests failed! Rolling back..."
        kubectl rollout undo deployment/$APP_NAME
        exit 1
    fi
else
    echo "❌ Deployment failed! Rolling back..."
    kubectl rollout undo deployment/$APP_NAME
    exit 1
fi
```

## 📋 **Troubleshooting**

### Common Issues

#### Application Won't Start
```bash
# Check logs
docker logs ai-code-editor
kubectl logs deployment/ai-code-editor -n ai-code-editor

# Check ports
netstat -tlnp | grep :8000
ss -tlnp | grep :5173

# Check dependencies
npm list
pip list
```

#### Performance Issues
```bash
# Check resource usage
docker stats ai-code-editor
kubectl top pods -n ai-code-editor

# Check application metrics
curl http://localhost:8000/api/performance/summary
curl http://localhost:9090/metrics  # Prometheus metrics
```

#### Database Connection Issues
```bash
# Test database connection
python -c "import psycopg2; print('PostgreSQL connection OK')"
redis-cli ping

# Check connection strings
echo $DATABASE_URL
echo $REDIS_URL
```

### Health Checks
```bash
# Application health
curl http://localhost:8000/health

# Detailed health check
curl http://localhost:8000/api/performance/health

# Component health
curl http://localhost:8000/api/performance/system
```

---

**📞 Support**: For deployment issues, please check our [troubleshooting guide](TROUBLESHOOTING.md) or open an issue on GitHub.