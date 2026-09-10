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

/* Quanto token NOVO vale a semana inteira da conta. Os avisos sao dados em %
   dessa semana, que e a moeda real.

   Medido em 2026-09-10 no Terra medium, pela virada de % que o proprio log
   grava (rate_limits.primary.used_percent): a conta foi de 6% para 7% com 562
   mil tokens novos DESTA maquina - se alguem do time usou junto, 1% custa
   ainda mais. Semana >= ~56M. O valor anterior (6M) saiu de uma correlacao com
   erro de 112x e fazia o aviso de "1,7%" tocar em ~100 mil tokens, ~0,2% real:
   tocava em todo ajuste simples e virou ruido. 50M arredonda pra baixo, pra
   avisar um pouco antes do real, nunca depois.

   Com 50M, as sessoes de layout desse dia (0,44M e 0,54M somando o guardian)
   passam caladas. Modelo diferente pode pesar diferente: recalibrar pela
   virada de % no log, nao por estimativa. */
const SEMANA_NOVO = 50e6;
const AVISOS = [
  { pct: 1.7, titulo: "Sessao ja custou ~1,7% da semana",
    texto: "Escreva 'encerra' para o agente fechar o assunto, depois /new. Nada se perde." },
  { pct: 4, titulo: "Sessao cara: ~4% da semana",
    texto: "A cota e compartilhada com o time. Escreva 'encerra' e depois /new." },
  { pct: 8, titulo: "Feche esta sessao: ~8% da semana",
    texto: "Uma sessao so nao deveria custar isso. Escreva 'encerra' e depois /new - nada se perde." },
].map((a) => ({ ...a, em: Math.round((a.pct / 100) * SEMANA_NOVO) }));

let proximo = 0;
let sessaoVigiada = null;   /* id da sessao que estamos acompanhando agora */

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

/* De qual sessao e um .jsonl. O guardian (sub-agente que avalia aprovacao)
   grava arquivo proprio, com parent_thread_id apontando pro id da sessao
   principal - entao a chave e parent_thread_id, senao o proprio id. */
const sessaoDoArquivo = new Map();
function sessaoDe(p) {
  if (sessaoDoArquivo.has(p)) return sessaoDoArquivo.get(p);
  const primeira = seguro(() => fs.readFileSync(p, "utf8").split("\n", 1)[0]);
  const meta = seguro(() => JSON.parse(primeira).payload);
  const id = meta?.parent_thread_id || meta?.id;
  if (id) sessaoDoArquivo.set(p, id); // sem id: 1a linha ainda sendo escrita, tenta de novo
  return id || p;
}

/* A sessao que esta rodando agora (a do .jsonl escrito por ultimo) e TODOS os
   arquivos dela. Vigiar so "o arquivo mais recente" alternava entre a sessao e
   o guardian, zerava os avisos a cada troca e repetia a notificacao - simulado
   sobre 2026-09-10: 10 trocas, 9 avisos. O gasto do guardian e cota real (25% a
   44% da sessao nesse dia), entao entra na soma. */
function sessaoAtual() {
  const recentes = [];
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
          recentes.push({ p, mtimeMs: st.mtimeMs });
        }
      }
    }
  }
  if (!recentes.length) return null;
  const id = sessaoDe(recentes.reduce((a, b) => (b.mtimeMs > a.mtimeMs ? b : a)).p);
  return { id, arquivos: recentes.filter((r) => sessaoDe(r.p) === id).map((r) => r.p) };
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
  const sessao = sessaoAtual();

  /* /new cria outra sessao (outro id): zera os avisos. O guardian nao conta
     como sessao nova - ele tem o mesmo id-pai. */
  if (sessao && sessao.id !== sessaoVigiada) {
    sessaoVigiada = sessao.id;
    proximo = 0;
    ultimoReforco = 0;
  }

  if (sessao) {
    const novo = sessao.arquivos.reduce((s, p) => s + novoDe(p), 0);
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
