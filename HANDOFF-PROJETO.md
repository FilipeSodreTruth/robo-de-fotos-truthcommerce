# Handoff — Agente de layout Nuvemshop

Estado do projeto em 2026-09-09. Para retomar o trabalho em outra sessão, com outro agente
ou outra pessoa.

Repositório: `github.com/FilipeSodreTruth/robo-de-fotos-truthcommerce` (público, branch `main`).
O nome não descreve o projeto — renomear continua pendente.

## O que é

Manuais + scripts que permitem ao time da Truth Commerce aplicar CSS/JS/HTML em temas
Nuvemshop usando um agente de IA (Codex ou Claude Code), sem que a pessoa precise saber
programar nem ter editor de código instalado.

## Arquivos do repositório

```
COMECE-AQUI.md                guia do usuário final (não técnico)
HANDOFF-PROJETO.md            este arquivo
HANDOFF-modelo.md             template do handoff por loja
settings.json                 permissões do Claude Code
codex-config-nuvemshop.toml   referência do perfil do Codex
gasto.js                      relatório de consumo sob demanda
vigia.js                      vigia em segundo plano (avisos ao vivo)
envia-gasto.js                manda o resumo agregado de consumo para um webhook
nova-loja.command / .bat      atalhos de duplo clique (Mac / Windows)
modo-simples/   AGENTS.md + CLAUDE.md
modo-avancado/  AGENTS.md + CLAUDE.md
```

**Tudo se propaga sozinho.** O atalho baixa a cada execução os manuais, `settings.json`,
`vigia.js`, `gasto.js` e o modelo de handoff — e **também se auto-atualiza**, comparando-se com
a versão do repositório antes de qualquer coisa (no Mac continua na mesma execução via `exec`;
no Windows reabre a janela, porque o `.bat` é lido linha a linha do disco). Editar qualquer
arquivo no GitHub chega em todas as máquinas na próxima abertura. O script também migra perfis
antigos do Codex que ainda apontem para o modelo caro.

Ressalva: quem estiver com um atalho anterior à auto-atualização precisa baixá-lo uma última
vez pelo comando do `COMECE-AQUI.md`. Depois disso, nunca mais.

## Os dois modos

**Modo CLI (`modo-avancado/`)** — token + CLI tiendanube, publica via `theme push`. Pressupõe
tema com seções e blocos `custom_code`: hoje **só o Ipanema**. Fluxo: verificar ferramentas →
token → pull do tema → reconhecer no Playwright → preview injetado → aprovação → push →
conferir no servidor → registrar → verificar no navegador.

**Modo simples (`modo-simples/`)** — sem token, sem CLI, para temas clássicos. O agente analisa
a página pelo Playwright e mantém dois arquivos na pasta do cliente; **entrega o código pela
área de transferência** (`pbcopy` / `type … | clip`), e o usuário cola no painel. Ninguém abre
arquivo — o time não tem VS Code.

**Exatamente dois destinos no modo simples:** campo de CSS personalizado e rodapé (HTML +
`<script>`). Não existem blocos numerados nem seção "Personalizada" — isso é do modo CLI, e o
vazamento desse vocabulário entre os manuais já causou erro na prática. Cada manual declara seu
escopo no topo.

Estrutura por loja no modo simples:

```
codigo/
  estilos.css     todo o CSS — o usuário copia inteiro
  scripts.html    todo o JS/HTML — o usuário copia inteiro
  _anterior/      versão anterior, para reverter
HANDOFF.md
.modo             grava o modo daquela loja (não pergunta de novo)
```

`vigia.js` e `gasto.js` ficam em `~/.codex/`, não na pasta da loja — são um por máquina. Os
scripts de abertura baixam os dois e **iniciam o vigia automaticamente**, encerrando junto com
o agente: o time é grande e não técnico, e aviso passivo que depende de alguém lembrar de rodar
não funciona nesse contexto.

## Decisões de desenho (o porquê)

**Dois portões de aprovação.** No Codex exigiu override explícito, porque o modelo é treinado
para persistir até resolver e atropelaria a espera.

**Regras críticas em duas camadas.** Manual instrui; permissões impedem. `theme publish`
bloqueado, `theme push` com confirmação. Instrução falha em sessão longa, permissão não.

**Sentinelas no CSS** (`/* @agente inicio: <slug> */`) para substituir em vez de empilhar.

**Arquivo como fonte da verdade.** Como o usuário cola o arquivo inteiro, substituindo, não
existe caminho para acumular código morto. Ideia do Filipe.

