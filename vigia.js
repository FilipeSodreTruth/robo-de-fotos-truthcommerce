#!/usr/bin/env node
/*
 * vigia.js — aviso de consumo DENTRO do chat do Codex, no agente de layout.
 *
 * Roda como hook UserPromptSubmit: o Codex chama a cada mensagem enviada e
 * passa session_id, transcript_path e cwd no stdin. Ate 2026-09-10 era um
 * processo em segundo plano com notificacao do sistema - pouco visivel, e o
 * time pediu o aviso no chat, fixo.
 *
 *   node vigia.js --instalar   registra o hook em ~/.codex/hooks.json (o nova-loja faz)
 *   node vigia.js              modo hook: le o evento do stdin
 *
 * O Codex so executa hook que a pessoa aprovou uma vez, em /hooks. Por isso o
 * comando registrado NUNCA muda - mudar exigiria aprovar de novo em cada PC. O
 * que evolui e este arquivo, que o nova-loja baixa a cada abertura.
 *
 * Le so os registros locais em ~/.codex/sessions; nao envia nada.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const CODEX = path.join(os.homedir(), ".codex");
const ESTADO = path.join(CODEX, ".aviso-gasto");
const ATIVO = path.join(CODEX, ".aviso-gasto-ativo"); // existe = o hook ja rodou (foi aprovado)

/* Quanto token NOVO (entrada nao cacheada + saida) vale a semana inteira da
   conta. Medido em 2026-09-10 no Terra medium, pela virada de % que o proprio
   log grava (rate_limits.primary.used_percent): a conta foi de 6% para 7% com
   562 mil tokens novos DESTA maquina - se alguem do time usou junto, 1% custa
   ainda mais. Semana >= ~56M. O valor anterior (6M) saiu de uma correlacao com
   erro de 112x e fazia o aviso de "1,7%" tocar em ~100 mil tokens, ~0,2% real.
   50M arredonda pra baixo, pra avisar um pouco antes do real, nunca depois.
   Modelo diferente pode pesar diferente: recalibrar pela virada de % no log. */
const SEMANA_NOVO = 50e6;

const NIVEIS = [
  (p) => `Aviso de consumo: esta sessao ja custou ~${p}% da semana da conta, que e do time todo. Ao terminar este ajuste, escreva "encerra" e depois /new - nada se perde.`,
  (p) => `Sessao cara: ~${p}% da semana da conta. Escreva "encerra" e depois /new.`,
  (p) => `Feche esta sessao: ~${p}% da semana da conta. Uma sessao so nao deveria custar isso - escreva "encerra" e depois /new.`,
];
const CORTES = [1.7, 4, 8];

/* Sessao parada: o cache da conversa expira e a PROXIMA mensagem reenvia o
   contexto inteiro como token novo. Medido nos logs de 2026-09-04 a 10: ate 45
   min parada o cache segurou (2 de 2); acima de 60 min perdeu em 3 de 6 - uma
   volta de 83 min com 100k de contexto custou 93 mil tokens novos. "encerra"
   nessa hora ja pagaria o reenvio, entao a mensagem manda dar /new direto: o
   HANDOFF esta em dia pela regra de registro continuo. Contexto pequeno passa:
   reenviar 30k nao vale segurar a mensagem de ninguem. */
const PARADA = 60 * 60_000;
const CONTEXTO_CARO = 100_000;

function seguro(fn) {
  try {
    return fn();
  } catch {
    return null;
  }
}

const pct = (tokens) => ((tokens / SEMANA_NOVO) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/* Token NOVO acumulado do arquivo. cached_input_tokens e SUBCONJUNTO de
   input_tokens (verificado em 6 sessoes reais), entao a subtracao e valida. */
function novoDe(arquivo) {
  const texto = seguro(() => fs.readFileSync(arquivo, "utf8"));
  const usos = texto && texto.match(/"total_token_usage":\{[^}]*\}/g);
  if (!usos) return 0;
  const u = seguro(() => JSON.parse("{" + usos[usos.length - 1] + "}").total_token_usage);
  if (!u) return 0;
  return Math.max((u.input_tokens || 0) - (u.cached_input_tokens || 0), 0) + (u.output_tokens || 0);
}

/* Tamanho do contexto na ultima chamada - o que seria reenviado sem cache. */
function contextoDe(arquivo) {
  const texto = seguro(() => fs.readFileSync(arquivo, "utf8"));
  const usos = texto && texto.match(/"last_token_usage":\{[^}]*\}/g);
  if (!usos) return 0;
  return seguro(() => JSON.parse("{" + usos[usos.length - 1] + "}").last_token_usage.input_tokens) || 0;
}

/* Comeco do arquivo: o id e o parent_thread_id ficam no inicio da 1a linha. */
function inicio(p) {
  const fd = seguro(() => fs.openSync(p, "r"));
  if (fd === null) return "";
  const buf = Buffer.alloc(2048);
  const n = seguro(() => fs.readSync(fd, buf, 0, buf.length, 0)) || 0;
  fs.closeSync(fd);
  return buf.toString("utf8", 0, n);
}

