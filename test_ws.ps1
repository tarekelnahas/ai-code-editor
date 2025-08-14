Add-Type -AssemblyName System.Net.WebSockets
$uri = [Uri]"ws://127.0.0.1:8000/ws/ai"
$ws = [System.Net.WebSockets.ClientWebSocket]::new()
try {
    $ws.ConnectAsync($uri, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
    $init = @{ prompt="Say hi in one short sentence."; role="general" } | ConvertTo-Json -Compress
    $buf = [Text.Encoding]::UTF8.GetBytes($init)
    $seg = New-Object System.ArraySegment[byte] (,$buf)
    $ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult()

    $recvBuf = New-Object byte[] 16384
    $recvSeg = New-Object System.ArraySegment[byte] $recvBuf
    $start = Get-Date
    $first=$null
    $acc=""
    $timeout=(Get-Date).AddSeconds(10)
    
    while ($ws.State -eq [System.Net.WebSockets.WebSocketState]::Open -and (Get-Date) -lt $timeout) {
        $res = $ws.ReceiveAsync($recvSeg, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
        if ($res.Count -le 0) { continue }
        $txt = [Text.Encoding]::UTF8.GetString($recvBuf,0,$res.Count)
        foreach ($line in ($txt -split "`n")) {
            if (-not $line.Trim()) { continue }
            try {
                $o = $line | ConvertFrom-Json
                if ($o.type -eq "start") { $model=$o.model }
                elseif ($o.type -eq "delta") {
                    if ($null -eq $first) { $first = Get-Date }
                    $acc += ($o.token ?? "")
                }
                elseif ($o.type -eq "end") { break }
            } catch {}
        }
        if ($acc.Length -gt 150) { break }
    }
    
    try { $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure,"done",[Threading.CancellationToken]::None).GetAwaiter().GetResult() } catch {}
    
    $elapsed = ((Get-Date) - $start).TotalSeconds
    $ttft = ($null -ne $first) ? (($first - $start).TotalMilliseconds) : $null
    $rate = ($elapsed -gt 0) ? [math]::Round(($acc.Length/$elapsed),1) : 0
    
    Write-Host "---- UI & ROLES REPORT ----"
    Write-Host "Roles -> completion: deepseek-coder:latest | general: dolphin-phi:latest | planner: dolphin-phi:latest"
    Write-Host "WS model: $($model ?? "unknown")"
    Write-Host "TTFT_ms: $($ttft ?? "N/A")"
    Write-Host "Chars/sec: $rate"
    Write-Host "Snippet: $($acc.Substring(0, [Math]::Min(100,$acc.Length)) -replace "`r|`n"," ")"
    Write-Host "--------------------------------"
} 
catch { 
    Write-Host "WS test failed: $($_.Exception.Message)" 
}