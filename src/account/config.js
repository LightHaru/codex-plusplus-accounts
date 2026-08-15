const { nodeDeps, codexAuthPaths, ensureDir } = require("../node-utils");

async function saveAuthSnapshotWithCurrentBaseUrl(sourcePath, targetPath) {
  const { fsp } = nodeDeps();
  const raw = await fsp.readFile(sourcePath, "utf8");
  let auth;
  try {
    auth = JSON.parse(raw);
  } catch {
    await fsp.writeFile(targetPath, raw, "utf8");
    return;
  }

  const currentBaseUrl = await readCurrentOpenAIBaseUrl();
  if (isApiKeyAuth(auth) && currentBaseUrl && !accountOpenAIBaseUrl(auth)) {
    auth.base_url = currentBaseUrl;
    await fsp.writeFile(targetPath, `${JSON.stringify(auth, null, 2)}\n`, "utf8");
    return;
  }

  await fsp.writeFile(targetPath, raw, "utf8");
}

async function readAuthJson(filePath, label) {
  const { fsp } = nodeDeps();
  const raw = await fsp.readFile(filePath, "utf8");
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${label} is not valid JSON.`);
  }
}

async function syncOpenAIBaseUrlForAccount(auth) {
  if (!isApiKeyAuth(auth)) {
    await setTopLevelOpenAIBaseUrl(null);
    return;
  }

  const baseUrl = accountOpenAIBaseUrl(auth);
  if (baseUrl) await setTopLevelOpenAIBaseUrl(baseUrl);
}

function isApiKeyAuth(auth) {
  return auth?.auth_mode === "apikey" || !!auth?.OPENAI_API_KEY;
}

function accountOpenAIBaseUrl(auth) {
  if (!isApiKeyAuth(auth)) return null;
  for (const key of ["openai_base_url", "base_url", "OPENAI_BASE_URL"]) {
    const baseUrl = normalizeBaseUrl(auth?.[key]);
    if (baseUrl) return baseUrl;
  }
  return null;
}

function normalizeBaseUrl(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

async function readCurrentOpenAIBaseUrl() {
  const { fsp } = nodeDeps();
  const { CONFIG_PATH } = codexAuthPaths();
  try {
    return readTopLevelTomlString(await fsp.readFile(CONFIG_PATH, "utf8"), "openai_base_url");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function setTopLevelOpenAIBaseUrl(baseUrl) {
  const { fsp } = nodeDeps();
  const { CODEX_DIR, CONFIG_PATH } = codexAuthPaths();
  await ensureDir(CODEX_DIR);
  let current = "";
  try {
    current = await fsp.readFile(CONFIG_PATH, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const next = updateTopLevelTomlString(current, "openai_base_url", baseUrl);
  if (next !== current) {
    await fsp.writeFile(CONFIG_PATH, next, "utf8");
  }
}

function updateTopLevelTomlString(raw, key, value) {
  const lines = raw ? raw.replace(/\r\n/g, "\n").split("\n") : [];
  if (lines.length && lines[lines.length - 1] === "") lines.pop();

  const keyPattern = new RegExp(`^\\s*${escapeRegExp(key)}\\s*=`);
  const kept = [];
  let firstTableIndex = null;
  for (const line of lines) {
    const isTableHeader = /^\s*\[/.test(line);
    if (firstTableIndex === null && isTableHeader) firstTableIndex = kept.length;
    if (firstTableIndex === null && keyPattern.test(line)) continue;
    kept.push(line);
  }

  const insertAt = firstTableIndex === null ? kept.length : firstTableIndex;
  if (value) {
    kept.splice(insertAt, 0, `${key} = ${JSON.stringify(value)}`);
  }

  return `${kept.join("\n")}${kept.length ? "\n" : ""}`;
}

function readTopLevelTomlString(raw, key) {
  const keyPattern = new RegExp(`^\\s*${escapeRegExp(key)}\\s*=\\s*(['"])(.*)\\1\\s*(?:#.*)?$`);
  for (const line of raw.replace(/\r\n/g, "\n").split("\n")) {
    if (/^\s*\[/.test(line)) return null;
    const match = line.match(keyPattern);
    if (!match) continue;
    return match[2].trim() || null;
  }
  return null;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
  saveAuthSnapshotWithCurrentBaseUrl,
  readAuthJson,
  syncOpenAIBaseUrlForAccount,
  setTopLevelOpenAIBaseUrl,
  accountOpenAIBaseUrl,
};
