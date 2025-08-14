param([string]$Out = "$(Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'msedgedriver.exe')")
Write-Host "Attempting to fetch msedgedriver -> $Out"
try{
  $ver = (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Edge\BLBeacon").version
}catch{ $ver = "" }
if(-not $ver){ Write-Host "Edge version unknown. Please download driver manually."; exit 0 }
$base = "https://msedgedriver.azureedge.net/$ver/edgedriver_win64.zip"
$zip = "$Out.zip"
try{
  Invoke-WebRequest -Uri $base -OutFile $zip -UseBasicParsing -TimeoutSec 60
  Expand-Archive -Path $zip -DestinationPath (Split-Path -Parent $Out) -Force
  $found = Get-ChildItem (Split-Path -Parent $Out) -Recurse -Include msedgedriver.exe | Select-Object -First 1
  if($found){ Copy-Item $found.FullName $Out -Force; Remove-Item $zip -Force; Write-Host "Driver saved." }
  else { Write-Host "Driver not found in zip"; }
}catch{ Write-Host "Download failed: $($_.Exception.Message)"; }