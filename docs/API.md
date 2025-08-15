# API Documentation

Complete API reference for AI Code Editor backend services.

## 📖 **Overview**

The AI Code Editor provides a comprehensive REST API and WebSocket interface for code editing, AI integration, performance monitoring, and system management.

**Base URL**: `http://localhost:8000`  
**API Version**: `v1`  
**Documentation**: 
- Interactive Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- OpenAPI Spec: `http://localhost:8000/openapi.json`

## 🔐 **Authentication**

Currently, the API supports token-based authentication for protected endpoints.

```bash
# Example authenticated request
curl -H "Authorization: Bearer your-token" \
     http://localhost:8000/api/protected-endpoint
```

## 📊 **Rate Limiting**

API requests are rate-limited to prevent abuse:
- **Default**: 100 requests per minute per IP
- **AI Endpoints**: 10 requests per minute per IP
- **File Operations**: 50 requests per minute per IP

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## 🏥 **Health & Status**

### Health Check
```http
GET /health
```

**Response**:
```json
{
  "status": "ok",
  "service": "ai-code-editor",
  "version": "1.0.0",
  "timestamp": "2024-01-01T12:00:00Z",
  "uptime": 3600,
  "components": {
    "database": "ok",
    "ai_providers": "ok",
    "file_system": "ok"
  }
}
```

### System Status
```http
GET /system/status
```

**Response**:
```json
{
  "device": "cpu",
  "seed": 12345,
  "platform": "Windows-10",
  "python_version": "3.11.5",
  "node_version": "18.17.0"
}
```

## 🤖 **AI Integration**

### Route AI Request
Primary endpoint for AI interactions with automatic provider selection.

```http
POST /ai/route
Content-Type: application/json
```

**Request Body**:
```json
{
  "prompt": "Create a Python function to validate email addresses",
  "role": "completion",
  "provider": "ollama",
  "model": "deepseek-coder:latest",
  "temperature": 0.2,
  "max_tokens": 500,
  "cacheKey": "email-validation-function"
}
```

**Response**:
```json
{
  "provider": "ollama",
  "model": "deepseek-coder:latest",
  "content": "def validate_email(email: str) -> bool:\n    import re\n    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'\n    return bool(re.match(pattern, email))",
  "cached": false,
  "took_ms": 1250,
  "tokens_used": 45
}
```

**Error Response**:
```json
{
  "detail": "No provider succeeded (check keys or offline mode).",
  "status_code": 502,
  "error_code": "AI_PROVIDER_UNAVAILABLE"
}
```

### List AI Providers
```http
GET /ai/providers
```

**Response**:
```json
{
  "providers": ["ollama", "openai", "anthropic"],
  "default": "ollama",
  "status": {
    "ollama": {
      "available": true,
      "models": ["deepseek-coder:latest", "dolphin-phi:latest"],
      "response_time_ms": 45
    },
    "openai": {
      "available": true,
      "models": ["gpt-4o-mini", "gpt-4"],
      "response_time_ms": 120
    },
    "anthropic": {
      "available": false,
      "error": "API key not configured"
    }
  }
}
```

### AI Provider Health
```http
GET /ai/providers/{provider}/health
```

**Response**:
```json
{
  "provider": "ollama",
  "status": "healthy",
  "response_time_ms": 42,
  "available_models": 3,
  "last_check": "2024-01-01T12:00:00Z"
}
```

## 📊 **Performance Monitoring**

### System Metrics
```http
GET /api/performance/system
```

**Response**:
```json
{
  "cpu_percent": 25.5,
  "memory_usage_mb": 1024.0,
  "memory_percent": 12.5,
  "memory_available_mb": 7168.0,
  "disk_usage_percent": 45.2,
  "disk_free_gb": 128.5,
  "network_sent_mb": 125.3,
  "network_recv_mb": 89.7,
  "uptime_seconds": 86400,
  "load_average": [1.2, 1.5, 1.8],
  "process_count": 156,
  "boot_time": "2024-01-01T00:00:00Z"
}
```

### Performance Summary
```http
GET /api/performance/summary
```

