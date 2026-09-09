#!/usr/bin/env node
/*
 * gasto.js — quanto o Codex consumiu, por dia e por sessao.
 * Le os logs locais em ~/.codex/sessions. Nao envia nada para lugar nenhum.
 *
 *   node gasto.js            hoje
 *   node gasto.js semana     ultimos 7 dias
 *   node gasto.js sessoes    as sessoes mais caras da semana
 *   node gasto.js 14         ultimos 14 dias
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const BASE = path.join(os.homedir(), ".codex", "sessions");
const arg = (process.argv[2] || "hoje").toLowerCase();

const M = (n) => (n / 1e6).toFixed(2) + "M";

const pad = (s, n) => String(s).padEnd(n);
const padL = (s, n) => String(s).padStart(n);

function diasAtras(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return [
    String(d.getFullYear()),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ];
}

function arquivosDoDia([y, m, d]) {
  const dir = path.join(BASE, y, m, d);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => path.join(dir, f));
}

/* O robo de imagens roda cada geracao num CODEX_HOME isolado e descartavel
   (codex-img-XXXXXX), entao sozinho ele inventa milhares de "projetos" de uma
   sessao so - 3.074 numa medicao de 2026-09-09, contra 16 pastas de verdade.
   Colapsa tudo num balde so, senao a lista de projetos nao serve pra nada. */
function nomeProjeto(cwd) {
  if (!cwd) return "desconhecido";
  const base = path.basename(cwd);
  return /^codex-img-/.test(base) ? "[robo de imagens]" : base;
}

/* Le uma sessao e devolve o total acumulado (a ultima ocorrencia manda),
   o numero de turnos do usuario e a pasta em que rodou. */
function lerSessao(arquivo) {
  let texto;
  try {
    texto = fs.readFileSync(arquivo, "utf8");
  } catch {
    return null;
  }

  let total = 0,
    cache = 0,
    entrada = 0,
    saida = 0;
  const usos = texto.match(/"total_token_usage":\{[^}]*\}/g);
  if (usos && usos.length) {
    try {
      const u = JSON.parse("{" + usos[usos.length - 1] + "}").total_token_usage;
      total = u.total_tokens || 0;
      entrada = u.input_tokens || 0;
      saida = u.output_tokens || 0;
      cache = u.cached_input_tokens || 0;
    } catch {}
  }

  const turnos = (texto.match(/"type":"user_message"/g) || []).length ||
                 (texto.match(/"role":"user"/g) || []).length;

  let cwd = "";
  const primeira = texto.slice(0, texto.indexOf("\n"));
  try {
    cwd = JSON.parse(primeira).payload?.cwd || JSON.parse(primeira).cwd || "";
  } catch {}

  const nome = path.basename(arquivo);
  const hora = (nome.match(/T(\d\d)-(\d\d)/) || []).slice(1).join(":");

  return {
    arquivo,
    total,
    entrada,
    saida,
    cache,
    turnos,
    cwd: nomeProjeto(cwd),
    hora,
  };
}

function coletar(dias) {
  const out = [];
  for (let i = 0; i < dias; i++) {
    const dia = diasAtras(i);
    const sessoes = arquivosDoDia(dia)
      .map(lerSessao)
      .filter((s) => s && s.total > 0);
    if (sessoes.length) out.push({ dia: dia.join("-"), sessoes });
  }
  return out.reverse();
}

function linhaDia(d) {
  const t = d.sessoes.reduce((a, s) => a + s.total, 0);
  const c = d.sessoes.reduce((a, s) => a + s.cache, 0);
  return `${d.dia}   ${padL(d.sessoes.length, 3)} sessoes   ${padL(M(t), 8)}   (cache ${M(c)})`;
}

if (!fs.existsSync(BASE)) {
  console.log("Nao encontrei ~/.codex/sessions. O Codex ja rodou nesta maquina?");
  process.exit(0);
}

if (arg === "hoje") {
  const dados = coletar(1);
  if (!dados.length) {
    console.log("Nenhuma sessao hoje.");
    process.exit(0);
  }
  const d = dados[0];
  const total = d.sessoes.reduce((a, s) => a + s.total, 0);
  console.log(`\n  Hoje: ${M(total)} tokens em ${d.sessoes.length} sessoes\n`);
  d.sessoes
    .sort((a, b) => b.total - a.total)
    .forEach((s) => {
      const porTurno = s.turnos ? Math.round(s.total / s.turnos / 1000) : 0;
      const alerta = porTurno > 80 ? "  <-- sessao inchada" : "";
      console.log(
        `  ${pad(s.hora, 6)} ${pad(s.cwd.slice(0, 22), 24)} ${padL(M(s.total), 8)}  ${padL(s.turnos, 3)} turnos  ${padL(porTurno + "k/turno", 12)}${alerta}`
      );
    });
  console.log("");
} else if (arg === "sessoes") {
  const dados = coletar(7);
  const todas = dados.flatMap((d) => d.sessoes.map((s) => ({ ...s, dia: d.dia })));
  todas.sort((a, b) => b.total - a.total);
  console.log("\n  Sessoes mais caras dos ultimos 7 dias\n");
  todas.slice(0, 15).forEach((s) => {
    const porTurno = s.turnos ? Math.round(s.total / s.turnos / 1000) : 0;
    const alerta = porTurno > 80 ? "  <-- sessao inchada" : "";
    console.log(
      `  ${s.dia} ${pad(s.hora, 6)} ${pad(s.cwd.slice(0, 20), 22)} ${padL(M(s.total), 8)}  ${padL(s.turnos, 3)} turnos  ${padL(porTurno + "k/turno", 12)}${alerta}`
    );
  });
  const total = todas.reduce((a, s) => a + s.total, 0);
  const inchadas = todas.filter((s) => s.turnos && s.total / s.turnos > 80000);
  const gastoInchadas = inchadas.reduce((a, s) => a + s.total, 0);
  console.log(`\n  Total da semana: ${M(total)}`);
  if (inchadas.length) {
    const pct = Math.round((gastoInchadas / total) * 100);
    console.log(
      `  ${inchadas.length} sessoes inchadas concentram ${M(gastoInchadas)} (${pct}% da semana).`
    );
    console.log("  Sessao longa reenvia o contexto inteiro a cada turno — troque por varias curtas.\n");
  } else {
    console.log("  Nenhuma sessao inchada. Boa higiene de contexto.\n");
  }
} else {
  const dias = arg === "semana" ? 7 : parseInt(arg, 10) || 7;
  const dados = coletar(dias);
  if (!dados.length) {
    console.log("Nenhuma sessao no periodo.");
    process.exit(0);
  }
  console.log(`\n  Ultimos ${dias} dias\n`);
  dados.forEach((d) => console.log("  " + linhaDia(d)));
  const total = dados.reduce(
    (a, d) => a + d.sessoes.reduce((x, s) => x + s.total, 0),
    0
  );
  const n = dados.reduce((a, d) => a + d.sessoes.length, 0);
  console.log(`\n  Total: ${M(total)} em ${n} sessoes`);
  console.log("  Para ver as sessoes mais caras:  node gasto.js sessoes\n");
}
