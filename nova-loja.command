#!/bin/bash
# ============================================================
#  Nova loja — Mac
#  Duplo clique neste arquivo. Ele cria a pasta do cliente,
#  baixa a versão mais recente dos manuais e abre o Codex.
# ============================================================

# Endereço dos manuais (o repositório precisa estar PÚBLICO)
RAW="https://raw.githubusercontent.com/FilipeSodreTruth/robo-de-fotos-truthcommerce/main"

# Onde as pastas dos clientes ficam
BASE="$HOME/nuvemshop-lojas"

# Modelo padrao do time. Trocar aqui muda em todas as maquinas na proxima abertura.
MODELO_PADRAO="gpt-5.6-terra"

# ------------------------------------------------------------
#  Auto-atualizacao: pega a versao mais nova deste proprio atalho
#  antes de qualquer coisa. Roda uma vez so (a variavel evita loop).
# ------------------------------------------------------------
if [ -z "$AGENTE_ATUALIZADO" ]; then
  NOVO=$(mktemp)
  if curl -fsSL "$RAW/nova-loja.command" -o "$NOVO" 2>/dev/null \
     && [ -s "$NOVO" ] && head -1 "$NOVO" | grep -q '^#!/bin/bash' \
     && ! cmp -s "$NOVO" "$0"; then
    cat "$NOVO" > "$0" && chmod +x "$0"
    rm -f "$NOVO"
    echo ""
    echo "  Atalho atualizado para a versao mais recente. Continuando..."
    AGENTE_ATUALIZADO=1 exec "$0" "$@"
  fi
  rm -f "$NOVO"
fi

set -e
cd "$(dirname "$0")"

echo ""
echo "  Agente de layout Nuvemshop"
echo "  ----------------------------------------"
echo ""
read -p "  Nome do cliente (ex: mega-ar): " CLIENTE

if [ -z "$CLIENTE" ]; then
  echo "  Nome vazio. Feche a janela e tente de novo."
  read -n 1 -s
  exit 1
fi

# normaliza: minúsculas, espaços viram hífen
CLIENTE=$(echo "$CLIENTE" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
PASTA="$BASE/$CLIENTE"

mkdir -p "$PASTA"
cd "$PASTA"

if [ -f "HANDOFF.md" ]; then
  echo ""
  echo "  Pasta já existe — retomando o trabalho desse cliente."
else
  echo ""
  echo "  Criando a pasta do cliente."
fi

# garante o perfil de permissões do Codex, uma vez por máquina
mkdir -p "$HOME/.codex"
PERFIL="$HOME/.codex/nuvemshop.config.toml"
if [ ! -f "$PERFIL" ]; then
  echo "  Configurando o perfil de permissoes do Codex (primeira vez)..."
  cat > "$PERFIL" <<TOMLEOF
model = "$MODELO_PADRAO"
model_reasoning_effort = "medium"
approval_policy = "on-request"
sandbox_mode = "workspace-write"

[sandbox_workspace_write]
network_access = true
TOMLEOF
else
  # O perfil so era escrito na primeira execucao, e a unica migracao existente
  # trocava gpt-5.6-sol por Terra. Qualquer outro modelo (Astra, Luna, um que
  # nem existe ainda) ficava para sempre. Agora a linha do modelo e reescrita
  # a cada abertura: o padrao vive aqui no script, nao na maquina de cada um.
  if grep -qE '^model[[:space:]]*=' "$PERFIL"; then
    sed -i.bak -E "s/^model[[:space:]]*=.*/model = \"$MODELO_PADRAO\"/" "$PERFIL"
    rm -f "$PERFIL.bak"
  else
    printf 'model = "%s"\n' "$MODELO_PADRAO" | cat - "$PERFIL" > "$PERFIL.tmp"
    mv "$PERFIL.tmp" "$PERFIL"
  fi
fi

# versoes antigas deste script gravavam o perfil dentro do config.toml,
# formato que o Codex nao aceita mais junto com -p
if grep -q "\[profiles.nuvemshop\]" "$HOME/.codex/config.toml" 2>/dev/null; then
  echo ""
  echo "  ATENCAO: existe um bloco antigo [profiles.nuvemshop] no seu"
  echo "  ~/.codex/config.toml. Apague esse bloco inteiro, senao o Codex"
  echo "  recusa o perfil e abre no modelo errado. Para abrir:"
  echo "  open -e ~/.codex/config.toml"
  echo ""
fi

# navegador do Playwright: registra o servidor MCP e baixa o Chromium (uma vez por maquina)
MARCA="$HOME/.codex/.playwright-pronto"
if [ ! -f "$MARCA" ]; then
  echo "  Preparando o navegador de teste (primeira vez, pode demorar)..."
  if ! codex mcp list 2>/dev/null | grep -q playwright; then
    codex mcp add playwright -- npx @playwright/mcp@latest >/dev/null 2>&1 \
      && echo "  Servidor Playwright registrado no Codex." \
      || echo "  Nao consegui registrar o Playwright no Codex - rode manualmente:
     codex mcp add playwright -- npx @playwright/mcp@latest"
  fi
  if command -v claude >/dev/null 2>&1; then
    claude mcp list 2>/dev/null | grep -q playwright || \
      claude mcp add playwright npx @playwright/mcp@latest >/dev/null 2>&1
  fi
  npx --yes playwright install chromium >/dev/null 2>&1 \
    && echo "  Navegador de teste instalado." \
    || echo "  Aviso: nao consegui baixar o Chromium. Rode:  npx playwright install chromium"
  touch "$MARCA"
fi

# modo de trabalho
if [ -f ".modo" ]; then
  MODO=$(cat .modo)
  echo "  Modo desta loja: $MODO (definido antes)"
else
  echo ""
  echo "  Como o codigo vai para a loja?"
  echo "    [Enter] simples   - edito os arquivos, voce copia e cola no painel"
  echo "    [a]     avancado  - publico direto (precisa de token e CLI)"
  read -p "  > " M
  case "$M" in
    a|A|avancado) MODO="modo-avancado" ;;
    *)            MODO="modo-simples"  ;;
  esac
  echo "$MODO" > .modo
