#!/usr/bin/env node
/*
 * envia-gasto.js — manda o resumo de consumo desta maquina para o AutomaTruth.
 *
 * Envia SO numeros agregados: conta Codex, pasta do projeto, tokens, sessoes,
 * turnos. Nunca conteudo de conversa, nunca caminho completo, nunca token
 * de loja, nunca o id_token em si - so a claim de email dele.
 *
 * O destino fica em ~/.codex/gasto-webhook.txt. NAO precisa criar na mao: o
 * nova-loja escreve na primeira abertura, entao ninguem visita PC nenhum.
 *
 * Primeira linha: a URL. Segunda linha, OPCIONAL: um segredo, mandado no
 * cabecalho X-Gasto-Token. Hoje o AutomaTruth aceita sem segredo, de proposito -
 * o que trafega e contador agregado de token e a tela e so de admin. Se um dia
 * a env GASTO_LAYOUT_TOKEN for definida la, ela passa a ser exigida e a segunda
 * linha vira obrigatoria.
 *
 * Ate 2026-08 o destino era um webhook do n8n. O n8n saiu de uso em 2026-08-20 e
 * o envio passou a falhar calado — por isso a troca.
 *
 * Sem esse arquivo o script sai calado e nao atrapalha nada.
 *
 * Roda sozinho ao abrir e ao fechar o agente pelo nova-loja. Ate 2026-09-10 era
 * uma vez por dia, na abertura: o painel ficava uma sessao (ou um dia) atrasado.
 * Repetir nao soma - o servidor substitui o envio anterior da mesma semana.
 * Mandar agora:  node ~/.codex/envia-gasto.js
 * Ver o que iria:  node ~/.codex/envia-gasto.js --mostrar
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const BASE = path.join(os.homedir(), ".codex", "sessions");
const CONFIG = path.join(os.homedir(), ".codex", "gasto-webhook.txt");

/* Quantos dias de pasta varrer no disco. NAO e a janela do relatorio: serve
   so pra achar as sessoes candidatas. O recorte de verdade e a janela SEMANAL
   da assinatura (ver janelaSemanal), que tem inicio e fim proprios. 9 da folga
   pros 7 dias da janela caberem mesmo com fuso e sessao virando o dia. */
const DIAS_VARREDURA = 9;

const MOSTRAR = process.argv.includes("--mostrar");

function seguro(fn) {
  try {
    return fn();
  } catch {
    return null;
  }
}

function diasAtras(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return [
    String(d.getFullYear()),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ];
}

