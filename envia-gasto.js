#!/usr/bin/env node
/*
 * envia-gasto.js — manda o resumo de consumo desta maquina para o n8n.
 *
 * Envia SO numeros agregados: pasta do projeto, tokens, sessoes, turnos.
 * Nunca conteudo de conversa, nunca caminho completo, nunca token de loja.
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
      /* o cache conta na cota e nao entra em total_tokens — somar */
      total = (u.total_tokens || entrada + saida) + cache;
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
