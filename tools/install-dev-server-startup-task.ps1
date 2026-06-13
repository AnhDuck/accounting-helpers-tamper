$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$RestartScript = Join-Path $Root "tools\restart-dev-server.ps1"
$TaskName = "Accounting Helpers Dev Server"

$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$RestartScript`""

$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 5)

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Starts the Accounting Helpers Tampermonkey dev server at Windows login." `
  -Force | Out-Null

Write-Host "Installed startup task: $TaskName"
Write-Host "It will run at Windows login:"
Write-Host "  powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$RestartScript`""
