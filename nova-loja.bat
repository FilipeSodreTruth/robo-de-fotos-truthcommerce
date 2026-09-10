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

REM Modelo padrao do time. Trocar aqui muda em todas as maquinas na proxima abertura.
set MODELO_PADRAO=gpt-5.6-terra

REM ------------------------------------------------------------
REM  Auto-atualizacao: pega a versao mais nova deste proprio atalho.
REM  O .bat e lido linha a linha do disco, entao trocamos o arquivo
REM  e reabrimos numa janela nova em vez de continuar aqui.
REM ------------------------------------------------------------
if not "%~1"=="atualizado" (
  curl -fsSL "%RAW%/nova-loja.bat" -o "%TEMP%\nova-loja-novo.bat" >nul 2>&1
  if exist "%TEMP%\nova-loja-novo.bat" (
    findstr /c:"Agente de layout Nuvemshop" "%TEMP%\nova-loja-novo.bat" >nul 2>&1
    if not errorlevel 1 (
      fc /b "%TEMP%\nova-loja-novo.bat" "%~f0" >nul 2>&1
      if errorlevel 1 (
        copy /y "%TEMP%\nova-loja-novo.bat" "%~f0" >nul 2>&1
        del "%TEMP%\nova-loja-novo.bat" >nul 2>&1
        echo.
        echo   Atalho atualizado para a versao mais recente. Reabrindo...
        timeout /t 2 >nul
        start "" "%~f0" atualizado
        exit /b
      )
    )
    del "%TEMP%\nova-loja-novo.bat" >nul 2>&1
  )
)

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
  >"%PERFIL%" echo model = "%MODELO_PADRAO%"
  >>"%PERFIL%" echo model_reasoning_effort = "medium"
  >>"%PERFIL%" echo approval_policy = "on-request"
  >>"%PERFIL%" echo sandbox_mode = "workspace-write"
  >>"%PERFIL%" echo.
  >>"%PERFIL%" echo [sandbox_workspace_write]
  >>"%PERFIL%" echo network_access = true
) else (
  REM O perfil so era escrito na primeira execucao, e a unica migracao existente
  REM trocava gpt-5.6-sol por Terra. Qualquer outro modelo - Astra, Luna, um que
  REM nem existe ainda - ficava para sempre. Agora a linha do modelo e reescrita
  REM a cada abertura: o padrao vive aqui no script, nao na maquina de cada um.
  powershell -NoProfile -Command "$p='%PERFIL%'; $q=[char]34; $l='model = '+$q+'%MODELO_PADRAO%'+$q; $c=Get-Content -Path $p; if ($c -match '^model\s*=') { $c = $c -replace '^model\s*=.*', $l } else { $c = ,$l + $c }; Set-Content -Path $p -Value $c" >nul 2>&1
)

findstr /c:"[profiles.nuvemshop]" "%USERPROFILE%\.codex\config.toml" >nul 2>&1
if not errorlevel 1 (
  echo.
  echo   ATENCAO: existe um bloco antigo [profiles.nuvemshop] no seu
  echo   config.toml. Apague esse bloco inteiro, senao o Codex recusa o
  echo   perfil e abre no modelo errado.
  echo   Arquivo: %USERPROFILE%\.codex\config.toml
  echo.
)

set MARCA=%USERPROFILE%\.codex\.playwright-pronto
if not exist "%MARCA%" (
  echo   Preparando o navegador de teste ^(primeira vez, pode demorar^)...
  codex mcp list 2>nul | findstr /i playwright >nul 2>&1
  if errorlevel 1 codex mcp add playwright -- npx @playwright/mcp@latest >nul 2>&1
  where claude >nul 2>&1
  if not errorlevel 1 claude mcp add playwright npx @playwright/mcp@latest >nul 2>&1
  call npx --yes playwright install chromium >nul 2>&1
  type nul > "%MARCA%"
  echo   Navegador de teste pronto.
)

if exist ".modo" (
  set /p MODO=<.modo
) else (
  echo.
  echo   Como o codigo vai para a loja?
  echo     [Enter] simples   - edito os arquivos, voce copia e cola no painel
  echo     [a]     avancado  - publico direto ^(precisa de token e CLI^)
  set "M="
  set /p M="  > "
  if /i "!M!"=="a" (set "MODO=modo-avancado") else (set "MODO=modo-simples")
  >.modo echo !MODO!
)

echo   Modo desta loja: !MODO!

