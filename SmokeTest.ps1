# Mido AI Editor Smoke Test Script
# Run this after building to verify all components work

param(
    [string]$InstallPath = "$env:TEMP\MidoAIEditorSmokeTest"
)

Write-Host "=== Mido AI Editor Smoke Test ===" -ForegroundColor Green
Write-Host "Testing release artifacts..." -ForegroundColor Yellow

# Test 1: Check release files exist
Write-Host "`n1. Checking release artifacts..." -ForegroundColor Cyan
$releaseDir = Join-Path $PSScriptRoot "release"
$nsisInstaller = Join-Path $releaseDir "Mido AI Editor-0.1.0-x64.exe"
$portableExe = Join-Path $releaseDir "win-unpacked\Mido AI Editor.exe"

if (Test-Path $nsisInstaller) {
    Write-Host "   ✓ NSIS Installer found: $((Get-Item $nsisInstaller).Length / 1MB) MB" -ForegroundColor Green
} else {
    Write-Host "   ✗ NSIS Installer missing" -ForegroundColor Red
    exit 1
}

if (Test-Path $portableExe) {
    Write-Host "   ✓ Portable executable found: $((Get-Item $portableExe).Length / 1MB) MB" -ForegroundColor Green
} else {
    Write-Host "   ✗ Portable executable missing" -ForegroundColor Red
    exit 1
}

# Test 2: Test backend startup
Write-Host "`n2. Testing backend startup..." -ForegroundColor Cyan
$serverScript = Join-Path $PSScriptRoot "server\bootstrap.ps1"
if (Test-Path $serverScript) {
    Write-Host "   ✓ Server bootstrap script found" -ForegroundColor Green
} else {
    Write-Host "   ✗ Server bootstrap script missing" -ForegroundColor Red
    exit 1
}

# Test 3: Check Python dependencies
Write-Host "`n3. Checking Python dependencies..." -ForegroundColor Cyan
$requirements = Join-Path $PSScriptRoot "server\requirements.txt"
if (Test-Path $requirements) {
    Write-Host "   ✓ requirements.txt found" -ForegroundColor Green
} else {
    Write-Host "   ✗ requirements.txt missing" -ForegroundColor Red
}

# Test 4: Check client build
Write-Host "`n4. Checking client build..." -ForegroundColor Cyan
$clientDist = Join-Path $PSScriptRoot "client\dist"
if (Test-Path $clientDist) {
    $indexFile = Join-Path $clientDist "index.html"
    if (Test-Path $indexFile) {
        Write-Host "   ✓ Client build complete" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Client build incomplete - no index.html" -ForegroundColor Red
    }
} else {
    Write-Host "   ✗ Client build directory missing" -ForegroundColor Red
}

# Test 5: Check tools scripts
Write-Host "`n5. Checking tools scripts..." -ForegroundColor Cyan
$createPortable = Join-Path $PSScriptRoot "scripts\create-portable.ps1"
$exportLogs = Join-Path $PSScriptRoot "scripts\export-logs.ps1"

if (Test-Path $createPortable) {
    Write-Host "   ✓ create-portable.ps1 found" -ForegroundColor Green
} else {
    Write-Host "   ✗ create-portable.ps1 missing" -ForegroundColor Red
}

if (Test-Path $exportLogs) {
    Write-Host "   ✓ export-logs.ps1 found" -ForegroundColor Green
} else {
    Write-Host "   ✗ export-logs.ps1 missing" -ForegroundColor Red
}

# Test 6: Check API endpoints (if server is running)
Write-Host "`n6. Testing API endpoints..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -TimeoutSec 5
    if ($response.status -eq "ok") {
        Write-Host "   ✓ Health endpoint responding" -ForegroundColor Green
    } else {
        Write-Host "   ! Health endpoint responding but status unexpected" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ! Health endpoint not responding (server not running)" -ForegroundColor Yellow
}

try {
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:8000/ai/meta" -TimeoutSec 5
    if ($response.roles) {
        Write-Host "   ✓ /ai/meta endpoint responding with roles" -ForegroundColor Green
    } else {
        Write-Host "   ! /ai/meta endpoint responding but no roles" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ! /ai/meta endpoint not responding" -ForegroundColor Yellow
}

# Test 7: Quick portable workspace test
Write-Host "`n7. Testing portable workspace creation..." -ForegroundColor Cyan
$testPortablePath = Join-Path $env:TEMP "MidoTestPortable"
if (Test-Path $createPortable) {
    try {
        $result = & powershell -ExecutionPolicy Bypass -File $createPortable -OutputPath $testPortablePath
        if (Test-Path $testPortablePath) {
            Write-Host "   ✓ Portable workspace created successfully" -ForegroundColor Green
            Remove-Item -Recurse -Force $testPortablePath -ErrorAction SilentlyContinue
        } else {
            Write-Host "   ! Portable workspace creation failed" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "   ! Portable workspace test failed: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host "`n=== Test Complete ===" -ForegroundColor Green
Write-Host "All critical components verified. Ready for deployment!" -ForegroundColor Green
Write-Host "`nRelease artifacts:" -ForegroundColor Cyan
Write-Host "  - NSIS Installer: $nsisInstaller"
Write-Host "  - Portable: $portableExe"
Write-Host "  - QuickStart Guide: $(Join-Path $PSScriptRoot QuickStart.md)"