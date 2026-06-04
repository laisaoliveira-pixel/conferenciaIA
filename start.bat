@echo off
chcp 65001 > nul
title FolhaIA — Servidor Backend

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║   FolhaIA — Iniciando servidor backend   ║
echo  ╚══════════════════════════════════════════╝
echo.

REM Verifica se o .env foi configurado
findstr /C:"cole-sua-api-key-aqui" .env > nul 2>&1
if %errorlevel% == 0 (
    echo  [AVISO] O arquivo .env ainda nao foi configurado!
    echo  Abra o arquivo backend\.env e preencha suas credenciais do Azure OpenAI.
    echo.
    pause
    start notepad .env
    exit /b 1
)

echo  Credenciais carregadas do arquivo .env
echo  Iniciando servidor em http://localhost:8000
echo.
echo  Acesse o sistema em: http://localhost:8000
echo  Para encerrar: pressione Ctrl+C
echo.

REM Abre o browser automaticamente apos 2 segundos
start /b cmd /c "timeout /t 2 /nobreak > nul && start http://localhost:8000"

REM Inicia o servidor FastAPI
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload

pause