echo   Atualizando os manuais...
curl -fsSL "%RAW%/!MODO!/AGENTS.md" -o "%PASTA%\AGENTS.md.novo" >nul 2>&1

if exist "%PASTA%\AGENTS.md.novo" (
  move /y "%PASTA%\AGENTS.md.novo" "%PASTA%\AGENTS.md" >nul
  curl -fsSL "%RAW%/!MODO!/CLAUDE.md" -o "%PASTA%\CLAUDE.md" >nul 2>&1
  if not exist ".claude" mkdir ".claude"
  if not exist "codigo\_anterior" mkdir "codigo\_anterior"
  curl -fsSL "%RAW%/settings.json" -o "%PASTA%\.claude\settings.json" >nul 2>&1
  curl -fsSL "%RAW%/vigia.js" -o "%USERPROFILE%\.codex\vigia.js" >nul 2>&1
  curl -fsSL "%RAW%/gasto.js" -o "%USERPROFILE%\.codex\gasto.js" >nul 2>&1
  curl -fsSL "%RAW%/envia-gasto.js" -o "%USERPROFILE%\.codex\envia-gasto.js" >nul 2>&1
  rem Destino do envio de consumo, uma vez por maquina. So cria se faltar: quem ja
  rem tem o arquivo pode ter posto um segredo na 2a linha.
  if not exist "%USERPROFILE%\.codex\gasto-webhook.txt" (
    echo https://automatruth-automatruth.wflubn.easypanel.host/api/codex/layout-spend>"%USERPROFILE%\.codex\gasto-webhook.txt"
  )
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
if /i "!ESCOLHA!"=="c" set "AGENTE=claude"
if /i "!ESCOLHA!"=="claude" set "AGENTE=claude"

REM Segunda camada: mesmo que o perfil seja ignorado (bloco antigo no config.toml,
REM -p recusado), a linha de abertura fixa o modelo. So usa a flag se esta versao
REM da CLI tiver --model; versoes antigas abrem como antes.
set "FLAG_MODELO="
if /i "!AGENTE!"=="codex" (
  codex --help 2>nul | findstr /c:"--model" >nul 2>&1
  if not errorlevel 1 set "FLAG_MODELO=--model %MODELO_PADRAO%"
)

REM Acoes do navegador (Playwright) sem revisao automatica do guardian, que custava
REM ~32% dos tokens novos (ver nova-loja.command). So com o servidor registrado:
REM sem ele o override derruba a abertura do Codex.
set "FLAG_MCP="
if /i "!AGENTE!"=="codex" (
  codex mcp list 2>nul | findstr /c:"playwright" >nul 2>&1
  if not errorlevel 1 set "FLAG_MCP=-c mcp_servers.playwright.default_tools_approval_mode=approve"
)

echo.
echo   Pronto. Abrindo o !AGENTE! nesta pasta:
echo   %PASTA%
if /i "!AGENTE!"=="codex" echo   Modelo: %MODELO_PADRAO%   ^(para subir no meio do trabalho: /model^)
echo.
echo   Escreva o que voce quer mudar na loja. O agente conduz o resto.
echo   ----------------------------------------
echo.

REM resumo de consumo para o AutomaTruth, em segundo plano. Vai de novo ao fechar
REM o agente (la embaixo); repetir nao soma, o servidor substitui o envio anterior.
REM Sai calado se %USERPROFILE%\.codex\gasto-webhook.txt nao existir nesta maquina.
if exist "%USERPROFILE%\.codex\envia-gasto.js" (
  start /b "" node "%USERPROFILE%\.codex\envia-gasto.js" >nul 2>&1
)

REM Aviso de consumo dentro do chat: vigia.js roda como hook do Codex a cada
REM mensagem (ver nova-loja.command). Aqui so garante o registro do hook.
if /i "!AGENTE!"=="codex" if exist "%USERPROFILE%\.codex\vigia.js" (
  node "%USERPROFILE%\.codex\vigia.js" --instalar
)

if "!AGENTE!"=="claude" (
  claude
) else (
  codex -p nuvemshop !FLAG_MODELO! !FLAG_MCP! --cd "%PASTA%"
)

REM consumo da sessao que acabou de fechar. Em primeiro plano de proposito:
REM fechar a janela mataria um envio em segundo plano.
if exist "%USERPROFILE%\.codex\envia-gasto.js" (
  node "%USERPROFILE%\.codex\envia-gasto.js" >nul 2>&1
)
