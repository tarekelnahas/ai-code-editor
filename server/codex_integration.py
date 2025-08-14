"""
OpenAI Codex Integration for AI Code Editor
Provides Codex-like code generation, completion, and explanation capabilities
"""

import asyncio
import json
import re
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
import httpx
import os

@dataclass
class CodexRequest:
    prompt: str
    language: str
    max_tokens: int = 150
    temperature: float = 0.1
    stop_sequences: Optional[List[str]] = None

@dataclass
class CodexResponse:
    generated_code: str
    confidence: float
    explanation: str
    suggestions: List[str]

class CodexIntegration:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.base_url = "https://api.openai.com/v1"
        self.model = "gpt-3.5-turbo"  # Using ChatGPT as Codex replacement
        
        # Language-specific prompts and patterns
        self.language_contexts = {
            'python': {
                'system_prompt': 'You are an expert Python developer. Write clean, efficient, and well-documented Python code.',
                'stop_sequences': ['\n\n', 'def ', 'class ', 'if __name__'],
                'common_imports': ['import os', 'import sys', 'import json', 'from typing import']
            },
            'javascript': {
                'system_prompt': 'You are an expert JavaScript developer. Write modern, efficient JavaScript/ES6+ code.',
                'stop_sequences': ['\n\n', 'function ', 'const ', 'class '],
                'common_imports': ['import', 'const', 'require']
            },
            'typescript': {
                'system_prompt': 'You are an expert TypeScript developer. Write type-safe, modern TypeScript code.',
                'stop_sequences': ['\n\n', 'interface ', 'type ', 'class '],
                'common_imports': ['import', 'interface', 'type']
            },
            'react': {
                'system_prompt': 'You are an expert React developer. Write modern React components using hooks and best practices.',
                'stop_sequences': ['\n\n', 'function ', 'const ', 'export '],
                'common_imports': ['import React', 'import { useState', 'import { useEffect']
            }
        }
    
    async def generate_code(self, request: CodexRequest) -> CodexResponse:
        """Generate code using Codex-like capabilities"""
        if not self.api_key:
            return self._fallback_generation(request)
        
        try:
            # Prepare the prompt with context
            context = self.language_contexts.get(request.language, self.language_contexts['python'])
            
            messages = [
                {"role": "system", "content": context['system_prompt']},
                {"role": "user", "content": self._format_prompt(request)}
            ]
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": self.model,
                "messages": messages,
                "max_tokens": request.max_tokens,
                "temperature": request.temperature,
                "stop": context.get('stop_sequences', [])
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload
                )
                
                if response.status_code == 200:
                    result = response.json()
                    generated_code = result['choices'][0]['message']['content'].strip()
                    
                    return CodexResponse(
                        generated_code=generated_code,
                        confidence=0.9,
                        explanation=await self._generate_explanation(generated_code, request.language),
                        suggestions=await self._generate_suggestions(generated_code, request.language)
                    )
                else:
                    return self._fallback_generation(request)
                    
        except Exception as e:
            print(f"Codex API error: {e}")
            return self._fallback_generation(request)
    
    async def complete_code(self, code_context: str, cursor_position: int, language: str) -> List[str]:
        """Provide code completion suggestions"""
        # Extract the incomplete line and context
        lines = code_context[:cursor_position].split('\n')
        current_line = lines[-1] if lines else ""
        context_lines = lines[-10:] if len(lines) > 10 else lines
        
        prompt = f"""Complete the following {language} code:

Context:
{''.join(context_lines[:-1])}

Current incomplete line:
{current_line}

Provide 3-5 different completion options:"""
        
        request = CodexRequest(
            prompt=prompt,
            language=language,
            max_tokens=100,
            temperature=0.3
        )
        
        response = await self.generate_code(request)
        
        # Parse multiple suggestions from response
        suggestions = []
        lines = response.generated_code.split('\n')
        for line in lines[:5]:  # Top 5 suggestions
            if line.strip() and not line.startswith('#'):
                suggestions.append(line.strip())
        
        return suggestions
    
    async def explain_code(self, code: str, language: str) -> str:
        """Explain what a piece of code does"""
        if not self.api_key:
            return self._basic_explanation(code, language)
        
        try:
            messages = [
                {
                    "role": "system", 
                    "content": f"You are an expert {language} developer. Explain code clearly and concisely."
                },
                {
                    "role": "user", 
                    "content": f"Explain what this {language} code does:\n\n{code}"
                }
            ]
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": self.model,
                "messages": messages,
                "max_tokens": 200,
                "temperature": 0.1
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return result['choices'][0]['message']['content'].strip()
                    
        except Exception as e:
            print(f"Code explanation error: {e}")
        
        return self._basic_explanation(code, language)
    
    async def optimize_code(self, code: str, language: str) -> Dict[str, str]:
        """Suggest code optimizations"""
        if not self.api_key:
            return self._basic_optimization(code, language)
        
        try:
            messages = [
                {
                    "role": "system",
                    "content": f"You are an expert {language} developer. Provide code optimizations and improvements."
                },
                {
                    "role": "user",
                    "content": f"Optimize and improve this {language} code:\n\n{code}\n\nProvide the optimized code and explain the improvements:"
                }
            ]
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": self.model,
                "messages": messages,
                "max_tokens": 400,
                "temperature": 0.2
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload
                )
                
                if response.status_code == 200:
                    result = response.json()
                    content = result['choices'][0]['message']['content'].strip()
                    
                    # Try to separate optimized code from explanation
                    parts = content.split('\n\n', 1)
                    if len(parts) == 2:
                        return {
                            "optimized_code": parts[0].strip(),
                            "explanation": parts[1].strip()
                        }
                    else:
                        return {
                            "optimized_code": content,
                            "explanation": "Optimized version of the provided code."
                        }
                        
        except Exception as e:
            print(f"Code optimization error: {e}")
        
        return self._basic_optimization(code, language)
    
    async def generate_tests(self, code: str, language: str) -> str:
        """Generate unit tests for the given code"""
        if not self.api_key:
            return self._basic_test_generation(code, language)
        
        test_frameworks = {
            'python': 'pytest',
            'javascript': 'Jest',
            'typescript': 'Jest with TypeScript',
            'java': 'JUnit'
        }
        
        framework = test_frameworks.get(language, 'appropriate testing framework')
        
        try:
            messages = [
                {
                    "role": "system",
                    "content": f"You are an expert in {language} testing. Write comprehensive unit tests using {framework}."
                },
                {
                    "role": "user",
                    "content": f"Generate unit tests for this {language} code:\n\n{code}\n\nUse {framework} and include edge cases:"
                }
            ]
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": self.model,
                "messages": messages,
                "max_tokens": 500,
                "temperature": 0.1
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return result['choices'][0]['message']['content'].strip()
                    
        except Exception as e:
            print(f"Test generation error: {e}")
        
        return self._basic_test_generation(code, language)
    
    async def convert_language(self, code: str, from_lang: str, to_lang: str) -> str:
        """Convert code from one language to another"""
        if not self.api_key:
            return f"# Code conversion from {from_lang} to {to_lang}\n# Original code:\n{code}\n\n# Converted code would appear here"
        
        try:
            messages = [
                {
                    "role": "system",
                    "content": f"You are an expert programmer. Convert code accurately from {from_lang} to {to_lang} while maintaining functionality."
                },
                {
                    "role": "user",
                    "content": f"Convert this {from_lang} code to {to_lang}:\n\n{code}"
                }
            ]
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": self.model,
                "messages": messages,
                "max_tokens": 600,
                "temperature": 0.1
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return result['choices'][0]['message']['content'].strip()
                    
        except Exception as e:
            print(f"Language conversion error: {e}")
        
        return f"# Error converting from {from_lang} to {to_lang}\n{code}"
    
    def _format_prompt(self, request: CodexRequest) -> str:
        """Format the prompt with language-specific context"""
        context = self.language_contexts.get(request.language, {})
        
        formatted_prompt = f"Write {request.language} code for: {request.prompt}"
        
        # Add common imports if relevant
        if any(keyword in request.prompt.lower() for keyword in ['import', 'require', 'include']):
            imports = context.get('common_imports', [])
            if imports:
                formatted_prompt += f"\n\nCommon imports to consider: {', '.join(imports)}"
        
        return formatted_prompt
    
    def _fallback_generation(self, request: CodexRequest) -> CodexResponse:
        """Fallback code generation when API is not available"""
        templates = {
            'python': {
                'function': '''def {name}({params}):
    """
    {description}
    
    Args:
        {param_docs}
    
    Returns:
        {return_doc}
    """
    # TODO: Implement function logic
    pass''',
                'class': '''class {name}:
    """
    {description}
    """
    
    def __init__(self{params}):
        """Initialize {name}."""
        # TODO: Initialize attributes
        pass''',
                'api': '''import requests

def api_call(url, method='GET', data=None):
    """Make an API call."""
    try:
        response = requests.request(method, url, json=data)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        print(f"API error: {e}")
        return None'''
            },
            'javascript': {
                'function': '''function {name}({params}) {{
    // TODO: Implement function
    return null;
}}''',
                'api': '''async function apiCall(url, options = {}) {{
    try {{
        const response = await fetch(url, {{
            method: options.method || 'GET',
            headers: {{
                'Content-Type': 'application/json',
                ...options.headers
            }},
            body: options.data ? JSON.stringify(options.data) : undefined
        }});
        
        if (!response.ok) {{
            throw new Error(`HTTP error! status: ${{response.status}}`);
        }}
        
        return await response.json();
    }} catch (error) {{
        console.error('API error:', error);
        throw error;
    }}
}}'''
            }
        }
        
        # Simple template matching
        code_type = 'function'
        if 'class' in request.prompt.lower():
            code_type = 'class'
        elif 'api' in request.prompt.lower() or 'request' in request.prompt.lower():
            code_type = 'api'
        
        template = templates.get(request.language, {}).get(code_type, '# Generated code placeholder')
        
        return CodexResponse(
            generated_code=template,
            confidence=0.6,
            explanation=f"Generated {request.language} {code_type} template based on prompt: {request.prompt}",
            suggestions=[
                "Add proper error handling",
                "Include input validation", 
                "Add documentation",
                "Consider edge cases"
            ]
        )
    
    async def _generate_explanation(self, code: str, language: str) -> str:
        """Generate basic explanation without API"""
        return f"This {language} code implements the requested functionality. Review and customize as needed."
    
    async def _generate_suggestions(self, code: str, language: str) -> List[str]:
        """Generate improvement suggestions without API"""
        return [
            "Add error handling",
            "Include input validation",
            "Add comprehensive documentation",
            "Consider performance optimizations"
        ]
    
    def _basic_explanation(self, code: str, language: str) -> str:
        """Provide basic code explanation without API"""
        lines = len(code.split('\n'))
        return f"This {language} code snippet contains {lines} lines and implements specific functionality. It may include functions, classes, or other constructs typical of {language} programming."
    
    def _basic_optimization(self, code: str, language: str) -> Dict[str, str]:
        """Provide basic optimization suggestions without API"""
        return {
            "optimized_code": code,
            "explanation": f"Code optimization suggestions: Consider performance improvements, error handling, and {language}-specific best practices."
        }
    
    def _basic_test_generation(self, code: str, language: str) -> str:
        """Generate basic test template without API"""
        if language == 'python':
            return '''import pytest

def test_function():
    """Test the main function."""
    # TODO: Add test cases
    assert True
    
def test_edge_cases():
    """Test edge cases."""
    # TODO: Add edge case tests
    assert True'''
        
        elif language in ['javascript', 'typescript']:
            return '''describe('Function Tests', () => {
    test('should work correctly', () => {
        // TODO: Add test cases
        expect(true).toBe(true);
    });
    
    test('should handle edge cases', () => {
        // TODO: Add edge case tests
        expect(true).toBe(true);
    });
});'''
        
        return f"# {language} test template\n# TODO: Add appropriate tests for this language"