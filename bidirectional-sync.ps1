# Bidirectional Git Sync Script
# Automatically pulls changes from GitHub AND pushes local changes

Write-Host "Starting Bidirectional Git Sync..." -ForegroundColor Green
Write-Host "Monitoring directory: $PWD" -ForegroundColor Yellow
Write-Host "This will sync changes both ways (local <-> GitHub)" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow

# Function to check for remote changes and pull them
function Pull-RemoteChanges {
    Write-Host "Checking for remote changes..." -ForegroundColor Cyan
    
    # Fetch remote changes
    git fetch origin main
    
    # Check if remote has new commits
    $localCommit = git rev-parse HEAD
    $remoteCommit = git rev-parse origin/main
    
    if ($localCommit -ne $remoteCommit) {
        Write-Host "Remote changes detected, pulling..." -ForegroundColor Yellow
        
        # Check if there are local uncommitted changes
        $status = git status --porcelain
        if ($status) {
            Write-Host "Local changes detected, stashing before pull..." -ForegroundColor Magenta
            git stash push -m "Auto-stash before pull $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
            
            git pull origin main
            
            Write-Host "Reapplying local changes..." -ForegroundColor Magenta
            git stash pop
        } else {
            git pull origin main
        }
        
        Write-Host "Remote changes pulled successfully!" -ForegroundColor Green
    }
}

# Function to commit and push local changes
function Push-LocalChanges {
    $status = git status --porcelain
    if ($status) {
        Write-Host "Local changes detected, pushing..." -ForegroundColor Cyan
        
        # Add all changes
        git add .
        
        # Create commit with timestamp
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        git commit -m "Auto-sync: $timestamp

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
        
        # Push to GitHub
        git push origin main
        
        Write-Host "Local changes pushed successfully!" -ForegroundColor Green
    }
}

# Function to perform full sync
function Sync-Repository {
    try {
        # First pull remote changes
        Pull-RemoteChanges
        
        # Then push local changes
        Push-LocalChanges
        
        Write-Host "Sync complete!" -ForegroundColor Green
    } catch {
        Write-Host "Error during sync: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Initial sync
Write-Host "Performing initial sync..." -ForegroundColor Blue
Sync-Repository

# Watch for changes every 30 seconds
while ($true) {
    Start-Sleep -Seconds 30
    Sync-Repository
}