"""
GitHub Router - API endpoints for GitHub integration
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
from github_integration import GitHubIntegration

router = APIRouter(prefix="/github", tags=["github"])

# Pydantic models
class CreatePRRequest(BaseModel):
    title: str
    body: str
    head: str
    base: str = "main"

class CreateIssueRequest(BaseModel):
    title: str
    body: str
    labels: Optional[List[str]] = None

class RepoRequest(BaseModel):
    owner: str
    repo: str

def get_github_client():
    """Get GitHub client with token from environment"""
    token = os.getenv("GITHUB_TOKEN")
    return GitHubIntegration(token)

@router.get("/repo-info")
async def get_local_repo_info():
    """Get local repository information"""
    github = get_github_client()
    return github.get_local_repo_info()

@router.post("/repo-info")
async def get_repo_info(request: RepoRequest):
    """Get repository information from GitHub"""
    github = get_github_client()
    try:
        return await github.get_repo_info(request.owner, request.repo)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/pull-requests")
async def list_pull_requests(request: RepoRequest, state: str = "open"):
    """List pull requests"""
    github = get_github_client()
    try:
        return await github.list_pull_requests(request.owner, request.repo, state)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/pull-requests/create")
async def create_pull_request(request: RepoRequest, pr_data: CreatePRRequest):
    """Create a pull request"""
    github = get_github_client()
    try:
        return await github.create_pull_request(
            request.owner, request.repo, 
            pr_data.title, pr_data.body, 
            pr_data.head, pr_data.base
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/pull-requests/suggest-description")
async def suggest_pr_description(request: RepoRequest, branch: str):
    """Generate AI-powered PR description"""
    github = get_github_client()
    try:
        description = await github.suggest_pr_description(request.owner, request.repo, branch)
        return {"description": description}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/issues")
async def list_issues(request: RepoRequest, state: str = "open"):
    """List issues"""
    github = get_github_client()
    try:
        return await github.list_issues(request.owner, request.repo, state)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/issues/create")
async def create_issue(request: RepoRequest, issue_data: CreateIssueRequest):
    """Create an issue"""
    github = get_github_client()
    try:
        return await github.create_issue(
            request.owner, request.repo,
            issue_data.title, issue_data.body,
            issue_data.labels
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/commits")
async def get_commit_history(request: RepoRequest, limit: int = 10):
    """Get commit history"""
    github = get_github_client()
    try:
        return await github.get_commit_history(request.owner, request.repo, limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/commits/{sha}/analysis")
async def analyze_commit(request: RepoRequest, sha: str):
    """Analyze code changes in a commit"""
    github = get_github_client()
    try:
        return await github.analyze_code_changes(request.owner, request.repo, sha)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status")
async def github_status():
    """Check GitHub integration status"""
    token = os.getenv("GITHUB_TOKEN")
    github = get_github_client()
    local_repo = github.get_local_repo_info()
    
    return {
        "token_configured": bool(token),
        "local_repo": local_repo,
        "features_available": [
            "Repository info",
            "Pull request management",
            "Issue tracking",
            "Commit analysis",
            "AI-powered PR descriptions"
        ]
    }