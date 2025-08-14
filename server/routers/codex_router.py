"""
Codex Router - OpenAI Codex-like capabilities for AI Code Editor
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
from codex_integration import CodexIntegration, CodexRequest

router = APIRouter(prefix="/codex", tags=["codex"])

# Pydantic models
class GenerateCodeRequest(BaseModel):
    prompt: str
    language: str
    max_tokens: Optional[int] = 150
    temperature: Optional[float] = 0.1

class CompleteCodeRequest(BaseModel):
    code_context: str
    cursor_position: int
    language: str
    max_suggestions: Optional[int] = 5

class ExplainCodeRequest(BaseModel):
    code: str
    language: str

class OptimizeCodeRequest(BaseModel):
    code: str
    language: str

class GenerateTestsRequest(BaseModel):
    code: str
    language: str
    test_framework: Optional[str] = None

class ConvertLanguageRequest(BaseModel):
    code: str
    from_language: str
    to_language: str

# Initialize Codex integration
codex = CodexIntegration()

@router.post("/generate")
async def generate_code(request: GenerateCodeRequest):
    """Generate code from natural language description (Codex-like)"""
    try:
        codex_request = CodexRequest(
            prompt=request.prompt,
            language=request.language,
            max_tokens=request.max_tokens,
            temperature=request.temperature
        )
        
        response = await codex.generate_code(codex_request)
        
        return {
            "generated_code": response.generated_code,
            "confidence": response.confidence,
            "explanation": response.explanation,
            "suggestions": response.suggestions,
            "language": request.language,
            "prompt": request.prompt
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Code generation failed: {str(e)}")

@router.post("/complete")
async def complete_code(request: CompleteCodeRequest):
    """Provide intelligent code completion suggestions"""
    try:
        suggestions = await codex.complete_code(
            request.code_context,
            request.cursor_position,
            request.language
        )
        
        return {
            "suggestions": suggestions[:request.max_suggestions],
            "language": request.language,
            "context_length": len(request.code_context),
            "cursor_position": request.cursor_position
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Code completion failed: {str(e)}")

@router.post("/explain")
async def explain_code(request: ExplainCodeRequest):
    """Explain what a piece of code does"""
    try:
        explanation = await codex.explain_code(request.code, request.language)
        
        return {
            "explanation": explanation,
            "language": request.language,
            "code_length": len(request.code),
            "lines_of_code": len(request.code.split('\n'))
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Code explanation failed: {str(e)}")

@router.post("/optimize")
async def optimize_code(request: OptimizeCodeRequest):
    """Optimize and improve code"""
    try:
        optimization = await codex.optimize_code(request.code, request.language)
        
        return {
            "original_code": request.code,
            "optimized_code": optimization["optimized_code"],
            "explanation": optimization["explanation"],
            "language": request.language,
            "improvement_areas": [
                "Performance optimization",
                "Code readability",
                "Best practices",
                "Error handling"
            ]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Code optimization failed: {str(e)}")

@router.post("/generate-tests")
async def generate_tests(request: GenerateTestsRequest):
    """Generate unit tests for code"""
    try:
        tests = await codex.generate_tests(request.code, request.language)
        
        # Determine test framework if not specified
        test_frameworks = {
            'python': 'pytest',
            'javascript': 'Jest',
            'typescript': 'Jest',
            'java': 'JUnit',
            'csharp': 'NUnit'
        }
        
        framework = request.test_framework or test_frameworks.get(request.language, 'Generic')
        
        return {
            "test_code": tests,
            "original_code": request.code,
            "test_framework": framework,
            "language": request.language,
            "test_types": [
                "Unit tests",
                "Edge cases",
                "Error handling",
                "Input validation"
            ]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Test generation failed: {str(e)}")

@router.post("/convert")
async def convert_language(request: ConvertLanguageRequest):
    """Convert code from one programming language to another"""
    try:
        converted_code = await codex.convert_language(
            request.code,
            request.from_language,
            request.to_language
        )
        
        return {
            "original_code": request.code,
            "converted_code": converted_code,
            "from_language": request.from_language,
            "to_language": request.to_language,
            "conversion_notes": [
                f"Converted from {request.from_language} to {request.to_language}",
                "Review syntax and libraries for accuracy",
                "Test thoroughly in target language environment",
                "Consider language-specific best practices"
            ]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Language conversion failed: {str(e)}")

@router.post("/refactor")
async def refactor_code(code: str, language: str, refactor_type: str = "general"):
    """Refactor code for better structure and readability"""
    try:
        # Use optimization endpoint for refactoring
        optimization = await codex.optimize_code(code, language)
        
        refactor_suggestions = {
            "general": [
                "Extract methods for better modularity",
                "Improve variable naming",
                "Add documentation",
                "Reduce complexity"
            ],
            "performance": [
                "Optimize loops and iterations",
                "Reduce memory usage",
                "Improve algorithm efficiency",
                "Cache repeated calculations"
            ],
            "security": [
                "Add input validation",
                "Sanitize user input",
                "Use secure coding practices",
                "Handle errors gracefully"
            ]
        }
        
        return {
            "original_code": code,
            "refactored_code": optimization["optimized_code"],
            "refactor_type": refactor_type,
            "explanation": optimization["explanation"],
            "suggestions": refactor_suggestions.get(refactor_type, refactor_suggestions["general"]),
            "language": language
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Code refactoring failed: {str(e)}")

@router.get("/capabilities")
async def get_codex_capabilities():
    """Get Codex integration capabilities and status"""
    api_key_configured = bool(os.getenv("OPENAI_API_KEY"))
    
    return {
        "api_configured": api_key_configured,
        "model": codex.model,
        "capabilities": [
            "Natural language to code generation",
            "Intelligent code completion", 
            "Code explanation and documentation",
            "Code optimization and refactoring",
            "Unit test generation",
            "Language conversion",
            "Best practices suggestions"
        ],
        "supported_languages": [
            "Python", "JavaScript", "TypeScript", "Java", "C++", "C#", 
            "Go", "Rust", "PHP", "Ruby", "Swift", "Kotlin"
        ],
        "features": {
            "code_generation": "Generate complete functions and classes",
            "code_completion": "Context-aware suggestions",
            "code_explanation": "Natural language explanations",
            "code_optimization": "Performance and readability improvements",
            "test_generation": "Comprehensive unit tests",
            "language_conversion": "Cross-language code translation",
            "refactoring": "Structure and design improvements"
        }
    }

@router.get("/examples")
async def get_usage_examples():
    """Get usage examples for Codex integration"""
    return {
        "code_generation": {
            "prompt": "Create a function that validates email addresses using regex",
            "language": "python",
            "expected_output": "A complete Python function with validation logic"
        },
        "code_completion": {
            "context": "def fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n-1) + fib",
            "cursor_position": 89,
            "expected_output": ["onacci(n-2)", "onacci(n - 2)"]
        },
        "code_explanation": {
            "code": "def quicksort(arr):\n    if len(arr) <= 1:\n        return arr\n    pivot = arr[len(arr) // 2]\n    left = [x for x in arr if x < pivot]\n    middle = [x for x in arr if x == pivot]\n    right = [x for x in arr if x > pivot]\n    return quicksort(left) + middle + quicksort(right)",
            "expected_output": "Explanation of quicksort algorithm implementation"
        },
        "test_generation": {
            "code": "def add_numbers(a, b):\n    return a + b",
            "expected_output": "Unit tests covering normal cases, edge cases, and error handling"
        }
    }

@router.get("/health")
async def codex_health_check():
    """Health check for Codex integration"""
    api_key_configured = bool(os.getenv("OPENAI_API_KEY"))
    
    return {
        "status": "healthy",
        "api_configured": api_key_configured,
        "fallback_enabled": True,
        "model": codex.model,
        "features_available": [
            "Code generation",
            "Code completion", 
            "Code explanation",
            "Code optimization",
            "Test generation",
            "Language conversion",
            "Code refactoring"
        ],
        "note": "Fallback templates available when OpenAI API is not configured"
    }