**Registro contínuo no handoff — regra + checagem estrutural.** Falhou na prática: alguém
trabalhou uma sessão inteira sem registrar nada. Dois reforços: no manual, a escrita acontece
**antes de responder ao usuário** (o momento se perde se ficar para o fim do turno); e o vigia
compara o mtime de `codigo/` com o do `HANDOFF.md`, notificando se o segundo ficar 15 min para
trás — palavra combinada: "atualiza o handoff". Mesmo padrão do nome do bloco e do
`theme publish`: instrução sozinha não segura.

Teste para saber se está registrado o bastante: *se esta sessão morresse agora, outra pessoa
continuaria só com o arquivo?* Gatilhos de escrita: publicação confirmada, decisão do usuário
sobre **como** trabalhar, armadilha do tema descoberta, falha com causa identificada, e antes
de qualquer espera longa.

**`HANDOFF.md` por loja tem três seções:** *Decisões e preferências* (vale para sempre),
*Armadilhas deste tema*, *Histórico*. Decisão sobre método não envelhece junto com o log.

**Manuais enxutos.** Cortados ~55% (CLI: 28k → ~12k caracteres; simples: 20k → ~11k). Prompt
longo dispersa o modelo. Regras ficam no topo e não se repetem nos passos.

**Sem MCP de design conectado.** Galerias e extratores de token (A1 Gallery, MiroMiro e
similares) foram avaliados e descartados: somam tools ao contexto de toda sessão e o acervo é
de landing page, não de e-commerce. O Playwright que já está no fluxo lê `getComputedStyle` de
qualquer loja de referência. Não reabrir sem motivo novo.

**`browser_snapshot` só sob demanda.** Devolve a árvore de acessibilidade inteira — numa home
de loja (4.600px na Cutelaria) domina o custo de contexto. Quando o usuário já indicou o alvo,
ir direto ao `browser_evaluate` mirado.

**Backup por cliente** (`../<pasta>-backup`), nunca compartilhado.

## Controle de custo

**Sessão curta é a maior alavanca.** Medição real: duas sessões de 90 e 105 turnos queimaram
25M de tokens (44% de uma semana). Dois gatilhos levam ao mesmo lugar: o agente sugere `/new`
ao fim de cada bloco, e o vigia notifica quando a sessão fica cara. Como o vigia é processo
separado e o agente não vê a notificação, existe palavra combinada: o usuário escreve
**"encerra"**, o agente fecha o handoff, resume em três linhas e libera o `/new`. O vigia zera
os avisos ao detectar arquivo de sessão novo.

**O cache JÁ ESTÁ no `total_tokens` — não somar de novo.** Medido em 6 sessões reais de
`~/.codex/sessions` (2026-09-09, unânime): `total_tokens == input_tokens + output_tokens`, e
`cached_input_tokens` é um **subconjunto de `input_tokens`**. Exemplo:

```
input=49.502.088  output=145.914  cached_input=47.950.592  total=49.648.002
```

