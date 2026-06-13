@echo off
REM Empaqueta Agenda Financiera en release\AgendaFinanciera para entregar al cliente.
powershell -ExecutionPolicy Bypass -File "%~dp0package-release.ps1"
pause
