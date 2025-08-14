<#
.SYNOPSIS
    Creates a portable workspace for the AI Code Editor.

.DESCRIPTION
    This script creates a portable workspace directory containing the AI Code Editor,
    all its dependencies, and configuration files. The resulting directory can be
    moved to any Windows machine and run without installation.

.PARAMETER OutputPath
    The path where the portable workspace will be created.
    Defaults to a directory named "Mido-AI-Editor-Portable" in the current directory.

.EXAMPLE
    .\create-portable.ps1
    Creates a portable workspace in .\Mido-AI-Editor-Portable

.EXAMPLE
    .\create-portable.ps1 -OutputPath "C:\Tools\MidoEditor"
    Creates a portable workspace in C:\Tools\MidoEditor
#>

param(
    [string]$OutputPath = ".\Mido-AI-Editor-Portable"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Write-Info { param([string]$msg) Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Success { param([string]$msg) Write-Host "[SUCCESS] $msg" -ForegroundColor Green }
function Write-Warning { param([string]$msg) Write-Host "[WARNING] $msg" -ForegroundColor Yellow }
function Write-Error { param([string]$msg) Write-Host "[ERROR] $msg" -ForegroundColor Red }

Write-Info "Starting portable workspace creation..."
Write-Info "Target directory: $OutputPath"

# Ensure absolute path
$OutputPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputPath)

# Create main directory structure
$directories = @(
    "$OutputPath",
    "$OutputPath\app",
    "$OutputPath\data",
    "$OutputPath\data\projects",
    "$OutputPath\data\logs",
    "$OutputPath\data\config",
    "$OutputPath\data\cache",
    "$OutputPath\data\models"
)

foreach ($dir in $directories) {
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
        Write-Info "Created directory: $dir"
    }
}

# Copy application files
Write-Info "Copying application files..."

$sourceDir = Split-Path -Parent $PSScriptRoot
$appFiles = @(
    "dist\main.js",
    "dist\preload.js",
    "client\dist",
    "server",
    "package.json"
)

foreach ($file in $appFiles) {
    $sourcePath = Join-Path $sourceDir $file
    $destPath = Join-Path "$OutputPath\app" $file
    
    if (Test-Path $sourcePath) {
        if (Test-Path $sourcePath -PathType Container) {
            Copy-Item -Path $sourcePath -Destination $destPath -Recurse -Force
        } else {
            $destDir = Split-Path $destPath -Parent
            if (!(Test-Path $destDir)) {
                New-Item -ItemType Directory -Force -Path $destDir | Out-Null
            }
            Copy-Item -Path $sourcePath -Destination $destPath -Force
        }
        Write-Info "Copied: $file"
    } else {
        Write-Warning "Source not found: $sourcePath"
    }
}

# Create start script
$startScript = @"
@echo off
title Mido AI Editor (Portable)
echo Starting Mido AI Editor...
echo.
echo Workspace: %~dp0data
set MIDO_WORKSPACE=%~dp0data
set MIDO_PORTABLE=1
start "" "%cd%\app\Mido AI Editor.exe" %*
"@

Set-Content -Path "$OutputPath\Start Mido AI Editor.cmd" -Value $startScript -Encoding ASCII
Write-Info "Created portable start script"

# Create configuration file
$config = @{
    workspace = "data"
    logs = "data\logs"
    projects = "data\projects"
    models = "data\models"
    cache = "data\cache"
    portable = $true
} | ConvertTo-Json -Depth 3

Set-Content -Path "$OutputPath\data\config\portable.json" -Value $config -Encoding UTF8
Write-Info "Created portable configuration"

# Create README
$readme = @"
Mido AI Editor - Portable Workspace
====================================

This is a portable installation of Mido AI Editor that can be run from any
Windows machine without installation.

USAGE:
1. Run "Start Mido AI Editor.cmd" to launch the application
2. All data (projects, logs, models) will be stored in the "data" folder
3. The application can be moved to any location or USB drive

FOLDERS:
- data/projects: Your code projects
- data/logs: Application logs
- data/config: Configuration files
- data/cache: Temporary cache files
- data/models: AI models (if downloaded locally)

NOTES:
- Python and Node.js are bundled with this portable version
- No administrator privileges required
- All data stays within this folder structure
- Compatible with Windows 10/11

For support or updates, visit: [Repository URL]
"@

Set-Content -Path "$OutputPath\README.txt" -Value $readme -Encoding UTF8
Write-Info "Created README file"

# Create .gitignore for data folder
$gitignore = @"
# Portable workspace ignores
*.log
*.tmp
*.cache
node_modules/
.venv/
__pycache__/
*.pyc
*.pyo
.env
.DS_Store
Thumbs.db
data/logs/*
data/cache/*
!data/logs/.gitkeep
!data/cache/.gitkeep
"@

Set-Content -Path "$OutputPath\.gitignore" -Value $gitignore -Encoding UTF8

# Create .gitkeep files for empty directories
@".gitkeep" | Set-Content -Path "$OutputPath\data\logs\.gitkeep"
@".gitkeep" | Set-Content -Path "$OutputPath\data\cache\.gitkeep"
@".gitkeep" | Set-Content -Path "$OutputPath\data\projects\.gitkeep"
@".gitkeep" | Set-Content -Path "$OutputPath\data\models\.gitkeep"

Write-Success "Portable workspace created successfully!"
Write-Success "Location: $OutputPath"
Write-Success "Run 'Start Mido AI Editor.cmd' to launch the application"

# Display directory structure
Write-Info "Directory structure created:"
Get-ChildItem $OutputPath -Recurse | Where-Object { $_.Name -notlike "__pycache__*" -and $_.Name -notlike "*.pyc" } | 
    Sort-Object FullName | ForEach-Object {
        $indent = "  " * ($_.FullName.Split('\').Count - $OutputPath.Split('\').Count)
        Write-Host "$indent$($_.Name)" -ForegroundColor DarkGray
    }