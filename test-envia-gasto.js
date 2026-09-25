const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { janelaSemanal } = require("./envia-gasto");

const originalNow = Date.now;
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "envia-gasto-test-"));

function fixture(eventos) {
  const file = path.join(pasta, `${Math.random()}.jsonl`);
  fs.writeFileSync(file, eventos.map((e) => JSON.stringify(e)).join("\n"));
  return file;
}
function evento(timestamp, reset, percent) {
  return {
    timestamp: new Date(timestamp).toISOString(),
    payload: { rate_limits: { primary: { resets_at: reset / 1000, window_minutes: 10080, used_percent: percent } } },
  };
}

try {
  const agora = Date.parse("2026-09-25T12:59:00Z");
  Date.now = () => agora;

  const resetAtual = Date.parse("2026-10-02T10:59:00Z");
  const atual = janelaSemanal([fixture([evento(agora, resetAtual, 15)])]);
  assert.equal(atual.inicio, Date.parse("2026-09-25T10:59:00Z"));
  assert.equal(atual.fim, resetAtual);
  assert.equal(atual.usado_percent, 15);
  assert.equal(atual.estimada, false);

  const resetPassado = Date.parse("2026-09-25T10:59:00Z");
  const projetada = janelaSemanal([fixture([evento(agora, resetPassado, 77)])]);
  assert.equal(projetada.inicio, resetPassado);
  assert.equal(projetada.fim, resetAtual);
  assert.equal(projetada.usado_percent, null);
  assert.equal(projetada.estimada, true);

  const snapshots = janelaSemanal([fixture([
    evento(Date.parse("2026-09-25T08:00:00Z"), resetPassado, 77),
    evento(Date.parse("2026-09-25T12:58:00Z"), resetAtual, 15),
  ])]);
  assert.equal(snapshots.usado_percent, 15);
  assert.equal(snapshots.inicio, Date.parse("2026-09-25T10:59:00Z"));

  console.log("3 verificacoes de janela Codex passaram.");
} finally {
  Date.now = originalNow;
  fs.rmSync(pasta, { recursive: true, force: true });
}
