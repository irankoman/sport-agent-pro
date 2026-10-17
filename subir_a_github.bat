@echo off
title Subir SportAgent a GitHub
cd /d "%~dp0"
echo =======================================================
echo   SUBIENDO SPORT-AGENT PRO A TU GITHUB
echo   Repositorio: https://github.com/irankoman/sport-agent-pro.git
echo =======================================================
echo.
echo Si Git te pide credenciales:
echo 1. En 'Username' escribe: irankoman
echo 2. En 'Password' pega tu GitHub Personal Access Token
echo    (Generalo gratis en: https://github.com/settings/tokens con permiso 'repo')
echo.
.\.tools\mingit\cmd\git.exe push -u origin main
echo.
if %errorlevel% equ 0 (
    echo =======================================================
    echo   EXITO: Todos los archivos se subieron a GitHub.
    echo   Ahora puedes ir a Render.com y desplegar tu app.
    echo =======================================================
) else (
    echo =======================================================
    echo   Hubo un detalle al autenticar. Revisa tu token.
    echo =======================================================
)
echo.
pause
