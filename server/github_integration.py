"""
Enhanced GitHub Integration for AI Code Editor
Provides advanced GitHub features including PR management, issue tracking, and code review
"""

import json
import asyncio
from typing import Dict, List, Optional, Any
import httpx
from fastapi import HTTPException
import subprocess
import os

class GitHubIntegration:
    def __init__(self, token: Optional[str] = None):
        self.token = token
        self.base_url = "https://api.github.com"
        self.headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "AI-Code-Editor/1.0"
        }
        if token:
            self.headers["Authorization"] = f"token {token}"

    async def get_repo_info(self, owner: str, repo: str) -> Dict[str, Any]:
        """Get repository information"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/repos/{owner}/{repo}",
                headers=self.headers
            )
            if response.status_code == 200:
                return response.json()
            raise HTTPException(status_code=response.status_code, detail="Failed to fetch repo info")

    async def list_pull_requests(self, owner: str, repo: str, state: str = "open") -> List[Dict[str, Any]]:
        """List pull requests"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/repos/{owner}/{repo}/pulls",
                headers=self.headers,
                params={"state": state}
            )
            if response.status_code == 200:
                return response.json()
            raise HTTPException(status_code=response.status_code, detail="Failed to fetch pull requests")

    async def create_pull_request(self, owner: str, repo: str, title: str, body: str, 
                                head: str, base: str = "main") -> Dict[str, Any]:
        """Create a pull request"""
        data = {
            "title": title,
            "body": body,
            "head": head,
            "base": base
        }
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/repos/{owner}/{repo}/pulls",
                headers=self.headers,
                json=data
            )
            if response.status_code == 201:
                return response.json()
            raise HTTPException(status_code=response.status_code, detail="Failed to create pull request")

    async def list_issues(self, owner: str, repo: str, state: str = "open") -> List[Dict[str, Any]]:
        """List issues"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/repos/{owner}/{repo}/issues",
                headers=self.headers,
                params={"state": state}
            )
            if response.status_code == 200:
                return response.json()
            raise HTTPException(status_code=response.status_code, detail="Failed to fetch issues")

    async def create_issue(self, owner: str, repo: str, title: str, body: str, 
                          labels: Optional[List[str]] = None) -> Dict[str, Any]:
        """Create an issue"""
        data = {
            "title": title,
            "body": body
        }
        if labels:
            data["labels"] = labels
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/repos/{owner}/{repo}/issues",
                headers=self.headers,
                json=data
            )
            if response.status_code == 201:
                return response.json()
            raise HTTPException(status_code=response.status_code, detail="Failed to create issue")

    async def get_commit_history(self, owner: str, repo: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get commit history"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/repos/{owner}/{repo}/commits",
                headers=self.headers,
                params={"per_page": limit}
            )
            if response.status_code == 200:
                return response.json()
            raise HTTPException(status_code=response.status_code, detail="Failed to fetch commits")

    async def analyze_code_changes(self, owner: str, repo: str, sha: str) -> Dict[str, Any]:
        """Analyze code changes in a commit"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/repos/{owner}/{repo}/commits/{sha}",
                headers=self.headers
            )
            if response.status_code == 200:
                commit_data = response.json()
                return {
                    "sha": sha,
                    "message": commit_data["commit"]["message"],
                    "author": commit_data["commit"]["author"]["name"],
                    "date": commit_data["commit"]["author"]["date"],
                    "files_changed": len(commit_data["files"]),
                    "additions": commit_data["stats"]["additions"],
                    "deletions": commit_data["stats"]["deletions"],
                    "files": [
                        {
                            "filename": f["filename"],
                            "status": f["status"],
                            "additions": f["additions"],
                            "deletions": f["deletions"]
                        }
                        for f in commit_data["files"]
                    ]
                }
            raise HTTPException(status_code=response.status_code, detail="Failed to analyze changes")

    def get_local_repo_info(self) -> Dict[str, str]:
        """Get local repository information"""
        try:
            # Get remote URL
            result = subprocess.run(['git', 'remote', 'get-url', 'origin'], 
                                  capture_output=True, text=True)
            if result.returncode == 0:
                remote_url = result.stdout.strip()
                # Parse GitHub URL
                if 'github.com' in remote_url:
                    if remote_url.startswith('git@'):
                        # SSH format: git@github.com:owner/repo.git
                        parts = remote_url.replace('git@github.com:', '').replace('.git', '').split('/')
                    else:
                        # HTTPS format: https://github.com/owner/repo.git
                        parts = remote_url.replace('https://github.com/', '').replace('.git', '').split('/')
                    
                    if len(parts) == 2:
                        return {"owner": parts[0], "repo": parts[1]}
            
            return {"owner": "", "repo": ""}
        except Exception:
            return {"owner": "", "repo": ""}

    async def suggest_pr_description(self, owner: str, repo: str, branch: str) -> str:
        """Generate AI-powered PR description based on recent commits"""
        try:
            # Get recent commits on the branch
            commits = await self.get_commit_history(owner, repo, limit=5)
            
            # Analyze commit messages and changes
            changes_summary = []
            for commit in commits[:3]:  # Analyze last 3 commits
                analysis = await self.analyze_code_changes(owner, repo, commit["sha"])
                changes_summary.append({
                    "message": analysis["message"],
                    "files": analysis["files_changed"],
                    "additions": analysis["additions"],
                    "deletions": analysis["deletions"]
                })
            
            # Generate description based on changes
            description = "## Changes Summary\n\n"
            for i, change in enumerate(changes_summary, 1):
                description += f"{i}. {change['message']}\n"
                description += f"   - Files changed: {change['files']}\n"
                description += f"   - Lines added: {change['additions']}, deleted: {change['deletions']}\n\n"
            
            description += "## Test Plan\n\n"
            description += "- [ ] Manual testing completed\n"
            description += "- [ ] Unit tests updated\n"
            description += "- [ ] Integration tests passed\n\n"
            
            description += "## Review Notes\n\n"
            description += "Please review the changes and provide feedback.\n\n"
            description += "🤖 Generated with [Claude Code](https://claude.ai/code)"
            
            return description
        except Exception as e:
            return f"## Changes Summary\n\nRecent updates to improve functionality.\n\n## Test Plan\n\n- [ ] Manual testing completed\n\n🤖 Generated with [Claude Code](https://claude.ai/code)\n\nError generating detailed description: {str(e)}"