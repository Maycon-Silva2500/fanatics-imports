@echo off
cd /d "%~dp0"
title FANATICS IMPORTS - Servidor E-commerce (Desenvolvido por Maycon Silva)
color 0A

echo ==========================================================
echo          FANATICS IMPORTS - SISTEMA PROFISSIONAL
echo          Instagram: @Fanatics.imports_ofc
echo          Credito: Desenvolvido por Maycon Silva
echo ==========================================================
echo.
echo [DIR] Pasta do projeto: %CD%
echo.

:: Verifica se o Node.js esta instalado
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERRO] O Node.js nao foi encontrado no seu computador!
    echo Por favor, baixe e instale a versao LTS em: https://nodejs.org/
    pause
    exit /b
)

:: Verifica se as dependencias realmente foram instaladas
if not exist "node_modules\express\" (
    echo [INFO] Primeira execucao detectada. Instalando dependencias do sistema...
    echo Isso pode levar de 1 a 2 minutos. Aguarde...
    call npm install
    if not exist "node_modules\express\" (
        color 0C
        echo [ERRO] Falha ao instalar dependencias. Verifique sua conexao com a internet.
        pause
        exit /b
    )
    echo [OK] Dependencias instaladas com sucesso!
    echo.
)

echo [INFO] Iniciando servidor local em http://localhost:3000 ...
echo [AVISO] Mantenha esta janela aberta enquanto estiver usando o sistema.
echo.

:: Abre o navegador padrao automaticamente
start "" http://localhost:3000

:: Executa o servidor Node.js
node src/server.js

pause