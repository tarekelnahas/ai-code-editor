"""
Security utilities for AI Code Editor
Provides input sanitization and validation functions
"""

import re
import os
import shlex
from pathlib import Path
from typing import List, Optional, Union
from urllib.parse import urlparse


class SecurityValidator:
    """Comprehensive security validation utilities"""
    
    # Allowed file extensions for code editing
    ALLOWED_EXTENSIONS = {
        '.js', '.jsx', '.ts', '.tsx', '.py', '.rs', '.go', '.java', 
        '.cpp', '.c', '.h', '.hpp', '.css', '.scss', '.less', '.html', 
        '.htm', '.json', '.yaml', '.yml', '.md', '.mdx', '.txt', '.sh', 
        '.bash', '.ps1', '.sql', '.xml', '.toml', '.ini', '.cfg'
    }
    
    # Dangerous command patterns to block
    DANGEROUS_PATTERNS = [
        r'[;&|`$]',  # Command injection characters
        r'\.\./\.\.',  # Path traversal
        r'rm\s+-rf',  # Dangerous rm commands
        r'del\s+/[sq]',  # Dangerous Windows delete
        r'format\s+c:',  # Format commands
        r'shutdown|reboot',  # System control
        r'net\s+user',  # User management
        r'reg\s+delete',  # Registry manipulation
    ]
    
    @staticmethod
    def sanitize_command_args(args: List[str]) -> List[str]:
        """
        Sanitize command line arguments to prevent injection attacks
        
        Args:
            args: List of command arguments
            
        Returns:
            Sanitized argument list
            
        Raises:
            ValueError: If dangerous patterns are detected
        """
        sanitized_args = []
        
        for arg in args:
            # Check for dangerous patterns
            for pattern in SecurityValidator.DANGEROUS_PATTERNS:
                if re.search(pattern, arg, re.IGNORECASE):
                    raise ValueError(f"Dangerous pattern detected in argument: {arg}")
            
            # Shell escape the argument
            sanitized_arg = shlex.quote(str(arg))
            sanitized_args.append(sanitized_arg)
        
        return sanitized_args
    
    @staticmethod
    def validate_file_path(file_path: str, base_dir: Optional[str] = None) -> Path:
        """
        Validate and normalize file paths to prevent path traversal
        
        Args:
            file_path: The file path to validate
            base_dir: Optional base directory to restrict access
            
        Returns:
            Validated and normalized Path object
            
        Raises:
            ValueError: If path is invalid or dangerous
        """
        try:
            # Normalize the path
            path = Path(file_path).resolve()
            
            # Check for path traversal attempts
            if '..' in file_path or str(path).startswith('..'):
                raise ValueError("Path traversal attempt detected")
            
            # If base directory is specified, ensure path is within it
            if base_dir:
                base_path = Path(base_dir).resolve()
                try:
                    path.relative_to(base_path)
                except ValueError:
                    raise ValueError(f"Path outside allowed directory: {path}")
            
            # Check file extension
            if path.suffix.lower() not in SecurityValidator.ALLOWED_EXTENSIONS:
                raise ValueError(f"File extension not allowed: {path.suffix}")
            
            return path
            
        except Exception as e:
            raise ValueError(f"Invalid file path: {file_path} - {str(e)}")
    
    @staticmethod
    def validate_url(url: str) -> str:
        """
        Validate URL to prevent SSRF attacks
        
        Args:
            url: URL to validate
            
        Returns:
            Validated URL
            
        Raises:
            ValueError: If URL is invalid or dangerous
        """
        try:
            parsed = urlparse(url)
            
            # Only allow HTTPS and HTTP
            if parsed.scheme not in ['http', 'https']:
                raise ValueError(f"Invalid URL scheme: {parsed.scheme}")
            
            # Block localhost and private IP ranges (except for development)
            hostname = parsed.hostname
            if hostname and hostname not in ['localhost', '127.0.0.1'] and (
               hostname.startswith('192.168.') or \
               hostname.startswith('10.') or \
               hostname.startswith('172.') or \
               hostname == '0.0.0.0'):
                raise ValueError("Access to private networks not allowed")
            
            return url
            
        except Exception as e:
            raise ValueError(f"Invalid URL: {url} - {str(e)}")
    
    @staticmethod
    def sanitize_input(input_str: str, max_length: int = 10000) -> str:
        """
        Sanitize general text input
        
        Args:
            input_str: Input string to sanitize
            max_length: Maximum allowed length
            
        Returns:
            Sanitized string
            
        Raises:
            ValueError: If input is invalid
        """
        if not isinstance(input_str, str):
            raise ValueError("Input must be a string")
        
        if len(input_str) > max_length:
            raise ValueError(f"Input too long: {len(input_str)} > {max_length}")
        
        # Remove null bytes and control characters (except newlines and tabs)
        sanitized = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', input_str)
        
        return sanitized.strip()
    
    @staticmethod
    def validate_ai_prompt(prompt: str) -> str:
        """
        Validate AI prompts for safety
        
        Args:
            prompt: AI prompt to validate
            
        Returns:
            Validated prompt
            
        Raises:
            ValueError: If prompt contains unsafe content
        """
        # Check for prompt injection attempts
        dangerous_prompts = [
            'ignore previous instructions',
            'ignore all previous',
            'you are now',
            'new instructions',
            'system:',
            'admin:',
            'root:',
        ]
        
        prompt_lower = prompt.lower()
        for dangerous in dangerous_prompts:
            if dangerous in prompt_lower:
                raise ValueError(f"Potentially unsafe prompt detected")
        
        return SecurityValidator.sanitize_input(prompt, max_length=50000)


def require_safe_execution(func):
    """Decorator to ensure safe execution context"""
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            # Log security incidents
            import logging
            logging.warning(f"Security validation failed in {func.__name__}: {str(e)}")
            raise
    return wrapper