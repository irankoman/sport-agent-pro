@echo off
title Subir SPORT-AGENT PRO a GitHub
cd /d "%~dp0"

echo ======================================================================
echo   SUBIENDO SPORT-AGENT PRO A TU REPOSITORIO GITHUB
echo   Repositorio: https://github.com/irankoman/sport-agent-pro.git
echo ======================================================================
echo.
echo Se abrira automaticamente tu navegador web para autorizar GitHub en 1 clic.
echo (O si te solicita token, puedes pegarlo directamente).
echo.
echo Conectando con GitHub...
echo.

.\.tools\mingit\cmd\git.exe push -u origin main

echo.
if %errorlevel% equ 0 (
    echo ======================================================================
    echo   [EXITO] TODOS LOS ARCHIVOS FUERON SUBIDOS A TU GITHUB!
    echo   Ahora puedes ir a https://render.com y desplegar tu aplicacion gratis.
    echo ======================================================================
) else (
    echo ======================================================================
    echo   No se pudo completar el push.
    echo   Revisa que hayas iniciado sesion en tu navegador y vuelve a ejecutar.
    echo ======================================================================
)
echo.
pause
