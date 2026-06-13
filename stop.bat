@echo off
setlocal

set PORT=3737
set FOUND=

for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
  set FOUND=1
  echo Cerrando el servidor con PID %%p...
  taskkill /F /PID %%p >nul 2>&1
)

if not defined FOUND (
  echo No hay ningun servidor escuchando en el puerto %PORT%.
) else (
  echo Servidor detenido.
)

endlocal
