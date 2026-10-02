@echo off
rem =========================================================================
rem  Grow quickly - Smart Notebook one-click launcher
rem  Usage: double-click this file. (No admin needed normally.)
rem =========================================================================

cd /d "%~dp0"
title Smart Notebook - Starting
color 0a

echo ================================================
echo   Smart Notebook one-click launcher
echo ================================================
echo.

rem ---------- 1. Check Node.js ----------
where node >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Node.js not found. Please install from https://nodejs.org
    echo.
    pause
    exit /b 1
)
echo  [OK] Node:
node -v

rem ---------- 2. Check dependencies ----------
if not exist "node_modules\.bin\next.cmd" (
    if not exist "node_modules\.bin\next" (
        echo  [INFO] Installing dependencies, please wait...
        call npm install
        if errorlevel 1 (
            echo  [ERROR] npm install failed.
            pause
            exit /b 1
        )
    )
) else (
    echo  [OK] node_modules ready
)

rem ---------- 3. Check database ----------
if not exist "prisma\dev.db" (
    echo  [INFO] Database not found, initializing...
    call npx prisma migrate dev --skip-generate >nul 2>&1
    call npx prisma db seed >nul 2>&1
    echo  [OK] Database initialized
) else (
    call npx prisma migrate deploy >nul 2>&1
    echo  [OK] Database ready
)

rem ---------- 4. Check .env ----------
if not exist ".env" (
    echo  [INFO] .env not found, copying from .env.example.
    copy ".env.example" ".env" >nul 2>&1
)

echo.
echo ================================================
echo   Starting dev server...  http://localhost:3000
echo   Press Ctrl+C to stop.
echo ================================================
echo.

rem ---- Open browser after a short delay (non-blocking) ----
start "" /b cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000"

call npm run dev

echo.
echo   Server stopped.
pause