fi

# baixa a versão atual dos manuais, sempre
echo "  Atualizando os manuais..."
if curl -fsSL "$RAW/$MODO/AGENTS.md" -o AGENTS.md.novo 2>/dev/null; then
  mv AGENTS.md.novo AGENTS.md
  curl -fsSL "$RAW/$MODO/CLAUDE.md" -o CLAUDE.md
  mkdir -p codigo/_anterior
  mkdir -p .claude
  curl -fsSL "$RAW/settings.json" -o .claude/settings.json
  curl -fsSL "$RAW/vigia.js" -o "$HOME/.codex/vigia.js" 2>/dev/null
  curl -fsSL "$RAW/gasto.js" -o "$HOME/.codex/gasto.js" 2>/dev/null
  curl -fsSL "$RAW/envia-gasto.js" -o "$HOME/.codex/envia-gasto.js" 2>/dev/null
  # Destino do envio de consumo. Escrito UMA vez por maquina, aqui, pra ninguem
  # ter que visitar PC do time. So cria se faltar: quem ja tem o arquivo pode ter
  # posto um segredo na 2a linha, e sobrescrever apagaria isso.
  if [ ! -f "$HOME/.codex/gasto-webhook.txt" ]; then
    echo "https://automatruth-automatruth.wflubn.easypanel.host/api/codex/layout-spend" > "$HOME/.codex/gasto-webhook.txt"
  fi
  [ -f "HANDOFF.md" ] || curl -fsSL "$RAW/HANDOFF-modelo.md" -o HANDOFF.md
  echo "  Manuais atualizados."
else
  rm -f AGENTS.md.novo
  if [ -f "AGENTS.md" ]; then
    echo "  Nao consegui atualizar os manuais (sem internet ou repositorio fora do ar)."
    echo "  Seguindo com a versao que ja esta na pasta."
  else
    echo ""
    echo "  ERRO: nao consegui baixar os manuais e nao ha copia local."
    echo "  Avise quem cuida do repositorio. Feche esta janela."
    read -n 1 -s
    exit 1
  fi
fi

echo ""
echo "  Qual agente?"
echo "    [Enter] Codex   |   [c] Claude"
read -p "  > " ESCOLHA

case "$ESCOLHA" in
  c|C|claude|Claude) AGENTE="claude" ;;
  *)                 AGENTE="codex"  ;;
esac

# Segunda camada: mesmo que o perfil seja ignorado (bloco antigo no config.toml,
# -p recusado), a linha de abertura fixa o modelo. So usa a flag se esta versao
# da CLI tiver --model; versoes antigas abrem como antes.
FLAG_MODELO=""
if [ "$AGENTE" = "codex" ] && codex --help 2>/dev/null | grep -q -- '--model'; then
  FLAG_MODELO="--model $MODELO_PADRAO"
fi

echo ""
echo "  Pronto. Abrindo o $AGENTE nesta pasta:"
echo "  $PASTA"
if [ "$AGENTE" = "codex" ]; then
  echo "  Modelo: $MODELO_PADRAO   (para subir no meio do trabalho: /model)"
fi
echo ""
echo "  Escreva o que você quer mudar na loja. O agente conduz o resto."
echo "  ----------------------------------------"
echo ""

# resumo de consumo para o n8n — uma vez por dia, em segundo plano.
# Sai calado se ~/.codex/gasto-webhook.txt nao existir nesta maquina.
if [ -f "$HOME/.codex/envia-gasto.js" ]; then
  node "$HOME/.codex/envia-gasto.js" >/dev/null 2>&1 &
fi

# vigia de gasto em segundo plano — avisa se a sessao ficar cara
VIGIA=""
if [ -f "$HOME/.codex/vigia.js" ]; then
  node "$HOME/.codex/vigia.js" "$PASTA" >/dev/null 2>&1 &
  VIGIA=$!
fi
limpar() { [ -n "$VIGIA" ] && kill "$VIGIA" 2>/dev/null; }
trap limpar EXIT INT TERM

if [ "$AGENTE" = "claude" ]; then
  claude
else
  codex -p nuvemshop $FLAG_MODELO --cd "$PASTA"
fi

limpar
