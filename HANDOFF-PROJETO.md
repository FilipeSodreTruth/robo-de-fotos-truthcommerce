# Handoff — Agente de layout Nuvemshop

Estado do projeto em 2026-08-04. Este arquivo é para retomar o trabalho em outra sessão,
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

**Modo simples** — sem token, sem CLI. O agente só analisa a página pelo Playwright, escreve
o código em arquivos locais e **entrega pronto** para o usuário colar no painel da Nuvemshop.
Funciona em qualquer tema e em loja que ainda não tem o CLI liberado.

Estrutura de arquivos do modo simples, por loja:

```
codigo/
  estilos.css        fonte da verdade do CSS, legível e comentado
  scripts.html       fonte da verdade do JS/HTML
  para-colar/        gerado a cada entrega, já minificado e fatiado em ≤500 chars
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

**Blocos nomeados** (`JS - carrossel - home (1/3)`). Bloco órfão de versão anterior continua
executando e quebra o console — não é sujeira, é bug.

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

- [ ] Subir os arquivos no repositório e **torná-lo público** (o `curl` dos scripts depende
      disso; ainda dava 404 na última verificação)
- [ ] Versão Windows do script com a escolha de modo (o Mac já tem; o `.bat` ficou para trás)
- [ ] Confirmar a sintaxe de `rules`/execpolicy da versão instalada do Codex para bloquear
      `theme publish` — o perfil atual só cobre approval_policy e sandbox
- [ ] Testar o `.bat` de ponta a ponta no Windows (nunca foi rodado)
- [ ] Renomear o repositório
- [ ] Auto-atualização do script (~10 linhas, evita gente com versão velha)

## Armadilhas já encontradas

- **Mac:** arquivo baixado pelo navegador vem sem permissão de execução. A instalação usa
  `curl` + `chmod +x`, que também evita o bloqueio do Gatekeeper.
- **Windows:** `curl` no PowerShell é apelido do `Invoke-WebRequest`. Precisa ser `curl.exe`,
  e `%USERPROFILE%` não expande — usar `[Environment]::GetFolderPath('Desktop')`.
- **Codex:** versões atuais não aceitam `[profiles.x]` dentro do `config.toml`. O perfil vai
  em arquivo próprio: `~/.codex/nuvemshop.config.toml`.
- **Codex sandbox:** `workspace-write` corta a rede por padrão. Sem `network_access = true`,
  o `npm install` e o CLI da Nuvemshop travam sem erro claro.

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
