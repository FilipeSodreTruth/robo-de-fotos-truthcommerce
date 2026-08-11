# Handoff — Agente de layout Nuvemshop

Estado do projeto em 2026-08-11. Este arquivo é para retomar o trabalho em outra sessão,
com outro agente ou outra pessoa.

## O que é

Um conjunto de manuais + scripts que permite ao time da Truth Commerce aplicar CSS/JS/HTML
em temas Nuvemshop usando um agente de IA (Codex ou Claude Code), sem que a pessoa precise
saber programar.

Repositório: `github.com/FilipeSodreTruth/robo-de-fotos-truthcommerce`
(o nome não descreve o projeto — considerar renomear para algo como `agente-layout-nuvemshop`)

## Estrutura do repositório

```
modo-simples/          manuais do modo sem CLI/token
  AGENTS.md            versão Codex
  CLAUDE.md            versão Claude Code
modo-avancado/         manuais do modo com CLI/push direto
  AGENTS.md
  CLAUDE.md
settings.json          permissões do Claude Code (copiado para .claude/ da loja)
codex-config-nuvemshop.toml   referência do perfil do Codex
HANDOFF-modelo.md      template do handoff por loja
COMECE-AQUI.md         guia do usuário final (não técnico)
nova-loja.command      script Mac
nova-loja.bat          script Windows
```

## Os dois modos

**Modo avançado** — o agente tem token e CLI da Nuvemshop, publica direto via
`tiendanube theme push`. Fluxo: instalar ferramentas → obter token → pull do tema inteiro →
reconhecer a página no Playwright → preview injetado ao vivo → aprovação do usuário → push →
conferir no servidor → atualizar handoff → verificar no navegador.

**Modo simples** — sem token, sem CLI. O agente analisa a página pelo Playwright e **mantém
dois arquivos de código** na pasta da loja; o usuário copia deles e cola no painel. Sem
material intermediário, sem minificar, sem fatiar. Funciona em qualquer tema e em loja que
ainda não tem o CLI liberado.

Estrutura de arquivos do modo simples, por loja:

```
codigo/
  estilos.css        todo o CSS — é isto que o usuário copia
  scripts.html       todo o JS/HTML — é isto que o usuário copia
  _anterior/         cópia da versão anterior, para reverter
HANDOFF.md
.modo                grava qual modo aquela loja usa
```

O modo é escolhido na primeira vez que a loja é aberta e fica gravado — não pergunta de novo.

## Decisões de desenho (o porquê)

**Dois portões de aprovação.** O agente mostra o preview ao vivo e para; só publica depois do
"ok". No Codex isso precisou de override explícito, porque o modelo é treinado para persistir
até resolver e atropelaria a espera.

**Regras críticas em duas camadas.** O manual diz ao agente o que não fazer; as permissões
(`settings.json` no Claude Code, perfil no Codex) impedem de fato. `theme publish` está
bloqueado; `theme push` exige confirmação. Instrução falha em sessão longa, permissão não.

**Sentinelas no CSS** (`/* @agente inicio: <slug> */`) para permitir substituir código
publicado em vez de empilhar. Sem marcador não há edição confiável dentro de um `css_code`
de 15 mil caracteres.

**Blocos nomeados** (`JS - carrossel - home`). O nome fica num campo `name` no mesmo nível de
`type` e `settings` dentro do bloco — definível direto no JSON, sem editor visual (testado
contra a API). Bloco órfão de versão anterior continua executando e quebra o console — não é
sujeira, é bug.

**Onde o código mora.** Seções e blocos ficam no JSON da página (`templates/home.json` e
afins). O `settings_data.json` guarda as configurações globais, incluindo o CSS.

**Limites reais.** CSS global ~15.000; bloco de código do rodapé ~50.000 — não 500, como
constava antes. Na prática não é preciso dividir JS. O método para validar qualquer limite ou
suposição: criar via API, editar, remover e conferir se o arquivo volta byte a byte.

**HANDOFF.md por loja**, atualizado logo após a publicação subir e antes da verificação no
navegador, para sobreviver a queda de terminal.

**Backup por cliente** (`../<pasta>-backup`), nunca compartilhado — backup compartilhado
publicaria o tema da loja errada numa restauração.

