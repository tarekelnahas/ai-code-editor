param(
  [string]$HostUrl = "127.0.0.1",
  [int]$Port = 8000
)
$ErrorActionPreference = "SilentlyContinue"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$venv = Join-Path $here ".venv"
$py = Join-Path $venv "Scripts\python.exe"
$logDir = Join-Path $env:LOCALAPPDATA "AIEditor\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir "server.log"

# pick python
if (-not (Test-Path $py)) {
  # try system Python 3.11+
  $sys = (Get-Command python -ErrorAction SilentlyContinue)?.Source
  if (-not $sys) { Write-Host "ERR: python not found"; exit 1 }
  Write-Host "Creating venv at $venv"
  & $sys -m venv $venv
  $py = Join-Path $venv "Scripts\python.exe"
}

# ensure pip up-to-date
& $py -m pip install -U pip wheel *> $null

# install pinned deps (wheels available for Py3.11/3.13)
$req = @'
fastapi==0.116.1
uvicorn==0.35.0
pydantic==2.11.7
httpx==0.28.1
watchfiles==1.1.0
'@
$reqPath = Join-Path $here "requirements.prod.txt"
$req | Out-File -FilePath $reqPath -Encoding UTF8
& $py -m pip install -r $reqPath *> $null

# run uvicorn
$main = Join-Path $here "main.py"
if (-not (Test-Path $main)) { Write-Host "ERR: main.py not found at $main"; exit 1 }

# if server already listening, exit 0
try {
  $c = Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 -Uri ("http://{0}:{1}/health" -f $HostUrl,$Port)
  if ($c.StatusCode -eq 200) { Write-Host "Already running"; exit 0 }
} catch {}

$arg = "-m","uvicorn","main:app","--host",$HostUrl,"--port",$Port
Start-Process -FilePath $py -ArgumentList $arg -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError $log
Start-Sleep -Seconds 1
exit 0