const { ACCOUNT_NAME_PATTERN } = require("./constants");

const AUTH_SNAPSHOT_MAX_BYTES = 256 * 1024;
const USAGE_RESPONSE_MAX_BYTES = 1024 * 1024;
const USAGE_HOSTS = new Set(["chatgpt.com", "www.chatgpt.com"]);

function redactSecrets(value) {
  return String(value ?? "")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9._-]+/g, "[redacted-jwt]")
    .replace(/sk-[a-zA-Z0-9]{8,}/g, "[redacted-key]")
    .replace(/rt[-_][a-zA-Z0-9_-]{8,}/gi, "[redacted-refresh]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/(?:[A-Za-z]:)?(?:\\|\/)(?:Users|home)(?:\\|\/)[^\s"'\]]+/gi, "[redacted-path]");
}

function isSafeAccountName(name) {
  return typeof name === "string" && ACCOUNT_NAME_PATTERN.test(name) && !name.includes("..");
}

function assertInsideDir(dir, target) {
  const { path } = require("./node-utils").nodeDeps();
  const root = path.resolve(dir);
  const resolved = path.resolve(target);
  const rel = path.relative(root, resolved);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Blocked path outside the accounts folder.");
  }
  return resolved;
}

async function protectAuthFile(filePath) {
  const { fsp } = require("./node-utils").nodeDeps();
  try {
    await fsp.chmod(filePath, 0o600);
  } catch {
    /* Windows may ignore chmod; snapshot still written */
  }
}

function isAuthSnapshot(auth) {
  if (!auth || typeof auth !== "object" || Array.isArray(auth)) return false;
  const tokens = auth.tokens;
  const hasAccess =
    tokens &&
    typeof tokens === "object" &&
    typeof tokens.access_token === "string" &&
    tokens.access_token.length > 0;
  const hasKey = typeof auth.OPENAI_API_KEY === "string" && auth.OPENAI_API_KEY.length > 0;
  return Boolean(hasAccess || hasKey);
}

async function readAuthSnapshotFile(filePath, label) {
  const { fs, fsp } = require("./node-utils").nodeDeps();
  let stat;
  try {
    stat = await fsp.lstat(filePath);
  } catch {
    throw new Error(`${label} was not found.`);
  }
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error(`${label} must be a regular file.`);
  }
  if (stat.size > AUTH_SNAPSHOT_MAX_BYTES) {
    throw new Error(`${label} is too large to use as an auth snapshot.`);
  }
  const raw = await fsp.readFile(filePath, "utf8");
  let auth;
  try {
    auth = JSON.parse(raw);
  } catch {
    throw new Error(`${label} is not valid JSON.`);
  }
  if (!isAuthSnapshot(auth)) {
    throw new Error(`${label} is not a Codex auth snapshot.`);
  }
  return { auth, raw: `${JSON.stringify(auth, null, 2)}\n` };
}

async function writeAuthSnapshotFile(filePath, auth) {
  if (!isAuthSnapshot(auth)) throw new Error("Refusing to write an invalid auth snapshot.");
  const raw = `${JSON.stringify(auth, null, 2)}\n`;
  if (Buffer.byteLength(raw, "utf8") > AUTH_SNAPSHOT_MAX_BYTES) {
    throw new Error("Auth snapshot is too large to write.");
  }
  await writeFileAtomic(filePath, raw);
  await protectAuthFile(filePath);
}

async function writeFileAtomic(filePath, raw) {
  const { fsp } = require("./node-utils").nodeDeps();
  const tempPath = `${filePath}.tmp`;
  await fsp.writeFile(tempPath, raw, "utf8");
  try {
    await fsp.rename(tempPath, filePath);
  } catch {
    await fsp.copyFile(tempPath, filePath);
    await fsp.rm(tempPath, { force: true });
  }
}

function isAllowedUsageUrl(urlLike, base) {
  try {
    const url = typeof urlLike === "string" ? new URL(urlLike, base) : urlLike;
    return url.protocol === "https:" && USAGE_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function isIpHostname(hostname) {
  const host = String(hostname || "").replace(/^\[|\]$/g, "");
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return true;
  if (host.includes(":")) return true;
  return false;
}

function isSafeLoginNavigation(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:") return !isIpHostname(parsed.hostname);
    if (
      parsed.protocol === "http:" &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") &&
      parsed.port === "1455"
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

module.exports = {
  AUTH_SNAPSHOT_MAX_BYTES,
  USAGE_RESPONSE_MAX_BYTES,
  USAGE_HOSTS,
  redactSecrets,
  isSafeAccountName,
  assertInsideDir,
  protectAuthFile,
  isAuthSnapshot,
  readAuthSnapshotFile,
  writeAuthSnapshotFile,
  writeFileAtomic,
  isAllowedUsageUrl,
  isSafeLoginNavigation,
  isIpHostname,
};