**Response**:
```json
{
  "total_requests": 1500,
  "recent_requests": 45,
  "avg_response_time": 250.5,
  "median_response_time": 180.0,
  "p95_response_time": 850.0,
  "error_rate": 0.02,
  "current_memory_mb": 1024.0,
  "current_cpu_percent": 25.5,
  "slow_endpoints": {
    "POST /ai/route": {
      "avg_response_time": 1200,
      "max_response_time": 3500,
      "request_count": 150,
      "error_rate": 0.01
    }
  },
  "top_endpoints": [
    {
      "endpoint": "GET /api/performance/summary",
      "request_count": 300,
      "avg_response_time": 45.2
    }
  ]
}
```

### Detailed Metrics
```http
GET /api/performance/metrics?minutes=60
```

**Query Parameters**:
- `minutes` (int): Time period in minutes (1-1440)

**Response**:
```json
{
  "period_minutes": 60,
  "metric_count": 150,
  "metrics": [
    {
      "endpoint": "/api/ai/route",
      "method": "POST",
      "status_code": 200,
      "response_time_ms": 1250.5,
      "memory_usage_mb": 1024.0,
      "cpu_percent": 28.5,
      "timestamp": "2024-01-01T12:00:00Z",
      "request_size_bytes": 256,
      "response_size_bytes": 1024
    }
  ]
}
```

### Endpoint Statistics
```http
GET /api/performance/endpoints
```

**Response**:
```json
{
  "POST /ai/route": {
    "count": 150,
    "total_time": 187500.0,
    "min_time": 250.0,
    "max_time": 3500.0,
    "avg_response_time": 1250.0,
    "error_count": 2,
    "error_rate": 0.013,
    "avg_memory": 1024.0,
    "avg_cpu": 28.5,
    "requests_per_minute": 2.5
  }
}
```

### Performance Alerts
```http
GET /api/performance/alerts
```

