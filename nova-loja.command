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
mkdir -p "$HOME/.codex"
PERFIL="$HOME/.codex/nuvemshop.config.toml"
if [ ! -f "$PERFIL" ]; then
  echo "  Configurando o perfil de permissoes do Codex (primeira vez)..."
  cat > "$PERFIL" <<'TOMLEOF'
model = "gpt-5.6-sol"
model_reasoning_effort = "medium"
approval_policy = "on-request"
sandbox_mode = "workspace-write"

[sandbox_workspace_write]
network_access = true
TOMLEOF
fi

# versoes antigas deste script gravavam o perfil dentro do config.toml,
# formato que o Codex nao aceita mais junto com -p
if grep -q "\[profiles.nuvemshop\]" "$HOME/.codex/config.toml" 2>/dev/null; then
  echo ""
  echo "  ATENCAO: existe um bloco antigo [profiles.nuvemshop] no seu"
  echo "  ~/.codex/config.toml. Apague esse bloco inteiro, senao o Codex"
  echo "  recusa o perfil. Para abrir:  open -e ~/.codex/config.toml"
  echo ""
fi

# modo de trabalho
if [ -f ".modo" ]; then
  MODO=$(cat .modo)
  echo "  Modo desta loja: $MODO (definido antes)"
else
  echo ""
  echo "  Como o codigo vai para a loja?"
  echo "    [Enter] simples   - entrego o codigo, voce cola no painel"
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
  mkdir -p codigo/para-colar codigo/_anterior
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
echo "  Qual agente?"
echo "    [Enter] Codex   |   [c] Claude"
read -p "  > " ESCOLHA

case "$ESCOLHA" in
  c|C|claude|Claude) AGENTE="claude" ;;
  *)                 AGENTE="codex"  ;;
esac

echo ""
echo "  Pronto. Abrindo o $AGENTE nesta pasta:"
echo "  $PASTA"
echo ""
echo "  Escreva o que você quer mudar na loja. O agente conduz o resto."
echo "  ----------------------------------------"
echo ""

if [ "$AGENTE" = "claude" ]; then
  exec claude
else
  exec codex -p nuvemshop
fi
