const { ACCOUNT_NAME_PATTERN } = require("./constants");

function nodeDeps() {
  return {
    fs: require("node:fs"),
    fsp: require("node:fs/promises"),
    os: require("node:os"),
    path: require("node:path"),
  };
}

function codexAuthPaths() {
  const { os, path } = nodeDeps();
  const CODEX_DIR = path.join(os.homedir(), ".codex");
  return {
    CODEX_DIR,
    AUTH_PATH: path.join(CODEX_DIR, "auth.json"),
    CONFIG_PATH: path.join(CODEX_DIR, "config.toml"),
    ACCOUNTS_DIR: path.join(CODEX_DIR, "auth_accounts"),
    USAGE_CACHE_PATH: path.join(CODEX_DIR, "auth_accounts_usage.json"),
    CURRENT_NAME_PATH: path.join(CODEX_DIR, "current_account"),
  };
}

function normalizeAccountName(rawName) {
  if (typeof rawName !== "string") throw new Error("Account name is required.");
  const name = rawName.trim().replace(/\.json$/i, "");
  if (!ACCOUNT_NAME_PATTERN.test(name)) {
    throw new Error(
      "Use letters, numbers, dots, underscores, or dashes. The name must start with a letter or number.",
    );
  }
  return name;
}

function accountPath(name) {
  const { path } = nodeDeps();
  const { ACCOUNTS_DIR } = codexAuthPaths();
  return path.join(ACCOUNTS_DIR, `${name}.json`);
}

async function ensureDir(dir) {
  const { fsp } = nodeDeps();
  await fsp.mkdir(dir, { recursive: true });
}

async function pathExists(target) {
  const { fs, fsp } = nodeDeps();
  try {
    await fsp.access(target, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

module.exports = { nodeDeps, codexAuthPaths, normalizeAccountName, accountPath, ensureDir, pathExists };
