@echo off
setlocal

cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\restart-dev-server.ps1" -Foreground

echo.
echo Dev server stopped.
pause
