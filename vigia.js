#!/usr/bin/env node
/*
 * vigia.js — acompanha o gasto da sessao atual do Codex em segundo plano e
 * avisa por notificacao do sistema quando ela ficar longa demais.
 *
 * Cuida so do tamanho da sessao. A cota geral do plano se acompanha no
 * painel do Codex.
 *
 * Iniciado automaticamente pelo nova-loja. Nao precisa rodar na mao.
 * Le so os registros locais em ~/.codex/sessions; nao envia nada.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");

const BASE = path.join(os.homedir(), ".codex", "sessions");
const INICIO = Date.now();
const INTERVALO = 30_000;

/* Avisos por sessao, em tokens. Calibrar com dados reais depois de uma semana:
   `node gasto.js sessoes` mostra a distribuicao. Se o primeiro aviso virar ruido,
   suba o numero; se sessao cara passar batido, desca. */
const AVISOS = [
  { em: 0.8e6, titulo: "Sessao ficando longa",
    texto: "Escreva 'encerra' para o agente fechar o assunto, depois /new. Nada se perde." },
  { em: 2e6, titulo: "Sessao cara",
    texto: "Cada mensagem custa varias vezes mais que no comeco. Escreva 'encerra' e depois /new." },
  { em: 4e6, titulo: "Feche esta sessao",
    texto: "Longa demais para ser eficiente. Escreva 'encerra' e depois /new — nada se perde." },
];
let proximo = 0;
let arquivoVigiado = null;   /* sessao que estamos acompanhando agora */

/* Passando do ultimo nivel, repete a cada 5 min ate a sessao acabar:
   quem ignorou a primeira notificacao precisa de insistencia. */
const REFORCO = 5 * 60_000;
let ultimoReforco = 0;


function notificar(titulo, texto) {
  try {
    if (process.platform === "darwin") {
      const s = (x) => x.replace(/"/g, "'");
      execFile("osascript", [
        "-e",
        `display notification "${s(texto)}" with title "${s(titulo)}" sound name "Submarine"`,
      ]);
    } else if (process.platform === "win32") {
      const ps = `
        Add-Type -AssemblyName System.Windows.Forms
        $n = New-Object System.Windows.Forms.NotifyIcon
        $n.Icon = [System.Drawing.SystemIcons]::Warning
        $n.BalloonTipTitle = '${titulo.replace(/'/g, "")}'
        $n.BalloonTipText  = '${texto.replace(/'/g, "")}'
        $n.Visible = $true
        $n.ShowBalloonTip(20000)
        Start-Sleep -Seconds 12
        $n.Dispose()`;
      execFile("powershell", ["-NoProfile", "-WindowStyle", "Hidden", "-Command", ps]);
    } else {
      execFile("notify-send", [titulo, texto]);
    }
  } catch {
    /* sem notificacao disponivel: seguir em silencio */
  }
}

/* Acha o .jsonl mais recente criado depois que este vigia comecou:
   e a sessao que esta rodando agora. */
function sessaoAtual() {
  let melhor = null;
  const anos = seguro(() => fs.readdirSync(BASE)) || [];
  for (const a of anos) {
    for (const m of seguro(() => fs.readdirSync(path.join(BASE, a))) || []) {
      for (const d of seguro(() => fs.readdirSync(path.join(BASE, a, m))) || []) {
        const dir = path.join(BASE, a, m, d);
        for (const f of seguro(() => fs.readdirSync(dir)) || []) {
          if (!f.endsWith(".jsonl")) continue;
          const p = path.join(dir, f);
          const st = seguro(() => fs.statSync(p));
          if (!st) continue;
          if (st.mtimeMs < INICIO - 60_000) continue;
          if (!melhor || st.mtimeMs > melhor.mtimeMs) melhor = { p, mtimeMs: st.mtimeMs };
        }
      }
    }
  }
  return melhor && melhor.p;
}

function seguro(fn) {
  try {
    return fn();
  } catch {
    return null;
  }
}

function totalDe(arquivo) {
  const texto = seguro(() => fs.readFileSync(arquivo, "utf8"));
  if (!texto) return 0;
  const usos = texto.match(/"total_token_usage":\{[^}]*\}/g);
  if (!usos || !usos.length) return 0;
  try {
    return JSON.parse("{" + usos[usos.length - 1] + "}").total_token_usage.total_tokens || 0;
  } catch {
    return 0;
  }
}

function tick() {
  const arquivo = sessaoAtual();

  /* /new cria um arquivo novo: zera os avisos para a sessao seguinte */
  if (arquivo && arquivo !== arquivoVigiado) {
    arquivoVigiado = arquivo;
    proximo = 0;
    ultimoReforco = 0;
  }

  if (arquivo) {
    const total = totalDe(arquivo);
    while (proximo < AVISOS.length && total >= AVISOS[proximo].em) {
      const a = AVISOS[proximo];
      notificar(a.titulo, a.texto);
      proximo++;
      ultimoReforco = Date.now();
    }

    const ultimo = AVISOS[AVISOS.length - 1];
    if (total >= ultimo.em && Date.now() - ultimoReforco >= REFORCO) {
      notificar(ultimo.titulo, ultimo.texto);
      ultimoReforco = Date.now();
    }
  }

}

if (!fs.existsSync(BASE)) process.exit(0);
setInterval(tick, INTERVALO);
tick();