function lerSessao(arquivo) {
  const texto = seguro(() => fs.readFileSync(arquivo, "utf8"));
  if (!texto) return null;

  let total = 0,
    cache = 0,
    entrada = 0,
    saida = 0;
  const usos = texto.match(/"total_token_usage":\{[^}]*\}/g);
  if (usos && usos.length) {
    try {
      const u = JSON.parse("{" + usos[usos.length - 1] + "}").total_token_usage;
      entrada = u.input_tokens || 0;
      saida = u.output_tokens || 0;
      cache = u.cached_input_tokens || 0;
      /* NAO somar o cache: medido em 6 sessoes reais (2026-09-09),
         total_tokens == input_tokens + output_tokens e cached_input_tokens
         e um SUBCONJUNTO de input_tokens - ja esta dentro do total.
         Somar de novo inflava o numero em ~2x. */
      total = u.total_tokens || entrada + saida;
    } catch {}
  }
  if (!total) return null;

  let cwd = "", inicio = 0, subagente = false;
  const primeira = texto.slice(0, texto.indexOf("\n"));
  try {
    const j = JSON.parse(primeira);
    cwd = j.payload?.cwd || j.cwd || "";
    inicio = Date.parse(j.timestamp || j.payload?.timestamp || "") || 0;
    /* sub-agente (o guardian que avalia aprovacao, ou spawn_agent): o token e
       gasto real da cota e entra no total, mas nao e sessao que alguem abriu
       nem turno de pessoa. Medido em 2026-09-10: o guardian respondia por 29
       dos 42 "turnos" de uma maquina. */
    subagente = Boolean(j.payload?.source?.subagent);
  } catch {}

  /* Turno = mensagem que a pessoa digitou. O Codex atual nao grava
     "user_message" na sessao principal, e contar "role":"user" pegava tambem
     o AGENTS.md e o contexto de ambiente que ele injeta no inicio. */
  const turnos = subagente
    ? 0
    : (texto.match(/"role":"user","content":\[\{"type":"input_text","text":"(?!# AGENTS\.md instructions|<environment_context>|<user_instructions>)/g) || []).length ||
      (texto.match(/"type":"user_message"/g) || []).length;

  /* so o nome da loja, nunca o caminho inteiro */
  const projeto = lojaDe(cwd);
  if (!projeto) return null; // nao e sessao de layout

  return { total, entrada, saida, cache, turnos, projeto, inicio, subagente };
}

/* SO conta sessao de layout. Os dois launchers criam a pasta da loja dentro de
   ~/nuvemshop-lojas (BASE, linha 12 do nova-loja.command e do .bat), entao a
   loja e o primeiro segmento depois desse diretorio. Devolve null pra qualquer
   outra coisa - o robo de imagens (codex-img-*, milhares de pastas isoladas e
   descartaveis) e qualquer projeto que a pessoa abra por fora ficam de fora.

   Le so a string de cwd gravada no log: nao toca no disco, entao continua
   funcionando pra loja que ja foi apagada ou renomeada. Aceita / e \\ por causa
   do Windows. */
function lojaDe(cwd) {
  if (!cwd) return null;
  const partes = cwd.split(/[\\/]+/);
  const i = partes.lastIndexOf("nuvemshop-lojas");
  if (i === -1) return null;
  return partes[i + 1] || null;
}

/* Qual conta Codex esta logada NESTA maquina. O log de sessao (session_meta)
   nao guarda a conta - so cwd, git e plan_type - entao a unica fonte e o
   auth.json que o proprio Codex escreve. tokens.id_token e um JWT OIDC; so
   decodificamos a claim "email" localmente, sem validar assinatura (nao e
   checagem de seguranca, e leitura de arquivo local). Mesmo metodo do
   readCodexAccountIdentity do robo de imagens, pra chavear igual.

   ATENCAO - a conta NAO identifica a pessoa. O time inteiro compartilha duas
   contas: a maioria loga com suporte@, alguns com vitor@. A conta diz qual
   COTA esta sendo drenada, nao quem drenou. Quem e a pessoa sai de
   maquina + usuario, que e uma por pessoa.

   Limite conhecido: e a conta logada AGORA. Se a maquina trocou de conta
   dentro da janela de 7 dias, os dias antigos ficam atribuidos a conta atual. */
function contaCodex() {
  const raw = seguro(() =>
    JSON.parse(fs.readFileSync(path.join(os.homedir(), ".codex", "auth.json"), "utf8"))
  );
  const idToken = raw?.tokens?.id_token;
  if (typeof idToken !== "string") return null;
  const payloadB64 = idToken.split(".")[1];
  if (!payloadB64) return null;
  const claims = seguro(() =>
    JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"))
  );
  const email = typeof claims?.email === "string" ? claims.email.trim().toLowerCase() : null;
  return email || null;
}

/* A janela que importa e a SEMANAL da assinatura, nao "os ultimos 7 dias".
   O proprio log carrega ela: rate_limits.primary tem window_minutes (10080 =
   7 dias), used_percent e resets_at (epoch em segundos). Pegamos o snapshot
   mais recente de todas as sessoes varridas - e por conta, entao vale pra
   maquina inteira.

   Sem snapshot (Codex antigo, log sem rate_limits) caimos em 7 dias corridos
   pra tras, que e a aproximacao razoavel. */
function janelaSemanal(arquivos) {
  let melhor = null;
  for (const f of arquivos) {
    const texto = seguro(() => fs.readFileSync(f, "utf8"));
    if (!texto) continue;
    const m = texto.match(/"rate_limits":\{[^{]*"primary":\{[^}]*\}/g);
    if (!m) continue;
    const j = seguro(() => JSON.parse("{" + m[m.length - 1] + "}}").rate_limits);
    const p = j?.primary;
    if (!p?.resets_at || !p?.window_minutes) continue;
    if (!melhor || p.resets_at > melhor.resets_at) melhor = p;
  }

  if (!melhor) {
    const fim = Date.now();
    return { inicio: fim - 7 * 864e5, fim, usado_percent: null, estimada: true };
  }
  const fim = melhor.resets_at * 1000;
  return {
    inicio: fim - melhor.window_minutes * 60000,
    fim,
    usado_percent: typeof melhor.used_percent === "number" ? melhor.used_percent : null,
    estimada: false,
  };
}

function coletar() {
  /* junta os arquivos dos ultimos dias, descobre a janela semanal e so entao
     decide quais sessoes entram - por inicio da sessao, nao pela pasta do dia */
  const arquivos = [];
  for (let i = 0; i < DIAS_VARREDURA; i++) {
    const [y, m, d] = diasAtras(i);
    const dir = path.join(BASE, y, m, d);
    if (!fs.existsSync(dir)) continue;
    for (const f of seguro(() => fs.readdirSync(dir)) || []) {
      if (f.endsWith(".jsonl")) arquivos.push(path.join(dir, f));
    }
  }

  const semana = janelaSemanal(arquivos);

  const porLoja = new Map();
  for (const f of arquivos) {
    const ses = lerSessao(f);
    if (!ses) continue;
    /* sessao sem timestamp legivel entra: perder gasto e pior que datar mal */
    if (ses.inicio && (ses.inicio < semana.inicio || ses.inicio > semana.fim)) continue;

    const l =
      porLoja.get(ses.projeto) ||
      { total: 0, entrada: 0, saida: 0, cache: 0, sessoes: 0, turnos: 0, inchadas: 0 };
    l.total += ses.total;
    l.entrada += ses.entrada;
    l.saida += ses.saida;
    l.cache += ses.cache;
    l.turnos += ses.turnos;
    if (!ses.subagente) l.sessoes += 1;
    if (ses.turnos && ses.total / ses.turnos > 250000) l.inchadas += 1;
    porLoja.set(ses.projeto, l);
  }

  return {
    semana,
    lojas: [...porLoja.entries()]
      .map(([loja, l]) => ({ loja, ...l }))
      .sort((a, b) => b.total - a.total),
  };
}

function main() {
  if (!fs.existsSync(BASE)) return;

  const bruto = seguro(() => fs.readFileSync(CONFIG, "utf8"));
  const linhas = (bruto || "").split("\n").map((l) => l.trim()).filter(Boolean);
  const url = linhas[0];
  const segredo = linhas[1] || null;

  if (!MOSTRAR && (!url || !url.startsWith("http"))) return;

  const { semana, lojas } = coletar();
  if (!lojas.length) {
    /* normal: maquina que nao fez layout na semana nao tem o que mandar */
    if (MOSTRAR) console.log("Nenhuma sessao de layout (~/nuvemshop-lojas) nesta semana da assinatura.");
    return;
  }

  const corpo = {
    maquina: os.hostname(),
    usuario: os.userInfo().username,
    /* qual das duas cotas compartilhadas do time foi drenada (suporte@ ou
       vitor@) - nao e a pessoa: quem gastou sai de maquina + usuario */
    conta: contaCodex(),
    enviado_em: new Date().toISOString(),
    /* a semana da assinatura, nao 7 dias corridos. usado_percent e da CONTA
       inteira (compartilhada), nao so desta maquina - por isso vem junto das
       lojas: da pra ver quanto da cota comum foi drenada e por quais lojas. */
    semana: {
      inicio: new Date(semana.inicio).toISOString(),
      reseta_em: new Date(semana.fim).toISOString(),
      usado_percent: semana.usado_percent,
      estimada: semana.estimada,
    },
    lojas,
  };

  if (MOSTRAR) {
    console.log(JSON.stringify(corpo, null, 2));
    return;
  }

  const cabecalhos = { "Content-Type": "application/json" };
  if (segredo) cabecalhos["X-Gasto-Token"] = segredo;

  fetch(url, {
    method: "POST",
    headers: cabecalhos,
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(10000),
  }).catch(() => {
    /* sem internet, AutomaTruth fora do ar: sair calado. Isto nunca pode
       atrapalhar quem so quer abrir ou fechar o agente. */
  });
}

main();