**Manuais baixados a cada execução.** Editar o manual no repositório propaga para todo mundo
na próxima abertura. Só o script em si não se auto-atualiza.

## Modelos recomendados

| Uso | Codex | Claude |
|---|---|---|
| Ajuste simples, tema conhecido | `gpt-5.6-terra` medium | Sonnet 5 medium |
| Padrão | `gpt-5.6-sol` medium | Sonnet 5 high |
| Bug difícil, JS complexo | `gpt-5.6-sol` high | Opus 5 high |

Alavanca de custo é o reasoning effort, não descer de tier. O CSS é a parte fácil; o difícil
é o loop agêntico, e modelo fraco erra o loop.

## Pendências

- [ ] Confirmar a sintaxe de `rules`/execpolicy da versão instalada do Codex para bloquear
      `theme publish` — o perfil atual só cobre approval_policy e sandbox
- [ ] Testar o `.bat` de ponta a ponta no Windows
- [ ] Renomear o repositório
- [ ] Auto-atualização do script (~10 linhas, evita gente com versão velha)
- [ ] Validar por medição os limites de `css_code` e `custom_css` (nunca foram testados)
- [ ] Biblioteca de componentes (ver abaixo)

## Armadilhas já encontradas

- **Mac:** arquivo baixado pelo navegador vem sem permissão de execução. A instalação usa
  `curl` + `chmod +x`, que também evita o bloqueio do Gatekeeper.
- **Windows:** `curl` no PowerShell é apelido do `Invoke-WebRequest`. Precisa ser `curl.exe`,
  e `%USERPROFILE%` não expande — usar `[Environment]::GetFolderPath('Desktop')`.
- **Codex:** versões atuais não aceitam `[profiles.x]` dentro do `config.toml`. O perfil vai
  em arquivo próprio: `~/.codex/nuvemshop.config.toml`.
- **Codex sandbox:** `workspace-write` corta a rede por padrão. Sem `network_access = true`,
  o `npm install` e o CLI da Nuvemshop travam sem erro claro.
- **Playwright no macOS:** Chromium lançado do terminal de dentro do sandbox do Codex morre
  com `Operation not permitted`. Só o caminho MCP funciona, porque o servidor roda fora do
  sandbox. Nunca instalar `playwright` na pasta do cliente — os scripts registram o servidor
  (`codex mcp add playwright -- npx @playwright/mcp@latest`) e baixam o Chromium uma vez por
  máquina. `playwright` e `@playwright/mcp` são pacotes distintos, e registrar o servidor não
  vale para a sessão já aberta: é preciso reabrir o agente.
- **Codex e diretório:** sem `--cd`, o Codex abre no diretório de onde foi chamado e não acha
  o `AGENTS.md`. Os scripts passam o caminho explicitamente.
- **Codex perfis:** `[profiles.x]` dentro do `config.toml` foi descontinuado; o perfil vai em
  `~/.codex/nuvemshop.config.toml`.

## Próximo passo combinado: biblioteca de componentes

A ideia acordada (ainda não construída). O objetivo é entregar coisas que a Nuvemshop não faz
nativo — carrossel 3D, banner com hotspot, hover magnético, reveal de card — sem redescobrir
cada uma a cada cliente.

Estrutura proposta:

```
biblioteca/
  carrossel-3d/
    README.md          o que faz, quando usa, quando NÃO usa
    fonte.html         código legível e comentado
    para-colar/        já minificado e fatiado
    demo.html          funcionando, para mostrar ao cliente
  banner-hotspot/
  botao-hover-magnetico/
```

Mais uma página de vitrine com todos rodando ao vivo, para o cliente apontar o que quer.

Restrição que define as escolhas técnicas: CSS puro cabe folgado nos 15.000 caracteres;
`scroll-snap` + `perspective` + `rotateY` dá carrossel 3D sem JS; hotspot é posicionamento
absoluto com `:hover`/`:focus`. Swiper, GSAP e three.js estouram os blocos de 500 e pesam no
mobile — evitar.

Fontes de repertório: CodePen, Codrops, Awwwards. Conferir licença antes de reaproveitar e
testar em toque, porque muito efeito assume mouse.

Os três primeiros a construir: carrossel 3D, banner hotspot, efeito de card.
