"""
AI-Powered Code Completion System
Provides intelligent code suggestions, auto-completion, and code generation
"""

import re
import ast
import json
from typing import Dict, List, Any, Optional, Tuple
from pathlib import Path
from dataclasses import dataclass
import asyncio
from collections import defaultdict

@dataclass
class CompletionSuggestion:
    text: str
    kind: str  # 'function', 'variable', 'class', 'keyword', 'snippet', 'import'
    detail: str
    documentation: str
    insert_text: str
    confidence: float
    priority: int

@dataclass
class CodeContext:
    file_path: str
    language: str
    cursor_line: int
    cursor_column: int
    current_line: str
    previous_lines: List[str]
    indentation: str
    scope: str  # 'class', 'function', 'module'

class AICodeCompletion:
    def __init__(self):
        self.language_patterns = {
            'python': {
                'keywords': [
                    'def', 'class', 'if', 'else', 'elif', 'for', 'while', 'try', 'except', 
                    'finally', 'with', 'as', 'import', 'from', 'return', 'yield', 'lambda',
                    'and', 'or', 'not', 'in', 'is', 'True', 'False', 'None', 'async', 'await'
                ],
                'builtins': [
                    'print', 'len', 'range', 'enumerate', 'zip', 'map', 'filter', 'sorted',
                    'max', 'min', 'sum', 'any', 'all', 'isinstance', 'hasattr', 'getattr',
                    'setattr', 'str', 'int', 'float', 'bool', 'list', 'dict', 'set', 'tuple'
                ],
                'common_imports': [
                    'import os', 'import sys', 'import json', 'import re', 'import datetime',
                    'from typing import', 'import asyncio', 'import logging', 'import pathlib',
                    'import requests', 'import pandas as pd', 'import numpy as np'
                ]
            },
            'javascript': {
                'keywords': [
                    'function', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 'do',
                    'switch', 'case', 'break', 'continue', 'return', 'try', 'catch', 'finally',
                    'class', 'extends', 'import', 'export', 'default', 'async', 'await'
                ],
                'builtins': [
                    'console.log', 'JSON.parse', 'JSON.stringify', 'parseInt', 'parseFloat',
                    'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'fetch',
                    'document.getElementById', 'document.querySelector', 'addEventListener'
                ]
            },
            'typescript': {
                'keywords': [
                    'interface', 'type', 'enum', 'namespace', 'module', 'declare', 'abstract',
                    'implements', 'extends', 'public', 'private', 'protected', 'readonly'
                ],
                'types': [
                    'string', 'number', 'boolean', 'any', 'void', 'null', 'undefined',
                    'object', 'Array', 'Promise', 'Map', 'Set', 'Record', 'Partial'
                ]
            }
        }
        
        self.code_templates = {
            'python': {
                'function': 'def ${1:function_name}(${2:params}):\n    """${3:Description}\n    \n    Args:\n        ${4:param}: ${5:Description}\n    \n    Returns:\n        ${6:Return description}\n    """\n    ${0:pass}',
                'class': 'class ${1:ClassName}:\n    """${2:Class description}\n    """\n    \n    def __init__(self${3:, params}):\n        """Initialize ${1:ClassName}\n        \n        Args:\n            ${4:param}: ${5:Description}\n        """\n        ${0:pass}',
                'try_except': 'try:\n    ${1:# Code that might raise an exception}\n    pass\nexcept ${2:Exception} as e:\n    ${3:# Handle exception}\n    print(f"Error: {e}")\n    ${0:pass}',
                'main': 'if __name__ == "__main__":\n    ${0:main()}',
                'async_function': 'async def ${1:function_name}(${2:params}):\n    """${3:Description}\n    \n    Args:\n        ${4:param}: ${5:Description}\n    \n    Returns:\n        ${6:Return description}\n    """\n    ${0:pass}'
            },
            'javascript': {
                'function': 'function ${1:functionName}(${2:params}) {\n    ${0:// Function body}\n}',
                'arrow_function': 'const ${1:functionName} = (${2:params}) => {\n    ${0:// Function body}\n};',
                'async_function': 'async function ${1:functionName}(${2:params}) {\n    try {\n        ${0:// Async code}\n    } catch (error) {\n        console.error(error);\n    }\n}',
                'class': 'class ${1:ClassName} {\n    constructor(${2:params}) {\n        ${3:// Initialize properties}\n    }\n    \n    ${0:// Methods}\n}',
                'try_catch': 'try {\n    ${1:// Code that might throw}\n} catch (error) {\n    ${2:console.error(error);}\n}',
                'for_loop': 'for (let ${1:i} = 0; ${1:i} < ${2:array}.length; ${1:i}++) {\n    ${0:// Loop body}\n}',
                'foreach': '${1:array}.forEach((${2:item}, ${3:index}) => {\n    ${0:// Loop body}\n});'
            }
        }
        
    async def get_completions(self, context: CodeContext, prefix: str = "") -> List[CompletionSuggestion]:
        """Get AI-powered code completions based on context"""
        completions = []
        
        # Get language-specific completions
        if context.language in self.language_patterns:
            completions.extend(await self._get_language_completions(context, prefix))
        
        # Add smart suggestions based on context
        completions.extend(await self._get_context_aware_completions(context, prefix))
        
        # Add code templates/snippets
        completions.extend(await self._get_template_completions(context, prefix))
        
        # Add import suggestions
        completions.extend(await self._get_import_suggestions(context, prefix))
        
        # Sort by confidence and priority
        completions.sort(key=lambda x: (-x.priority, -x.confidence))
        
        return completions[:50]  # Limit to top 50 suggestions
    
    async def _get_language_completions(self, context: CodeContext, prefix: str) -> List[CompletionSuggestion]:
        """Get basic language completions (keywords, builtins)"""
        completions = []
        patterns = self.language_patterns.get(context.language, {})
        
        # Keywords
        for keyword in patterns.get('keywords', []):
            if keyword.startswith(prefix.lower()):
                completions.append(CompletionSuggestion(
                    text=keyword,
                    kind='keyword',
                    detail=f'{context.language} keyword',
                    documentation=f'{keyword} - {context.language} language keyword',
                    insert_text=keyword,
                    confidence=0.8,
                    priority=7
                ))
        
        # Built-in functions
        for builtin in patterns.get('builtins', []):
            if builtin.startswith(prefix.lower()):
                completions.append(CompletionSuggestion(
                    text=builtin,
                    kind='function',
                    detail=f'{context.language} built-in',
                    documentation=f'{builtin} - Built-in function',
                    insert_text=builtin,
                    confidence=0.9,
                    priority=8
                ))
        
        # Types (for TypeScript)
        for type_name in patterns.get('types', []):
            if type_name.startswith(prefix.lower()):
                completions.append(CompletionSuggestion(
                    text=type_name,
                    kind='class',
                    detail='TypeScript type',
                    documentation=f'{type_name} - TypeScript type',
                    insert_text=type_name,
                    confidence=0.85,
                    priority=6
                ))
        
        return completions
    
    async def _get_context_aware_completions(self, context: CodeContext, prefix: str) -> List[CompletionSuggestion]:
        """Get intelligent completions based on current context"""
        completions = []
        current_line = context.current_line.strip()
        
        # Python-specific context awareness
        if context.language == 'python':
            # If inside a class, suggest common methods
            if context.scope == 'class' and prefix.startswith('def '):
                python_methods = [
                    ('__init__', 'Constructor method'),
                    ('__str__', 'String representation'),
                    ('__repr__', 'Object representation'),
                    ('__eq__', 'Equality comparison'),
                    ('__hash__', 'Hash value'),
                    ('__len__', 'Length of object')
                ]
                
                for method, desc in python_methods:
                    if method.startswith(prefix[4:]):  # Remove 'def ' prefix
                        completions.append(CompletionSuggestion(
                            text=method,
                            kind='function',
                            detail='Special method',
                            documentation=f'{method} - {desc}',
                            insert_text=f'{method}(self):',
                            confidence=0.9,
                            priority=9
                        ))
            
            # Import suggestions based on common patterns
            if current_line.startswith('import ') or current_line.startswith('from '):
                common_imports = [
                    'os', 'sys', 'json', 're', 'datetime', 'collections', 'itertools',
                    'functools', 'typing', 'pathlib', 'asyncio', 'logging'
                ]
                
                for imp in common_imports:
                    if imp.startswith(prefix):
                        completions.append(CompletionSuggestion(
                            text=imp,
                            kind='import',
                            detail='Standard library',
                            documentation=f'{imp} - Python standard library module',
                            insert_text=imp,
                            confidence=0.85,
                            priority=8
                        ))
            
            # Exception handling suggestions
            if 'except' in current_line:
                exceptions = [
                    'ValueError', 'TypeError', 'KeyError', 'IndexError', 'AttributeError',
                    'FileNotFoundError', 'IOError', 'ConnectionError', 'TimeoutError'
                ]
                
                for exc in exceptions:
                    if exc.startswith(prefix):
                        completions.append(CompletionSuggestion(
                            text=exc,
                            kind='class',
                            detail='Exception type',
                            documentation=f'{exc} - Built-in exception',
                            insert_text=exc,
                            confidence=0.9,
                            priority=9
                        ))
        
        # JavaScript/TypeScript context awareness
        elif context.language in ['javascript', 'typescript']:
            # Console methods
            if current_line.startswith('console.'):
                console_methods = [
                    ('log', 'Log message to console'),
                    ('error', 'Log error message'),
                    ('warn', 'Log warning message'),
                    ('info', 'Log info message'),
                    ('debug', 'Log debug message'),
                    ('table', 'Display data as table')
                ]
                
                for method, desc in console_methods:
                    if method.startswith(prefix):
                        completions.append(CompletionSuggestion(
                            text=method,
                            kind='function',
                            detail='Console method',
                            documentation=f'console.{method} - {desc}',
                            insert_text=f'{method}()',
                            confidence=0.9,
                            priority=9
                        ))
            
            # Promise methods
            if '.then' in current_line or '.catch' in current_line or 'Promise.' in current_line:
                promise_methods = [
                    ('then', 'Handle successful result'),
                    ('catch', 'Handle error'),
                    ('finally', 'Execute regardless of result'),
                    ('all', 'Wait for all promises'),
                    ('race', 'Wait for first promise'),
                    ('resolve', 'Create resolved promise'),
                    ('reject', 'Create rejected promise')
                ]
                
                for method, desc in promise_methods:
                    if method.startswith(prefix):
                        completions.append(CompletionSuggestion(
                            text=method,
                            kind='function',
                            detail='Promise method',
                            documentation=f'Promise.{method} - {desc}',
                            insert_text=f'{method}()',
                            confidence=0.9,
                            priority=9
                        ))
        
        return completions
    
    async def _get_template_completions(self, context: CodeContext, prefix: str) -> List[CompletionSuggestion]:
        """Get code template/snippet completions"""
        completions = []
        templates = self.code_templates.get(context.language, {})
        
        for template_name, template_code in templates.items():
            # Check if the template matches the context
            should_suggest = False
            
            if template_name == 'function' and ('def ' in prefix or 'function' in prefix):
                should_suggest = True
            elif template_name == 'class' and 'class' in prefix:
                should_suggest = True
            elif template_name == 'try_except' and ('try' in prefix or 'except' in prefix):
                should_suggest = True
            elif template_name == 'main' and '__main__' in prefix:
                should_suggest = True
            elif template_name in prefix:
                should_suggest = True
            
            if should_suggest:
                completions.append(CompletionSuggestion(
                    text=template_name.replace('_', ' ').title(),
                    kind='snippet',
                    detail=f'Code template',
                    documentation=f'{template_name} - Code snippet template',
                    insert_text=template_code,
                    confidence=0.95,
                    priority=10
                ))
        
        return completions
    
    async def _get_import_suggestions(self, context: CodeContext, prefix: str) -> List[CompletionSuggestion]:
        """Get intelligent import suggestions"""
        completions = []
        current_line = context.current_line.strip()
        
        if context.language == 'python':
            # Common import patterns
            import_patterns = [
                ('import os', 'Operating system interface'),
                ('import sys', 'System-specific parameters'),
                ('import json', 'JSON encoder/decoder'),
                ('import re', 'Regular expressions'),
                ('import datetime', 'Date and time'),
                ('from typing import List, Dict, Optional', 'Type hints'),
                ('import asyncio', 'Asynchronous I/O'),
                ('import logging', 'Logging facility'),
                ('from pathlib import Path', 'Object-oriented filesystem paths'),
                ('import requests', 'HTTP library'),
                ('import pandas as pd', 'Data analysis library'),
                ('import numpy as np', 'Numerical computing')
            ]
            
            if current_line.startswith('import') or current_line.startswith('from') or len(context.previous_lines) < 5:
                for import_stmt, desc in import_patterns:
                    if any(word in import_stmt.lower() for word in prefix.lower().split()):
                        completions.append(CompletionSuggestion(
                            text=import_stmt,
                            kind='import',
                            detail='Import statement',
                            documentation=f'{import_stmt} - {desc}',
                            insert_text=import_stmt,
                            confidence=0.8,
                            priority=7
                        ))
        
        elif context.language in ['javascript', 'typescript']:
            # Common JavaScript/TypeScript imports
            import_patterns = [
                ('import React from "react"', 'React library'),
                ('import { useState, useEffect } from "react"', 'React hooks'),
                ('import axios from "axios"', 'HTTP client'),
                ('import lodash from "lodash"', 'Utility library'),
                ('import moment from "moment"', 'Date manipulation'),
                ('import express from "express"', 'Web framework'),
                ('import fs from "fs"', 'File system'),
                ('import path from "path"', 'Path utilities')
            ]
            
            if current_line.startswith('import') or len(context.previous_lines) < 5:
                for import_stmt, desc in import_patterns:
                    if any(word in import_stmt.lower() for word in prefix.lower().split()):
                        completions.append(CompletionSuggestion(
                            text=import_stmt,
                            kind='import',
                            detail='Import statement',
                            documentation=f'{import_stmt} - {desc}',
                            insert_text=import_stmt,
                            confidence=0.8,
                            priority=7
                        ))
        
        return completions
    
    async def generate_code(self, prompt: str, language: str, context: Optional[CodeContext] = None) -> str:
        """Generate code based on natural language prompt"""
        # This would integrate with an LLM for actual code generation
        # For now, providing template-based generation
        
        prompt_lower = prompt.lower()
        
        if language == 'python':
            if 'function' in prompt_lower or 'def' in prompt_lower:
                return '''def example_function(param1, param2):
    """
    Example function generated from prompt.
    
    Args:
        param1: First parameter
        param2: Second parameter
    
    Returns:
        Result of the operation
    """
    # TODO: Implement function logic
    return param1 + param2'''
            
            elif 'class' in prompt_lower:
                return '''class ExampleClass:
    """
    Example class generated from prompt.
    """
    
    def __init__(self, value):
        """Initialize the class with a value."""
        self.value = value
    
    def get_value(self):
        """Get the current value."""
        return self.value
    
    def set_value(self, new_value):
        """Set a new value."""
        self.value = new_value'''
            
            elif 'api' in prompt_lower or 'request' in prompt_lower:
                return '''import requests

def make_api_request(url, method='GET', data=None, headers=None):
    """
    Make an API request.
    
    Args:
        url: The API endpoint URL
        method: HTTP method (GET, POST, PUT, DELETE)
        data: Request data for POST/PUT requests
        headers: Request headers
    
    Returns:
        Response object
    """
    try:
        response = requests.request(
            method=method,
            url=url,
            json=data,
            headers=headers
        )
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        print(f"API request failed: {e}")
        return None'''
        
        elif language in ['javascript', 'typescript']:
            if 'function' in prompt_lower:
                return '''/**
 * Example function generated from prompt
 * @param {any} param1 - First parameter
 * @param {any} param2 - Second parameter
 * @returns {any} Result of the operation
 */
function exampleFunction(param1, param2) {
    // TODO: Implement function logic
    return param1 + param2;
}'''
            
            elif 'class' in prompt_lower:
                return '''/**
 * Example class generated from prompt
 */
class ExampleClass {
    constructor(value) {
        this.value = value;
    }
    
    getValue() {
        return this.value;
    }
    
    setValue(newValue) {
        this.value = newValue;
    }
}'''
            
            elif 'api' in prompt_lower or 'fetch' in prompt_lower:
                return '''/**
 * Make an API request
 * @param {string} url - The API endpoint URL
 * @param {Object} options - Request options
 * @returns {Promise} Response promise
 */
async function makeApiRequest(url, options = {}) {
    try {
        const response = await fetch(url, {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            body: options.data ? JSON.stringify(options.data) : undefined
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
}'''
        
        return f"// Generated code for: {prompt}\n// TODO: Implement the requested functionality"
    
    def analyze_completion_context(self, file_content: str, cursor_position: Tuple[int, int]) -> CodeContext:
        """Analyze the code context around cursor position"""
        lines = file_content.split('\n')
        cursor_line, cursor_column = cursor_position
        
        # Ensure cursor position is valid
        cursor_line = max(0, min(cursor_line, len(lines) - 1))
        cursor_column = max(0, cursor_column)
        
        current_line = lines[cursor_line] if cursor_line < len(lines) else ""
        previous_lines = lines[max(0, cursor_line - 10):cursor_line]
        
        # Detect indentation
        indentation = ""
        for char in current_line:
            if char in [' ', '\t']:
                indentation += char
            else:
                break
        
        # Determine scope (simplified)
        scope = "module"
        for i in range(cursor_line - 1, -1, -1):
            line = lines[i].strip()
            if line.startswith('class '):
                scope = "class"
                break
            elif line.startswith('def ') or line.startswith('function '):
                scope = "function"
                break
        
        return CodeContext(
            file_path="",
            language="python",  # Would be detected from file extension
            cursor_line=cursor_line,
            cursor_column=cursor_column,
            current_line=current_line,
            previous_lines=previous_lines,
            indentation=indentation,
            scope=scope
        )