**Response**:
```json
{
  "alert_count": 1,
  "alerts": [
    "High CPU usage: 85.2%"
  ],
  "thresholds": {
    "response_time_ms": 2000,
    "error_rate": 0.05,
    "memory_usage_mb": 1024,
    "cpu_percent": 80
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### Health Status
```http
GET /api/performance/health
```

**Response**:
```json
{
  "status": "healthy",
  "alerts": [],
  "metrics": {
    "avg_response_time": 250.5,
    "error_rate": 0.02,
    "memory_usage_mb": 1024.0,
    "cpu_percent": 25.5
  },
  "score": 85,
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### Trigger Optimization
```http
POST /api/performance/optimize
```

**Response**:
```json
{
  "status": "optimization_completed",
  "actions": [
    "garbage_collection",
    "metrics_cleanup",
    "stats_reset"
  ],
  "memory_freed_mb": 128.5,
  "metrics_cleaned": 500,
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 📁 **File Management**

### List Directory Contents
```http
GET /files/list?path=/project/src&recursive=false
```

**Query Parameters**:
- `path` (string): Directory path to list
- `recursive` (boolean): Include subdirectories

**Response**:
```json
{
  "path": "/project/src",
  "files": [
    {
      "name": "app.py",
      "type": "file",
      "size": 2048,
      "modified": "2024-01-01T12:00:00Z",
      "permissions": "rw-r--r--",
      "owner": "user",
      "language": "python"
    },
    {
      "name": "components",
      "type": "directory",
      "size": 4096,
      "modified": "2024-01-01T11:30:00Z",
      "file_count": 15
    }
  ],
  "total_files": 25,
  "total_size": 1048576
}
```

### Read File Content
```http
POST /files/read
Content-Type: application/json
```

**Request Body**:
```json
{
  "file_path": "/project/src/app.py",
  "encoding": "utf-8"
}
```

**Response**:
```json
{
  "content": "import fastapi\nfrom fastapi import FastAPI\n\napp = FastAPI()\n\n@app.get('/')\ndef read_root():\n    return {'Hello': 'World'}",
  "encoding": "utf-8",
  "size": 125,
  "lines": 8,
  "language": "python",
  "metadata": {
    "modified": "2024-01-01T12:00:00Z",
    "permissions": "rw-r--r--",
    "owner": "user"
  }
}
```

### Write File Content
```http
POST /files/write
Content-Type: application/json
```

**Request Body**:
```json
{
  "file_path": "/project/src/new_file.py",
  "content": "def hello_world():\n    print('Hello, World!')",
  "encoding": "utf-8",
  "create_directories": true
}
```

**Response**:
```json
{
  "status": "success",
  "file_path": "/project/src/new_file.py",
  "bytes_written": 45,
  "created": true,
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### File Search
```http
GET /files/search?query=function&path=/project&extensions=py,js
```

**Query Parameters**:
- `query` (string): Search term
- `path` (string): Search directory
- `extensions` (string): Comma-separated file extensions
- `case_sensitive` (boolean): Case sensitive search

**Response**:
```json
{
  "query": "function",
  "results": [
    {
      "file": "/project/src/utils.py",
      "matches": [
        {
          "line": 5,
          "content": "def utility_function():",
          "column": 4
        }
      ]
    }
  ],
  "total_matches": 12,
  "search_time_ms": 45
}
```

## 🔧 **System Management**

### Execute System Command
```http
POST /system/run
Content-Type: application/json
```

**Request Body**:
```json
{
  "cmd": "git",
  "args": ["status", "--porcelain"],
  "cwd": "/project",
  "dry": false,
  "timeout": 30
}
```

**Response**:
```json
{
  "ok": true,
  "code": 0,
  "out": " M app.py\n?? new_file.py",
  "execution_time_ms": 125,
  "command": "git status --porcelain",
  "cwd": "/project"
}
```

**Error Response**:
```json
{
  "ok": false,
  "code": 1,
  "out": "fatal: not a git repository",
  "error": "Command execution failed",
  "command": "git status --porcelain"
}
```

### Get Environment Info
```http
GET /system/environment
```

**Response**:
```json
{
  "platform": "Windows-10-10.0.19042-SP0",
  "python_version": "3.11.5",
  "node_version": "18.17.0",
  "cpu_count": 8,
  "total_memory_gb": 16.0,
  "available_memory_gb": 8.5,
  "disk_space_gb": 256.0,
  "environment_variables": {
    "NODE_ENV": "development",
    "PYTHON_ENV": "development"
  }
}
```

## 🔄 **Git Integration**

### Configure Git Settings
```http
POST /git/config
Content-Type: application/json
```

**Request Body**:
```json
{
  "repoPath": "/project",
  "branch": "main",
  "userName": "Developer",
  "userEmail": "dev@example.com",
  "autoSync": true,
  "ignoreGlobs": ["*.log", "*.tmp", "node_modules/**"]
}
```

**Response**:
```json
{
  "ok": true,
  "git": {
    "repoPath": "/project",
    "branch": "main", 
    "userName": "Developer",
    "userEmail": "dev@example.com",
    "autoSync": true,
    "ignoreGlobs": ["*.log", "*.tmp", "node_modules/**"]
  }
}
```

### Get Repository Status
```http
GET /git/status?repoPath=/project&branch=main
```

**Response**:
```json
{
  "branch": "main",
  "ahead": 2,
  "behind": 0,
  "changes": 5,
  "lastCommit": "abc123 feat: add new feature",
  "status": "clean",
  "modified_files": [
    "src/app.py",
    "README.md"
  ],
  "untracked_files": [
    "new_file.py"
  ],
  "remote_url": "https://github.com/user/repo.git"
}
```

### Push Changes
```http
POST /git/push
Content-Type: application/json
```

**Request Body**:
```json
{
  "repoPath": "/project",
  "message": "feat: implement new feature",
  "branch": "main",
  "dry": false
}
```

**Response**:
```json
{
  "ok": true,
  "out": "Pushed successfully to origin/main",
  "commit_hash": "abc123def456",
  "files_committed": 3,
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### Set GitHub Token
```http
POST /git/set_token
Content-Type: application/json
```

**Request Body**:
```json
{
  "token": "ghp_1234567890abcdef",
  "user": "username"
}
```

**Response**:
```json
{
  "ok": true,
  "message": "GitHub token configured successfully"
}
```

## 📊 **Code Analysis**

### Analyze File
```http
POST /api/analysis/file
Content-Type: application/json
```

**Request Body**:
```json
{
  "file_path": "/project/src/app.py",
  "analysis_type": "comprehensive",
  "include_security": true,
  "include_performance": true
}
```

**Response**:
```json
{
  "file_path": "/project/src/app.py",
  "language": "python",
  "analysis": {
    "lines_of_code": 125,
    "complexity": {
      "cyclomatic": 8,
      "cognitive": 12,
      "maintainability_index": 75
    },
    "quality_score": 8.5,
    "security_issues": [
      {
        "line": 45,
        "severity": "medium",
        "type": "hardcoded_secret",
        "message": "Potential hardcoded secret found",
        "suggestion": "Use environment variables for secrets"
      }
    ],
    "performance_suggestions": [
      {
        "line": 23,
        "type": "optimization",
        "message": "Consider using list comprehension",
        "impact": "minor"
      }
    ],
    "code_smells": [
      {
        "line": 67,
        "type": "long_method",
        "message": "Method too long (25 lines)",
        "suggestion": "Break into smaller methods"
      }
    ]
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### Analyze Project
```http
POST /api/analysis/project
Content-Type: application/json
```

**Request Body**:
```json
{
  "project_path": "/project",
  "languages": ["python", "typescript", "javascript"],
  "exclude_patterns": ["node_modules", "*.pyc", "__pycache__"]
}
```

**Response**:
```json
{
  "project_path": "/project",
  "summary": {
    "total_files": 156,
    "lines_of_code": 15420,
    "languages": {
      "python": 8500,
      "typescript": 4200,
      "javascript": 2720
    },
    "average_complexity": 6.8,
    "maintainability_index": 78,
    "technical_debt_hours": 24.5
  },
  "security_summary": {
    "total_issues": 12,
    "high_severity": 2,
    "medium_severity": 6,
    "low_severity": 4
  },
  "performance_summary": {
    "optimization_opportunities": 18,
    "potential_memory_leaks": 3,
    "slow_operations": 5
  },
  "top_issues": [
    {
      "file": "/project/src/auth.py",
      "line": 23,
      "severity": "high",
      "type": "sql_injection",
      "message": "Potential SQL injection vulnerability"
    }
  ]
}
```

### Get Project Metrics
```http
GET /api/analysis/project/metrics?project_path=/project
```

**Response**:
```json
{
  "metrics": {
    "code_quality": {
      "maintainability_index": 78.5,
      "complexity_average": 6.8,
      "duplication_percentage": 5.2,
      "test_coverage": 85.4
    },
    "security": {
      "vulnerability_count": 12,
      "security_score": 7.8,
      "critical_issues": 2
    },
    "performance": {
      "performance_score": 8.2,
      "optimization_opportunities": 18,
      "bottlenecks": 5
    },
    "documentation": {
      "documentation_coverage": 65.0,
      "comment_density": 15.2
    }
  },
  "trends": {
    "quality_trend": "improving",
    "security_trend": "stable",
    "performance_trend": "improving"
  }
}
```

## 🔌 **WebSocket API**

### AI Chat WebSocket
Connect to the AI chat WebSocket for real-time interactions.

**Endpoint**: `ws://localhost:8000/ws/ai`

#### Connection
```javascript
const ws = new WebSocket('ws://localhost:8000/ws/ai');

ws.onopen = () => {
    console.log('Connected to AI chat');
};

ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    handleMessage(message);
};

ws.onerror = (error) => {
    console.error('WebSocket error:', error);
};

ws.onclose = () => {
    console.log('Disconnected from AI chat');
};
```

#### Message Format
```typescript
interface WebSocketMessage {
  type: 'user' | 'assistant' | 'thinking' | 'error' | 'system';
  content: string;
  path?: string;
  metadata?: Record<string, any>;
  timestamp?: string;
}
```

#### Send User Message
```javascript
ws.send(JSON.stringify({
  type: 'user',
  content: 'Explain this React component and suggest improvements',
  path: '/project/src/components/Editor.tsx'
}));
```

#### Receive AI Response
```javascript
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'thinking':
      showThinking(message.content);
      break;
      
    case 'assistant':
      displayResponse(message.content);
      break;
      
    case 'error':
      showError(message.content);
      break;
      
    case 'system':
      handleSystemMessage(message.content);
      break;
  }
};
```

### Real-time Performance Monitoring
**Endpoint**: `ws://localhost:8000/ws/performance`

```javascript
const perfWs = new WebSocket('ws://localhost:8000/ws/performance');

perfWs.onmessage = (event) => {
  const metrics = JSON.parse(event.data);
  updateDashboard(metrics);
};
```

**Message Format**:
```json
{
  "type": "metrics_update",
  "data": {
    "cpu_percent": 25.5,
    "memory_usage_mb": 1024.0,
    "active_requests": 5,
    "error_rate": 0.02
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## ❌ **Error Handling**

### Error Response Format
All API errors follow a consistent format:

```json
{
  "detail": "Human readable error message",
  "status_code": 400,
  "error_code": "VALIDATION_ERROR",
  "timestamp": "2024-01-01T12:00:00Z",
  "request_id": "req_123456789",
  "validation_errors": [
    {
      "field": "file_path",
      "message": "Path does not exist",
      "code": "PATH_NOT_FOUND"
    }
  ]
}
```

### HTTP Status Codes

- **200 OK**: Request successful
- **201 Created**: Resource created successfully
- **400 Bad Request**: Invalid request data
- **401 Unauthorized**: Authentication required
- **403 Forbidden**: Access denied
- **404 Not Found**: Resource not found
- **422 Unprocessable Entity**: Validation error
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error
- **502 Bad Gateway**: External service error
- **503 Service Unavailable**: Service temporarily unavailable

### Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `AUTHENTICATION_ERROR` | Authentication failed |
| `AUTHORIZATION_ERROR` | Access denied |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `AI_PROVIDER_UNAVAILABLE` | No AI provider available |
| `FILE_NOT_FOUND` | File does not exist |
| `PERMISSION_DENIED` | Insufficient permissions |
| `SECURITY_VIOLATION` | Security validation failed |
| `TIMEOUT_ERROR` | Request timeout |
| `INTERNAL_ERROR` | Internal server error |

## 📝 **Request/Response Examples**

### Complete AI Code Generation Flow
```bash
# 1. Check AI provider status
curl http://localhost:8000/ai/providers

# 2. Generate code
curl -X POST http://localhost:8000/ai/route \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a REST API endpoint for user authentication",
    "role": "completion",
    "model": "deepseek-coder:latest"
  }'

# 3. Save generated code
curl -X POST http://localhost:8000/files/write \
  -H "Content-Type: application/json" \
  -d '{
    "file_path": "/project/src/auth.py",
    "content": "# Generated authentication endpoint code here"
  }'

# 4. Analyze code quality
curl -X POST http://localhost:8000/api/analysis/file \
  -H "Content-Type: application/json" \
  -d '{
    "file_path": "/project/src/auth.py",
    "analysis_type": "comprehensive"
  }'
```

### Performance Monitoring Workflow
```bash
# 1. Get system overview
curl http://localhost:8000/api/performance/summary

# 2. Check for alerts
curl http://localhost:8000/api/performance/alerts

# 3. Get detailed metrics
curl http://localhost:8000/api/performance/metrics?minutes=30

# 4. Trigger optimization if needed
curl -X POST http://localhost:8000/api/performance/optimize
```

### Git Integration Workflow
```bash
# 1. Configure Git
curl -X POST http://localhost:8000/git/config \
  -H "Content-Type: application/json" \
  -d '{
    "repoPath": "/project",
    "userName": "Developer",
    "userEmail": "dev@example.com"
  }'

