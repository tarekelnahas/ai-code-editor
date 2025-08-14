"""
AI Code Completion Router - API endpoints for intelligent code completion
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Tuple
from ai_completion import AICodeCompletion, CodeContext

router = APIRouter(prefix="/completion", tags=["completion"])

# Pydantic models
class CompletionRequest(BaseModel):
    file_content: str
    cursor_position: Tuple[int, int]  # (line, column)
    language: str
    prefix: Optional[str] = ""
    max_suggestions: Optional[int] = 20

class CodeGenerationRequest(BaseModel):
    prompt: str
    language: str
    context: Optional[Dict[str, Any]] = None

class CompletionResponse(BaseModel):
    suggestions: List[Dict[str, Any]]
    context_info: Dict[str, Any]

# Initialize completion engine
completion_engine = AICodeCompletion()

@router.post("/suggest")
async def get_code_completions(request: CompletionRequest) -> CompletionResponse:
    """Get intelligent code completion suggestions"""
    try:
        # Analyze context
        context = completion_engine.analyze_completion_context(
            request.file_content, 
            request.cursor_position
        )
        context.language = request.language
        
        # Get completions
        suggestions = await completion_engine.get_completions(context, request.prefix)
        
        # Limit suggestions
        limited_suggestions = suggestions[:request.max_suggestions]
        
        # Format response
        formatted_suggestions = [
            {
                "text": s.text,
                "kind": s.kind,
                "detail": s.detail,
                "documentation": s.documentation,
                "insertText": s.insert_text,
                "confidence": s.confidence,
                "priority": s.priority
            }
            for s in limited_suggestions
        ]
        
        context_info = {
            "language": context.language,
            "scope": context.scope,
            "line": context.cursor_line,
            "column": context.cursor_column,
            "indentation": context.indentation
        }
        
        return CompletionResponse(
            suggestions=formatted_suggestions,
            context_info=context_info
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Completion failed: {str(e)}")

@router.post("/generate")
async def generate_code(request: CodeGenerationRequest):
    """Generate code from natural language prompt"""
    try:
        context = None
        if request.context:
            # Create context from provided data
            context = CodeContext(
                file_path=request.context.get("file_path", ""),
                language=request.language,
                cursor_line=request.context.get("cursor_line", 0),
                cursor_column=request.context.get("cursor_column", 0),
                current_line=request.context.get("current_line", ""),
                previous_lines=request.context.get("previous_lines", []),
                indentation=request.context.get("indentation", ""),
                scope=request.context.get("scope", "module")
            )
        
        generated_code = await completion_engine.generate_code(
            request.prompt, 
            request.language, 
            context
        )
        
        return {
            "generated_code": generated_code,
            "language": request.language,
            "prompt": request.prompt,
            "success": True
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Code generation failed: {str(e)}")

@router.get("/languages")
async def get_supported_languages():
    """Get list of supported programming languages"""
    return {
        "supported_languages": [
            {
                "name": "Python",
                "id": "python",
                "extensions": [".py", ".pyw"],
                "features": ["completion", "templates", "imports", "context_aware"]
            },
            {
                "name": "JavaScript",
                "id": "javascript", 
                "extensions": [".js", ".mjs"],
                "features": ["completion", "templates", "imports", "context_aware"]
            },
            {
                "name": "TypeScript",
                "id": "typescript",
                "extensions": [".ts"],
                "features": ["completion", "templates", "types", "context_aware"]
            },
            {
                "name": "React",
                "id": "javascript",
                "extensions": [".jsx", ".tsx"],
                "features": ["completion", "templates", "hooks", "context_aware"]
            }
        ],
        "completion_types": [
            "keywords", "functions", "variables", "classes", 
            "imports", "snippets", "templates", "context_aware"
        ]
    }

@router.get("/templates/{language}")
async def get_code_templates(language: str):
    """Get available code templates for a language"""
    templates = completion_engine.code_templates.get(language, {})
    
    if not templates:
        raise HTTPException(status_code=404, detail=f"No templates found for language: {language}")
    
    formatted_templates = []
    for name, code in templates.items():
        formatted_templates.append({
            "name": name,
            "display_name": name.replace('_', ' ').title(),
            "description": f"{name.replace('_', ' ').title()} code template",
            "language": language,
            "code": code,
            "placeholders": len([m for m in code.split('${') if '}' in m])
        })
    
    return {
        "language": language,
        "templates": formatted_templates,
        "count": len(formatted_templates)
    }

@router.post("/context-analyze")
async def analyze_context(
    file_content: str,
    cursor_position: Tuple[int, int],
    language: str = "python"
):
    """Analyze code context at cursor position"""
    try:
        context = completion_engine.analyze_completion_context(file_content, cursor_position)
        context.language = language
        
        return {
            "context": {
                "language": context.language,
                "cursor_line": context.cursor_line,
                "cursor_column": context.cursor_column,
                "current_line": context.current_line,
                "scope": context.scope,
                "indentation": context.indentation,
                "indentation_level": len(context.indentation)
            },
            "suggestions": {
                "in_function": context.scope == "function",
                "in_class": context.scope == "class",
                "at_module_level": context.scope == "module",
                "can_suggest_imports": context.cursor_line < 10,
                "needs_indentation": len(context.current_line.strip()) == 0
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Context analysis failed: {str(e)}")

@router.get("/health")
async def completion_health_check():
    """Health check for completion service"""
    return {
        "status": "healthy",
        "features": [
            "Intelligent code completion",
            "Context-aware suggestions", 
            "Code template snippets",
            "Natural language code generation",
            "Multi-language support",
            "Import suggestions",
            "Syntax-aware completions"
        ],
        "languages_supported": len(completion_engine.language_patterns),
        "templates_available": sum(len(templates) for templates in completion_engine.code_templates.values())
    }

@router.get("/stats")
async def get_completion_stats():
    """Get completion engine statistics"""
    stats = {
        "languages": {},
        "templates": {},
        "total_keywords": 0,
        "total_builtins": 0,
        "total_templates": 0
    }
    
    for lang, patterns in completion_engine.language_patterns.items():
        keyword_count = len(patterns.get('keywords', []))
        builtin_count = len(patterns.get('builtins', []))
        
        stats["languages"][lang] = {
            "keywords": keyword_count,
            "builtins": builtin_count,
            "has_types": 'types' in patterns
        }
        
        stats["total_keywords"] += keyword_count
        stats["total_builtins"] += builtin_count
    
    for lang, templates in completion_engine.code_templates.items():
        template_count = len(templates)
        stats["templates"][lang] = template_count
        stats["total_templates"] += template_count
    
    return stats