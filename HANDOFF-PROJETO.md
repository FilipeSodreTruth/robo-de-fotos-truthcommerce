# Handoff — Agente de layout Nuvemshop

Estado do projeto em 2026-08-21. Para retomar o trabalho em outra sessão, com outro agente
ou outra pessoa.

Repositório: `github.com/FilipeSodreTruth/robo-de-fotos-truthcommerce` (público, branch `main`).
O nome não descreve o projeto — renomear continua pendente.

## O que é

Manuais + scripts que permitem ao time da Truth Commerce aplicar CSS/JS/HTML em temas
Nuvemshop usando um agente de IA (Codex ou Claude Code), sem que a pessoa precise saber
programar nem ter editor de código instalado.

## Estrutura do repositório

```
COMECE-AQUI.md                guia do usuário final (não técnico)
HANDOFF-PROJETO.md            este arquivo
HANDOFF-modelo.md             template do handoff por loja
settings.json                 permissões do Claude Code
codex-config-nuvemshop.toml   referência do perfil do Codex
nova-loja.command / .bat      scripts de duplo clique (Mac / Windows)
modo-simples/   AGENTS.md + CLAUDE.md
modo-avancado/  AGENTS.md + CLAUDE.md
```

Os manuais são baixados a cada execução do script — editar no GitHub propaga para todo mundo
na próxima abertura. Só o script em si não se auto-atualiza (pendência).

## Os dois modos

**Modo CLI (`modo-avancado/`)** — token + CLI tiendanube, publica via `theme push`. Pressupõe
tema com seções e blocos `custom_code`: hoje **só o Ipanema**. Fluxo: verificar ferramentas →
token → pull do tema → reconhecer no Playwright → preview injetado → aprovação → push →
conferir no servidor → registrar → verificar no navegador.

**Modo simples (`modo-simples/`)** — sem token, sem CLI, para temas clássicos. O agente
analisa a página pelo Playwright e mantém dois arquivos na pasta do cliente; **entrega o
código pela área de transferência** (`pbcopy` / `type … | clip`), e o usuário cola no painel.
Ninguém abre arquivo — o time não tem VS Code.

**Exatamente dois destinos no modo simples:** campo de CSS personalizado e rodapé (HTML +
`<script>`). Não existem blocos numerados nem seção "Personalizada" — isso é do modo CLI, e o
vazamento desse vocabulário entre os manuais já causou erro na prática. Cada manual agora
declara seu escopo no topo.

Estrutura por loja no modo simples:

```
codigo/
  estilos.css     todo o CSS — o usuário copia inteiro
  scripts.html    todo o JS/HTML — o usuário copia inteiro
  _anterior/      versão anterior, para reverter
HANDOFF.md
.modo             grava o modo daquela loja (não pergunta de novo)
```

## Decisões de desenho (o porquê)

**Dois portões de aprovação.** No Codex isso exigiu override explícito, porque o modelo é
treinado para persistir até resolver e atropelaria a espera.

**Regras críticas em duas camadas.** Manual instrui; permissões impedem. `theme publish`
bloqueado, `theme push` com confirmação. Instrução falha em sessão longa, permissão não.

**Sentinelas no CSS** (`/* @agente inicio: <slug> */`) para substituir em vez de empilhar.

**Arquivo como fonte da verdade.** Como o usuário cola o arquivo inteiro, substituindo, não
existe caminho para acumular código morto. Ideia do Filipe.

**Registro contínuo no handoff** (regra inviolável). Escrever no momento em que a informação
aparece, não no fim. Teste: *se esta sessão morresse agora, outra pessoa continuaria só com o
arquivo?* Gatilhos: publicação confirmada, decisão do usuário sobre **como** trabalhar,
armadilha do tema descoberta, falha com causa identificada, antes de espera longa.

**`HANDOFF.md` por loja tem três seções:** *Decisões e preferências* (vale para sempre),
*Armadilhas deste tema*, *Histórico*. Decisão sobre método não envelhece junto com o log.

**Manuais enxutos.** Foram cortados ~55% (CLI: 28k → 11,5k caracteres; simples: 20k → 10k).
Prompt longo dispersa o modelo. Regras ficam no topo e não se repetem nos passos.

**Backup por cliente** (`../<pasta>-backup`), nunca compartilhado.

**`browser_snapshot` só sob demanda.** Ele devolve a árvore de acessibilidade inteira — numa
home de loja (4.600px de altura na Cutelaria) isso domina o custo de contexto da sessão. Quando
o usuário já indicou o alvo, o agente vai direto ao `browser_evaluate` mirado. Foi assim que a
sessão real identificou a seção, e custa uma fração.

## Fatos técnicos confirmados

- **Nome do bloco:** campo `name` **no mesmo nível de `type` e `settings`**, não dentro de
  `settings`. Definível direto no JSON, sem editor visual — testado contra a API.
