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
CFG="$HOME/.codex/config.toml"
mkdir -p "$HOME/.codex"
touch "$CFG"
if ! grep -q "\[profiles.nuvemshop\]" "$CFG"; then
  echo "  Configurando o perfil de permissões do Codex (primeira vez)..."
  {
    echo ""
    echo "[profiles.nuvemshop]"
    echo 'model = "gpt-5.6-sol"'
    echo 'model_reasoning_effort = "medium"'
    echo 'approval_policy = "on-request"'
    echo 'sandbox_mode = "workspace-write"'
    echo ""
    echo "[profiles.nuvemshop.sandbox_workspace_write]"
    echo "network_access = true"
  } >> "$CFG"
fi

# baixa a versão atual dos manuais, sempre
echo "  Atualizando os manuais..."
if curl -fsSL "$RAW/AGENTS.md" -o AGENTS.md.novo 2>/dev/null; then
  mv AGENTS.md.novo AGENTS.md
  curl -fsSL "$RAW/CLAUDE.md" -o CLAUDE.md
  mkdir -p .claude
  curl -fsSL "$RAW/settings.json" -o .claude/settings.json
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
echo "  Pronto. Abrindo o Codex nesta pasta:"
echo "  $PASTA"
echo ""
echo "  Escreva o que você quer mudar na loja. O agente conduz o resto."
echo "  ----------------------------------------"
echo ""

exec codex -p nuvemshop
