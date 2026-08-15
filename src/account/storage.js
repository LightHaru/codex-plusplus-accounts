const {
  nodeDeps,
  codexAuthPaths,
  accountPath,
  ensureDir,
  pathExists,
} = require("../node-utils");
const { emailFromAuthString } = require("./auth");

async function listAccountNames() {
  const { fsp } = nodeDeps();
  const { ACCOUNTS_DIR } = codexAuthPaths();
  if (!(await pathExists(ACCOUNTS_DIR))) return [];
  const entries = await fsp.readdir(ACCOUNTS_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name.replace(/\.json$/i, ""))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

async function getCurrentAccountName(accounts) {
  const { fsp, path } = nodeDeps();
  const { AUTH_PATH, ACCOUNTS_DIR, CURRENT_NAME_PATH } = codexAuthPaths();
  if (!(await pathExists(AUTH_PATH))) return null;
  const matched = await findMatchingAccountByContents(accounts);
  if (matched) return matched;

  try {
    const raw = await fsp.readFile(CURRENT_NAME_PATH, "utf8");
    const name = raw.trim();
    if (name && accounts.includes(name)) return name;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  if (!(await pathExists(AUTH_PATH))) return null;
  try {
    const stat = await fsp.lstat(AUTH_PATH);
    if (stat.isSymbolicLink()) {
      const target = await fsp.readlink(AUTH_PATH);
      const resolved = path.resolve(path.dirname(AUTH_PATH), target);
      const relative = path.relative(path.resolve(ACCOUNTS_DIR), resolved);
      if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
        return path.basename(resolved).replace(/\.json$/i, "");
      }
    }
  } catch {
    /* fall through to content matching */
  }

  return null;
}

async function findMatchingAccountByContents(accounts) {
  const { fsp } = nodeDeps();
  const { AUTH_PATH } = codexAuthPaths();
  let active;
  try {
    active = await fsp.readFile(AUTH_PATH, "utf8");
  } catch {
    return null;
  }

  for (const name of accounts) {
    try {
      const saved = await fsp.readFile(accountPath(name), "utf8");
      if (saved === active) return name;
    } catch {
      /* ignore unreadable snapshots */
    }
  }
  return null;
}

async function accountContentsMatchActive(contents) {
  const { fsp } = nodeDeps();
  const { AUTH_PATH } = codexAuthPaths();
  try {
    return (await fsp.readFile(AUTH_PATH, "utf8")) === contents;
  } catch {
    return false;
  }
}

async function ensureAutosavedActiveAccount() {
  const { fsp } = nodeDeps();
  const { AUTH_PATH, ACCOUNTS_DIR, CURRENT_NAME_PATH } = codexAuthPaths();
  if (!(await pathExists(AUTH_PATH))) return null;

  const accounts = await listAccountNames();
  const matched = await findMatchingAccountByContents(accounts);
  if (matched) {
    await fsp.writeFile(CURRENT_NAME_PATH, `${matched}\n`, "utf8");
    return matched;
  }

  const active = await fsp.readFile(AUTH_PATH, "utf8");
  const sameEmail = await findMatchingAccountByEmail(accounts, active);
  if (sameEmail) {
    await fsp.copyFile(AUTH_PATH, accountPath(sameEmail));
    await fsp.writeFile(CURRENT_NAME_PATH, `${sameEmail}\n`, "utf8");
    return sameEmail;
  }

  await ensureDir(ACCOUNTS_DIR);
  const name = await nextAvailableAccountName("account");
  await fsp.copyFile(AUTH_PATH, accountPath(name));
  await fsp.writeFile(CURRENT_NAME_PATH, `${name}\n`, "utf8");
  return name;
}

async function findMatchingAccountByEmail(accounts, activeContents) {
  const activeEmail = emailFromAuthString(activeContents)?.toLowerCase();
  if (!activeEmail) return null;

  const { fsp } = nodeDeps();
  const { CURRENT_NAME_PATH } = codexAuthPaths();
  let current = null;
  try {
    current = (await fsp.readFile(CURRENT_NAME_PATH, "utf8")).trim();
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const matches = [];
  for (const name of accounts) {
    try {
      const filePath = accountPath(name);
      const [contents, stat] = await Promise.all([
        fsp.readFile(filePath, "utf8"),
        fsp.stat(filePath),
      ]);
      if (emailFromAuthString(contents)?.toLowerCase() === activeEmail) {
        matches.push({ name, isCurrent: name === current, mtimeMs: stat.mtimeMs });
      }
    } catch {
      /* ignore unreadable snapshots */
    }
  }

  matches.sort((a, b) => {
    if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
    if (a.mtimeMs !== b.mtimeMs) return b.mtimeMs - a.mtimeMs;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
  return matches[0]?.name || null;
}

async function nextAvailableAccountName(baseName) {
  const accounts = new Set(await listAccountNames());
  if (!accounts.has(baseName)) return baseName;
  for (let index = 2; index < 10_000; index += 1) {
    const name = `${baseName}-${index}`;
    if (!accounts.has(name)) return name;
  }
  throw new Error("Could not find an available account name.");
}

module.exports = {
  listAccountNames,
  getCurrentAccountName,
  findMatchingAccountByContents,
  findMatchingAccountByEmail,
  accountContentsMatchActive,
  ensureAutosavedActiveAccount,
  nextAvailableAccountName,
};
