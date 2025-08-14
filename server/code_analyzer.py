"""
Advanced Code Analysis and Review Tool
Provides intelligent code analysis, vulnerability detection, and code quality assessment
"""

import ast
import os
import re
import json
from typing import Dict, List, Any, Optional, Tuple
from pathlib import Path
import subprocess
from dataclasses import dataclass
from collections import defaultdict

@dataclass
class CodeIssue:
    type: str
    severity: str  # 'critical', 'high', 'medium', 'low', 'info'
    file: str
    line: int
    column: int
    message: str
    suggestion: str
    rule_id: str

@dataclass
class CodeMetrics:
    lines_of_code: int
    cyclomatic_complexity: int
    maintainability_index: float
    tech_debt_ratio: float
    test_coverage: float

class CodeAnalyzer:
    def __init__(self, project_path: str):
        self.project_path = Path(project_path)
        self.supported_extensions = {'.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.cpp', '.c', '.cs'}
        
    def analyze_project(self) -> Dict[str, Any]:
        """Comprehensive project analysis"""
        results = {
            "summary": self._get_project_summary(),
            "issues": self._find_code_issues(),
            "metrics": self._calculate_metrics(),
            "dependencies": self._analyze_dependencies(),
            "security": self._security_scan(),
            "recommendations": []
        }
        
        results["recommendations"] = self._generate_recommendations(results)
        return results
    
    def _get_project_summary(self) -> Dict[str, Any]:
        """Get basic project statistics"""
        file_counts = defaultdict(int)
        total_lines = 0
        total_files = 0
        
        for file_path in self.project_path.rglob("*"):
            if file_path.is_file() and not self._should_ignore_file(file_path):
                ext = file_path.suffix.lower()
                file_counts[ext] += 1
                total_files += 1
                
                if ext in self.supported_extensions:
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            total_lines += sum(1 for line in f if line.strip())
                    except:
                        pass
        
        return {
            "total_files": total_files,
            "total_lines": total_lines,
            "file_types": dict(file_counts),
            "languages_detected": self._detect_languages()
        }
    
    def _find_code_issues(self) -> List[CodeIssue]:
        """Find potential code issues"""
        issues = []
        
        for file_path in self.project_path.rglob("*"):
            if file_path.is_file() and not self._should_ignore_file(file_path):
                ext = file_path.suffix.lower()
                
                if ext == '.py':
                    issues.extend(self._analyze_python_file(file_path))
                elif ext in ['.js', '.ts', '.jsx', '.tsx']:
                    issues.extend(self._analyze_javascript_file(file_path))
                else:
                    issues.extend(self._analyze_generic_file(file_path))
        
        return sorted(issues, key=lambda x: (x.severity, x.file))
    
    def _analyze_python_file(self, file_path: Path) -> List[CodeIssue]:
        """Analyze Python files for issues"""
        issues = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = content.split('\n')
            
            # Parse AST for structural analysis
            try:
                tree = ast.parse(content)
                issues.extend(self._analyze_python_ast(tree, file_path, lines))
            except SyntaxError as e:
                issues.append(CodeIssue(
                    type="syntax_error",
                    severity="critical",
                    file=str(file_path),
                    line=e.lineno or 1,
                    column=e.offset or 0,
                    message=f"Syntax error: {e.msg}",
                    suggestion="Fix the syntax error",
                    rule_id="SYNTAX001"
                ))
            
            # Line-by-line analysis
            for i, line in enumerate(lines, 1):
                issues.extend(self._analyze_python_line(line, i, file_path))
                
        except Exception as e:
            issues.append(CodeIssue(
                type="analysis_error",
                severity="low",
                file=str(file_path),
                line=1,
                column=0,
                message=f"Could not analyze file: {e}",
                suggestion="Check file encoding and permissions",
                rule_id="ANALYSIS001"
            ))
        
        return issues
    
    def _analyze_python_ast(self, tree: ast.AST, file_path: Path, lines: List[str]) -> List[CodeIssue]:
        """Analyze Python AST for complex issues"""
        issues = []
        
        class IssueVisitor(ast.NodeVisitor):
            def visit_FunctionDef(self, node):
                # Check function complexity
                complexity = self._calculate_function_complexity(node)
                if complexity > 10:
                    issues.append(CodeIssue(
                        type="complexity",
                        severity="medium",
                        file=str(file_path),
                        line=node.lineno,
                        column=node.col_offset,
                        message=f"Function '{node.name}' has high complexity ({complexity})",
                        suggestion="Consider breaking down this function into smaller functions",
                        rule_id="COMPLEXITY001"
                    ))
                
                # Check for long functions
                if hasattr(node, 'end_lineno') and node.end_lineno:
                    func_length = node.end_lineno - node.lineno
                    if func_length > 50:
                        issues.append(CodeIssue(
                            type="function_length",
                            severity="low",
                            file=str(file_path),
                            line=node.lineno,
                            column=node.col_offset,
                            message=f"Function '{node.name}' is too long ({func_length} lines)",
                            suggestion="Consider breaking down this function",
                            rule_id="LENGTH001"
                        ))
                
                self.generic_visit(node)
            
            def visit_Try(self, node):
                # Check for bare except clauses
                for handler in node.handlers:
                    if handler.type is None:
                        issues.append(CodeIssue(
                            type="bare_except",
                            severity="medium",
                            file=str(file_path),
                            line=handler.lineno,
                            column=handler.col_offset,
                            message="Bare except clause catches all exceptions",
                            suggestion="Specify the exception type(s) to catch",
                            rule_id="EXCEPT001"
                        ))
                
                self.generic_visit(node)
        
        visitor = IssueVisitor()
        visitor.visit(tree)
        
        return issues
    
    def _analyze_python_line(self, line: str, line_num: int, file_path: Path) -> List[CodeIssue]:
        """Analyze individual Python lines"""
        issues = []
        stripped = line.strip()
        
        # Check line length
        if len(line) > 120:
            issues.append(CodeIssue(
                type="line_length",
                severity="low",
                file=str(file_path),
                line=line_num,
                column=120,
                message=f"Line too long ({len(line)} characters)",
                suggestion="Break long lines for better readability",
                rule_id="LENGTH002"
            ))
        
        # Check for potential security issues
        security_patterns = [
            (r'eval\(', "Use of eval() can be dangerous"),
            (r'exec\(', "Use of exec() can be dangerous"),
            (r'__import__\(', "Dynamic imports can be risky"),
            (r'pickle\.loads?\(', "Pickle deserialization can be unsafe"),
            (r'shell=True', "Shell=True in subprocess can be dangerous"),
        ]
        
        for pattern, message in security_patterns:
            if re.search(pattern, line):
                issues.append(CodeIssue(
                    type="security",
                    severity="high",
                    file=str(file_path),
                    line=line_num,
                    column=line.find(re.search(pattern, line).group()),
                    message=message,
                    suggestion="Consider safer alternatives",
                    rule_id="SECURITY001"
                ))
        
        return issues
    
    def _analyze_javascript_file(self, file_path: Path) -> List[CodeIssue]:
        """Analyze JavaScript/TypeScript files"""
        issues = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            for i, line in enumerate(lines, 1):
                issues.extend(self._analyze_javascript_line(line, i, file_path))
                
        except Exception as e:
            issues.append(CodeIssue(
                type="analysis_error",
                severity="low",
                file=str(file_path),
                line=1,
                column=0,
                message=f"Could not analyze file: {e}",
                suggestion="Check file encoding and permissions",
                rule_id="ANALYSIS002"
            ))
        
        return issues
    
    def _analyze_javascript_line(self, line: str, line_num: int, file_path: Path) -> List[CodeIssue]:
        """Analyze individual JavaScript/TypeScript lines"""
        issues = []
        stripped = line.strip()
        
        # Check for common JS issues
        js_patterns = [
            (r'console\.log\(', "Console.log found in production code", "low"),
            (r'debugger;', "Debugger statement found", "medium"),
            (r'alert\(', "Alert() should not be used in production", "medium"),
            (r'document\.write\(', "document.write() is deprecated", "medium"),
            (r'innerHTML\s*=', "innerHTML can be vulnerable to XSS", "high"),
            (r'eval\(', "eval() usage can be dangerous", "high"),
        ]
        
        for pattern, message, severity in js_patterns:
            if re.search(pattern, line):
                issues.append(CodeIssue(
                    type="best_practice",
                    severity=severity,
                    file=str(file_path),
                    line=line_num,
                    column=line.find(re.search(pattern, line).group()),
                    message=message,
                    suggestion="Consider safer alternatives",
                    rule_id="JS001"
                ))
        
        return issues
    
    def _analyze_generic_file(self, file_path: Path) -> List[CodeIssue]:
        """Generic analysis for other file types"""
        issues = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            # Check for common issues in any code file
            for i, line in enumerate(lines, 1):
                # Check for TODO/FIXME comments
                if re.search(r'(TODO|FIXME|HACK|XXX)', line, re.IGNORECASE):
                    issues.append(CodeIssue(
                        type="todo",
                        severity="info",
                        file=str(file_path),
                        line=i,
                        column=0,
                        message="TODO/FIXME comment found",
                        suggestion="Consider addressing this item",
                        rule_id="TODO001"
                    ))
                
                # Check for hardcoded credentials patterns
                cred_patterns = [
                    r'password\s*=\s*["\'][^"\']+["\']',
                    r'api_key\s*=\s*["\'][^"\']+["\']',
                    r'secret\s*=\s*["\'][^"\']+["\']',
                    r'token\s*=\s*["\'][^"\']+["\']'
                ]
                
                for pattern in cred_patterns:
                    if re.search(pattern, line, re.IGNORECASE):
                        issues.append(CodeIssue(
                            type="security",
                            severity="critical",
                            file=str(file_path),
                            line=i,
                            column=0,
                            message="Potential hardcoded credential found",
                            suggestion="Use environment variables or secure vaults",
                            rule_id="SECURITY002"
                        ))
                
        except:
            pass  # Skip files that can't be read as text
        
        return issues
    
    def _calculate_metrics(self) -> CodeMetrics:
        """Calculate code quality metrics"""
        total_loc = 0
        total_complexity = 0
        function_count = 0
        
        for file_path in self.project_path.rglob("*.py"):
            if not self._should_ignore_file(file_path):
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        lines = [l for l in content.split('\n') if l.strip()]
                        total_loc += len(lines)
                    
                    # Calculate complexity for Python files
                    try:
                        tree = ast.parse(content)
                        for node in ast.walk(tree):
                            if isinstance(node, ast.FunctionDef):
                                function_count += 1
                                total_complexity += self._calculate_function_complexity(node)
                    except:
                        pass
                        
                except:
                    continue
        
        avg_complexity = total_complexity / max(function_count, 1)
        maintainability = max(0, 100 - avg_complexity * 5)  # Simplified calculation
        tech_debt = min(100, avg_complexity * 2)  # Simplified calculation
        
        return CodeMetrics(
            lines_of_code=total_loc,
            cyclomatic_complexity=avg_complexity,
            maintainability_index=maintainability,
            tech_debt_ratio=tech_debt,
            test_coverage=0.0  # Would need coverage tools integration
        )
    
    def _analyze_dependencies(self) -> Dict[str, Any]:
        """Analyze project dependencies"""
        dependencies = {
            "python": [],
            "javascript": [],
            "outdated": [],
            "security_issues": []
        }
        
        # Analyze Python dependencies
        requirements_file = self.project_path / "requirements.txt"
        if requirements_file.exists():
            try:
                with open(requirements_file, 'r') as f:
                    dependencies["python"] = [line.strip() for line in f if line.strip() and not line.startswith('#')]
            except:
                pass
        
        # Analyze JavaScript dependencies
        package_json = self.project_path / "package.json"
        if package_json.exists():
            try:
                with open(package_json, 'r') as f:
                    data = json.load(f)
                    deps = data.get('dependencies', {})
                    dev_deps = data.get('devDependencies', {})
                    dependencies["javascript"] = list(deps.keys()) + list(dev_deps.keys())
            except:
                pass
        
        return dependencies
    
    def _security_scan(self) -> List[Dict[str, Any]]:
        """Basic security vulnerability scan"""
        vulnerabilities = []
        
        # Check for common vulnerability patterns
        vuln_patterns = [
            {
                "pattern": r"sql\s*=.*\+.*",
                "type": "SQL Injection",
                "severity": "high",
                "description": "Potential SQL injection vulnerability"
            },
            {
                "pattern": r"\.innerHTML\s*=.*\+",
                "type": "XSS",
                "severity": "high", 
                "description": "Potential XSS vulnerability via innerHTML"
            },
            {
                "pattern": r"pickle\.loads?\(",
                "type": "Deserialization",
                "severity": "critical",
                "description": "Unsafe deserialization with pickle"
            }
        ]
        
        for file_path in self.project_path.rglob("*"):
            if file_path.is_file() and not self._should_ignore_file(file_path):
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        lines = content.split('\n')
                    
                    for i, line in enumerate(lines, 1):
                        for vuln in vuln_patterns:
                            if re.search(vuln["pattern"], line, re.IGNORECASE):
                                vulnerabilities.append({
                                    "type": vuln["type"],
                                    "severity": vuln["severity"],
                                    "file": str(file_path),
                                    "line": i,
                                    "description": vuln["description"],
                                    "code_snippet": line.strip()
                                })
                except:
                    continue
        
        return vulnerabilities
    
    def _generate_recommendations(self, analysis: Dict[str, Any]) -> List[str]:
        """Generate improvement recommendations based on analysis"""
        recommendations = []
        
        # Based on issues found
        issue_counts = defaultdict(int)
        for issue in analysis["issues"]:
            issue_counts[issue.type] += 1
        
        if issue_counts.get("security", 0) > 0:
            recommendations.append("🔒 Address security vulnerabilities immediately")
        
        if issue_counts.get("complexity", 0) > 3:
            recommendations.append("🧠 Refactor complex functions to improve maintainability")
        
        if issue_counts.get("line_length", 0) > 10:
            recommendations.append("📏 Consider using a code formatter to maintain consistent line length")
        
        # Based on metrics
        metrics = analysis["metrics"]
        if metrics.cyclomatic_complexity > 5:
            recommendations.append("📊 High complexity detected - consider simplifying code logic")
        
        if metrics.maintainability_index < 50:
            recommendations.append("🔧 Low maintainability - refactoring recommended")
        
        # Based on dependencies
        deps = analysis["dependencies"]
        if len(deps["python"]) > 20 or len(deps["javascript"]) > 30:
            recommendations.append("📦 Consider reducing dependency count for better security and performance")
        
        if not recommendations:
            recommendations.append("✅ Code quality looks good! Keep up the excellent work!")
        
        return recommendations
    
    def _should_ignore_file(self, file_path: Path) -> bool:
        """Check if file should be ignored in analysis"""
        ignore_patterns = [
            '.git', '__pycache__', 'node_modules', '.venv', 'venv',
            'dist', 'build', '.pytest_cache', '.mypy_cache',
            '.coverage', '*.pyc', '*.pyo', '*.pyd', '*.so',
            '*.egg-info', '.DS_Store', 'Thumbs.db'
        ]
        
        path_str = str(file_path)
        return any(pattern in path_str for pattern in ignore_patterns)
    
    def _detect_languages(self) -> List[str]:
        """Detect programming languages in the project"""
        languages = set()
        
        lang_extensions = {
            'Python': ['.py', '.pyw'],
            'JavaScript': ['.js', '.mjs'],
            'TypeScript': ['.ts', '.tsx'],
            'React': ['.jsx'],
            'Java': ['.java'],
            'C++': ['.cpp', '.cc', '.cxx'],
            'C': ['.c'],
            'C#': ['.cs'],
            'Go': ['.go'],
            'Rust': ['.rs'],
            'PHP': ['.php'],
            'Ruby': ['.rb'],
            'Swift': ['.swift'],
            'Kotlin': ['.kt'],
            'HTML': ['.html', '.htm'],
            'CSS': ['.css', '.scss', '.sass'],
            'SQL': ['.sql']
        }
        
        for file_path in self.project_path.rglob("*"):
            if file_path.is_file() and not self._should_ignore_file(file_path):
                ext = file_path.suffix.lower()
                for lang, exts in lang_extensions.items():
                    if ext in exts:
                        languages.add(lang)
                        break
        
        return sorted(list(languages))
    
    def _calculate_function_complexity(self, node: ast.FunctionDef) -> int:
        """Calculate cyclomatic complexity of a function"""
        complexity = 1  # Base complexity
        
        for child in ast.walk(node):
            if isinstance(child, (ast.If, ast.While, ast.For, ast.AsyncFor)):
                complexity += 1
            elif isinstance(child, ast.ExceptHandler):
                complexity += 1
            elif isinstance(child, (ast.And, ast.Or)):
                complexity += 1
        
        return complexity