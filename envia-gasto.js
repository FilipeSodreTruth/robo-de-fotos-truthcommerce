#!/usr/bin/env node
/*
 * envia-gasto.js — manda o resumo de consumo desta maquina para o n8n.
 *
 * Envia SO numeros agregados: conta Codex, pasta do projeto, tokens, sessoes,
 * turnos. Nunca conteudo de conversa, nunca caminho completo, nunca token
 * de loja, nunca o id_token em si - so a claim de email dele.
 *
 * A URL do webhook fica em ~/.codex/gasto-webhook.txt, uma vez por maquina:
 *
 *     echo "https://SEU-N8N/webhook/gasto-codex" > ~/.codex/gasto-webhook.txt
 *
 * Fica fora do repositorio de proposito — ele e publico, e webhook em
 * repositorio publico qualquer um posta lixo nele. Segunda linha do arquivo,
 * opcional: um segredo, mandado no cabecalho X-Gasto-Token.
 *
 * Sem esse arquivo o script sai calado e nao atrapalha nada.
 *
 * Roda sozinho na abertura do nova-loja, uma vez por dia.
 * Forcar agora:  node ~/.codex/envia-gasto.js --forcar
 * Ver o que iria:  node ~/.codex/envia-gasto.js --mostrar
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const BASE = path.join(os.homedir(), ".codex", "sessions");
const CONFIG = path.join(os.homedir(), ".codex", "gasto-webhook.txt");
const MARCA = path.join(os.homedir(), ".codex", ".gasto-enviado");

/* Reenvia sempre os ultimos 7 dias: maquina que ficou desligada nao perde
   nada, e o n8n sobrescreve as linhas repetidas pela chave. */
const JANELA = 7;

const FORCAR = process.argv.includes("--forcar");
const MOSTRAR = process.argv.includes("--mostrar");

function seguro(fn) {
  try {
    return fn();
  } catch {
    return null;
  }
}

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
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

  const turnos =
    (texto.match(/"type":"user_message"/g) || []).length ||
    (texto.match(/"role":"user"/g) || []).length;

  let cwd = "";
  const primeira = texto.slice(0, texto.indexOf("\n"));
  try {
    const j = JSON.parse(primeira);
    cwd = j.payload?.cwd || j.cwd || "";
  } catch {}

  /* so o nome da pasta, nunca o caminho inteiro */
  return {
    total,
    entrada,
    saida,
    cache,
    turnos,
    projeto: cwd ? path.basename(cwd) : "desconhecido",
  };
}

/* Qual conta Codex esta logada NESTA maquina. O log de sessao (session_meta)
   nao guarda a conta - so cwd, git e plan_type - entao a unica fonte e o
   auth.json que o proprio Codex escreve. tokens.id_token e um JWT OIDC; so
   decodificamos a claim "email" localmente, sem validar assinatura (nao e
   checagem de seguranca, e leitura de arquivo local). Mesmo metodo do
   readCodexAccountIdentity do robo de imagens, pra chavear igual.

   Limite conhecido: e a conta logada AGORA. Se a maquina trocou de conta
   dentro da janela de 7 dias, os dias antigos ficam atribuidos a conta atual.
   Na pratica cada pessoa usa uma conta so, entao serve pra dizer QUEM gastou. */
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

function coletar() {
  const dias = [];
  for (let i = 0; i < JANELA; i++) {
    const [y, m, d] = diasAtras(i);
    const dir = path.join(BASE, y, m, d);
    if (!fs.existsSync(dir)) continue;

    const sessoes = (seguro(() => fs.readdirSync(dir)) || [])
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => lerSessao(path.join(dir, f)))
      .filter(Boolean);
    if (!sessoes.length) continue;

    const porProjeto = new Map();
    for (const s of sessoes) {
      const p =
        porProjeto.get(s.projeto) ||
        { total: 0, entrada: 0, saida: 0, cache: 0, sessoes: 0, turnos: 0, inchadas: 0 };
      p.total += s.total;
      p.entrada += s.entrada;
      p.saida += s.saida;
      p.cache += s.cache;
      p.turnos += s.turnos;
      p.sessoes += 1;
      if (s.turnos && s.total / s.turnos > 250000) p.inchadas += 1;
      porProjeto.set(s.projeto, p);
    }

    dias.push({
      dia: `${y}-${m}-${d}`,
      projetos: [...porProjeto.entries()]
        .map(([projeto, p]) => ({ projeto, ...p }))
        .sort((a, b) => b.total - a.total),
    });
  }
  return dias;
}

function main() {
  if (!fs.existsSync(BASE)) return;

  const bruto = seguro(() => fs.readFileSync(CONFIG, "utf8"));
  const linhas = (bruto || "").split("\n").map((l) => l.trim()).filter(Boolean);
  const url = linhas[0];
  const segredo = linhas[1] || null;

  if (!MOSTRAR && (!url || !url.startsWith("http"))) return;

  /* uma vez por dia, salvo --forcar */
  const ultimo = (seguro(() => fs.readFileSync(MARCA, "utf8")) || "").trim();
  if (!FORCAR && !MOSTRAR && ultimo === hojeISO()) return;

  const dias = coletar();
  if (!dias.length) return;

  const corpo = {
    maquina: os.hostname(),
    usuario: os.userInfo().username,
    /* quem realmente gastou: o usuario do SO nao serve de chave (uma mesma
       maquina roda com conta Codex de outra pessoa) */
    conta: contaCodex(),
    enviado_em: new Date().toISOString(),
    janela_dias: JANELA,
    dias,
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
  })
    .then((r) => {
      /* so grava a marca se o n8n aceitou: falhou, tenta na proxima abertura */
      if (r.ok) seguro(() => fs.writeFileSync(MARCA, hojeISO()));
    })
    .catch(() => {
      /* sem internet, n8n fora do ar: sair calado. Isto nunca pode
         atrapalhar quem so quer abrir o agente. */
    });
}

main();
