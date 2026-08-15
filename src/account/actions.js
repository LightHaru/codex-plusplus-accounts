const { t } = require("../i18n");
const {
  nodeDeps,
  codexAuthPaths,
  normalizeAccountName,
  accountPath,
  ensureDir,
  pathExists,
} = require("../node-utils");
const { readState } = require("./state");
const { getCurrentAccountName, listAccountNames } = require("./storage");
const { fetchActiveUsageSnapshot, writeAccountUsage } = require("./usage");
const {
  readAuthJson,
  saveAuthSnapshotWithCurrentBaseUrl,
  setTopLevelOpenAIBaseUrl,
  syncOpenAIBaseUrlForAccount,
} = require("./config");

async function saveCurrentAccount(rawName) {
  const { fsp } = nodeDeps();
  const { AUTH_PATH, ACCOUNTS_DIR, CURRENT_NAME_PATH } = codexAuthPaths();
  const name = normalizeAccountName(rawName);
  if (!(await pathExists(AUTH_PATH))) {
    throw new Error(`No active Codex auth file found at ${AUTH_PATH}`);
  }
  await ensureDir(ACCOUNTS_DIR);
  await saveAuthSnapshotWithCurrentBaseUrl(AUTH_PATH, accountPath(name));
  await fsp.writeFile(CURRENT_NAME_PATH, `${name}\n`, "utf8");
  return readState({ notice: t("service.saved", { name }) });
}

async function switchAccount(rawName, api) {
  const { fsp } = nodeDeps();
  const { CODEX_DIR, AUTH_PATH, CURRENT_NAME_PATH } = codexAuthPaths();
  const name = normalizeAccountName(rawName);
  const source = accountPath(name);
  if (!(await pathExists(source))) throw new Error(`Saved account not found: ${name}`);
  await ensureDir(CODEX_DIR);
  try {
    const account = await readAuthJson(source, `Saved account ${name}`);
    await syncOpenAIBaseUrlForAccount(account);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    api?.log?.warn?.(`[account-switcher] skipped base URL sync for ${name}: ${message}`);
  }
  await fsp.copyFile(source, AUTH_PATH);
  await fsp.writeFile(CURRENT_NAME_PATH, `${name}\n`, "utf8");
  api?.log?.info?.(
    `[account-switcher] switched auth file to ${name}; subsequent host fetches should use the new tokens`,
  );
  await nudgeLiveSessionAfterSwitch(api, name);
  return readState({
    notice: t("service.switched", { name }),
    requiresAppRelaunch: false,
  });
}

/**
 * After swapping ~/.codex/auth.json, probe the live Codex host so later
 * ChatGPT/Codex fetches pick up the new tokens without killing the window.
 *
 * There is no public Codex++ auth-refresh API. We do not reload BrowserWindow
 * or relaunch the app. A usage fetch through the existing electronBridge path
 * is the safe in-process nudge: the native host attaches auth from auth.json.
 */
async function nudgeLiveSessionAfterSwitch(api, name) {
  try {
    const refreshed = await tryPublicAuthRefresh(api);
    if (refreshed) {
      api?.log?.info?.(`[account-switcher] in-process auth refresh via ${refreshed}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    api?.log?.warn?.(`[account-switcher] in-process auth refresh failed: ${message}`);
  }

  try {
    const snapshot = await fetchActiveUsageSnapshot(api);
    await writeAccountUsage(name, snapshot);
    api?.log?.info?.(`[account-switcher] post-switch usage fetch succeeded for ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    api?.log?.warn?.(
      `[account-switcher] post-switch usage fetch failed for ${name}: ${message}`,
    );
  }
}

async function tryPublicAuthRefresh(api) {
  const codex = api?.codex;
  if (!codex || typeof codex !== "object") return null;
  for (const method of ["refreshAuth", "reloadAuth", "invalidateAuth"]) {
    if (typeof codex[method] !== "function") continue;
    await codex[method]();
    return method;
  }
  return null;
}

async function deleteAccount(rawName) {
  const { fsp } = nodeDeps();
  const { CURRENT_NAME_PATH } = codexAuthPaths();
  const name = normalizeAccountName(rawName);
  await fsp.rm(accountPath(name), { force: true });

  try {
    const raw = await fsp.readFile(CURRENT_NAME_PATH, "utf8");
    if (raw.trim() === name) {
      await fsp.rm(CURRENT_NAME_PATH, { force: true });
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  return readState({ notice: t("service.removed", { name }) });
}

async function clearActiveAuth(api) {
  const { fsp, path } = nodeDeps();
  const { CODEX_DIR, AUTH_PATH, CURRENT_NAME_PATH } = codexAuthPaths();
  await ensureDir(CODEX_DIR);
  await setTopLevelOpenAIBaseUrl(null);
  if (await pathExists(AUTH_PATH)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await fsp.copyFile(AUTH_PATH, path.join(CODEX_DIR, `auth.account-switcher-backup-${stamp}.json`));
    await fsp.rm(AUTH_PATH, { force: true });
  }
  await fsp.rm(CURRENT_NAME_PATH, { force: true });
  api?.log?.info?.("[account-switcher] cleared active auth file; app relaunch required");
  return readState({
    notice: t("service.sessionCleared"),
    requiresAppRelaunch: true,
  });
}

async function refreshActiveUsage(api) {
  const accounts = await listAccountNames();
  const current = await getCurrentAccountName(accounts);
  if (!current) return readState();
  const snapshot = await fetchActiveUsageSnapshot(api);
  await writeAccountUsage(current, snapshot);
  return readState();
}

async function relaunchCodex(api) {
  api?.log?.info?.("[account-switcher] relaunch requested");
  const electronRequire = eval("require");
  const { app } = electronRequire("electron");
  setTimeout(() => {
    app.relaunch();
    app.exit(0);
  }, 100);
  return readState({ notice: t("service.relaunching") });
}

module.exports = {
  saveCurrentAccount,
  switchAccount,
  deleteAccount,
  clearActiveAuth,
  refreshActiveUsage,
  relaunchCodex,
};
