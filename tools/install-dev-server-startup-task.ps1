$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$RestartScript = Join-Path $Root "tools\restart-dev-server.ps1"
$TaskName = "Accounting Helpers Dev Server"

function Install-StartupShortcut {
  $startup = [Environment]::GetFolderPath("Startup")
  $shortcutPath = Join-Path $startup "$TaskName.lnk"
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = "powershell.exe"
  $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$RestartScript`""
  $shortcut.WorkingDirectory = $Root
  $shortcut.WindowStyle = 7
  $shortcut.Description = "Starts the Accounting Helpers Tampermonkey dev server at Windows login."
  $shortcut.Save()
  Write-Host "Installed Startup folder shortcut: $shortcutPath"
}

try {
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
} catch {
  Write-Host "Scheduled Task install failed: $($_.Exception.Message)"
  Write-Host "Falling back to the Windows Startup folder."
  Install-StartupShortcut
}

Write-Host "It will run at Windows login:"
Write-Host "  powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$RestartScript`""
