@echo off
title SportAgent Betano Pro - Servidor y Tunel Publico
echo ======================================================================
echo           SPORT-AGENT BETANO PRO - SERVIDOR EN LINEA
echo ======================================================================
echo.
echo Iniciando servidor FastAPI local...
start /B python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000

echo Esperando 3 segundos...
timeout /t 3 /nobreak >nul

echo.
echo ======================================================================
echo   TU APP ESTA DISPONIBLE EN:
echo   - Local (PC):         http://localhost:8000
echo   - Red Local (Wi-Fi):  http://192.168.100.7:8000
echo ======================================================================
echo.
echo Iniciando Tunel Publico para acceso desde cualquier celular o Internet...
echo (Se mostrara el enlace HTTPS publico a continuacion)
echo.
.\cloudflared.exe tunnel --url http://127.0.0.1:8000
pause
