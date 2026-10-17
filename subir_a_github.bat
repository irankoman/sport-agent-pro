@echo off
title Subir SPORT-AGENT PRO a GitHub
cd /d "%~dp0"

set "PATH=%~dp0.tools\mingit\cmd;%~dp0.tools\gcm;C:\Windows\System32\OpenSSH;%PATH%"

echo ======================================================================
echo   SUBIENDO SPORT-AGENT PRO A TU REPOSITORIO GITHUB
echo   Repositorio: git@github.com:irankoman/sport-agent-pro.git
echo ======================================================================
echo.
echo Intentando subida rapida por SSH...
git push -u origin main
echo.
if %errorlevel% equ 0 (
    echo ======================================================================
    echo   [EXITO TOTAL] TODOS LOS ARCHIVOS FUERON SUBIDOS A TU GITHUB!
    echo   Render ahora detectara automaticamente tu proyecto para desplegarlo.
    echo ======================================================================
    pause
    exit /b 0
)

echo No se pudo por SSH. Intentando por HTTPS con navegador...
git remote set-url origin https://github.com/irankoman/sport-agent-pro.git
git push -u origin main
echo.
if %errorlevel% equ 0 (
    echo ======================================================================
    echo   [EXITO TOTAL] TODOS LOS ARCHIVOS FUERON SUBIDOS A TU GITHUB!
    echo ======================================================================
) else (
    echo ======================================================================
    echo   Revisa la clave SSH o el inicio de sesion en el navegador.
    echo ======================================================================
)
echo.
pause
