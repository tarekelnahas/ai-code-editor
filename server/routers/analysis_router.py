"""
Code Analysis Router - API endpoints for code analysis and review
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
import os
from pathlib import Path
from code_analyzer import CodeAnalyzer

router = APIRouter(prefix="/analysis", tags=["analysis"])

# Pydantic models
class AnalysisRequest(BaseModel):
    project_path: Optional[str] = None
    file_path: Optional[str] = None
    analysis_type: str = "full"  # full, quick, security

class FileAnalysisRequest(BaseModel):
    file_path: str
    content: Optional[str] = None

# Cache for analysis results
analysis_cache = {}

@router.post("/project")
async def analyze_project(request: AnalysisRequest, background_tasks: BackgroundTasks):
    """Analyze entire project for code quality, security, and best practices"""
    try:
        project_path = request.project_path or os.getcwd()
        
        if not os.path.exists(project_path):
            raise HTTPException(status_code=400, detail="Project path does not exist")
        
        analyzer = CodeAnalyzer(project_path)
        
        if request.analysis_type == "quick":
            # Quick analysis - basic metrics only
            result = {
                "summary": analyzer._get_project_summary(),
                "metrics": analyzer._calculate_metrics(),
                "type": "quick"
            }
        elif request.analysis_type == "security":
            # Security-focused analysis
            result = {
                "summary": analyzer._get_project_summary(),
                "security": analyzer._security_scan(),
                "issues": [issue for issue in analyzer._find_code_issues() 
                          if issue.type == "security"],
                "type": "security"
            }
        else:
            # Full analysis
            result = analyzer.analyze_project()
            result["type"] = "full"
        
        # Cache the results
        cache_key = f"{project_path}_{request.analysis_type}"
        analysis_cache[cache_key] = result
        
        return {
            "status": "completed",
            "analysis": result,
            "cache_key": cache_key
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@router.post("/file")
async def analyze_file(request: FileAnalysisRequest):
    """Analyze a single file"""
    try:
        file_path = Path(request.file_path)
        
        if not request.content and not file_path.exists():
            raise HTTPException(status_code=400, detail="File does not exist and no content provided")
        
        # Create a temporary analyzer for the file's directory
        analyzer = CodeAnalyzer(file_path.parent if file_path.exists() else ".")
        
        issues = []
        if file_path.suffix.lower() == '.py':
            issues = analyzer._analyze_python_file(file_path)
        elif file_path.suffix.lower() in ['.js', '.ts', '.jsx', '.tsx']:
            issues = analyzer._analyze_javascript_file(file_path)
        else:
            issues = analyzer._analyze_generic_file(file_path)
        
        return {
            "file": str(file_path),
            "issues": [
                {
                    "type": issue.type,
                    "severity": issue.severity,
                    "line": issue.line,
                    "column": issue.column,
                    "message": issue.message,
                    "suggestion": issue.suggestion,
                    "rule_id": issue.rule_id
                }
                for issue in issues
            ],
            "issue_count": len(issues),
            "severity_counts": {
                "critical": len([i for i in issues if i.severity == "critical"]),
                "high": len([i for i in issues if i.severity == "high"]),
                "medium": len([i for i in issues if i.severity == "medium"]),
                "low": len([i for i in issues if i.severity == "low"]),
                "info": len([i for i in issues if i.severity == "info"])
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File analysis failed: {str(e)}")

@router.get("/project/summary")
async def get_project_summary(project_path: Optional[str] = None):
    """Get basic project statistics"""
    try:
        path = project_path or os.getcwd()
        analyzer = CodeAnalyzer(path)
        summary = analyzer._get_project_summary()
        
        return {
            "project_path": path,
            "summary": summary
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Summary failed: {str(e)}")

@router.get("/project/metrics")
async def get_code_metrics(project_path: Optional[str] = None):
    """Get code quality metrics"""
    try:
        path = project_path or os.getcwd()
        analyzer = CodeAnalyzer(path)
        metrics = analyzer._calculate_metrics()
        
        return {
            "project_path": path,
            "metrics": {
                "lines_of_code": metrics.lines_of_code,
                "cyclomatic_complexity": round(metrics.cyclomatic_complexity, 2),
                "maintainability_index": round(metrics.maintainability_index, 2),
                "tech_debt_ratio": round(metrics.tech_debt_ratio, 2),
                "test_coverage": round(metrics.test_coverage, 2)
            },
            "grade": _calculate_grade(metrics)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Metrics calculation failed: {str(e)}")

@router.get("/security-scan")
async def security_scan(project_path: Optional[str] = None):
    """Perform security vulnerability scan"""
    try:
        path = project_path or os.getcwd()
        analyzer = CodeAnalyzer(path)
        vulnerabilities = analyzer._security_scan()
        
        severity_counts = {
            "critical": len([v for v in vulnerabilities if v["severity"] == "critical"]),
            "high": len([v for v in vulnerabilities if v["severity"] == "high"]),
            "medium": len([v for v in vulnerabilities if v["severity"] == "medium"]),
            "low": len([v for v in vulnerabilities if v["severity"] == "low"])
        }
        
        return {
            "project_path": path,
            "vulnerabilities": vulnerabilities,
            "total_count": len(vulnerabilities),
            "severity_counts": severity_counts,
            "security_score": _calculate_security_score(severity_counts)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Security scan failed: {str(e)}")

@router.get("/dependencies")
async def analyze_dependencies(project_path: Optional[str] = None):
    """Analyze project dependencies"""
    try:
        path = project_path or os.getcwd()
        analyzer = CodeAnalyzer(path)
        dependencies = analyzer._analyze_dependencies()
        
        return {
            "project_path": path,
            "dependencies": dependencies,
            "total_count": len(dependencies["python"]) + len(dependencies["javascript"]),
            "recommendations": _get_dependency_recommendations(dependencies)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dependency analysis failed: {str(e)}")

@router.get("/cache/{cache_key}")
async def get_cached_analysis(cache_key: str):
    """Get cached analysis results"""
    if cache_key in analysis_cache:
        return {
            "status": "found",
            "analysis": analysis_cache[cache_key]
        }
    else:
        raise HTTPException(status_code=404, detail="Analysis not found in cache")

@router.delete("/cache/{cache_key}")
async def clear_cached_analysis(cache_key: str):
    """Clear specific cached analysis"""
    if cache_key in analysis_cache:
        del analysis_cache[cache_key]
        return {"status": "cleared"}
    else:
        raise HTTPException(status_code=404, detail="Analysis not found in cache")

@router.delete("/cache")
async def clear_all_cache():
    """Clear all cached analysis results"""
    analysis_cache.clear()
    return {"status": "all_cache_cleared"}

@router.get("/health")
async def analysis_health_check():
    """Health check for analysis service"""
    return {
        "status": "healthy",
        "cache_size": len(analysis_cache),
        "supported_languages": [
            "Python", "JavaScript", "TypeScript", "React", 
            "Java", "C++", "C", "C#", "Go", "Rust"
        ],
        "analysis_types": ["full", "quick", "security"],
        "features": [
            "Code quality analysis",
            "Security vulnerability scanning",
            "Dependency analysis",
            "Cyclomatic complexity calculation",
            "Best practices checking",
            "Technical debt assessment"
        ]
    }

def _calculate_grade(metrics) -> str:
    """Calculate overall code quality grade"""
    score = 0
    
    # Maintainability Index (0-100)
    score += metrics.maintainability_index * 0.4
    
    # Complexity penalty (lower is better)
    complexity_score = max(0, 100 - metrics.cyclomatic_complexity * 10)
    score += complexity_score * 0.3
    
    # Tech debt penalty (lower is better)
    tech_debt_score = max(0, 100 - metrics.tech_debt_ratio)
    score += tech_debt_score * 0.3
    
    if score >= 90:
        return "A"
    elif score >= 80:
        return "B"
    elif score >= 70:
        return "C"
    elif score >= 60:
        return "D"
    else:
        return "F"

def _calculate_security_score(severity_counts: Dict[str, int]) -> int:
    """Calculate security score based on vulnerability counts"""
    base_score = 100
    
    # Deduct points based on severity
    base_score -= severity_counts.get("critical", 0) * 25
    base_score -= severity_counts.get("high", 0) * 15
    base_score -= severity_counts.get("medium", 0) * 5
    base_score -= severity_counts.get("low", 0) * 1
    
    return max(0, base_score)

def _get_dependency_recommendations(dependencies: Dict[str, Any]) -> List[str]:
    """Generate dependency-related recommendations"""
    recommendations = []
    
    python_count = len(dependencies["python"])
    js_count = len(dependencies["javascript"])
    
    if python_count > 50:
        recommendations.append("Consider reducing Python dependencies for better security")
    
    if js_count > 100:
        recommendations.append("Large number of JavaScript dependencies detected - audit recommended")
    
    if python_count == 0 and js_count == 0:
        recommendations.append("No dependencies detected - ensure requirements files are present")
    
    return recommendations