- **Limites:** CSS global ~15.000; bloco de código do rodapé **~50.000** (oficial na doc, não
  500 como constava antes). Na prática nunca é preciso dividir JS.
- **Onde mora:** seções e blocos ficam no JSON da página (`templates/home.json` e afins). O
  `settings_data.json` guarda configurações globais, incluindo o CSS.
- **Método para validar limites:** criar via API, editar, remover, conferir se o arquivo volta
  byte a byte. Os ~15.000 do CSS e ~5.000 do `custom_css` nunca foram medidos assim.

## Armadilhas já encontradas (custaram tempo)

- **Playwright no macOS:** Chromium lançado do terminal dentro do sandbox do Codex morre com
  `Operation not permitted`. **Só o caminho MCP funciona** (o servidor roda fora do sandbox).
  Nunca instalar `playwright` na pasta do cliente. `playwright` e `@playwright/mcp` são
  pacotes distintos. Registrar o servidor não vale para a sessão já aberta — reabrir o agente.
  Os scripts hoje registram e baixam o Chromium na primeira execução.
- **Codex perfis:** `[profiles.x]` dentro do `config.toml` foi descontinuado — o perfil vai em
  `~/.codex/nuvemshop.config.toml`. Bloco antigo faz o `-p` falhar; os scripts avisam.
- **Codex sandbox:** `workspace-write` corta a rede por padrão. Sem `network_access = true`, o
  `npm install` e o CLI travam sem erro claro.
- **Codex e diretório:** sem `--cd`, abre onde foi chamado e não acha o `AGENTS.md`.
- **`.bat`:** variável definida dentro de bloco `if` precisa de expansão atrasada (`!MODO!`).
- **PowerShell:** `curl` é apelido do `Invoke-WebRequest` — usar `curl.exe`, e
  `[Environment]::GetFolderPath('Desktop')` no lugar de `%USERPROFILE%`.
- **Mac:** arquivo baixado pelo navegador vem sem permissão de execução e com quarentena. A
  instalação por `curl` + `chmod +x` resolve os dois.
- **Upload no GitHub:** arrastar pasta aninhada cria o caminho inteiro no repositório. Usar
  *Add file → Create new file* digitando `modo-simples/AGENTS.md`.

## Pesquisa na documentação oficial (nuvemshop.dev, ago/2026)

**Não existe changelog de temas.** O changelog do site é só de API e reflete mudanças na
documentação, não na API. Nada sobre seções ou layout no último ano.

**Achado mais importante — o CLI tem fluxo FTP para temas não-Ipanema.** O Fork workflow (token
+ API REST) suporta apenas o Ipanema; para os outros temas existe o Fluxo FTP, que baixa, envia
e monitora arquivos. Ou seja: **o modo simples poderia publicar automaticamente**, e o
copia-e-cola deixaria de existir. Não testado ainda — é a próxima coisa a fazer.

**Bloco `code`:** tem a tag `"general"`, então entra em qualquer seção que aceite blocos
genéricos — não precisa de seção "Personalizada". O manual do modo CLI ainda não reflete isso.

**Ipanema é o único tema seccionável disponível** — a separação em dois modos está
estruturalmente correta e deve continuar valendo por um tempo.

**Outros caminhos, para projeto futuro (não este agente):** NubeSDK executa código de terceiros
na vitrine e no checkout; a Scripts API (`POST /scripts`) injeta JS via API. Ambos exigem app
registrado no Partners Portal e homologação. É o único jeito de mexer no **checkout** — serviço
vendável que a concorrência provavelmente não oferece.

**MCP oficial da Nuvemshop** (`https://admin-mcp.nuvemshop.com.br/mcp`): 28 tools de catálogo,
pedidos, cupons e promoções. **Não faz layout.** Toda escrita atua sobre a loja publicada e
fica visível na hora — precisaria dos mesmos portões de aprovação.

**Do changelog, relevante à operação (não a layout):** tabelas de preço por cliente (B2B),
kits no catálogo, visibilidade de categoria, API de blog, e — atenção — o **timeout de webhook
caiu de 10s para 3s**, o que pode estar quebrando automação n8n sem ninguém perceber.

## Pesquisa visual — A1 Gallery + MiroMiro (implementado e validado, ago/2026)

Decidido **não** virar modo separado. A ideia de uma sessão à parte foi descartada: trocar de
pasta no meio de um atendimento (fechar, reabrir, reexplicar) não compensa. Ficou como etapa
condicional dentro dos manuais existentes — **simples e CLI**. Os dois MCPs são registrados de
antemão pelo script; o agente decide na conversa quando usar.

**Três ferramentas, três camadas — não concorrem:**
- **A1 Gallery** acha a *direção* (busca por estilo; acervo de SaaS/landing). Só quando o
  pedido é aberto, sem site nem print. Nunca determina cor/fonte da loja.
