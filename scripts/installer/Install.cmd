@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
set "installer_exit=%ERRORLEVEL%"
pause
exit /b %installer_exit%
