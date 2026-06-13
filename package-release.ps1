# Empaqueta Agenda Financiera en una carpeta portatil lista para entregar al cliente.
# Genera: release\AgendaFinanciera\  (Node incluido, frontend compilado, doble clic para usar)
#
# Uso:  doble clic en package-release.bat   (o)   powershell -ExecutionPolicy Bypass -File package-release.ps1

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
Set-Location $root

# Version de Node que se incluira en el paquete (la misma con la que desarrollas).
$nodeVersion = 'v24.14.0'
$nodeUrl     = "https://nodejs.org/dist/$nodeVersion/win-x64/node.exe"

# Version de la app (se lee de package.json) para nombrar el .zip
$appVersion = (Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version

$releaseRoot = Join-Path $root 'release'
$appDir      = Join-Path $releaseRoot 'AgendaFinanciera'
$cacheDir    = Join-Path $root '.node-cache'
$nodeCache   = Join-Path $cacheDir "node-$nodeVersion.exe"

Write-Host ''
Write-Host '=== Empaquetando Agenda Financiera ===' -ForegroundColor Cyan
Write-Host ''

# 1) Descargar node.exe portatil (cacheado para no bajarlo cada vez)
if (-not (Test-Path $nodeCache)) {
  Write-Host "Descargando Node $nodeVersion portatil..." -ForegroundColor Yellow
  New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null
  Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeCache
} else {
  Write-Host "Node $nodeVersion ya en cache." -ForegroundColor DarkGray
}

# 2) Compilar el frontend (siempre fresco)
Write-Host 'Compilando el frontend...' -ForegroundColor Yellow
Push-Location (Join-Path $root 'client')
if (-not (Test-Path 'node_modules')) { npm install }
npm run build
Pop-Location

# 3) Asegurar dependencias del servidor
if (-not (Test-Path (Join-Path $root 'node_modules'))) {
  Write-Host 'Instalando dependencias del servidor...' -ForegroundColor Yellow
  npm install
}

# 4) Limpiar y armar la carpeta de salida
Write-Host 'Armando la carpeta del paquete...' -ForegroundColor Yellow
if (Test-Path $releaseRoot) { Remove-Item $releaseRoot -Recurse -Force }
New-Item -ItemType Directory -Force -Path $appDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $appDir 'node') | Out-Null

Copy-Item $nodeCache (Join-Path $appDir 'node\node.exe')

# robocopy devuelve codigos 0-7 como exito; lo neutralizamos para no romper el script
function Robo($src, $dst) {
  robocopy $src $dst /E /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "robocopy fallo copiando $src" }
  $global:LASTEXITCODE = 0
}

Robo (Join-Path $root 'server')       (Join-Path $appDir 'server')
Robo (Join-Path $root 'node_modules') (Join-Path $appDir 'node_modules')
Robo (Join-Path $root 'client\dist')  (Join-Path $appDir 'client\dist')
Copy-Item (Join-Path $root 'package.json') $appDir

# No queremos arrastrar tests ni datos del desarrollador
Remove-Item (Join-Path $appDir 'server\tests') -Recurse -Force -ErrorAction SilentlyContinue

# 5) Lanzadores para el cliente
$iniciarVbs = @'
' Lanza Agenda Financiera sin ventana de consola, usando el Node incluido.
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh  = CreateObject("WScript.Shell")
base = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = base
sh.Run """" & base & "\node\node.exe"" --no-warnings server\index.js", 0, False
'@
Set-Content -Path (Join-Path $appDir 'iniciar-oculto.vbs') -Value $iniciarVbs -Encoding ASCII

$iniciarBat = @'
@echo off
cd /d "%~dp0"
echo Iniciando Agenda Financiera...
echo El navegador se abrira automaticamente.
echo Para cerrar la app usa "Detener.bat".
wscript "%~dp0iniciar-oculto.vbs"
exit
'@
Set-Content -Path (Join-Path $appDir 'Iniciar Agenda Financiera.bat') -Value $iniciarBat -Encoding ASCII

$detenerBat = @'
@echo off
setlocal
set PORT=3737
set FOUND=
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
  set FOUND=1
  taskkill /F /PID %%p >nul 2>&1
)
if not defined FOUND (
  echo No hay ninguna instancia de Agenda Financiera en ejecucion.
) else (
  echo Agenda Financiera detenida.
)
timeout /t 2 >nul
endlocal
'@
Set-Content -Path (Join-Path $appDir 'Detener.bat') -Value $detenerBat -Encoding ASCII

$leeme = @'
AGENDA FINANCIERA
=================

COMO USAR
---------
1. Doble clic en "Iniciar Agenda Financiera.bat".
   Se abre el navegador con la app. No necesitas instalar nada mas.
2. Para cerrarla, doble clic en "Detener.bat".

NOTAS
-----
- Tus datos se guardan en la carpeta "data" (archivo agenda.db).
  Para respaldar, copia esa carpeta. Para mudarte de PC, copia toda
  esta carpeta completa.
- La app funciona sin internet.
- Si Windows muestra un aviso de seguridad la primera vez, elige
  "Mas informacion" -> "Ejecutar de todas formas".
'@
Set-Content -Path (Join-Path $appDir 'LEEME.txt') -Value $leeme -Encoding UTF8

# 6) Comprimir en .zip listo para entregar
$zipPath = Join-Path $releaseRoot "AgendaFinanciera-v$appVersion.zip"
Write-Host 'Comprimiendo en .zip...' -ForegroundColor Yellow
Compress-Archive -Path $appDir -DestinationPath $zipPath -Force
$zipMb = (Get-Item $zipPath).Length / 1MB

Write-Host ''
Write-Host 'Listo.' -ForegroundColor Green
Write-Host "Carpeta:  $appDir" -ForegroundColor Green
Write-Host ("ZIP:      {0}  ({1:N1} MB)" -f $zipPath, $zipMb) -ForegroundColor Green
Write-Host 'Entregale el .zip al cliente.' -ForegroundColor Green
Write-Host ''