/* O transcript e os sub-agentes dele. O guardian (avalia aprovacao) grava
   arquivo proprio na mesma pasta com parent_thread_id = id da sessao, e o gasto
   dele e cota real (25% a 44% da sessao em 2026-09-10).
   ponytail: so a pasta do dia do transcript; sessao que vira a meia-noite perde
   os sub-agentes do dia seguinte na conta. */
function arquivosDaSessao(transcript) {
  const id = (inicio(transcript).match(/"id":"([^"]+)"/) || [])[1];
  if (!id) return [transcript];
  const dir = path.dirname(transcript);
  const filhos = (seguro(() => fs.readdirSync(dir)) || [])
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => path.join(dir, f))
    .filter((p) => p !== transcript && inicio(p).includes(`"parent_thread_id":"${id}"`));
  return [transcript, ...filhos];
}

function lerEstado(chave) {
  return seguro(() => JSON.parse(fs.readFileSync(path.join(ESTADO, chave + ".json"), "utf8"))) || {};
}

function gravarEstado(chave, estado) {
  seguro(() => {
    fs.mkdirSync(ESTADO, { recursive: true });
    fs.writeFileSync(path.join(ESTADO, chave + ".json"), JSON.stringify(estado));
  });
}

/* Devolve o JSON de saida do hook, ou null pra deixar a mensagem seguir calada. */
function hook(evento) {
  seguro(() => fs.writeFileSync(ATIVO, new Date().toISOString()));

  if (!/nuvemshop-lojas/.test(evento.cwd || "")) return null; // so o agente de layout
  const transcript = evento.transcript_path;
  const st = transcript && seguro(() => fs.statSync(transcript));
  if (!st) return null;
  if (inicio(transcript).includes('"parent_thread_id"')) return null; // sub-agente: nunca segurar o guardian

  const chave = String(evento.session_id || path.basename(transcript)).replace(/[^\w.-]/g, "_");
  const estado = lerEstado(chave);

  const parada = Date.now() - st.mtimeMs;
  if (parada >= PARADA && estado.seguradaEm !== st.mtimeMs) {
    const contexto = contextoDe(transcript);
    if (contexto >= CONTEXTO_CARO) {
      gravarEstado(chave, { ...estado, seguradaEm: st.mtimeMs });
      return {
        decision: "block",
        reason: `Mensagem segurada: a sessao ficou parada ${Math.round(parada / 60_000)} min e o cache da conversa provavelmente expirou - enviar agora reenvia tudo (~${pct(contexto)}% da semana). De /new: o HANDOFF tem o estado. Se quiser continuar aqui mesmo, envie de novo.`,
      };
    }
  }

  const novo = arquivosDaSessao(transcript).reduce((s, p) => s + novoDe(p), 0);
  const p = (novo / SEMANA_NOVO) * 100;
  const alcancado = CORTES.reduce((n, corte, i) => (p >= corte ? i : n), -1);
  if (alcancado < 0) return null;
  /* cada nivel avisa uma vez; o ultimo repete a cada mensagem - quem ignorou
     os anteriores precisa de insistencia */
  if (alcancado <= (estado.nivel ?? -1) && alcancado < CORTES.length - 1) return null;
  gravarEstado(chave, { ...estado, nivel: alcancado });
  return { systemMessage: NIVEIS[alcancado](pct(novo)) };
}

/* Registra o hook em ~/.codex/hooks.json sem apagar hook de mais ninguem: le,
   acrescenta o nosso se faltar, grava. JSON ilegivel: nao toca - perder o hook
   de alguem e pior que ficar sem aviso. */
function instalar() {
  const arquivo = path.join(CODEX, "hooks.json");
  const comando = `node "${path.join(CODEX, "vigia.js")}"`;

  let config = {};
  if (fs.existsSync(arquivo)) {
    config = seguro(() => JSON.parse(fs.readFileSync(arquivo, "utf8")));
    if (!config || typeof config !== "object") return;
  }
  config.hooks = config.hooks || {};
  const grupos = (config.hooks.UserPromptSubmit = config.hooks.UserPromptSubmit || []);
  const registrado = grupos.some((g) => (g.hooks || []).some((h) => h.command === comando));
  if (!registrado) {
    grupos.push({ hooks: [{ type: "command", command: comando, timeout: 10 }] });
    fs.mkdirSync(CODEX, { recursive: true });
    fs.writeFileSync(arquivo, JSON.stringify(config, null, 2) + "\n");
  }

  if (!fs.existsSync(ATIVO)) {
    console.log("  Aviso de consumo no chat - PRIMEIRA VEZ: dentro do Codex, digite /hooks");
    console.log("  e aprove o hook do vigia.js. Sem isso o agente funciona, so sem o aviso.");
    console.log("");
  }
}

if (process.argv.includes("--instalar")) {
  instalar();
} else {
  const saida = hook(seguro(() => JSON.parse(fs.readFileSync(0, "utf8"))) || {});
  if (saida) process.stdout.write(JSON.stringify(saida));
}
