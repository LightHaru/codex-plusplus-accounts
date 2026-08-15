const { nodeDeps, codexAuthPaths, ensureDir } = require("../node-utils");

async function readAutoswitchEnabled() {
  const { fsp } = nodeDeps();
  const { AUTOSWITCH_PATH } = codexAuthPaths();
  try {
    const raw = JSON.parse(await fsp.readFile(AUTOSWITCH_PATH, "utf8"));
    if (raw && typeof raw.enabled === "boolean") return raw.enabled;
  } catch {
    /* default on */
  }
  return true;
}

async function writeAutoswitchEnabled(enabled) {
  const { fsp } = nodeDeps();
  const { CODEX_DIR, AUTOSWITCH_PATH } = codexAuthPaths();
  await ensureDir(CODEX_DIR);
  await fsp.writeFile(
    AUTOSWITCH_PATH,
    `${JSON.stringify({ enabled: Boolean(enabled) }, null, 2)}\n`,
    "utf8",
  );
  return Boolean(enabled);
}

module.exports = { readAutoswitchEnabled, writeAutoswitchEnabled };
