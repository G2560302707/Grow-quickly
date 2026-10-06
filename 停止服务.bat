@echo off
rem =========================================================================
rem  Smart Wrong Notebook - Stop dev servers
rem  Usage: double-click to stop the project's dev servers.
rem  Kills this project's processes BY PORT only:
rem    3000 = web (learning app) / 3001 = admin console / 5173 = uniapp H5
rem  NOTE: never kill all node.exe system-wide - that would break other apps.
rem =========================================================================

cd /d "%~dp0"
title Smart Notebook - Stop Server
color 0c

echo ================================================
echo   Stopping Smart Notebook dev servers...
echo ================================================
echo.

setlocal
for %%P in (3000 3001 5173) do (
    echo  [INFO] Releasing port %%P if occupied...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%%P " ^| findstr "LISTENING"') do (
        echo  [INFO]   Killing PID %%a
        taskkill /F /T /PID %%a >nul 2>&1
    )
)
endlocal

echo.
echo  All done. Dev servers stopped.
pause
