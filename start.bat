@echo off
cd /d "%~dp0"

if not exist node_modules (
  echo Instalando dependencias del servidor...
  npm install
)

if not exist client\node_modules (
  echo Instalando dependencias del cliente...
  cd client
  npm install
  cd ..
)

if not exist client\dist (
  echo Compilando el frontend...
  cd client
  npm run build
  cd ..
)

node --no-warnings server/index.js
