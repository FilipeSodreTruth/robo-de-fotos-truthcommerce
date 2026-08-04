@echo off
REM ============================================================
REM   Nova loja - Windows
REM   Duplo clique neste arquivo. Ele cria a pasta do cliente,
REM   baixa a versao mais recente dos manuais e abre o Codex.
REM ============================================================

REM Endereco dos manuais (o repositorio precisa estar PUBLICO)
set RAW=https://raw.githubusercontent.com/FilipeSodreTruth/robo-de-fotos-truthcommerce/main

REM Onde as pastas dos clientes ficam
set BASE=%USERPROFILE%\nuvemshop-lojas

setlocal enabledelayedexpansion
chcp 65001 >nul

echo.
echo   Agente de layout Nuvemshop
echo   ----------------------------------------
echo.
set /p CLIENTE="  Nome do cliente (ex: mega-ar): "

if "%CLIENTE%"=="" (
  echo   Nome vazio. Feche a janela e tente de novo.
  pause >nul
  exit /b 1
)

set CLIENTE=%CLIENTE: =-%
set PASTA=%BASE%\%CLIENTE%

if not exist "%PASTA%" mkdir "%PASTA%"
cd /d "%PASTA%"

echo.
if exist "HANDOFF.md" (
  echo   Pasta ja existe - retomando o trabalho desse cliente.
) else (
  echo   Criando a pasta do cliente.
)

if not exist "%USERPROFILE%\.codex" mkdir "%USERPROFILE%\.codex"
set PERFIL=%USERPROFILE%\.codex\nuvemshop.config.toml
if not exist "%PERFIL%" (
  echo   Configurando o perfil de permissoes do Codex ^(primeira vez^)...
  >"%PERFIL%" echo model = "gpt-5.6-sol"
  >>"%PERFIL%" echo model_reasoning_effort = "medium"
  >>"%PERFIL%" echo approval_policy = "on-request"
  >>"%PERFIL%" echo sandbox_mode = "workspace-write"
  >>"%PERFIL%" echo.
  >>"%PERFIL%" echo [sandbox_workspace_write]
  >>"%PERFIL%" echo network_access = true
)

findstr /c:"[profiles.nuvemshop]" "%USERPROFILE%\.codex\config.toml" >nul 2>&1
if not errorlevel 1 (
  echo.
  echo   ATENCAO: existe um bloco antigo [profiles.nuvemshop] no seu
  echo   config.toml. Apague esse bloco inteiro, senao o Codex recusa o perfil.
  echo   Arquivo: %USERPROFILE%\.codex\config.toml
  echo.
)

echo   Atualizando os manuais...
curl -fsSL "%RAW%/AGENTS.md" -o "%PASTA%\AGENTS.md.novo" >nul 2>&1

if exist "%PASTA%\AGENTS.md.novo" (
  move /y "%PASTA%\AGENTS.md.novo" "%PASTA%\AGENTS.md" >nul
  curl -fsSL "%RAW%/CLAUDE.md" -o "%PASTA%\CLAUDE.md" >nul 2>&1
  if not exist ".claude" mkdir ".claude"
  curl -fsSL "%RAW%/settings.json" -o "%PASTA%\.claude\settings.json" >nul 2>&1
  if not exist "HANDOFF.md" curl -fsSL "%RAW%/HANDOFF-modelo.md" -o "%PASTA%\HANDOFF.md" >nul 2>&1
  echo   Manuais atualizados.
) else (
  if exist "AGENTS.md" (
    echo   Nao consegui atualizar os manuais ^(sem internet ou repositorio fora do ar^).
    echo   Seguindo com a versao que ja esta na pasta.
  ) else (
    echo.
    echo   ERRO: nao consegui baixar os manuais e nao ha copia local.
    echo   Avise quem cuida do repositorio. Feche esta janela.
    pause ^>nul
    exit /b 1
  )
)

echo.
echo   Qual agente?
echo     [Enter] Codex   ^|   [c] Claude
set ESCOLHA=
set /p ESCOLHA="  > "

set AGENTE=codex
if /i "%ESCOLHA%"=="c" set AGENTE=claude
if /i "%ESCOLHA%"=="claude" set AGENTE=claude

echo.
echo   Pronto. Abrindo o %AGENTE% nesta pasta:
echo   %PASTA%
echo.
echo   Escreva o que voce quer mudar na loja. O agente conduz o resto.
echo   ----------------------------------------
echo.

if "%AGENTE%"=="claude" (
  claude
) else (
  codex -p nuvemshop
)