Versões anteriores deste handoff afirmavam o contrário ("o campo `total_tokens` NÃO soma
`cached_input_tokens`") e citavam uma sessão de `total=137k` com `cache=1,68M`. Isso é
impossível neste formato — o cache não pode exceder o total do qual faz parte; foi leitura
equivocada. `gasto.js` e `vigia.js` sempre usaram `total_tokens` puro e sempre estiveram
certos. Só o `envia-gasto.js` somava o cache, inflando o número em ~2x (49,41M reportados
contra 25,35M reais numa janela de 7 dias) — corrigido em 2026-09-09.

**Cuidado ao reusar os números abaixo:** a calibragem do vigia e a referência de "sessão
normal" foram estabelecidas sob a premissa errada acima e podem estar dobradas. Refazer com
`gasto.js sessoes` antes de tratar qualquer um deles como verdade.

**Calibragem atual (suspeita, ver acima):** avisos por sessão em 3M / 6M / 12M (o último repete
a cada 5 min). Referência anotada na época: sessão normal e concluída = ~1,8M, ~91k por turno.

**Custo real por trabalho:** aquela sessão de 1,8M custaria ~$0,73 em Terra (entrada $0,25 +
cache $0,34 + saída $0,14) ou ~$1,41 em Sol. O cache foi 93% do volume e 46% do custo, porque
tem desconto de 90%. Menos de um dólar por ajuste completo — o gargalo do negócio é tempo de
pessoa, não token. (A ordem de grandeza se sustenta mesmo se o volume estiver dobrado.)

**O envio cobre só layout.** `envia-gasto.js` manda apenas sessões cujo `cwd` está dentro de
`~/nuvemshop-lojas` — o `BASE` que os dois launchers usam para criar a pasta da loja. A loja é
o primeiro segmento depois dele. Fica de fora tudo que a pessoa abra por fora e, principalmente,
o robô de imagens do AutomaTruth, que roda cada geração num `CODEX_HOME` isolado e descartável
(`codex-img-XXXXXX`): no histórico desta máquina eram **3.074 sessões** que virariam 3.074
"projetos" de uma sessão só. O filtro lê apenas a string de `cwd` gravada no log, sem tocar no
disco, então continua valendo para loja já apagada ou renomeada.

**Quem gastou, e de qual cota.** São perguntas diferentes e o `envia-gasto.js` manda as duas.
O time inteiro compartilha **duas contas Codex**: a maioria das pessoas loga com `suporte@`,
algumas com `vitor@`. Logo a conta **não** identifica a pessoa — ela identifica qual das duas
cotas está sendo drenada. Quem é a pessoa sai de `maquina` + `usuario`, que é uma por pessoa
(nesta máquina, por exemplo, o usuário do SO é `filipesodredasilva` e a conta logada é
`suporte@truthcommerce.com.br`).

Isso importa porque a janela semanal é **compartilhada**: quando alguém quase fecha 100% da
semana num dia, o estrago cai em todo mundo que usa aquela conta, e a conta sozinha não diz
em qual máquina olhar.

A conta vem do `auth.json` (claim `email` do `id_token`) — o `session_meta` do log **não**
guarda conta nenhuma, só `cwd`, `git` e `plan_type`. Limite conhecido: é a conta logada no
momento do envio, então troca de conta dentro da janela de 7 dias atribui os dias antigos à
conta atual.

**Onde a cota realmente foi.** Medido no histórico completo de uma máquina (2026-09-09,
2.539M de tokens em 3.464 sessões):

| Pasta | Tokens | Sessões |
|---|---:|---:|
| `API-MercadoLivre` | 2.246M | 352 |
| robô de imagens (`codex-img-*`) | 130M | 3.074 |
| layout (`nuvemshop-lojas`) | **18M** | 5 |
| outros projetos avulsos | 145M | 33 |

Layout é **0,7%** do consumo. A disciplina de sessão vale muito mais aplicada ao repositório do
MercadoLivre do que aqui — e é bom lembrar disso antes de gastar esforço otimizando este lado.

**Não monitorar cota semanal** (nem de time): `/status` dentro da sessão do Codex já mostra o
restante. O vigia cuida só do tamanho da sessão, que é o que ninguém percebe sozinho.

## Modelos

| Uso | Codex | Claude |
|---|---|---|
| Padrão | `gpt-5.6-terra` medium | Sonnet 5 medium |
| Resistiu a duas tentativas, JS complexo | `gpt-5.6-sol` high | Opus 5 high |

**Padrão invertido em 2026-08.** A recomendação original era o modelo de topo sempre, com o
argumento de que erro de loop custa mais que modelo caro. Isso vale quando sobra cota; com a
cota estourando, a conta muda. Agora é barato por padrão e o agente aponta o momento de subir —
a troca é do usuário, via `/model`, porque o agente julgaria a dificuldade antes de conhecê-la.
Não é preciso voltar o modelo: o próximo `/new` reabre no padrão.

**Tarifação confirmada:** modelo muda o custo por token; effort não muda a taxa, só o volume de
raciocínio gerado. Terra $2/$12 por milhão (cache $0,20); Sol $5/$30 (cache $0,50); Luna
$0,20/$1,20.

**Luna em avaliação, não decidido.** Dez vezes mais barato que Terra — a sessão de $0,73 sairia
por ~7 centavos. Benchmark favorável (84,04% no BrowseComp a $1,33, contra 84,36% do GPT-5.5 a
$33,27), mas a OpenAI o posiciona para volume e baixo risco, como primeira passada antes de
escalar. Proposta em aberto: testar **só no modo simples** (erro custa tempo, não quebra loja) e
manter Terra no modo CLI (JSON inválido + `theme push` em loja no ar é estrago real). Teste
sugerido: repetir uma tarefa já feita e comparar turnos, respeito aos portões e acerto do
seletor de primeira.

## Fatos técnicos confirmados

- **Nome do bloco:** campo `name` **no mesmo nível de `type` e `settings`**, não dentro de
  `settings`. Definível direto no JSON, sem editor visual — testado contra a API.
- **Limites:** CSS global ~15.000; bloco de código do rodapé **~50.000** (oficial na doc, não
  500 como constava antes). Na prática nunca é preciso dividir JS.
- **Onde mora:** seções e blocos ficam no JSON da página (`templates/home.json` e afins). O
  `settings_data.json` guarda configurações globais, incluindo o CSS.
- **Método para validar limites:** criar via API, editar, remover, conferir se o arquivo volta
  byte a byte. Os ~15.000 do CSS e ~5.000 do `custom_css` nunca foram medidos assim.
- **Log de sessão do Codex** (`~/.codex/sessions/AAAA/MM/DD/*.jsonl`): a primeira linha é um
  `session_meta` com `cwd`, `cli_version` e `git` (`commit_hash`, `branch`, `repository_url`).
  O consumo vem de `total_token_usage`, e a última ocorrência no arquivo é o acumulado da
  sessão. Não há nenhum campo de conta ali.

## Armadilhas já encontradas (custaram tempo)

- **Playwright no macOS:** Chromium lançado do terminal dentro do sandbox do Codex morre com
  `Operation not permitted`. **Só o caminho MCP funciona** (o servidor roda fora do sandbox).
  Nunca instalar `playwright` na pasta do cliente. `playwright` e `@playwright/mcp` são pacotes
  distintos. Registrar o servidor não vale para a sessão já aberta — reabrir o agente. Os
  scripts hoje registram e baixam o Chromium na primeira execução.
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
- **Tag XML com acento** (`<parâmetros>` abrindo e `</parametros>` fechando) faz o modelo tratar
  o bloco como texto solto. Já corrigido; conferir ao editar os manuais do Claude.
- **Duas contas GitHub no `gh`** (`FilipeSodre` e `FilipeSodreTruth`). Um `403 Permission
  denied` ao dar push costuma ser credencial velha no keychain do macOS — repetir o push
  resolve. Não colocar o usuário na URL do remote (`https://usuario@github.com/...`): o helper
  do `gh` passa a pedir senha interativa e o comando trava.

## Pesquisa na documentação oficial (nuvemshop.dev)

**Não existe changelog de temas.** O changelog do site é só de API e reflete mudanças na
documentação. Nada sobre seções ou layout no último ano.

**Achado mais importante — o CLI tem fluxo FTP para temas não-Ipanema.** O Fork workflow (token
+ API REST) suporta apenas o Ipanema; para os outros existe o Fluxo FTP, que baixa, envia e
monitora arquivos. Ou seja: **o modo simples poderia publicar automaticamente**, e o
copia-e-cola deixaria de existir. Não testado — é a próxima coisa a fazer.

**Bloco `code`:** tem a tag `"general"`, então entra em qualquer seção que aceite blocos
genéricos — não precisa de seção "Personalizada". O manual do modo CLI ainda não reflete isso.

**Ipanema é o único tema seccionável disponível** — a separação em dois modos está
estruturalmente correta.

**Outros caminhos, para projeto futuro:** NubeSDK executa código de terceiros na vitrine e no
checkout; a Scripts API (`POST /scripts`) injeta JS via API. Ambos exigem app registrado no
Partners Portal e homologação. É o único jeito de mexer no **checkout** — serviço vendável que a
concorrência provavelmente não oferece.

**MCP oficial da Nuvemshop** (`https://admin-mcp.nuvemshop.com.br/mcp`): 28 tools de catálogo,
pedidos, cupons e promoções. **Não faz layout.** Toda escrita atua sobre a loja publicada e fica
visível na hora.

**Do changelog, relevante à operação:** tabelas de preço por cliente (B2B), kits no catálogo,
visibilidade de categoria, API de blog, e — atenção — o **timeout de webhook caiu de 10s para
3s**, o que pode estar quebrando automação n8n sem ninguém perceber.

## Pendências

- [ ] Testar o fluxo FTP do CLI num tema clássico — se funcionar, reescrever a entrega do modo
      simples
- [ ] Decidir sobre Luna no modo simples (teste comparativo descrito acima)
- [ ] Corrigir o manual do modo CLI: bloco `code` cabe em qualquer seção com tag "general"
- [ ] Confirmar a sintaxe de `rules`/execpolicy do Codex para bloquear `theme publish`
- [ ] Testar o `.bat` de ponta a ponta no Windows
- [ ] Renomear o repositório
- [ ] **Recalibrar os limites do vigia com `gasto.js sessoes`** — os valores atuais vêm da
      premissa errada sobre o cache (ver Controle de custo) e podem estar dobrados
- [ ] Validar por medição os limites de `css_code` e `custom_css`
- [ ] Verificar o timeout de 3s nos webhooks do n8n
- [ ] Levar a disciplina de sessão/handoff para o repositório do MercadoLivre
- [ ] Conferir se alguém do time está com o modo "fast" ligado (aumenta consumo); o auto-review
      consumiu ~8% de uma semana relendo transcript
- [ ] **Apontar o `envia-gasto.js` para o AutomaTruth** — hoje o destino é um webhook n8n, e o
      n8n saiu de uso em 2026-08-20, então o envio falha calado. O AutomaTruth já tem
      `/usage` (admin) com custo de IA e janela do Codex por conta; a chave de junção é o
      e-mail da conta, que o payload já manda
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

Posição do Filipe sobre design: fugir do óbvio é o que diferencia os sites; buscar inspiração e
aplicar é parte necessária do processo, não um extra.
