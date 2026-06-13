param(
  [switch]$Foreground
)

$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Port = 5173
$HealthUrl = "http://127.0.0.1:$Port/health"

function Stop-ExistingDevServer {
  $processes = Get-CimInstance Win32_Process -Filter "name = 'node.exe'" |
    Where-Object { $_.CommandLine -match "tools[\\/]dev-server\.js" }

  foreach ($process in $processes) {
    Write-Host "Stopping existing dev server process $($process.ProcessId)..."
    Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
  }
}

function Wait-ForHealth {
  for ($attempt = 1; $attempt -le 25; $attempt += 1) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing $HealthUrl -TimeoutSec 2
      if ($response.StatusCode -eq 200) {
        Write-Host "Dev server is healthy: $HealthUrl"
        return
      }
    } catch {
      Start-Sleep -Milliseconds 200
    }
  }

  throw "Dev server did not become healthy at $HealthUrl."
}

Set-Location $Root

Stop-ExistingDevServer

Write-Host "Building Accounting Helpers userscripts..."
& node "tools\build-release.js"
if ($LASTEXITCODE -ne 0) {
  throw "Build failed with exit code $LASTEXITCODE."
}

if ($Foreground) {
  Write-Host ""
  Write-Host "Starting Accounting Helpers dev server in this window..."
  Write-Host "Install or update Tampermonkey from:"
  Write-Host "  http://127.0.0.1:$Port/userscript/accounting-helpers.dev.user.js"
  Write-Host ""
  Write-Host "Leave this window open. Press Ctrl+C to stop the server."
  Write-Host ""
  & node "tools\dev-server.js"
  exit $LASTEXITCODE
}

Write-Host "Starting Accounting Helpers dev server in the background..."
$process = Start-Process -FilePath "node" -ArgumentList "tools\dev-server.js" -WorkingDirectory $Root -WindowStyle Hidden -PassThru
Write-Host "Started process $($process.Id)."

Wait-ForHealth
Write-Host "Dev userscript URL: http://127.0.0.1:$Port/userscript/accounting-helpers.dev.user.js"
