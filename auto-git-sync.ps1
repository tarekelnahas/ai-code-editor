# Auto Git Sync Script
# Automatically commits and pushes changes to GitHub

Write-Host "Starting Auto Git Sync..." -ForegroundColor Green
Write-Host "Monitoring directory: $PWD" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow

# Function to commit and push changes
function Sync-Changes {
    $status = git status --porcelain
    if ($status) {
        Write-Host "Changes detected, syncing..." -ForegroundColor Cyan
        
        # Add all changes
        git add .
        
        # Create commit with timestamp
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        git commit -m "Auto-sync: $timestamp

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
        
        # Push to GitHub
        git push origin main
        
        Write-Host "Changes synced successfully!" -ForegroundColor Green
    }
}

# Initial sync
Sync-Changes

# Watch for changes every 30 seconds
while ($true) {
    Start-Sleep -Seconds 30
    Sync-Changes
}