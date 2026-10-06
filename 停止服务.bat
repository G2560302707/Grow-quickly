@echo off
rem =========================================================================
rem  Grow quickly - Stop server launcher
rem  Usage: double-click to stop the running dev server.
rem  Hard-kills any Next.js / node dev server started for this project.
rem =========================================================================

cd /d "%~dp0"
title Smart Notebook - Stop Server
color 0c

echo ================================================
echo   Stopping Smart Notebook dev server...
echo ================================================
echo.

rem ---------- Kill node processes started by npm run dev ----------
rem TASKKILL /F /T kills the whole process tree (the window that ran npm).
echo  [INFO] Sending kill to node + npm processes...
taskkill /F /T /IM node.exe >nul 2>&1
taskkill /F /T /IM npm.exe >nul 2>&1
taskkill /F /T /IM next.exe >nul 2>&1
taskkill /F /T /IM node_modules>nul 2>&1

rem ---------- Also free the port in case anything still holds it ----------
echo  [INFO] Releasing port 3000 (if occupied)...
setlocal
set PORT=3000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    echo  [INFO] Closing PID %%a on port 3000...
    taskkill /F /PID %%a >nul 2>&1
)
endlocal

echo  [INFO] Releasing port 3001 (if occupied)...
setlocal
set PORT=3001
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001 " ^| findstr "LISTENING"') do (
    echo  [INFO] Closing PID %%a on port 3001...
    taskkill /F /PID %%a >nul 2>&1
)
endlocal

echo.
echo  All done. Server stopped.
pause