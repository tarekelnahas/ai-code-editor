$ErrorActionPreference='SilentlyContinue'
$root='F:\ai_code_editor'
cd $root
$ts=[int][double]::Parse((Get-Date -UFormat %s))

function JGET($url,$to=10){ try{ return Invoke-RestMethod -Uri $url -TimeoutSec $to } catch { return $null } }
function JPOST($url,$obj,$to=30){ try{ return Invoke-RestMethod -Uri $url -Method Post -Body ($obj|ConvertTo-Json) -ContentType "application/json" -TimeoutSec $to } catch { return $null } }

$rep=[ordered]@{
  Health=$false; Metrics=$false; Providers=$false; Route=$false;
  RAG_Index=$false; RAG_Search=$false; RAG_Complete=$false;
  WS=$false; SystemRun=$false; Tasks=$false;
  Git_Status=$false; Git_DryPush=$false; Browser=$false
}
$notes=@{}

Write-Host "Testing Health endpoint..."
$h=JGET "http://127.0.0.1:8000/health" 6
if($h -and $h.status){ $rep.Health=$true } else { $notes.Health="no /health" }

Write-Host "Testing Metrics endpoint..."
$m=JGET "http://127.0.0.1:8000/sys/metrics" 6
if($m){ $rep.Metrics=$true } else { $notes.Metrics="metrics fail" }

Write-Host "Testing Providers..."
$pmeta=JGET "http://127.0.0.1:8000/providers/meta" 6
if($pmeta){ $rep.Providers=$true } else { $notes.Providers="providers/meta fail" }
$route=JPOST "http://127.0.0.1:8000/ai/route" @{prompt="Selftest ping"; role="general"; cacheKey=("selftest-"+$ts)} 40
if($route -and $route.content){ $rep.Route=$true } else { $notes.Route="ai/route fail" }

Write-Host "Testing RAG Pro..."
$ragi=JPOST "http://127.0.0.1:8000/ragpro/index" @{clean=$false} 60
if($ragi){ $rep.RAG_Index=$true } else { $notes.RAG_Index="index fail" }
$ragq=JPOST "http://127.0.0.1:8000/ragpro/search" @{q="import";k=3} 12
if($ragq -and $ragq.hits){ $rep.RAG_Search=$true } else { $notes.RAG_Search="search 0 hits" }
$ragc=JPOST "http://127.0.0.1:8000/ai/complete_with_context_pro" @{prompt="Summarize this project in one short sentence."; k=3; role="general"} 90
if($ragc -and $ragc.content){ $rep.RAG_Complete=$true } else { $notes.RAG_Complete="ctx complete fail" }

Write-Host "Testing WebSocket (basic check)..."
$rep.WS=$false
$notes.WS="ws test skipped"

Write-Host "Testing System commands..."
$sys=JPOST "http://127.0.0.1:8000/system/run" @{cmd="git";args=@("--version");dry=$false} 20
if($sys -and $sys.ok){ $rep.SystemRun=$true } else { $notes.SystemRun="system/run fail" }

Write-Host "Testing Tasks..."
$tsave=JPOST "http://127.0.0.1:8000/tasks/save" @{name="echo-hello";cmd="cmd";args=@("/c","echo","Hello");cwd=$root} 10
$trun =JPOST "http://127.0.0.1:8000/tasks/run"  @{name="echo-hello"} 20
if($tsave -and $trun -and $trun.ok){ $rep.Tasks=$true } else { $notes.Tasks="tasks fail" }

Write-Host "Testing Git..."
$cfg=JPOST "http://127.0.0.1:8000/git/config" @{repoPath=$root;branch="main"} 10
$gst=JGET  "http://127.0.0.1:8000/git/status" 20
if($gst){ $rep.Git_Status=$true } else { $notes.Git_Status="status fail" }
$gpush=JPOST "http://127.0.0.1:8000/git/push" @{repoPath=$root;branch="main";message="chore: selftest";dry=$true} 40
if($gpush){ $rep.Git_DryPush=$true } else { $notes.Git_DryPush="dry push fail" }

Write-Host "Testing Browser (optional)..."
$driver=Test-Path "$root\server\tools\msedgedriver.exe"
$cfgPath=Join-Path $env:LOCALAPPDATA "AIEditor\config.json"
$allow=$false
if(Test-Path $cfgPath){
  try{
    $cfgJson=Get-Content $cfgPath -Raw | ConvertFrom-Json
    $allow=($cfgJson.browserAutomation.allow -eq $true)
  }catch{}
}
if($driver -and $allow){
  $b=JPOST "http://127.0.0.1:8000/browser/open" @{url="https://example.com"} 30
  if($b -and $b.ok){ $rep.Browser=$true } else { $notes.Browser="edge open fail" }
}else{
  $notes.Browser="skipped (driver or allow=false)"
}

Write-Host "Generating report..."
$okCount=($rep.GetEnumerator()|?{$_.Value -eq $true}).Count
$total=($rep.Keys).Count
$lines=@()
$lines+= "# Self-Test Report"
$lines+= ""
$lines+= "Time: $(Get-Date -Format s)"
$lines+= ""
foreach($k in $rep.Keys){ $stat= if($rep[$k]){"✅ PASS"} else {"❌ FAIL"}; $lines+= "- **$k**: $stat" }
$lines+= ""
$lines+= "## Notes"
if($notes.Keys.Count -eq 0){ $lines+= "- (none)" } else { foreach($k in $notes.Keys){ $lines+="- **$k**: $($notes[$k])" } }
$lines+= ""
$lines+= "## Route sample"
if($route){ $lines+= "- provider/model: $($route.provider) / $($route.model)"; $lines+= "- snippet: " + ($route.content.Substring(0,[Math]::Min(120,$route.content.Length))) }
$lines+= "## RAG stats"
if($ragi){ $lines+= "- indexed: updated=$($ragi.updated) skipped=$($ragi.skipped) in $($ragi.took_ms)ms" }
if($ragq){ $lines+= "- hits: $($ragq.hits.Count)" }
$path=(Join-Path $root "SELFTEST_REPORT.md")
$lines -join "`r`n" | Out-File -FilePath $path -Encoding UTF8

Write-Host "---- SELFTEST SUMMARY ----"
Write-Host ("PASS "+$okCount+" / "+$total)
Write-Host ("Report: "+$path)
Write-Host "--------------------------"