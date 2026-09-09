#!/usr/bin/env node
/*
 * vigia.js — acompanha o quanto a sessao atual do Codex esta comendo da COTA
 * SEMANAL e avisa por notificacao do sistema quando o preco ficar alto.
 *
 * Mede token NOVO (entrada nao cacheada + saida), nao o total. Medido em
 * 2026-09-09 sobre 3.464 sessoes reais: o total e 99,6% entrada, e 94% dela e
 * CACHE - que quase nao consome cota. Correlacionando janelas semanais com a
 * % consumida, o total erra por um fator de 2473x e o token novo por 112x.
 * Ou seja: o total infla com cache e NAO diz o que a cota custou. Sessao de
 * 183M totais gastou o mesmo que uma de 285M, porque as duas tinham ~5M novos.
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

/* A cota semanal vale ~6M de token NOVO (estimado no mesmo levantamento;
   ordem de grandeza, nao precisao - a dispersao de 112x provavelmente e peso
   por modelo). Os avisos sao dados em % dessa semana, que e a moeda real.

   Calibragem: as sessoes de layout medidas gastaram 40k, 53k, 218k e 352k de
   token novo. Com os cortes abaixo, as duas leves passam caladas e as duas
   pesadas avisam - que e o comportamento desejado. Aviso que toca em sessao
   normal vira ruido e ninguem le.

   Recalibrar com `node gasto.js sessoes` depois de uma semana de uso real. */
const SEMANA_NOVO = 6e6;
const AVISOS = [
  { pct: 1.7, titulo: "Sessao ja custou ~1,7% da semana",
    texto: "Escreva 'encerra' para o agente fechar o assunto, depois /new. Nada se perde." },
  { pct: 4, titulo: "Sessao cara: ~4% da semana",
    texto: "A cota e compartilhada com o time. Escreva 'encerra' e depois /new." },
  { pct: 8, titulo: "Feche esta sessao: ~8% da semana",
    texto: "Uma sessao so nao deveria custar isso. Escreva 'encerra' e depois /new - nada se perde." },
].map((a) => ({ ...a, em: Math.round((a.pct / 100) * SEMANA_NOVO) }));

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

/* Token NOVO da sessao: entrada que NAO veio do cache, mais a saida.
   cached_input_tokens e um SUBCONJUNTO de input_tokens (verificado em 6 sessoes
   reais), entao a subtracao e valida. */
function novoDe(arquivo) {
  const texto = seguro(() => fs.readFileSync(arquivo, "utf8"));
  if (!texto) return 0;
  const usos = texto.match(/"total_token_usage":\{[^}]*\}/g);
  if (!usos || !usos.length) return 0;
  try {
    const u = JSON.parse("{" + usos[usos.length - 1] + "}").total_token_usage;
    const entrada = u.input_tokens || 0;
    const cache = u.cached_input_tokens || 0;
    const saida = u.output_tokens || 0;
    return Math.max(entrada - cache, 0) + saida;
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
    const novo = novoDe(arquivo);
    while (proximo < AVISOS.length && novo >= AVISOS[proximo].em) {
      const a = AVISOS[proximo];
      notificar(a.titulo, a.texto);
      proximo++;
      ultimoReforco = Date.now();
    }

    const ultimo = AVISOS[AVISOS.length - 1];
    if (novo >= ultimo.em && Date.now() - ultimoReforco >= REFORCO) {
      notificar(ultimo.titulo, ultimo.texto);
      ultimoReforco = Date.now();
    }
  }

}

if (!fs.existsSync(BASE)) process.exit(0);
setInterval(tick, INTERVALO);
tick();