# 2. Check repository status
curl http://localhost:8000/git/status?repoPath=/project

# 3. Push changes
curl -X POST http://localhost:8000/git/push \
  -H "Content-Type: application/json" \
  -d '{
    "message": "feat: add new authentication endpoint",
    "repoPath": "/project"
  }'
```

## 🧪 **Testing the API**

### Using curl
```bash
# Health check
curl http://localhost:8000/health

# AI request with verbose output
curl -v -X POST http://localhost:8000/ai/route \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello, AI!", "role": "general"}'
```

### Using Python requests
```python
import requests

# Health check
response = requests.get('http://localhost:8000/health')
print(response.json())

# AI request
ai_response = requests.post('http://localhost:8000/ai/route', json={
    'prompt': 'Create a Python function to calculate fibonacci',
    'role': 'completion'
})
print(ai_response.json())
```

### Using JavaScript fetch
```javascript
// Health check
fetch('http://localhost:8000/health')
  .then(response => response.json())
  .then(data => console.log(data));

// AI request
fetch('http://localhost:8000/ai/route', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    prompt: 'Create a REST API with FastAPI',
    role: 'completion'
  })
})
.then(response => response.json())
.then(data => console.log(data));
```

---

**📚 Additional Resources**:
- [Interactive API Documentation](http://localhost:8000/docs) (Swagger UI)
- [Alternative API Documentation](http://localhost:8000/redoc) (ReDoc)
- [OpenAPI Specification](http://localhost:8000/openapi.json) (Machine-readable)

**🐛 Found an API issue?** Please report it on our [GitHub Issues](https://github.com/user/ai-code-editor/issues) page.