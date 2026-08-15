const { nodeDeps, codexAuthPaths, accountPath, pathExists } = require("../node-utils");
const { profileFromAuthString } = require("./auth");
const {
  accountContentsMatchActive,
  ensureAutosavedActiveAccount,
  getCurrentAccountName,
  listAccountNames,
} = require("./storage");
const { readAccountUsage } = require("./usage");
const { readAutoswitchEnabled } = require("./settings");

async function readState(extra = {}) {
  const { AUTH_PATH, ACCOUNTS_DIR, CONFIG_PATH, CURRENT_NAME_PATH } = codexAuthPaths();
  await ensureAutosavedActiveAccount();
  const allAccounts = await listAccountNames();
  const visibleAccounts = await selectVisibleAccounts(allAccounts);
  const accounts = visibleAccounts.map((account) => account.name);
  const current = await getCurrentAccountName(accounts);
  const hasActiveAuth = await pathExists(AUTH_PATH);
  const accountEmails = Object.fromEntries(
    visibleAccounts.map(({ name, email }) => [name, email]).filter(([, email]) => email),
  );
  const accountProfiles = Object.fromEntries(
    visibleAccounts
      .map(({ name, profile }) => [name, profile])
      .filter(([, profile]) => profile && Object.keys(profile).length),
  );
  const accountUsage = await readAccountUsage(accounts);
  const autoswitchEnabled = await readAutoswitchEnabled();
  return {
    accounts,
    accountEmails,
    accountProfiles,
    accountUsage,
    autoswitchEnabled,
    current,
    hasActiveAuth,
    paths: {
      auth: AUTH_PATH,
      accountsDir: ACCOUNTS_DIR,
      config: CONFIG_PATH,
      current: CURRENT_NAME_PATH,
    },
    ...extra,
  };
}

async function selectVisibleAccounts(accounts) {
  const details = await Promise.all(accounts.map(readAccountDetails));
  const byIdentity = new Map();
  for (const detail of details) {
    const key = detail.email ? `email:${detail.email.toLowerCase()}` : `name:${detail.name}`;
    const existing = byIdentity.get(key);
    if (!existing || compareAccountPreference(detail, existing) < 0) {
      byIdentity.set(key, detail);
    }
  }
  return Array.from(byIdentity.values()).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

async function readAccountDetails(name) {
  const { fsp } = nodeDeps();
  let raw = null;
  let mtimeMs = 0;
  try {
    const filePath = accountPath(name);
    const [contents, stat] = await Promise.all([
      fsp.readFile(filePath, "utf8"),
      fsp.stat(filePath),
    ]);
    raw = contents;
    mtimeMs = stat.mtimeMs;
  } catch {
    /* unreadable account snapshots remain selectable by name */
  }
  const profile = raw ? profileFromAuthString(raw) : null;
  return {
    name,
    profile,
    email: profile?.email || null,
    isActive: raw ? await accountContentsMatchActive(raw) : false,
    mtimeMs,
  };
}

function compareAccountPreference(left, right) {
  if (left.isActive !== right.isActive) return left.isActive ? -1 : 1;
  if (left.mtimeMs !== right.mtimeMs) return right.mtimeMs - left.mtimeMs;
  return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
}

module.exports = { readState, selectVisibleAccounts };
