<#
.SYNOPSIS
    Exports logs and diagnostic information for the AI Code Editor.

.DESCRIPTION
    This script collects application logs, system information, and diagnostic data
    into a ZIP file for troubleshooting and support purposes.

.PARAMETER OutputPath
    The path where the log archive will be saved.
    Defaults to a file named "mido-logs-[timestamp].zip" in the current directory.

.PARAMETER IncludeModels
    Include AI model files in the log export (can be large).

.PARAMETER Days
    Number of days of logs to include (default: 7).

.EXAMPLE
    .\export-logs.ps1
    Creates logs archive with default settings

.EXAMPLE
    .\export-logs.ps1 -OutputPath "C:\support\mido-logs.zip" -Days 14
    Creates logs archive with 14 days of history
#>

param(
    [string]$OutputPath,
    [switch]$IncludeModels,
    [int]$Days = 7
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Write-Info { param([string]$msg) Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Success { param([string]$msg) Write-Host "[SUCCESS] $msg" -ForegroundColor Green }
function Write-Warning { param([string]$msg) Write-Host "[WARNING] $msg" -ForegroundColor Yellow }
function Write-Error { param([string]$msg) Write-Host "[ERROR] $msg" -ForegroundColor Red }

# Determine output path
if ([string]::IsNullOrEmpty($OutputPath)) {
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $OutputPath = "mido-logs-$timestamp.zip"
}

$OutputPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputPath)
$tempDir = Join-Path $env:TEMP "mido-logs-$(Get-Random)"

Write-Info "Starting log export..."
Write-Info "Target archive: $OutputPath"
Write-Info "Including logs from last $Days days"

# Create temporary directory
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
Write-Info "Created temporary directory: $tempDir"

# Function to copy files with date filtering
function Copy-LogsWithFilter {
    param($SourceDir, $DestDir, $Pattern = "*.*")
    
    if (!(Test-Path $SourceDir)) {
        Write-Warning "Source directory not found: $SourceDir"
        return
    }
    
    $cutoffDate = (Get-Date).AddDays(-$Days)
    $files = Get-ChildItem -Path $SourceDir -Filter $Pattern -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -ge $cutoffDate }
    
    foreach ($file in $files) {
        $relativePath = $file.FullName.Substring($SourceDir.Length).TrimStart('\')
        $destFilePath = Join-Path $DestDir $relativePath
        $destFileDir = Split-Path $destFilePath -Parent
        
        if (!(Test-Path $destFileDir)) {
            New-Item -ItemType Directory -Force -Path $destFileDir | Out-Null
        }
        
        Copy-Item -Path $file.FullName -Destination $destFilePath -Force
    }
    
    Write-Info "Copied $($files.Count) log files from $SourceDir"
}

# Collect application logs
$logSources = @()

# Application logs from various locations
$appData = $env:APPDATA
$localAppData = $env:LOCALAPPDATA
$currentDir = Split-Path -Parent $PSScriptRoot

$logSources += @{ Source = "$currentDir\logs"; Dest = "app-logs" }
$logSources += @{ Source = "$currentDir\data\logs"; Dest = "data-logs" }
$logSources += @{ Source = "$appData\mido-ai-editor"; Dest = "appdata-logs" }
$logSources += @{ Source = "$localAppData\mido-ai-editor"; Dest = "localappdata-logs" }

# Python server logs
$logSources += @{ Source = "$currentDir\server\logs"; Dest = "python-logs" }

# Electron logs
$logSources += @{ Source = "$env:USERPROFILE\.config\mido-ai-editor"; Dest = "electron-logs" }

# VS Code extension logs (if applicable)
$logSources += @{ Source = "$env:USERPROFILE\.vscode\extensions\mido-ai-editor*"; Dest = "vscode-extension-logs" }

foreach ($source in $logSources) {
    if (Test-Path $source.Source) {
        $destPath = Join-Path $tempDir $source.Dest
        Copy-LogsWithFilter -SourceDir $source.Source -DestDir $destPath
    }
}

# Create system information report
Write-Info "Collecting system information..."
$systemInfo = @"
Mido AI Editor - Diagnostic Report
Generated: $(Get-Date)

=== SYSTEM INFORMATION ===
OS: $(Get-CimInstance -ClassName Win32_OperatingSystem | Select-Object -ExpandProperty Caption)
Version: $(Get-CimInstance -ClassName Win32_OperatingSystem | Select-Object -ExpandProperty Version)
Architecture: $env:PROCESSOR_ARCHITECTURE
Computer: $env:COMPUTERNAME
Username: $env:USERNAME

=== ENVIRONMENT VARIABLES ===
APPDATA: $env:APPDATA
LOCALAPPDATA: $env:LOCALAPPDATA
USERPROFILE: $env:USERPROFILE
TEMP: $env:TEMP

=== POWERSHELL INFORMATION ===
PowerShell Version: $($PSVersionTable.PSVersion)
PowerShell Edition: $($PSVersionTable.PSEdition)

=== NODE.JS INFORMATION ===
$(if (Get-Command node -ErrorAction SilentlyContinue) { node --version } else { "Node.js not found" })
$(if (Get-Command npm -ErrorAction SilentlyContinue) { npm --version } else { "npm not found" })

=== PYTHON INFORMATION ===
$(if (Get-Command python -ErrorAction SilentlyContinue) { python --version } else { "Python not found" })
$(if (Get-Command pip -ErrorAction SilentlyContinue) { pip --version } else { "pip not found" })

=== ELECTRON INFORMATION ===
$(if (Get-Command electron -ErrorAction SilentlyContinue) { electron --version } else { "Electron not found" })

=== OLLAMA INFORMATION ===
$(if (Get-Command ollama -ErrorAction SilentlyContinue) { ollama --version } else { "Ollama not found" })

=== DISK SPACE ===
$(Get-WmiObject -Class Win32_LogicalDisk | Where-Object { $_.DriveType -eq 3 } |
    ForEach-Object { "Drive $($_.DeviceID) - Used: $([math]::Round(($_.Size-$_.FreeSpace)/1GB,2))GB, Free: $([math]::Round($_.FreeSpace/1GB,2))GB" })

=== RUNNING PROCESSES ===
$(Get-Process | Where-Object { $_.ProcessName -like "*electron*" -or $_.ProcessName -like "*node*" -or $_.ProcessName -like "*python*" -or $_.ProcessName -like "*uvicorn*" } |
    Format-Table ProcessName, Id, CPU, WorkingSet -AutoSize | Out-String)

=== NETWORK PORTS ===
$(Get-NetTCPConnection | Where-Object { $_.LocalPort -in 8000,8001,8002,8003,8004,5173 } |
    Format-Table LocalAddress, LocalPort, State, OwningProcess -AutoSize | Out-String)

=== RECENT ERRORS (Last 24 hours) ===
$(Get-WinEvent -FilterHashtable @{ LogName='Application'; Level=2; StartTime=(Get-Date).AddHours(-24) } -ErrorAction SilentlyContinue |
    Select-Object -First 10 TimeCreated, Id, LevelDisplayName, Message |
    Format-Table -AutoSize | Out-String)
"@

Set-Content -Path "$tempDir\system-info.txt" -Value $systemInfo -Encoding UTF8

# Copy configuration files
Write-Info "Collecting configuration files..."
$configFiles = @(
    "$currentDir\package.json",
    "$currentDir\tsconfig.json",
    "$currentDir\vite.config.ts",
    "$currentDir\electron-builder.yml",
    "$currentDir\server\requirements.txt",
    "$currentDir\client\vite.config.ts"
)

foreach ($configFile in $configFiles) {
    if (Test-Path $configFile) {
        $destPath = Join-Path "$tempDir\config" (Split-Path $configFile -Leaf)
        $destDir = Split-Path $destPath -Parent
        if (!(Test-Path $destDir)) {
            New-Item -ItemType Directory -Force -Path $destDir | Out-Null
        }
        Copy-Item -Path $configFile -Destination $destPath -Force
    }
}

# Copy AI models info (not the actual models unless requested)
if ($IncludeModels) {
    Write-Info "Including AI model files..."
    $modelDirs = @(
        "$env:USERPROFILE\.ollama",
        "$currentDir\server\models"
    )
    
    foreach ($modelDir in $modelDirs) {
        if (Test-Path $modelDir) {
            $destPath = Join-Path "$tempDir\models" (Split-Path $modelDir -Leaf)
            Copy-Item -Path $modelDir -Destination $destPath -Recurse -Force
        }
    }
} else {
    # Just create a models info file
    $modelInfo = @"
AI Models Information
$(Get-Date)

Ollama Models:
$(if (Get-Command ollama -ErrorAction SilentlyContinue) { ollama list } else { "Ollama not available" })

Model Directories:
- $env:USERPROFILE\.ollama
- $currentDir\server\models

To include actual model files, run with -IncludeModels parameter
"@
    Set-Content -Path "$tempDir\models-info.txt" -Value $modelInfo -Encoding UTF8
}

# Create manifest file
$manifest = @"
Mido AI Editor - Log Export Manifest
Exported: $(Get-Date)
Export Script: $PSCommandPath
Days Included: $Days
Include Models: $IncludeModels

Contents:
$(Get-ChildItem $tempDir -Recurse | ForEach-Object { $_.FullName.Substring($tempDir.Length+1) } | Sort-Object)

Instructions:
1. This archive contains diagnostic information for troubleshooting
2. Share with support team for assistance
3. Check system-info.txt for environment details
4. Review recent logs for error patterns

Privacy Note:
- No source code is included
- No personal files are included
- Logs may contain file paths and error messages
- Review contents before sharing
"@

Set-Content -Path "$tempDir\MANIFEST.txt" -Value $manifest -Encoding UTF8

# Create ZIP archive
Write-Info "Creating ZIP archive..."
try {
    Compress-Archive -Path "$tempDir\*" -DestinationPath $OutputPath -Force
    Write-Success "Log archive created: $OutputPath"
    
    # Display archive contents
    Write-Info "Archive contents:"
    $zip = [System.IO.Compression.ZipFile]::OpenRead($OutputPath)
    $zip.Entries | Sort-Object FullName | ForEach-Object {
        $size = if ($_.Length -gt 1MB) { "{0:N2} MB" -f ($_.Length / 1MB) }
               elseif ($_.Length -gt 1KB) { "{0:N2} KB" -f ($_.Length / 1KB) }
               else { "$($_.Length) B" }
        Write-Host "  $($_.FullName) ($size)" -ForegroundColor Gray
    }
    $zip.Dispose()
    
    # Display archive size
    $archiveSize = (Get-Item $OutputPath).Length
    Write-Success "Archive size: $([math]::Round($archiveSize/1MB, 2)) MB"
} catch {
    Write-Error "Failed to create ZIP archive: $_"
    throw
} finally {
    # Clean up temporary directory
    if (Test-Path $tempDir) {
        Remove-Item -Path $tempDir -Recurse -Force
        Write-Info "Cleaned up temporary directory"
    }
}

Write-Success "Log export completed successfully!"
Write-Success "Archive location: $OutputPath"

# Offer to open folder
$choice = Read-Host "Open containing folder? (Y/N)"
if ($choice -eq "Y" -or $choice -eq "y") {
    Start-Process (Split-Path $OutputPath -Parent)
}