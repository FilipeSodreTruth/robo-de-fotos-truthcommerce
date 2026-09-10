#!/bin/bash
# ============================================================
#  Nova loja — Mac
#  Duplo clique neste arquivo. Ele cria a pasta do cliente,
#  baixa a versão mais recente dos manuais e abre o Codex.
# ============================================================

# Endereço dos manuais (o repositório precisa estar PÚBLICO)
RAW="https://raw.githubusercontent.com/FilipeSodreTruth/robo-de-fotos-truthcommerce/main"

# Espelho: quando o raw.githubusercontent devolve 503 (acontece), este
# caminho passa pelo github.com e costuma responder.
ESPELHO="https://github.com/FilipeSodreTruth/robo-de-fotos-truthcommerce/raw/main"

# Onde as pastas dos clientes ficam
BASE="$HOME/nuvemshop-lojas"

# Modelo padrao do time. Trocar aqui muda em todas as maquinas na proxima abertura.
MODELO_PADRAO="gpt-5.6-terra"

# ------------------------------------------------------------
#  baixar <caminho-no-repositorio> <destino>
#  Tenta o raw com 3 tentativas (o -f faz o curl tratar 5xx como erro e o
#  --retry cobre justamente 429/5xx), depois cai para o espelho.
#  Devolve 1 em vez de derrubar o script: quem chama decide o que fazer.
# ------------------------------------------------------------
baixar() {
  curl -fsSL --retry 3 --retry-delay 2 --connect-timeout 10 \
       "$RAW/$1" -o "$2" 2>/dev/null && return 0
  curl -fsSL --retry 2 --retry-delay 2 --connect-timeout 10 \
       "$ESPELHO/$1" -o "$2" 2>/dev/null && return 0
  return 1
}

# ------------------------------------------------------------
#  Auto-atualizacao: pega a versao mais nova deste proprio atalho
#  antes de qualquer coisa. Roda uma vez so (a variavel evita loop).
# ------------------------------------------------------------
if [ -z "$AGENTE_ATUALIZADO" ]; then
  NOVO=$(mktemp)
  if baixar "nova-loja.command" "$NOVO" \
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

# Baixa a versao atual dos manuais, sempre.
#
# Antes, um curl sem protecao aqui derrubava o script inteiro por causa do
# `set -e`: bastava um 503 no meio e a janela fechava sozinha, com a pasta
# meio atualizada. Agora nada aqui aborta a abertura.
echo "  Atualizando os manuais..."

FALHOU=0
baixar "$MODO/AGENTS.md" "AGENTS.md.novo" || FALHOU=1
baixar "$MODO/CLAUDE.md" "CLAUDE.md.novo" || FALHOU=1

if [ "$FALHOU" = "0" ]; then
  # so troca os manuais quando os dois chegaram inteiros
  mv AGENTS.md.novo AGENTS.md
  mv CLAUDE.md.novo CLAUDE.md
  mkdir -p codigo/_anterior .claude

  # acessorios: se um falhar, segue com o que ja existe na maquina
  baixar "settings.json"   ".claude/settings.json"        || true
  baixar "vigia.js"        "$HOME/.codex/vigia.js"        || true
  baixar "gasto.js"        "$HOME/.codex/gasto.js"        || true
  baixar "envia-gasto.js"  "$HOME/.codex/envia-gasto.js"  || true

  # Destino do envio de consumo, uma vez por maquina. Sem este arquivo o
  # envia-gasto sai calado (ver o comentario mais abaixo) e o AutomaTruth nunca
  # recebe nada - por isso ele e criado AQUI, e nao a mao em cada PC.
  # So cria se faltar: quem ja tem pode ter posto um segredo na 2a linha.
  if [ ! -f "$HOME/.codex/gasto-webhook.txt" ]; then
    echo "https://automatruth-automatruth.wflubn.easypanel.host/api/codex/layout-spend" > "$HOME/.codex/gasto-webhook.txt"
  fi
  [ -f "HANDOFF.md" ] || baixar "HANDOFF-modelo.md" "HANDOFF.md" || true

  echo "  Manuais atualizados."
else
  rm -f AGENTS.md.novo CLAUDE.md.novo
  if [ -f "AGENTS.md" ]; then
    echo "  Nao consegui atualizar os manuais (GitHub fora do ar ou sem internet)."
    echo "  Seguindo com a versao que ja esta na pasta - o trabalho nao para."
  else
    echo ""
    echo "  ERRO: nao consegui baixar os manuais e nao ha copia local nesta pasta."
    echo "  Tente de novo em alguns minutos. Se insistir, avise o time."
    echo ""
    echo "  Aperte qualquer tecla para fechar."
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

# resumo de consumo para o AutomaTruth, em segundo plano. Vai de novo ao fechar
# o agente (la embaixo); repetir nao soma, o servidor substitui o envio anterior.
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

# consumo da sessao que acabou de fechar - so o envio da abertura deixava o
# painel uma sessao atrasado. Em primeiro plano de proposito: fechar a janela
# mataria um envio em segundo plano. Sem internet, desiste em ate 10s.
if [ -f "$HOME/.codex/envia-gasto.js" ]; then
  node "$HOME/.codex/envia-gasto.js" >/dev/null 2>&1
fi

limpar