- **MiroMiro** mede a *aparência* de um site concreto (estrutura, espaçamento, arredondamento,
  cores, tipografia, CSS já calculado). Só quando há URL apontada e o pedido é "faz
  igual/parecido".
- **Playwright** mede o *comportamento* — o que o MiroMiro não pega: lógica de arraste, evento
  de mouse, proporção de movimento, presença de scroll-snap.

**Fluxo validado em produção** (um carrossel de arraste ficou fiel só na 3ª tentativa; as duas
primeiras falharam por scroll-snap e captura de ponteiro que a referência não usava):
A1 escolhe a referência → **Playwright localiza o seletor exato** da seção (senão o MiroMiro
traz a página inteira) → MiroMiro extrai só aquela seção → Playwright inspeciona o JS e **mede
a interação** → reconhece o tema da loja → importa só estrutura+comportamento → aplica cor/fonte
da loja → preview → testa desktop/celular/console/movimento real → aprovação → publicação.

**Regras novas que entraram nos quatro manuais:**
- **Medir a interação, não só olhar.** "Se move, tá bom" falhou 3x. Mover o mouse X px e
  comparar quantos px a referência rola e em quanto tempo (caso real: 240px→240px em ~140ms),
  repetindo o teste na loja. É a versão de UI do "a mensagem do push não é prova".
- **Não confiar no `accent_color` do tema.** Caso real: estava marrom, mas a identidade real da
  loja era cinza + amarelo. A cor visível nos componentes manda, não o setting salvo.
- **Reaproveitar componente nativo do tema** quando existir (ex.: Ipanema já tem seção de
  depoimentos com Swiper) — mantém editável pelo painel e evita biblioteca extra.

**Registro dos MCPs (confirmado contra `codex mcp list`):** o Codex separa MCP de comando
local (Playwright: `codex mcp add playwright -- npx @playwright/mcp@latest`) do remoto por URL
(`codex mcp add a1gallery --url https://www.a1.gallery/api/mcp`, idem miromiro). No Claude Code:
`claude mcp add --transport http <nome> <url>`. **A1 não pede auth; MiroMiro é OAuth** — abre o
navegador pedindo autorização na primeira vez (esperado; o COMECE-AQUI.md avisa o usuário final
para não recusar). O script agora **checa cada MCP por nome e registra só o que falta** (nada de
marcador único que pulava o bloco inteiro), então uma máquina com A1 mas sem MiroMiro se
auto-repara na próxima abertura.

## Pendências

- [ ] Testar o fluxo FTP do CLI num tema clássico — se funcionar, reescrever os passos de
      entrega do modo simples
- [ ] Corrigir o manual do modo CLI: bloco `code` cabe em qualquer seção com tag "general"
- [ ] Confirmar a sintaxe de `rules`/execpolicy do Codex para bloquear `theme publish`
- [ ] Testar o `.bat` de ponta a ponta no Windows — inclui a sub-rotina nova `:registrar_design`
      (registro per-MCP) e a tela de OAuth do MiroMiro; só o caminho do Codex no Mac foi testado
      de verdade
- [ ] Renomear o repositório
- [ ] Auto-atualização do script (~10 linhas)
- [ ] Validar por medição os limites de `css_code` e `custom_css`
- [ ] Verificar o timeout de 3s nos webhooks do n8n
- [ ] Designesy (auditoria de URL com nota A-F) — ainda não avaliado; MiroMiro e A1 já entraram.
      Testar isolado, medindo se o resultado melhora, antes de somar (soma tools ao contexto)
- [ ] Biblioteca de componentes (abaixo)

## Próximo passo combinado: biblioteca de componentes

Acordado, não construído. Objetivo: entregar o que a Nuvemshop não faz nativo — carrossel 3D,
banner com hotspot, hover magnético, reveal de card — sem redescobrir a cada cliente.

```
biblioteca/<componente>/
  README.md      o que faz, quando usa, quando NÃO usa
  fonte.html     código legível e comentado
  demo.html      funcionando, para mostrar ao cliente
```

Mais uma página de vitrine com todos rodando ao vivo, para o cliente apontar o que quer — isso
resolve a etapa de "ter ideia sob pressão" e vira argumento de venda.

Restrição que guia as escolhas técnicas: CSS puro cabe folgado nos limites. `scroll-snap` +
`perspective` + `rotateY` dá carrossel 3D sem JS; hotspot é posicionamento absoluto com
`:hover`/`:focus`. Swiper, GSAP e three.js pesam no mobile — evitar.

Fontes: CodePen, Codrops, Awwwards. Conferir licença e testar em toque (muito efeito assume
mouse).

Posição do Filipe sobre design: fugir do óbvio é o que diferencia os sites; buscar inspiração
e aplicar é parte necessária do processo, não um extra.
