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
const { fetchActiveUsageSnapshot, fetchUsageSnapshotForAuth, writeAccountUsage } = require("./usage");
const {
  readAuthJson,
  saveAuthSnapshotWithCurrentBaseUrl,
  setTopLevelOpenAIBaseUrl,
  syncOpenAIBaseUrlForAccount,
} = require("./config");
const { protectAuthFile, readAuthSnapshotFile } = require("../security");

async function saveCurrentAccount(rawName) {
  const { fsp } = nodeDeps();
  const { AUTH_PATH, ACCOUNTS_DIR, CURRENT_NAME_PATH } = codexAuthPaths();
  const name = normalizeAccountName(rawName);
  if (!(await pathExists(AUTH_PATH))) {
    throw new Error(`No active Codex auth file found at ${AUTH_PATH}`);
  }
  await ensureDir(ACCOUNTS_DIR);
  await saveAuthSnapshotWithCurrentBaseUrl(AUTH_PATH, accountPath(name));
  await protectAuthFile(accountPath(name));
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
  const snapshot = await readAuthSnapshotFile(source, `Saved account ${name}`);
  await fsp.writeFile(AUTH_PATH, snapshot.raw, "utf8");
  await protectAuthFile(AUTH_PATH);
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
    await fetchActiveUsageSnapshot(api);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    api?.log?.warn?.(`[account-switcher] post-switch live usage nudge failed: ${message}`);
  }

  try {
    await refreshUsageForSavedAccount(name, api, { allowLiveFallback: true });
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

async function refreshUsageForSavedAccount(name, api, options = {}) {
  const { allowLiveFallback = false } = options;
  try {
    const { readAuthJson } = require("./config");
    const auth = await readAuthJson(accountPath(name), `Saved account ${name}`);
    const snapshot = await fetchUsageSnapshotForAuth(auth, api);
    await writeAccountUsage(name, snapshot);
    return snapshot;
  } catch (error) {
    if (!allowLiveFallback) throw error;
    const snapshot = await fetchActiveUsageSnapshot(api);
    await writeAccountUsage(name, snapshot);
    return snapshot;
  }
}

async function refreshAllSavedAccountUsage(api) {
  const accounts = await listAccountNames();
  const current = await getCurrentAccountName(accounts);
  for (const name of accounts) {
    try {
      await refreshUsageForSavedAccount(name, api, { allowLiveFallback: name === current });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      api?.log?.warn?.(`[account-switcher] usage fetch failed for ${name}: ${message}`);
    }
  }
}

async function refreshActiveUsage(api) {
  await refreshAllSavedAccountUsage(api);
  return maybeFailover(api);
}

let failoverBusy = false;

async function maybeFailover(api) {
  const { readAutoswitchEnabled } = require("./settings");
  const { isUsageExhausted, pickFailoverAccount } = require("./failover");
  if (failoverBusy) return readState();
  if (!(await readAutoswitchEnabled())) return readState();

  failoverBusy = true;
  try {
    let state = await readState();
    const visited = new Set();
    let from = state.current;
    while (state.current && isUsageExhausted(state.accountUsage?.[state.current])) {
      if (visited.has(state.current)) break;
      visited.add(state.current);
      const next = pickFailoverAccount(
        state.current,
        state.accounts,
        state.accountUsage,
        visited,
      );
      if (!next) break;
      api?.log?.info?.(
        `[account-switcher] quota empty on ${state.current}; auto-switching to ${next}`,
      );
      state = await switchAccount(next, api);
      from = from || state.current;
    }
    if (visited.size && state.current && !visited.has(state.current)) {
      return {
        ...state,
        notice: t("service.autoSwitched", { from: [...visited][0], to: state.current }),
        autoSwitched: true,
      };
    }
    return state;
  } finally {
    failoverBusy = false;
  }
}

async function setAutoswitchEnabled(enabled) {
  const { writeAutoswitchEnabled } = require("./settings");
  const value = await writeAutoswitchEnabled(enabled);
  return readState({ notice: value ? t("profile.autoSwitchOn") : t("profile.autoSwitchOff") });
}


async function addAccountWithoutRelaunch(api) {
  const { ensureAutosavedActiveAccount } = require("./storage");
  const { runChatGptLogin, saveIncomingAccount } = require("./login");
  const { fsp } = nodeDeps();
  const { AUTH_PATH } = codexAuthPaths();
  const liveBefore = await pathExists(AUTH_PATH)
    ? await fsp.readFile(AUTH_PATH, "utf8")
    : null;
  await ensureAutosavedActiveAccount();
  const auth = await runChatGptLogin(api);
  const saved = await saveIncomingAccount(auth);
  if (liveBefore != null) {
    const liveAfter = await fsp.readFile(AUTH_PATH, "utf8");
    if (liveAfter !== liveBefore) {
      await fsp.writeFile(AUTH_PATH, liveBefore, "utf8");
      api?.log?.warn?.("[account-switcher] restored live auth.json after add-account");
    }
  }
  const notice = saved.updated
    ? t("service.updated", { name: saved.name })
    : t("service.added", { name: saved.name });
  api?.log?.info?.(`[account-switcher] added account snapshot ${saved.name} without touching live session`);
  try {
    await refreshUsageForSavedAccount(saved.name, api, { allowLiveFallback: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    api?.log?.warn?.(`[account-switcher] usage fetch failed for new account ${saved.name}: ${message}`);
  }
  return readState({ notice, requiresAppRelaunch: false });
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
  addAccountWithoutRelaunch,
  maybeFailover,
  setAutoswitchEnabled,
};
