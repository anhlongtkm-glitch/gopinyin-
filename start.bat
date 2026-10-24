@echo off
chcp 65001 >nul
title GoPinyin
cd /d "%~dp0"

set "PORT=8080"
set "URL=http://127.0.0.1:%PORT%/"
set "NODE_EXE="

REM Tim Node.js o nhieu vi tri (may nguoi dung thuong khong co node trong PATH)
where node >nul 2>nul
if not errorlevel 1 set "NODE_EXE=node"

if not defined NODE_EXE (
  if exist "C:\Program Files\nodejs\node.exe" set "NODE_EXE=C:\Program Files\nodejs\node.exe"
)

if not defined NODE_EXE (
  for /d %%d in ("C:\Users\%USERNAME%\.workbuddy-ai\binaries\node\versions\*") do (
    if exist "%%d\node.exe" set "NODE_EXE=%%d\node.exe"
  )
)

if not defined NODE_EXE (
  echo.
  echo   KHONG TIM THAY Node.js tren may tinh nay.
  echo   Cai dat Node.js LTS tai: https://nodejs.org
  echo   Sau do nhay dup file nay lai.
  echo.
  pause
  exit /b 1
)

REM Kiem tra xem GoPinyin da chay chua (dung Node, khong dung PowerShell mang)
"%NODE_EXE%" server\check.js "%URL%__gopinyin" >nul 2>nul
if not errorlevel 1 (
  echo GoPinyin dang chay - dang mo trinh duyet...
  start "" "%URL%"
  exit /b 0
)

"%NODE_EXE%" -e "require.resolve('esbuild')" >nul 2>nul
if errorlevel 1 (
  echo Chua cai dependencies. Hay chay npm install trong thu muc du an.
  pause
  exit /b 1
)

echo Dang build va khoi dong GoPinyin...
start "GoPinyin-Server" /min "%NODE_EXE%" scripts\dev.mjs --no-open

REM Cho server khoi dong, kiem tra bang Node (toi da ~30 giay)
set "READY=0"
for /l %%i in (1,1,30) do (
  "%NODE_EXE%" server\check.js "%URL%__gopinyin" >nul 2>nul
  if not errorlevel 1 ( set "READY=1" & goto :OPEN )
  ping -n 2 127.0.0.1 >nul 2>nul
)

:OPEN
if "%READY%"=="1" (
  echo Mo GoPinyin trong trinh duyet...
  start "" "%URL%"
) else (
  echo.
  echo   Khong the khoi dong server tu dong.
  echo   Hay mo thu cong bang trinh duyet: %URL%
  echo   Neu bao trang khong the truy cap, hay dam bao khong co chuong trinh nao chiem cong %PORT%.
  echo.
)
ping -n 3 127.0.0.1 >nul 2>nul
