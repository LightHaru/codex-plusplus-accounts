var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};

// src/constants.js
var require_constants = __commonJS({
  "src/constants.js"(exports2, module2) {
    var GLOBAL_SERVICE_KEY2 = "__codexpp_account_switcher_service__";
    var IPC_HANDLER_KEY2 = "__codexpp_account_switcher_ipc_handler__";
    var IPC_CHANNEL2 = "account-switcher";
    var ACCOUNT_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
    module2.exports = { GLOBAL_SERVICE_KEY: GLOBAL_SERVICE_KEY2, IPC_HANDLER_KEY: IPC_HANDLER_KEY2, IPC_CHANNEL: IPC_CHANNEL2, ACCOUNT_NAME_PATTERN };
  }
});

// src/node-utils.js
var require_node_utils = __commonJS({
  "src/node-utils.js"(exports2, module2) {
    var { ACCOUNT_NAME_PATTERN } = require_constants();
    function nodeDeps2() {
      return {
        fs: require("node:fs"),
        fsp: require("node:fs/promises"),
        os: require("node:os"),
        path: require("node:path")
      };
    }
    function codexAuthPaths2() {
      const { os, path } = nodeDeps2();
      const CODEX_DIR = path.join(os.homedir(), ".codex");
      return {
        CODEX_DIR,
        AUTH_PATH: path.join(CODEX_DIR, "auth.json"),
        CONFIG_PATH: path.join(CODEX_DIR, "config.toml"),
        ACCOUNTS_DIR: path.join(CODEX_DIR, "auth_accounts"),
        USAGE_CACHE_PATH: path.join(CODEX_DIR, "auth_accounts_usage.json"),
        CURRENT_NAME_PATH: path.join(CODEX_DIR, "current_account"),
        AUTOSWITCH_PATH: path.join(CODEX_DIR, "auth_accounts_autoswitch.json")
      };
    }
    function normalizeAccountName2(rawName) {
      if (typeof rawName !== "string") throw new Error("Account name is required.");
      const name = rawName.trim().replace(/\.json$/i, "");
      if (!ACCOUNT_NAME_PATTERN.test(name)) {
        throw new Error(
          "Use letters, numbers, dots, underscores, or dashes. The name must start with a letter or number."
        );
      }
      return name;
    }
    function accountPath2(name) {
      const { path } = nodeDeps2();
      const { assertInsideDir, isSafeAccountName } = require_security();
      const { ACCOUNTS_DIR } = codexAuthPaths2();
      if (!isSafeAccountName(name)) throw new Error("Invalid account name.");
      return assertInsideDir(ACCOUNTS_DIR, path.join(ACCOUNTS_DIR, `${name}.json`));
    }
    async function ensureDir2(dir) {
      const { fsp } = nodeDeps2();
      await fsp.mkdir(dir, { recursive: true });
    }
    async function pathExists2(target) {
      const { fs, fsp } = nodeDeps2();
      try {
        await fsp.access(target, fs.constants.F_OK);
        return true;
      } catch {
        return false;
      }
    }
    module2.exports = { nodeDeps: nodeDeps2, codexAuthPaths: codexAuthPaths2, normalizeAccountName: normalizeAccountName2, accountPath: accountPath2, ensureDir: ensureDir2, pathExists: pathExists2 };
  }
});

// src/security.js
var require_security = __commonJS({
  "src/security.js"(exports2, module2) {
    var { ACCOUNT_NAME_PATTERN } = require_constants();
    var AUTH_SNAPSHOT_MAX_BYTES = 256 * 1024;
    var USAGE_RESPONSE_MAX_BYTES2 = 1024 * 1024;
    var USAGE_HOSTS = /* @__PURE__ */ new Set(["chatgpt.com", "www.chatgpt.com"]);
    function redactSecrets(value) {
      return String(value ?? "").replace(/Bearer\s+\S+/gi, "Bearer [redacted]").replace(/eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9._-]+/g, "[redacted-jwt]").replace(/sk-[a-zA-Z0-9]{8,}/g, "[redacted-key]").replace(/rt[-_][a-zA-Z0-9_-]{8,}/gi, "[redacted-refresh]").replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]").replace(/(?:[A-Za-z]:)?(?:\\|\/)(?:Users|home)(?:\\|\/)[^\s"'\]]+/gi, "[redacted-path]");
    }
    function isSafeAccountName(name) {
      return typeof name === "string" && ACCOUNT_NAME_PATTERN.test(name) && !name.includes("..");
    }
    function assertInsideDir(dir, target) {
      const { path } = require_node_utils().nodeDeps();
      const root = path.resolve(dir);
      const resolved = path.resolve(target);
      const rel = path.relative(root, resolved);
      if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
        throw new Error("Blocked path outside the accounts folder.");
      }
      return resolved;
    }
    async function protectAuthFile2(filePath) {
      const { fsp } = require_node_utils().nodeDeps();
      try {
        await fsp.chmod(filePath, 384);
      } catch {
      }
    }
    function isAuthSnapshot(auth) {
      if (!auth || typeof auth !== "object" || Array.isArray(auth)) return false;
      const tokens = auth.tokens;
      const hasAccess = tokens && typeof tokens === "object" && typeof tokens.access_token === "string" && tokens.access_token.length > 0;
      const hasKey = typeof auth.OPENAI_API_KEY === "string" && auth.OPENAI_API_KEY.length > 0;
      return Boolean(hasAccess || hasKey);
    }
    async function readAuthSnapshotFile2(filePath, label) {
      const { fs, fsp } = require_node_utils().nodeDeps();
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
      return { auth, raw: `${JSON.stringify(auth, null, 2)}
` };
    }
    async function writeAuthSnapshotFile2(filePath, auth) {
      if (!isAuthSnapshot(auth)) throw new Error("Refusing to write an invalid auth snapshot.");
      const raw = `${JSON.stringify(auth, null, 2)}
`;
      if (Buffer.byteLength(raw, "utf8") > AUTH_SNAPSHOT_MAX_BYTES) {
        throw new Error("Auth snapshot is too large to write.");
      }
      await writeFileAtomic(filePath, raw);
      await protectAuthFile2(filePath);
    }
    async function writeFileAtomic(filePath, raw) {
      const { fsp } = require_node_utils().nodeDeps();
      const tempPath = `${filePath}.tmp`;
      await fsp.writeFile(tempPath, raw, "utf8");
      try {
        await fsp.rename(tempPath, filePath);
      } catch {
        await fsp.copyFile(tempPath, filePath);
        await fsp.rm(tempPath, { force: true });
      }
    }
    function isAllowedUsageUrl2(urlLike, base) {
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
    function isSafeLoginNavigation2(url) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol === "https:") return !isIpHostname(parsed.hostname);
        if (parsed.protocol === "http:" && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") && parsed.port === "1455") {
          return true;
        }
        return false;
      } catch {
        return false;
      }
    }
    module2.exports = {
      AUTH_SNAPSHOT_MAX_BYTES,
      USAGE_RESPONSE_MAX_BYTES: USAGE_RESPONSE_MAX_BYTES2,
      USAGE_HOSTS,
      redactSecrets,
      isSafeAccountName,
      assertInsideDir,
      protectAuthFile: protectAuthFile2,
      isAuthSnapshot,
      readAuthSnapshotFile: readAuthSnapshotFile2,
      writeAuthSnapshotFile: writeAuthSnapshotFile2,
      writeFileAtomic,
      isAllowedUsageUrl: isAllowedUsageUrl2,
      isSafeLoginNavigation: isSafeLoginNavigation2,
      isIpHostname
    };
  }
});

// src/utils.js
var require_utils = __commonJS({
  "src/utils.js"(exports2, module2) {
    var { redactSecrets } = require_security();
    function ok(state) {
      return { ok: true, state };
    }
    function fail(error) {
      return { ok: false, error: redactSecrets(error) };
    }
    function errorMessage(error) {
      return redactSecrets(error instanceof Error ? error.message : String(error));
    }
    function stringifyError(error) {
      const text = error instanceof Error ? error.stack || error.message : String(error);
      return redactSecrets(text);
    }
    module2.exports = { ok, fail, errorMessage, stringifyError };
  }
});

// src/i18n.js
var require_i18n = __commonJS({
  "src/i18n.js"(exports2, module2) {
    var STRINGS = {
      "accounts.pageTitle": "Accounts",
      "accounts.pageSubtitle": "Switch, add, or remove ChatGPT sessions without restarting.",
      "accounts.loading": "Loading saved accounts...",
      "accounts.refresh": "Refresh accounts",
      "accounts.add": "Add account",
      "accounts.confirmTitle": "Add another account?",
      "accounts.confirmMessage": "A sign-in window will open. The account you are using stays logged in.",
      "accounts.cancel": "Cancel",
      "accounts.confirmAdd": "Continue",
      "accounts.saved": "Saved accounts",
      "accounts.noSaved": "No saved accounts",
      "accounts.noSession": "No active session",
      "accounts.addHint": "Add an account from a sign-in window. The current session stays open.",
      "accounts.current": "Current",
      "accounts.currentSession": "Current session",
      "accounts.usageUnavailable": "Usage not checked",
      "accounts.switch": "Switch",
      "accounts.remove": "Remove",
      "accounts.actions": "Actions for {account}",
      "accounts.switchAccount": "Switch account",
      "accounts.removeAccount": "Remove account",
      "accounts.removing": "Removing account...",
      "accounts.switching": "Switching account...",
      "accounts.preparingSignIn": "Preparing sign-in...",
      "accounts.selected": "selected account",
      "accounts.switched": "Switched to {email}.",
      "accounts.switchedRelaunching": "Switched to {email}. Relaunching Codex...",
      "accounts.sessionClearedRelaunching": "Session cleared. Relaunching Codex for sign-in...",
      "accounts.relaunchFailed": "Relaunch failed: {error}",
      "profile.heading": "Accounts",
      "profile.usageRemaining": "Usage remaining",
      "profile.connected": "{n} connected subscriptions",
      "profile.addSubscription": "Add another subscription",
      "profile.resets": "Resets {when}",
      "profile.primary": "Primary",
      "profile.switching": "Switching...",
      "profile.switchTo": "Switch to {name}",
      "profile.signingIn": "Sign in to add an account...",
      "profile.addCancelled": "Sign-in cancelled.",
      "profile.addFailed": "Could not add account: {error}",
      "profile.switchFailed": "Could not switch: {error}",
      "profile.autoSwitch": "Auto-switch when quota runs out",
      "profile.autoSwitchOn": "On",
      "profile.autoSwitchOff": "Off",
      "service.added": "Added {name}. Current account is unchanged.",
      "service.updated": "Updated saved account {name}. Current account is unchanged.",
      "service.saved": "Saved current account as {name}.",
      "service.switched": "Switched to {name}.",
      "service.autoSwitched": "Quota empty on {from}. Switched to {to}.",
      "service.removed": "Removed saved account {name}.",
      "service.sessionCleared": "Session cleared. Relaunching Codex for sign-in.",
      "service.relaunching": "Relaunching Codex..."
    };
    function t2(key, params = {}) {
      const template = STRINGS[key] || key;
      return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name) => {
        return Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match;
      });
    }
    module2.exports = { t: t2 };
  }
});

// src/account/auth.js
var require_auth = __commonJS({
  "src/account/auth.js"(exports2, module2) {
    function emailFromAuthString(raw) {
      try {
        return emailFromAuth(JSON.parse(raw));
      } catch {
        return null;
      }
    }
    function emailFromAuth(auth) {
      return profileFromAuth2(auth).email || null;
    }
    function profileFromAuthString(raw) {
      try {
        return profileFromAuth2(JSON.parse(raw));
      } catch {
        return {};
      }
    }
    function profileFromAuth2(auth) {
      const direct = auth?.email || auth?.user?.email || auth?.account?.email;
      const profile = {};
      if (typeof direct === "string" && direct.includes("@")) profile.email = direct;
      const idToken = auth?.tokens?.id_token;
      if (typeof idToken !== "string") {
        if (typeof direct === "string" && direct.includes("@")) profile.email = direct;
        return profile;
      }
      const [, payload] = idToken.split(".");
      if (!payload) return profile;
      try {
        const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
        const authClaims = claims["https://api.openai.com/auth"];
        if (typeof claims.email === "string" && claims.email.includes("@")) {
          profile.email = claims.email;
        } else if (typeof direct === "string" && direct.includes("@")) {
          profile.email = direct;
        }
        if (typeof claims.name === "string" && claims.name.trim()) profile.name = claims.name.trim();
        if (typeof authClaims?.chatgpt_plan_type === "string") {
          profile.plan = authClaims.chatgpt_plan_type;
        }
        const defaultOrganization = Array.isArray(authClaims?.organizations) ? authClaims.organizations.find((organization) => organization?.is_default) : null;
        if (typeof defaultOrganization?.title === "string") {
          profile.organization = defaultOrganization.title;
        }
        return profile;
      } catch {
        return profile;
      }
    }
    module2.exports = { emailFromAuthString, emailFromAuth, profileFromAuthString, profileFromAuth: profileFromAuth2 };
  }
});

// src/account/storage.js
var require_storage = __commonJS({
  "src/account/storage.js"(exports2, module2) {
    var {
      nodeDeps: nodeDeps2,
      codexAuthPaths: codexAuthPaths2,
      accountPath: accountPath2,
      ensureDir: ensureDir2,
      pathExists: pathExists2
    } = require_node_utils();
    var { emailFromAuthString } = require_auth();
    var { isSafeAccountName } = require_security();
    async function listAccountNames2() {
      const { fsp } = nodeDeps2();
      const { ACCOUNTS_DIR } = codexAuthPaths2();
      if (!await pathExists2(ACCOUNTS_DIR)) return [];
      const entries = await fsp.readdir(ACCOUNTS_DIR, { withFileTypes: true });
      return entries.filter((entry) => entry.isFile() && !entry.isSymbolicLink() && entry.name.endsWith(".json")).map((entry) => entry.name.replace(/\.json$/i, "")).filter((name) => isSafeAccountName(name)).sort((a, b) => a.localeCompare(b, void 0, { sensitivity: "base" }));
    }
    async function getCurrentAccountName2(accounts) {
      const { fsp, path } = nodeDeps2();
      const { AUTH_PATH, ACCOUNTS_DIR, CURRENT_NAME_PATH } = codexAuthPaths2();
      if (!await pathExists2(AUTH_PATH)) return null;
      const matched = await findMatchingAccountByContents(accounts);
      if (matched) return matched;
      try {
        const raw = await fsp.readFile(CURRENT_NAME_PATH, "utf8");
        const name = raw.trim();
        if (name && accounts.includes(name)) return name;
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
      if (!await pathExists2(AUTH_PATH)) return null;
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
      }
      return null;
    }
    async function findMatchingAccountByContents(accounts) {
      const { fsp } = nodeDeps2();
      const { AUTH_PATH } = codexAuthPaths2();
      let active;
      try {
        active = await fsp.readFile(AUTH_PATH, "utf8");
      } catch {
        return null;
      }
      for (const name of accounts) {
        try {
          const saved = await fsp.readFile(accountPath2(name), "utf8");
          if (saved === active) return name;
        } catch {
        }
      }
      return null;
    }
    async function accountContentsMatchActive(contents) {
      const { fsp } = nodeDeps2();
      const { AUTH_PATH } = codexAuthPaths2();
      try {
        return await fsp.readFile(AUTH_PATH, "utf8") === contents;
      } catch {
        return false;
      }
    }
    async function ensureAutosavedActiveAccount() {
      const { fsp } = nodeDeps2();
      const { AUTH_PATH, ACCOUNTS_DIR, CURRENT_NAME_PATH } = codexAuthPaths2();
      if (!await pathExists2(AUTH_PATH)) return null;
      const accounts = await listAccountNames2();
      const matched = await findMatchingAccountByContents(accounts);
      if (matched) {
        await fsp.writeFile(CURRENT_NAME_PATH, `${matched}
`, "utf8");
        return matched;
      }
      const active = await fsp.readFile(AUTH_PATH, "utf8");
      const sameEmail = await findMatchingAccountByEmail2(accounts, active);
      const { readAuthSnapshotFile: readAuthSnapshotFile2, writeAuthSnapshotFile: writeAuthSnapshotFile2 } = require_security();
      const live = await readAuthSnapshotFile2(AUTH_PATH, "Active auth");
      if (sameEmail) {
        await writeAuthSnapshotFile2(accountPath2(sameEmail), live.auth);
        await fsp.writeFile(CURRENT_NAME_PATH, `${sameEmail}
`, "utf8");
        return sameEmail;
      }
      await ensureDir2(ACCOUNTS_DIR);
      const name = await nextAvailableAccountName2("account");
      await writeAuthSnapshotFile2(accountPath2(name), live.auth);
      await fsp.writeFile(CURRENT_NAME_PATH, `${name}
`, "utf8");
      return name;
    }
    async function findMatchingAccountByEmail2(accounts, activeContents) {
      const activeEmail = emailFromAuthString(activeContents)?.toLowerCase();
      if (!activeEmail) return null;
      const { fsp } = nodeDeps2();
      const { CURRENT_NAME_PATH } = codexAuthPaths2();
      let current = null;
      try {
        current = (await fsp.readFile(CURRENT_NAME_PATH, "utf8")).trim();
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
      const matches = [];
      for (const name of accounts) {
        try {
          const filePath = accountPath2(name);
          const [contents, stat] = await Promise.all([
            fsp.readFile(filePath, "utf8"),
            fsp.stat(filePath)
          ]);
          if (emailFromAuthString(contents)?.toLowerCase() === activeEmail) {
            matches.push({ name, isCurrent: name === current, mtimeMs: stat.mtimeMs });
          }
        } catch {
        }
      }
      matches.sort((a, b) => {
        if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
        if (a.mtimeMs !== b.mtimeMs) return b.mtimeMs - a.mtimeMs;
        return a.name.localeCompare(b.name, void 0, { sensitivity: "base" });
      });
      return matches[0]?.name || null;
    }
    async function nextAvailableAccountName2(baseName) {
      const accounts = new Set(await listAccountNames2());
      if (!accounts.has(baseName)) return baseName;
      for (let index = 2; index < 1e4; index += 1) {
        const name = `${baseName}-${index}`;
        if (!accounts.has(name)) return name;
      }
      throw new Error("Could not find an available account name.");
    }
    module2.exports = {
      listAccountNames: listAccountNames2,
      getCurrentAccountName: getCurrentAccountName2,
      findMatchingAccountByContents,
      findMatchingAccountByEmail: findMatchingAccountByEmail2,
      accountContentsMatchActive,
      ensureAutosavedActiveAccount,
      nextAvailableAccountName: nextAvailableAccountName2
    };
  }
});

// src/account/usage.js
var require_usage = __commonJS({
  "src/account/usage.js"(exports, module) {
    var { nodeDeps, codexAuthPaths, ensureDir } = require_node_utils();
    var { isAllowedUsageUrl, USAGE_RESPONSE_MAX_BYTES } = require_security();
    var USAGE_HOST = "chatgpt.com";
    var USAGE_PATH = "/backend-api/wham/usage";
    async function readAccountUsage(accounts) {
      const { fsp } = nodeDeps();
      const { USAGE_CACHE_PATH } = codexAuthPaths();
      let raw;
      try {
        raw = JSON.parse(await fsp.readFile(USAGE_CACHE_PATH, "utf8"));
      } catch {
        return {};
      }
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
      return Object.fromEntries(
        accounts.map((name) => [name, normalizeUsageSnapshot(raw[name])]).filter(([, usage]) => usage)
      );
    }
    async function writeAccountUsage(name, snapshot) {
      const { fsp } = nodeDeps();
      const { CODEX_DIR, USAGE_CACHE_PATH } = codexAuthPaths();
      const usage = normalizeUsageSnapshot(snapshot);
      if (!usage) return false;
      let cache = {};
      try {
        const raw = JSON.parse(await fsp.readFile(USAGE_CACHE_PATH, "utf8"));
        if (raw && typeof raw === "object" && !Array.isArray(raw)) cache = raw;
      } catch {
      }
      cache[name] = usage;
      await ensureDir(CODEX_DIR);
      await fsp.writeFile(USAGE_CACHE_PATH, `${JSON.stringify(cache, null, 2)}
`, "utf8");
      return true;
    }
    function normalizeUsageSnapshot(snapshot) {
      if (!snapshot || typeof snapshot !== "object") return null;
      const fiveHour = normalizeUsageWindow(snapshot.fiveHour);
      const weekly = normalizeUsageWindow(snapshot.weekly);
      if (!fiveHour && !weekly) return null;
      const at = Number(snapshot.at);
      return {
        fiveHour,
        weekly,
        at: Number.isFinite(at) ? at : Date.now()
      };
    }
    function normalizeUsageWindow(window2) {
      if (!window2 || typeof window2 !== "object") return null;
      const pct = Number(window2.pct);
      if (!Number.isFinite(pct)) return null;
      return {
        label: typeof window2.label === "string" && window2.label ? window2.label : null,
        pct: Math.max(0, Math.min(100, Math.round(pct))),
        resetAt: typeof window2.resetAt === "string" && window2.resetAt ? window2.resetAt : null
      };
    }
    async function fetchActiveUsageSnapshot(api2) {
      if (typeof api2?.fetchActiveUsage === "function") {
        return api2.fetchActiveUsage();
      }
      const usage = await fetchUsageInCodexWebview();
      return snapshotFromUsagePayload(usage);
    }
    function extractAuthCredentials(auth) {
      const tokens = auth?.tokens && typeof auth.tokens === "object" ? auth.tokens : null;
      const accessToken = typeof tokens?.access_token === "string" ? tokens.access_token.trim() : "";
      const accountId = typeof tokens?.account_id === "string" ? tokens.account_id.trim() : "";
      if (!accessToken) throw new Error("No access_token in auth snapshot");
      return { accessToken, accountId };
    }
    function nodeHttps() {
      const nodeRequire = eval("require");
      return nodeRequire("node:https");
    }
    function httpsGetJson(hostname, path, headers, hops = 0) {
      if (!isAllowedUsageUrl(`https://${hostname}${path}`)) {
        return Promise.reject(new Error("Blocked unexpected usage host."));
      }
      if (hops > 3) return Promise.reject(new Error("Too many usage redirects."));
      return new Promise((resolve, reject) => {
        const req = nodeHttps().request(
          {
            hostname,
            path,
            method: "GET",
            headers
          },
          (res) => {
            const chunks = [];
            let size = 0;
            res.on("data", (chunk) => {
              size += chunk.length;
              if (size > USAGE_RESPONSE_MAX_BYTES) {
                req.destroy();
                reject(new Error("Usage response too large."));
                return;
              }
              chunks.push(chunk);
            });
            res.on("end", () => {
              const body = Buffer.concat(chunks).toString("utf8");
              const status = res.statusCode || 0;
              if (status >= 300 && status < 400 && res.headers.location) {
                try {
                  const next = new URL(res.headers.location, `https://${hostname}${path}`);
                  if (!isAllowedUsageUrl(next)) {
                    reject(new Error("Blocked usage redirect off chatgpt.com."));
                    return;
                  }
                  httpsGetJson(next.hostname, `${next.pathname}${next.search}`, headers, hops + 1).then(resolve, reject);
                } catch (error) {
                  reject(error);
                }
                return;
              }
              if (status < 200 || status >= 300) {
                reject(new Error(`HTTP ${status}`));
                return;
              }
              try {
                resolve(JSON.parse(body));
              } catch (error) {
                reject(error);
              }
            });
          }
        );
        req.on("error", reject);
        req.setTimeout(1e4, () => {
          req.destroy();
          reject(new Error("usage request timed out"));
        });
        req.end();
      });
    }
    async function fetchUsageOverHttps(auth) {
      const { accessToken, accountId } = extractAuthCredentials(auth);
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      };
      if (accountId) headers["ChatGPT-Account-Id"] = accountId;
      const payload = await httpsGetJson(USAGE_HOST, USAGE_PATH, headers);
      return snapshotFromUsagePayload(payload);
    }
    async function fetchUsageSnapshotForAuth(auth, api2) {
      if (typeof api2?.fetchUsageWithAuth === "function") {
        return api2.fetchUsageWithAuth(auth);
      }
      if (typeof api2?.fetchActiveUsage === "function") {
        throw new Error("per-account usage mock missing");
      }
      return fetchUsageOverHttps(auth);
    }
    async function fetchUsageInCodexWebview() {
      const electronRequire = eval("require");
      const { webContents } = electronRequire("electron");
      const candidates = webContents.getAllWebContents().filter((wc) => {
        const url = wc.getURL();
        return !wc.isDestroyed() && (url.startsWith("app://") || url.includes("codex"));
      });
      let lastError = null;
      for (const wc of candidates) {
        try {
          return await wc.executeJavaScript(usageFetchScript(), true);
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError || new Error("No Codex webview available for usage fetch.");
    }
    function usageFetchScript() {
      return `(() => new Promise((resolve, reject) => {
    const bridge = window.electronBridge;
    if (typeof bridge?.sendMessageFromView !== "function") {
      reject(new Error("electronBridge unavailable"));
      return;
    }
    const hostId = new URL(window.location.href).searchParams.get("hostId")?.trim() || "local";
    const requestId = "account-switcher-usage-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    let done = false;
    const cleanup = () => {
      done = true;
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timer);
    };
    const finish = (fn, value) => {
      if (done) return;
      cleanup();
      fn(value);
    };
    const onMessage = (event) => {
      const data = event.data;
      if (!data || typeof data !== "object" || data.type !== "fetch-response" || data.requestId !== requestId) return;
      if (data.responseType === "success") {
        try {
          const body = JSON.parse(data.bodyJsonString);
          if (data.status >= 200 && data.status < 300) finish(resolve, body);
          else finish(reject, new Error("HTTP " + data.status));
        } catch (error) {
          finish(reject, error);
        }
      } else {
        finish(reject, new Error(data.error || "fetch failed"));
      }
    };
    const timer = window.setTimeout(() => {
      bridge.sendMessageFromView({ type: "cancel-fetch", requestId }).catch(() => {});
      finish(reject, new Error("usage request timed out"));
    }, 10000);
    window.addEventListener("message", onMessage);
    bridge.sendMessageFromView({
      type: "fetch",
      hostId,
      requestId,
      method: "GET",
      url: "/wham/usage",
    }).catch((error) => finish(reject, error));
  }))();`;
    }
    function snapshotFromUsagePayload(payload) {
      const windows = collectUsageWindows(payload);
      const five = pickClosestUsageWindow(windows, 300, (minutes) => minutes > 0 && minutes < 1440);
      const weekly = pickClosestUsageWindow(windows, 7 * 24 * 60, (minutes) => minutes >= 1440);
      return {
        fiveHour: usageWindowSnapshot(five, "5h"),
        weekly: usageWindowSnapshot(weekly, "Weekly"),
        at: Date.now()
      };
    }
    function collectUsageWindows(value, out = [], seen = /* @__PURE__ */ new WeakSet()) {
      if (!value || typeof value !== "object") return out;
      if (seen.has(value)) return out;
      seen.add(value);
      if ("used_percent" in value && "limit_window_seconds" in value && "reset_at" in value) {
        out.push(value);
      }
      const values = Array.isArray(value) ? value : Object.values(value);
      for (const item of values) collectUsageWindows(item, out, seen);
      return out;
    }
    function pickClosestUsageWindow(windows, targetMinutes, predicate) {
      let best = null;
      let bestDistance = Infinity;
      for (const window2 of windows) {
        const minutes = Number(window2?.limit_window_seconds) / 60;
        if (!Number.isFinite(minutes) || !predicate(minutes)) continue;
        const distance = Math.abs(minutes - targetMinutes);
        if (!best || distance < bestDistance) {
          best = window2;
          bestDistance = distance;
        }
      }
      return best;
    }
    function usageWindowSnapshot(window2, label) {
      if (!window2 || typeof window2 !== "object") return null;
      const used = Number(window2.used_percent);
      if (!Number.isFinite(used)) return null;
      const resetAt = formatUsageResetAt(window2.reset_at, Number(window2.limit_window_seconds) >= 86400);
      return {
        label,
        pct: Math.round(Math.min(Math.max(100 - used, 0), 100)),
        resetAt
      };
    }
    function formatUsageResetAt(epochSeconds, includeDay) {
      const seconds = Number(epochSeconds);
      if (!Number.isFinite(seconds)) return null;
      const date = new Date(seconds * 1e3);
      if (!Number.isFinite(date.getTime())) return null;
      return date.toLocaleString("vi-VN", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Saigon"
      });
    }
    module.exports = {
      readAccountUsage,
      writeAccountUsage,
      normalizeUsageSnapshot,
      normalizeUsageWindow,
      fetchActiveUsageSnapshot,
      fetchUsageSnapshotForAuth,
      snapshotFromUsagePayload
    };
  }
});

// src/account/settings.js
var require_settings = __commonJS({
  "src/account/settings.js"(exports2, module2) {
    var { nodeDeps: nodeDeps2, codexAuthPaths: codexAuthPaths2, ensureDir: ensureDir2 } = require_node_utils();
    async function readAutoswitchEnabled() {
      const { fsp } = nodeDeps2();
      const { AUTOSWITCH_PATH } = codexAuthPaths2();
      try {
        const raw = JSON.parse(await fsp.readFile(AUTOSWITCH_PATH, "utf8"));
        if (raw && typeof raw.enabled === "boolean") return raw.enabled;
      } catch {
      }
      return true;
    }
    async function writeAutoswitchEnabled(enabled) {
      const { fsp } = nodeDeps2();
      const { CODEX_DIR, AUTOSWITCH_PATH } = codexAuthPaths2();
      await ensureDir2(CODEX_DIR);
      await fsp.writeFile(
        AUTOSWITCH_PATH,
        `${JSON.stringify({ enabled: Boolean(enabled) }, null, 2)}
`,
        "utf8"
      );
      return Boolean(enabled);
    }
    module2.exports = { readAutoswitchEnabled, writeAutoswitchEnabled };
  }
});

// src/account/state.js
var require_state = __commonJS({
  "src/account/state.js"(exports2, module2) {
    var { nodeDeps: nodeDeps2, codexAuthPaths: codexAuthPaths2, accountPath: accountPath2, pathExists: pathExists2 } = require_node_utils();
    var { profileFromAuthString } = require_auth();
    var {
      accountContentsMatchActive,
      ensureAutosavedActiveAccount,
      getCurrentAccountName: getCurrentAccountName2,
      listAccountNames: listAccountNames2
    } = require_storage();
    var { readAccountUsage: readAccountUsage2 } = require_usage();
    var { readAutoswitchEnabled } = require_settings();
    async function readState2(extra = {}) {
      const { AUTH_PATH } = codexAuthPaths2();
      await ensureAutosavedActiveAccount();
      const allAccounts = await listAccountNames2();
      const visibleAccounts = await selectVisibleAccounts(allAccounts);
      const accounts = visibleAccounts.map((account) => account.name);
      const current = await getCurrentAccountName2(accounts);
      const hasActiveAuth = await pathExists2(AUTH_PATH);
      const accountEmails = Object.fromEntries(
        visibleAccounts.map(({ name, email }) => [name, email]).filter(([, email]) => email)
      );
      const accountProfiles = Object.fromEntries(
        visibleAccounts.map(({ name, profile }) => [name, profile]).filter(([, profile]) => profile && Object.keys(profile).length)
      );
      const accountUsage = await readAccountUsage2(accounts);
      const autoswitchEnabled = await readAutoswitchEnabled();
      return {
        accounts,
        accountEmails,
        accountProfiles,
        accountUsage,
        autoswitchEnabled,
        current,
        hasActiveAuth,
        ...extra
      };
    }
    async function selectVisibleAccounts(accounts) {
      const details = await Promise.all(accounts.map(readAccountDetails));
      const byIdentity = /* @__PURE__ */ new Map();
      for (const detail of details) {
        const key = detail.email ? `email:${detail.email.toLowerCase()}` : `name:${detail.name}`;
        const existing = byIdentity.get(key);
        if (!existing || compareAccountPreference(detail, existing) < 0) {
          byIdentity.set(key, detail);
        }
      }
      return Array.from(byIdentity.values()).sort(
        (a, b) => a.name.localeCompare(b.name, void 0, { sensitivity: "base" })
      );
    }
    async function readAccountDetails(name) {
      const { fsp } = nodeDeps2();
      let raw = null;
      let mtimeMs = 0;
      try {
        const filePath = accountPath2(name);
        const [contents, stat] = await Promise.all([
          fsp.readFile(filePath, "utf8"),
          fsp.stat(filePath)
        ]);
        raw = contents;
        mtimeMs = stat.mtimeMs;
      } catch {
      }
      const profile = raw ? profileFromAuthString(raw) : null;
      return {
        name,
        profile,
        email: profile?.email || null,
        isActive: raw ? await accountContentsMatchActive(raw) : false,
        mtimeMs
      };
    }
    function compareAccountPreference(left, right) {
      if (left.isActive !== right.isActive) return left.isActive ? -1 : 1;
      if (left.mtimeMs !== right.mtimeMs) return right.mtimeMs - left.mtimeMs;
      return left.name.localeCompare(right.name, void 0, { sensitivity: "base" });
    }
    module2.exports = { readState: readState2, selectVisibleAccounts };
  }
});

// src/account/config.js
var require_config = __commonJS({
  "src/account/config.js"(exports2, module2) {
    var { nodeDeps: nodeDeps2, codexAuthPaths: codexAuthPaths2, ensureDir: ensureDir2 } = require_node_utils();
    async function saveAuthSnapshotWithCurrentBaseUrl2(sourcePath, targetPath) {
      const { readAuthSnapshotFile: readAuthSnapshotFile2, writeAuthSnapshotFile: writeAuthSnapshotFile2 } = require_security();
      const snapshot = await readAuthSnapshotFile2(sourcePath, "Active auth");
      const auth = snapshot.auth;
      const currentBaseUrl = await readCurrentOpenAIBaseUrl();
      if (isApiKeyAuth(auth) && currentBaseUrl && !accountOpenAIBaseUrl(auth)) {
        auth.base_url = currentBaseUrl;
      }
      await writeAuthSnapshotFile2(targetPath, auth);
    }
    async function readAuthJson2(filePath, label) {
      const { readAuthSnapshotFile: readAuthSnapshotFile2 } = require_security();
      const snapshot = await readAuthSnapshotFile2(filePath, label);
      return snapshot.auth;
    }
    async function syncOpenAIBaseUrlForAccount2(auth) {
      if (!isApiKeyAuth(auth)) {
        await setTopLevelOpenAIBaseUrl2(null);
        return;
      }
      const baseUrl = accountOpenAIBaseUrl(auth);
      if (baseUrl) await setTopLevelOpenAIBaseUrl2(baseUrl);
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
      const { fsp } = nodeDeps2();
      const { CONFIG_PATH } = codexAuthPaths2();
      try {
        return readTopLevelTomlString(await fsp.readFile(CONFIG_PATH, "utf8"), "openai_base_url");
      } catch (error) {
        if (error?.code === "ENOENT") return null;
        throw error;
      }
    }
    async function setTopLevelOpenAIBaseUrl2(baseUrl) {
      const { fsp } = nodeDeps2();
      const { CODEX_DIR, CONFIG_PATH } = codexAuthPaths2();
      await ensureDir2(CODEX_DIR);
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
    module2.exports = {
      saveAuthSnapshotWithCurrentBaseUrl: saveAuthSnapshotWithCurrentBaseUrl2,
      readAuthJson: readAuthJson2,
      syncOpenAIBaseUrlForAccount: syncOpenAIBaseUrlForAccount2,
      setTopLevelOpenAIBaseUrl: setTopLevelOpenAIBaseUrl2,
      accountOpenAIBaseUrl
    };
  }
});

// src/account/failover.js
var require_failover = __commonJS({
  "src/account/failover.js"(exports2, module2) {
    function windowPct(usage, key) {
      const pct = usage?.[key]?.pct;
      return typeof pct === "number" && Number.isFinite(pct) ? pct : null;
    }
    function isUsageExhausted(usage) {
      if (!usage) return false;
      const weekly = windowPct(usage, "weekly");
      const five = windowPct(usage, "fiveHour");
      if (weekly === 0) return true;
      if (five === 0) return true;
      return false;
    }
    function remainingScore(usage) {
      if (!usage || isUsageExhausted(usage)) return 0;
      const weekly = windowPct(usage, "weekly");
      const five = windowPct(usage, "fiveHour");
      if (weekly == null && five == null) return 0;
      if (weekly == null) return five;
      if (five == null) return weekly;
      return Math.min(weekly, five);
    }
    function hasUsageRemaining(usage) {
      return remainingScore(usage) > 0;
    }
    function pickFailoverAccount(current, accounts, accountUsage, visited = /* @__PURE__ */ new Set()) {
      if (!isUsageExhausted(accountUsage?.[current])) return null;
      const names = Array.isArray(accounts) ? accounts : [];
      const candidates2 = names.filter((name) => {
        if (!name || name === current) return false;
        if (visited.has(name)) return false;
        return hasUsageRemaining(accountUsage?.[name]);
      });
      candidates2.sort((a, b) => {
        const diff = remainingScore(accountUsage[b]) - remainingScore(accountUsage[a]);
        if (diff) return diff;
        return a.localeCompare(b, void 0, { sensitivity: "base" });
      });
      return candidates2[0] || null;
    }
    module2.exports = {
      isUsageExhausted,
      hasUsageRemaining,
      remainingScore,
      pickFailoverAccount
    };
  }
});

// src/account/login.js
var require_login = __commonJS({
  "src/account/login.js"(exports, module) {
    var { profileFromAuth } = require_auth();
    var { nodeDeps, accountPath, ensureDir } = require_node_utils();
    var { isSafeLoginNavigation, writeAuthSnapshotFile } = require_security();
    var {
      nextAvailableAccountName,
      findMatchingAccountByEmail,
      listAccountNames
    } = require_storage();
    var CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
    var ISSUER = "https://auth.openai.com";
    var REDIRECT_URI = "http://localhost:1455/auth/callback";
    var SCOPE = "openid profile email offline_access api.connectors.read api.connectors.invoke";
    var ORIGINATOR = "codex_cli_rs";
    var PARTITION = "persist:codexpp-add-account";
    var LOGIN_TIMEOUT_MS = 5 * 60 * 1e3;
    var inflight = null;
    function electron() {
      const electronRequire = eval("require");
      return electronRequire("electron");
    }
    function nodeHttps() {
      const nodeRequire = eval("require");
      return nodeRequire("node:https");
    }
    function nodeCrypto() {
      const nodeRequire = eval("require");
      return nodeRequire("node:crypto");
    }
    var TOKEN_RESPONSE_MAX_BYTES = 256 * 1024;
    function base64url(buffer) {
      return Buffer.from(buffer).toString("base64url");
    }
    function generatePkce() {
      const verifier = base64url(nodeCrypto().randomBytes(32));
      const challenge = base64url(nodeCrypto().createHash("sha256").update(verifier).digest());
      return { verifier, challenge };
    }
    function generateState() {
      return base64url(nodeCrypto().randomBytes(32));
    }
    function buildAuthorizeUrl(challenge, state) {
      const query = new URLSearchParams({
        response_type: "code",
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        scope: SCOPE,
        code_challenge: challenge,
        code_challenge_method: "S256",
        id_token_add_organizations: "true",
        codex_cli_simplified_flow: "true",
        state,
        originator: ORIGINATOR
      });
      return `${ISSUER}/oauth/authorize?${query.toString()}`;
    }
    function isCallbackUrl(url) {
      return typeof url === "string" && url.startsWith(REDIRECT_URI);
    }
    function parseCallback(url) {
      const parsed = new URL(url);
      return {
        code: parsed.searchParams.get("code") || "",
        state: parsed.searchParams.get("state") || "",
        error: parsed.searchParams.get("error") || "",
        errorDescription: parsed.searchParams.get("error_description") || ""
      };
    }
    function postForm(pathname, fields) {
      const body = new URLSearchParams(fields).toString();
      return new Promise((resolve, reject) => {
        const req = nodeHttps().request(
          {
            hostname: "auth.openai.com",
            path: pathname,
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "Content-Length": Buffer.byteLength(body)
            }
          },
          (res) => {
            const chunks = [];
            let size = 0;
            res.on("data", (chunk) => {
              size += chunk.length;
              if (size > TOKEN_RESPONSE_MAX_BYTES) {
                req.destroy();
                reject(new Error("Token response too large."));
                return;
              }
              chunks.push(chunk);
            });
            res.on("end", () => {
              resolve({
                status: res.statusCode || 0,
                body: Buffer.concat(chunks).toString("utf8")
              });
            });
          }
        );
        req.on("error", reject);
        req.write(body);
        req.end();
      });
    }
    async function exchangeCodeForTokens(code, verifier) {
      const { status, body } = await postForm("/oauth/token", {
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        code_verifier: verifier
      });
      if (status < 200 || status >= 300) {
        throw new Error(`Token exchange failed (${status})`);
      }
      let json;
      try {
        json = JSON.parse(body);
      } catch {
        throw new Error("Token exchange returned invalid JSON.");
      }
      if (!json.id_token || !json.access_token || !json.refresh_token) {
        throw new Error("Token exchange missed id/access/refresh tokens.");
      }
      return json;
    }
    async function obtainApiKey(idToken) {
      try {
        const { status, body } = await postForm("/oauth/token", {
          grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
          client_id: CLIENT_ID,
          requested_token: "openai-api-key",
          subject_token: idToken,
          subject_token_type: "urn:ietf:params:oauth:token-type:id_token"
        });
        if (status < 200 || status >= 300) return null;
        const json = JSON.parse(body);
        return typeof json.access_token === "string" ? json.access_token : null;
      } catch {
        return null;
      }
    }
    function chatgptAccountId(idToken) {
      try {
        const payload = JSON.parse(
          Buffer.from(String(idToken).split(".")[1], "base64url").toString("utf8")
        );
        const claims = payload["https://api.openai.com/auth"] || {};
        return typeof claims.chatgpt_account_id === "string" ? claims.chatgpt_account_id : null;
      } catch {
        return null;
      }
    }
    function buildAuthJson(tokens, apiKey) {
      const accountId = chatgptAccountId(tokens.id_token);
      const auth = {
        auth_mode: "chatgpt",
        OPENAI_API_KEY: apiKey || null,
        tokens: {
          id_token: tokens.id_token,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token
        },
        last_refresh: (/* @__PURE__ */ new Date()).toISOString()
      };
      if (accountId) auth.tokens.account_id = accountId;
      return auth;
    }
    function sanitizeAccountName(raw) {
      let name = String(raw || "account").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "").replace(/^[^a-zA-Z0-9]+/, "").slice(0, 60);
      if (!name) name = "account";
      return name;
    }
    async function saveIncomingAccount(auth) {
      const { fsp } = nodeDeps();
      const { ACCOUNTS_DIR } = require_node_utils().codexAuthPaths();
      await ensureDir(ACCOUNTS_DIR);
      const raw = `${JSON.stringify(auth, null, 2)}
`;
      const accounts = await listAccountNames();
      const existing = await findMatchingAccountByEmail(accounts, raw);
      const profile = profileFromAuth(auth);
      let name = existing;
      if (!name) {
        const base = sanitizeAccountName(profile.name || profile.email?.split("@")[0] || "account");
        name = await nextAvailableAccountName(base);
      }
      await writeAuthSnapshotFile(accountPath(name), auth);
      return { name, profile, updated: Boolean(existing) };
    }
    function openLoginWindow(authUrl, expectedState, verifier) {
      const { BrowserWindow, session } = electron();
      const parent = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
      const ses = session.fromPartition(PARTITION);
      return new Promise((resolve, reject) => {
        let settled = false;
        let win;
        const finish = (error, tokens) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          try {
            if (win && !win.isDestroyed()) win.close();
          } catch {
          }
          ses.clearStorageData().catch(() => {
          });
          if (error) reject(error);
          else resolve(tokens);
        };
        const handleUrl = (url, event) => {
          if (!isCallbackUrl(url)) return false;
          if (event && typeof event.preventDefault === "function") event.preventDefault();
          const callback = parseCallback(url);
          if (callback.error) {
            finish(
              new Error(
                callback.errorDescription || `Sign-in failed: ${callback.error}`
              )
            );
            return true;
          }
          if (!callback.code) {
            finish(new Error("Sign-in missed the authorization code."));
            return true;
          }
          if (callback.state !== expectedState) {
            finish(new Error("Sign-in state mismatch."));
            return true;
          }
          exchangeCodeForTokens(callback.code, verifier).then(
            (tokens) => finish(null, tokens),
            (error) => finish(error)
          );
          return true;
        };
        const timer = setTimeout(() => {
          finish(new Error("Sign-in timed out."));
        }, LOGIN_TIMEOUT_MS);
        ses.clearStorageData().finally(() => {
          win = new BrowserWindow({
            width: 480,
            height: 740,
            title: "Add Codex account",
            autoHideMenuBar: true,
            parent: parent || void 0,
            modal: Boolean(parent),
            show: true,
            backgroundColor: "#202020",
            webPreferences: {
              partition: PARTITION,
              nodeIntegration: false,
              contextIsolation: true,
              sandbox: true
            }
          });
          win.webContents.setWindowOpenHandler(({ url }) => {
            if (isSafeLoginNavigation(url) && win && !win.isDestroyed()) win.loadURL(url);
            return { action: "deny" };
          });
          const onNavigate = (url, event) => {
            if (handleUrl(url, event)) return;
            if (!isSafeLoginNavigation(url) && event && typeof event.preventDefault === "function") {
              event.preventDefault();
            }
          };
          win.webContents.on("will-redirect", (event, url) => onNavigate(url, event));
          win.webContents.on("will-navigate", (event, url) => onNavigate(url, event));
          win.webContents.on("did-navigate", (_event, url) => onNavigate(url));
          win.webContents.on("did-fail-load", (_event, _code, _desc, url) => onNavigate(url));
          win.on("closed", () => {
            if (!settled) finish(new Error("Sign-in cancelled."));
          });
          win.loadURL(authUrl).catch((error) => finish(error));
        });
      });
    }
    async function runChatGptLogin(api2) {
      if (inflight) {
        api2?.log?.info?.("[account-switcher] add-account login window already open");
        return inflight;
      }
      const pkce = generatePkce();
      const state = generateState();
      const authUrl = buildAuthorizeUrl(pkce.challenge, state);
      api2?.log?.info?.("[account-switcher] opening isolated ChatGPT login window");
      inflight = (async () => {
        const tokens = await openLoginWindow(authUrl, state, pkce.verifier);
        const apiKey = await obtainApiKey(tokens.id_token);
        return buildAuthJson(tokens, apiKey);
      })();
      try {
        return await inflight;
      } finally {
        inflight = null;
      }
    }
    module.exports = {
      CLIENT_ID,
      REDIRECT_URI,
      buildAuthorizeUrl,
      isCallbackUrl,
      parseCallback,
      buildAuthJson,
      sanitizeAccountName,
      saveIncomingAccount,
      runChatGptLogin
    };
  }
});

// src/account/actions.js
var require_actions = __commonJS({
  "src/account/actions.js"(exports, module) {
    var { t } = require_i18n();
    var {
      nodeDeps,
      codexAuthPaths,
      normalizeAccountName,
      accountPath,
      ensureDir,
      pathExists
    } = require_node_utils();
    var { readState } = require_state();
    var { getCurrentAccountName, listAccountNames } = require_storage();
    var { fetchActiveUsageSnapshot, fetchUsageSnapshotForAuth, writeAccountUsage } = require_usage();
    var {
      readAuthJson,
      saveAuthSnapshotWithCurrentBaseUrl,
      setTopLevelOpenAIBaseUrl,
      syncOpenAIBaseUrlForAccount
    } = require_config();
    var { protectAuthFile, readAuthSnapshotFile } = require_security();
    async function saveCurrentAccount(rawName) {
      const { fsp } = nodeDeps();
      const { AUTH_PATH, ACCOUNTS_DIR, CURRENT_NAME_PATH } = codexAuthPaths();
      const name = normalizeAccountName(rawName);
      if (!await pathExists(AUTH_PATH)) {
        throw new Error("No active Codex auth file found.");
      }
      await ensureDir(ACCOUNTS_DIR);
      await saveAuthSnapshotWithCurrentBaseUrl(AUTH_PATH, accountPath(name));
      await protectAuthFile(accountPath(name));
      await fsp.writeFile(CURRENT_NAME_PATH, `${name}
`, "utf8");
      return readState({ notice: t("service.saved", { name }) });
    }
    async function switchAccount(rawName, api2) {
      const { fsp } = nodeDeps();
      const { CODEX_DIR, AUTH_PATH, CURRENT_NAME_PATH } = codexAuthPaths();
      const name = normalizeAccountName(rawName);
      const source = accountPath(name);
      if (!await pathExists(source)) throw new Error("Saved account not found.");
      await ensureDir(CODEX_DIR);
      try {
        const account = await readAuthJson(source, `Saved account ${name}`);
        await syncOpenAIBaseUrlForAccount(account);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api2?.log?.warn?.(`[account-switcher] skipped base URL sync: ${message}`);
      }
      const snapshot = await readAuthSnapshotFile(source, `Saved account ${name}`);
      await fsp.writeFile(AUTH_PATH, snapshot.raw, "utf8");
      await protectAuthFile(AUTH_PATH);
      await fsp.writeFile(CURRENT_NAME_PATH, `${name}
`, "utf8");
      api2?.log?.info?.(
        "[account-switcher] switched live auth snapshot; subsequent host fetches should use the new tokens"
      );
      await nudgeLiveSessionAfterSwitch(api2, name);
      return readState({
        notice: t("service.switched", { name }),
        requiresAppRelaunch: false
      });
    }
    async function nudgeLiveSessionAfterSwitch(api2, name) {
      try {
        const refreshed = await tryPublicAuthRefresh(api2);
        if (refreshed) {
          api2?.log?.info?.(`[account-switcher] in-process auth refresh via ${refreshed}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api2?.log?.warn?.(`[account-switcher] in-process auth refresh failed: ${message}`);
      }
      try {
        await fetchActiveUsageSnapshot(api2);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api2?.log?.warn?.(`[account-switcher] post-switch live usage nudge failed: ${message}`);
      }
      try {
        await refreshUsageForSavedAccount(name, api2, { allowLiveFallback: true });
        api2?.log?.info?.("[account-switcher] post-switch usage fetch succeeded");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api2?.log?.warn?.(
          `[account-switcher] post-switch usage fetch failed: ${message}`
        );
      }
    }
    async function tryPublicAuthRefresh(api2) {
      const codex = api2?.codex;
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
    async function clearActiveAuth(api2) {
      const { fsp, path } = nodeDeps();
      const { CODEX_DIR, AUTH_PATH, CURRENT_NAME_PATH } = codexAuthPaths();
      await ensureDir(CODEX_DIR);
      await setTopLevelOpenAIBaseUrl(null);
      if (await pathExists(AUTH_PATH)) {
        const { readAuthSnapshotFile: readAuthSnapshotFile2, writeAuthSnapshotFile: writeAuthSnapshotFile2 } = require_security();
        try {
          const snapshot = await readAuthSnapshotFile2(AUTH_PATH, "Active auth");
          await writeAuthSnapshotFile2(path.join(CODEX_DIR, "auth.switcher-backup.json"), snapshot.auth);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          api2?.log?.warn?.(`[account-switcher] skipped auth backup: ${message}`);
        }
        await fsp.rm(AUTH_PATH, { force: true });
      }
      await fsp.rm(CURRENT_NAME_PATH, { force: true });
      api2?.log?.info?.("[account-switcher] cleared active auth file; app relaunch required");
      return readState({
        notice: t("service.sessionCleared"),
        requiresAppRelaunch: true
      });
    }
    async function refreshUsageForSavedAccount(name, api2, options = {}) {
      const { allowLiveFallback = false } = options;
      try {
        const { readAuthJson: readAuthJson2 } = require_config();
        const auth = await readAuthJson2(accountPath(name), `Saved account ${name}`);
        const snapshot = await fetchUsageSnapshotForAuth(auth, api2);
        await writeAccountUsage(name, snapshot);
        return snapshot;
      } catch (error) {
        if (!allowLiveFallback) throw error;
        const snapshot = await fetchActiveUsageSnapshot(api2);
        await writeAccountUsage(name, snapshot);
        return snapshot;
      }
    }
    async function refreshAllSavedAccountUsage(api2) {
      const accounts = await listAccountNames();
      const current = await getCurrentAccountName(accounts);
      for (const name of accounts) {
        try {
          await refreshUsageForSavedAccount(name, api2, { allowLiveFallback: name === current });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          api2?.log?.warn?.(`[account-switcher] usage fetch failed: ${message}`);
        }
      }
    }
    async function refreshActiveUsage(api2) {
      await refreshAllSavedAccountUsage(api2);
      return maybeFailover(api2);
    }
    var failoverBusy = false;
    async function maybeFailover(api2) {
      const { readAutoswitchEnabled } = require_settings();
      const { isUsageExhausted, pickFailoverAccount } = require_failover();
      if (failoverBusy) return readState();
      if (!await readAutoswitchEnabled()) return readState();
      failoverBusy = true;
      try {
        let state = await readState();
        const visited = /* @__PURE__ */ new Set();
        let from = state.current;
        while (state.current && isUsageExhausted(state.accountUsage?.[state.current])) {
          if (visited.has(state.current)) break;
          visited.add(state.current);
          const next = pickFailoverAccount(
            state.current,
            state.accounts,
            state.accountUsage,
            visited
          );
          if (!next) break;
          api2?.log?.info?.(
            "[account-switcher] quota empty on live account; auto-switching to another saved snapshot"
          );
          state = await switchAccount(next, api2);
          from = from || state.current;
        }
        if (visited.size && state.current && !visited.has(state.current)) {
          return {
            ...state,
            notice: t("service.autoSwitched", { from: [...visited][0], to: state.current }),
            autoSwitched: true
          };
        }
        return state;
      } finally {
        failoverBusy = false;
      }
    }
    async function setAutoswitchEnabled(enabled) {
      const { writeAutoswitchEnabled } = require_settings();
      const value = await writeAutoswitchEnabled(enabled);
      return readState({ notice: value ? t("profile.autoSwitchOn") : t("profile.autoSwitchOff") });
    }
    async function addAccountWithoutRelaunch(api2) {
      const { ensureAutosavedActiveAccount } = require_storage();
      const { runChatGptLogin: runChatGptLogin2, saveIncomingAccount: saveIncomingAccount2 } = require_login();
      const { fsp } = nodeDeps();
      const { AUTH_PATH } = codexAuthPaths();
      const liveBefore = await pathExists(AUTH_PATH) ? await fsp.readFile(AUTH_PATH, "utf8") : null;
      await ensureAutosavedActiveAccount();
      const auth = await runChatGptLogin2(api2);
      const saved = await saveIncomingAccount2(auth);
      if (liveBefore != null) {
        const liveAfter = await fsp.readFile(AUTH_PATH, "utf8");
        if (liveAfter !== liveBefore) {
          await fsp.writeFile(AUTH_PATH, liveBefore, "utf8");
          api2?.log?.warn?.("[account-switcher] restored live auth.json after add-account");
        }
      }
      const notice = saved.updated ? t("service.updated", { name: saved.name }) : t("service.added", { name: saved.name });
      api2?.log?.info?.("[account-switcher] added account snapshot without touching live session");
      try {
        await refreshUsageForSavedAccount(saved.name, api2, { allowLiveFallback: false });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        api2?.log?.warn?.(`[account-switcher] usage fetch failed for new account: ${message}`);
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
      setAutoswitchEnabled
    };
  }
});

// src/account/service.js
var require_service = __commonJS({
  "src/account/service.js"(exports2, module2) {
    var { ok, fail, errorMessage, stringifyError } = require_utils();
    var {
      clearActiveAuth: clearActiveAuth2,
      deleteAccount: deleteAccount2,
      refreshActiveUsage: refreshActiveUsage2,
      relaunchCodex: relaunchCodex2,
      addAccountWithoutRelaunch: addAccountWithoutRelaunch2,
      maybeFailover: maybeFailover2,
      saveCurrentAccount: saveCurrentAccount2,
      setAutoswitchEnabled: setAutoswitchEnabled2,
      switchAccount: switchAccount2
    } = require_actions();
    var { readState: readState2 } = require_state();
    var ACTIONS = /* @__PURE__ */ new Set([
      "state",
      "save",
      "switch",
      "delete",
      "clear-active",
      "refresh-usage",
      "relaunch",
      "add-account",
      "failover-check",
      "set-autoswitch"
    ]);
    function createAccountService2(api2) {
      return {
        async handle(message) {
          const action = typeof message?.action === "string" ? message.action : "";
          try {
            if (!ACTIONS.has(action)) return fail("Unknown account action.");
            api2.log?.info?.(`[account-switcher] action ${action}`);
            if (action === "state") return ok(await readState2());
            if (action === "save") return ok(await saveCurrentAccount2(message?.name));
            if (action === "switch") return ok(await switchAccount2(message?.name, api2));
            if (action === "delete") return ok(await deleteAccount2(message?.name));
            if (action === "clear-active") return ok(await clearActiveAuth2(api2));
            if (action === "refresh-usage") return ok(await refreshActiveUsage2(api2));
            if (action === "relaunch") return ok(await relaunchCodex2(api2));
            if (action === "add-account") return ok(await addAccountWithoutRelaunch2(api2));
            if (action === "failover-check") return ok(await maybeFailover2(api2));
            if (action === "set-autoswitch") return ok(await setAutoswitchEnabled2(message?.enabled !== false));
            return fail("Unknown account action.");
          } catch (error) {
            api2.log.warn("[account-switcher] action failed", stringifyError(error));
            return fail(errorMessage(error));
          }
        }
      };
    }
    module2.exports = { createAccountService: createAccountService2 };
  }
});

// src/dom-utils.js
var require_dom_utils = __commonJS({
  "src/dom-utils.js"(exports2, module2) {
    function compactText(element) {
      return (element?.textContent || "").replace(/\s+/g, " ").trim();
    }
    function isVisible(element) {
      if (!(element instanceof HTMLElement)) return false;
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      const style = window.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden";
    }
    function findMenuItem(root, pattern) {
      return Array.from(
        root.querySelectorAll('[role="menuitem"], button, [data-radix-collection-item]')
      ).find((element) => {
        return element instanceof HTMLElement && isVisible(element) && pattern.test(compactText(element));
      });
    }
    function protectInteractiveControl(element, options = {}) {
      const preventClickDefault = options.preventClickDefault !== false;
      const stop = (event) => {
        event.stopPropagation();
      };
      element.addEventListener("pointerdown", stop, true);
      element.addEventListener("mousedown", stop, true);
      element.addEventListener("mouseup", stop, true);
      element.addEventListener("keydown", stop, true);
      element.addEventListener(
        "click",
        (event) => {
          if (preventClickDefault) event.preventDefault();
          event.stopPropagation();
        },
        true
      );
    }
    module2.exports = { compactText, isVisible, findMenuItem, protectInteractiveControl };
  }
});

// src/ipc.js
var require_ipc = __commonJS({
  "src/ipc.js"(exports2, module2) {
    var { IPC_CHANNEL: IPC_CHANNEL2 } = require_constants();
    async function invoke(state, action, payload = {}) {
      const result = await state.api.ipc.invoke(IPC_CHANNEL2, { ...payload, action });
      if (!result?.ok) throw new Error(result?.error || "Account switcher action failed.");
      state.lastState = result.state;
      return result.state;
    }
    module2.exports = { invoke };
  }
});

// src/ui-components.js
var require_ui_components = __commonJS({
  "src/ui-components.js"(exports2, module2) {
    var { protectInteractiveControl } = require_dom_utils();
    function addButtonFeedback(element, styles) {
      const normal = {
        background: element.style.background || element.style.backgroundColor || "transparent",
        color: element.style.color || "",
        transform: element.style.transform || ""
      };
      const apply = (values) => {
        if (values.background != null) element.style.background = values.background;
        if (values.color != null) element.style.color = values.color;
        if (values.transform != null) element.style.transform = values.transform;
      };
      const hover = styles.hover || {};
      const active = styles.active || hover;
      const restore = () => apply(styles.normal || normal);
      element.style.transition = "background-color 120ms ease, color 120ms ease, transform 80ms ease";
      element.addEventListener("pointerenter", () => {
        if (element.disabled) return;
        apply(hover);
      });
      element.addEventListener("pointerleave", restore);
      element.addEventListener("focus", () => {
        if (element.disabled) return;
        apply(hover);
      });
      element.addEventListener("blur", restore);
      element.addEventListener("pointerdown", () => {
        if (element.disabled) return;
        apply(active);
      });
      element.addEventListener("pointerup", () => {
        if (element.disabled) return;
        apply(hover);
      });
      element.addEventListener("pointercancel", restore);
    }
    function settingsButton(label) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.className = "inline-flex h-8 shrink-0 items-center justify-center rounded-lg px-3 text-sm text-token-text-primary hover:bg-token-foreground/10 disabled:cursor-default disabled:opacity-50";
      button.style.border = "1px solid color-mix(in srgb, currentColor 14%, transparent)";
      button.style.backgroundColor = "color-mix(in srgb, currentColor 5%, transparent)";
      addButtonFeedback(button, {
        hover: {
          background: "color-mix(in srgb, currentColor 10%, transparent)"
        },
        active: {
          background: "color-mix(in srgb, currentColor 16%, transparent)",
          transform: "scale(0.98)"
        }
      });
      protectInteractiveControl(button);
      return button;
    }
    function primaryButton(label) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.className = "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg font-normal";
      Object.assign(button.style, {
        height: "32px",
        minHeight: "32px",
        maxHeight: "32px",
        padding: "0 12px",
        fontSize: "13px",
        lineHeight: "1",
        border: "1px solid transparent"
      });
      button.style.background = "var(--color-token-text-primary, #fff)";
      button.style.color = "var(--color-token-main-surface-primary, #111)";
      addButtonFeedback(button, {
        normal: { background: "var(--color-token-text-primary, #fff)" },
        hover: { background: "color-mix(in srgb,var(--color-token-text-primary,#fff) 88%,transparent)" },
        active: {
          background: "color-mix(in srgb,var(--color-token-text-primary,#fff) 78%,transparent)",
          transform: "scale(0.98)"
        }
      });
      protectInteractiveControl(button);
      return button;
    }
    function iconButton(label, icon) {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", label);
      button.title = label;
      button.className = "inline-flex size-8 shrink-0 cursor-interaction items-center justify-center rounded-lg text-token-text-secondary hover:text-token-text-primary";
      button.style.background = "transparent";
      button.style.border = "0";
      button.appendChild(icon);
      addButtonFeedback(button, {
        normal: { background: "transparent" },
        hover: { background: "color-mix(in srgb,currentColor 9%,transparent)" },
        active: {
          background: "color-mix(in srgb,currentColor 14%,transparent)",
          transform: "scale(0.96)"
        }
      });
      protectInteractiveControl(button);
      return button;
    }
    function bindButtonAction(button, onAction) {
      let lastRun = 0;
      const run = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (button.disabled) return;
        const now = Date.now();
        if (now - lastRun < 350) return;
        lastRun = now;
        onAction(event);
      };
      button.addEventListener("pointerup", run);
      button.addEventListener("click", run);
    }
    function settingsStatus(text, isError = false) {
      const status = document.createElement("div");
      status.className = "text-token-text-secondary text-sm";
      status.style.color = isError ? "var(--color-token-text-error, #c2410c)" : "var(--color-token-text-secondary, currentColor)";
      status.textContent = text;
      return status;
    }
    function accountDisplayName(accountState, name, options = {}) {
      const email = accountState?.accountEmails?.[name];
      const suffix = accountState?.current === name && options.includeCurrent !== false ? " (current)" : "";
      return email ? `${email}${suffix}` : `${name}${suffix}`;
    }
    function accountUsageSummary(accountState, name) {
      const usage = accountState?.accountUsage?.[name];
      if (!usage || typeof usage !== "object") return null;
      const parts = [];
      const fiveHour = usageWindowSummary(usage.fiveHour, "5h");
      const weekly = usageWindowSummary(usage.weekly, "Weekly");
      if (fiveHour) parts.push(fiveHour);
      if (weekly) parts.push(weekly);
      if (!parts.length) return null;
      return parts.join(" \xB7 ");
    }
    function usageWindowSummary(window2, fallbackLabel) {
      if (typeof window2?.pct !== "number") return null;
      const rawLabel = window2.label || fallbackLabel;
      const label = /^5h$/i.test(rawLabel) ? "5-hour" : rawLabel;
      const reset = window2.pct <= 0 && window2.resetAt ? `, resets ${window2.resetAt}` : "";
      return `${label} ${window2.pct}% remaining${reset}`;
    }
    module2.exports = {
      addButtonFeedback,
      settingsButton,
      primaryButton,
      iconButton,
      settingsStatus,
      bindButtonAction,
      accountDisplayName,
      accountUsageSummary
    };
  }
});

// src/display.js
var require_display = __commonJS({
  "src/display.js"(exports2, module2) {
    var AVATAR_COLORS = ["#3b82f6", "#c4b5a5", "#7f1d1d", "#6366f1", "#a16207", "#0f766e"];
    function initials(label) {
      const parts = String(label || "A").trim().split(/\s+/).filter(Boolean);
      if (!parts.length) return "A";
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    function avatarColor(name) {
      let hash = 0;
      for (const ch of String(name)) hash = hash * 31 + ch.charCodeAt(0) >>> 0;
      return AVATAR_COLORS[hash % AVATAR_COLORS.length];
    }
    function formatPlan(plan) {
      const raw = String(plan || "").trim();
      if (!raw) return "Plus";
      if (/^plus$/i.test(raw)) return "Plus";
      if (/^pro$/i.test(raw)) return "Pro";
      if (/20x/i.test(raw)) return raw.replace(/^./, (c) => c.toUpperCase());
      return raw.charAt(0).toUpperCase() + raw.slice(1);
    }
    function accountRemainingPct(accountState, name) {
      const usage = accountState?.accountUsage?.[name];
      const weekly = usage?.weekly?.pct;
      const five = usage?.fiveHour?.pct;
      if (typeof weekly === "number") return weekly;
      if (typeof five === "number") return five;
      return null;
    }
    function totalRemainingPct(accountState) {
      const accounts = Array.isArray(accountState?.accounts) ? accountState.accounts : [];
      let sum = 0;
      let any = false;
      for (const name of accounts) {
        const pct = accountRemainingPct(accountState, name);
        if (typeof pct === "number") {
          sum += pct;
          any = true;
        }
      }
      return any ? sum : null;
    }
    function accountResetAt(accountState, name) {
      const usage = accountState?.accountUsage?.[name];
      return usage?.weekly?.resetAt || usage?.fiveHour?.resetAt || null;
    }
    module2.exports = {
      initials,
      avatarColor,
      formatPlan,
      accountRemainingPct,
      totalRemainingPct,
      accountResetAt
    };
  }
});

// src/ui-profile-menu.js
var require_ui_profile_menu = __commonJS({
  "src/ui-profile-menu.js"(exports2, module2) {
    var { compactText, isVisible, protectInteractiveControl } = require_dom_utils();
    var { invoke } = require_ipc();
    var { t: t2 } = require_i18n();
    var { errorMessage } = require_utils();
    var {
      accountDisplayName,
      bindButtonAction
    } = require_ui_components();
    var {
      accountRemainingPct,
      totalRemainingPct,
      formatPlan,
      initials,
      avatarColor
    } = require_display();
    var BLOCK_ATTR = "data-codexpp-profile-accounts";
    var PATCHED_ATTR = "data-codexpp-profile-patched";
    var POPUP_SELECTOR = [
      '[role="menu"]',
      '[role="dialog"]',
      "[data-radix-menu-content]",
      "[data-radix-dropdown-menu-content]",
      "[data-radix-popover-content]",
      "[data-radix-popper-content-wrapper]"
    ].join(", ");
    var CONTROL_SELECTOR = "button, a, [role='menuitem'], [role='link'], [role='option'], [data-radix-collection-item]";
    var STOCK_ITEM_PATTERN = /^(show pet|usage remaining|rate limits remaining|personal account|settings|log\s*out|sign\s*out)(\b|$)/i;
    var LOGOUT_PATTERN = /^(log\s*out|sign\s*out)(\b|$)/i;
    var FILE_MENU_PATTERN = /^(new chat|new window|open folder|exit|quit)(\b|$)/i;
    function mountProfileMenu(state) {
      const schedule = () => {
        if (state.disposed || state.profilePending) return;
        state.profilePending = window.requestAnimationFrame(() => {
          state.profilePending = 0;
          ensureProfileMenu(state);
        });
      };
      const observer = new MutationObserver(schedule);
      observer.observe(document.documentElement, { childList: true, subtree: true });
      state.disposers.push(() => observer.disconnect());
      state.disposers.push(() => {
        document.querySelectorAll(`[${BLOCK_ATTR}]`).forEach((element) => element.remove());
        document.querySelectorAll(`[${PATCHED_ATTR}]`).forEach((element) => {
          element.removeAttribute(PATCHED_ATTR);
        });
      });
      schedule();
    }
    function refreshProfileMenu(state, accountState) {
      state.profileMenuDirty = true;
      if (accountState) state.lastState = accountState;
      const popup = findProfilePopup();
      if (!popup) return;
      const existing = popup.querySelector(`[${BLOCK_ATTR}]`);
      if (existing) existing.remove();
      popup.removeAttribute(PATCHED_ATTR);
      ensureProfileMenu(state, accountState);
    }
    function ensureProfileMenu(state, knownState) {
      if (state.disposed) return;
      const popup = findProfilePopup();
      if (!popup) return;
      const fingerprint = profileFingerprint(knownState || state.lastState);
      if (!state.profileMenuDirty && popup.getAttribute(PATCHED_ATTR) === fingerprint && popup.querySelector(`[${BLOCK_ATTR}]`)) {
        return;
      }
      if (knownState) {
        renderProfileAccounts(state, popup, knownState);
        return;
      }
      const existing = popup.querySelector(`[${BLOCK_ATTR}]`);
      if (!existing) renderProfileAccounts(state, popup, state.lastState || { accounts: [] }, { loading: true });
      popup.setAttribute(PATCHED_ATTR, fingerprint || "pending");
      if (state.profileMenuFetch && !state.profileMenuDirty) return;
      state.profileMenuDirty = false;
      const request = invoke(state, "state");
      state.profileMenuFetch = request;
      request.then((accountState) => {
        if (state.disposed || state.profileMenuFetch !== request) return;
        const open = findProfilePopup();
        if (!open) return;
        renderProfileAccounts(state, open, accountState);
      }).catch((error) => {
        state.api.log.warn("[account-switcher] profile menu state failed", errorMessage(error));
      }).finally(() => {
        if (state.profileMenuFetch === request) state.profileMenuFetch = null;
      });
    }
    function renderProfileAccounts(state, popup, accountState, options = {}) {
      const accounts = Array.isArray(accountState?.accounts) ? accountState.accounts : [];
      const fingerprint = options.loading ? "loading" : profileFingerprint(accountState);
      popup.setAttribute(PATCHED_ATTR, fingerprint);
      if (!options.loading && !accounts.length) {
        popup.querySelector(`[${BLOCK_ATTR}]`)?.remove();
        return;
      }
      const block = document.createElement("div");
      block.setAttribute(BLOCK_ATTR, "true");
      block.style.cssText = "display:flex;flex-direction:column;gap:2px;padding:4px 6px 8px;margin:0 0 4px;border-bottom:1px solid color-mix(in srgb, currentColor 12%, transparent);";
      if (options.loading) {
        const status = document.createElement("div");
        status.style.cssText = "padding:8px 10px;font-size:12px;color:var(--color-token-text-secondary,currentColor);";
        status.textContent = t2("accounts.loading");
        block.appendChild(status);
      } else {
        block.appendChild(usageSummaryRow(accountState, accounts.length));
        for (const name of accounts) {
          block.appendChild(profileAccountRow(state, name, accountState));
        }
        block.appendChild(addSubscriptionRow(state));
        block.appendChild(autoSwitchRow(state, accountState));
        if (accountState?.error) {
          const error = document.createElement("div");
          error.style.cssText = "padding:4px 10px;font-size:11px;color:var(--color-token-text-error,#c2410c);";
          error.textContent = accountState.error;
          block.appendChild(error);
        }
      }
      const existing = popup.querySelector(`[${BLOCK_ATTR}]`);
      if (existing) existing.replaceWith(block);
      else {
        const anchor = firstStockAnchor(popup);
        if (anchor) anchor.before(block);
        else popup.prepend(block);
      }
      if (!options.loading) hideNativeUsageRows(popup);
    }
    function usageSummaryRow(accountState, count) {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:10px;padding:8px 10px 10px;color:var(--color-token-text-primary,currentColor);";
      const icon = document.createElement("div");
      icon.setAttribute("aria-hidden", "true");
      icon.style.cssText = "width:18px;height:18px;display:flex;align-items:center;justify-content:center;opacity:0.85;";
      icon.innerHTML = '<svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M10 17.5a7.5 7.5 0 1 0-7.4-8.7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M10 10l4-3.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="10" cy="10" r="1.2" fill="currentColor"/></svg>';
      const copy = document.createElement("div");
      copy.style.cssText = "min-width:0;flex:1;display:flex;flex-direction:column;gap:1px;";
      const title = document.createElement("div");
      title.style.cssText = "font-size:14px;line-height:18px;font-weight:500;";
      title.textContent = t2("profile.usageRemaining");
      const sub = document.createElement("div");
      sub.style.cssText = "font-size:12px;line-height:16px;color:var(--color-token-text-secondary,currentColor);";
      sub.textContent = t2("profile.connected", { n: count });
      copy.append(title, sub);
      const total = totalRemainingPct(accountState);
      const value = document.createElement("div");
      value.style.cssText = "font-size:14px;line-height:18px;font-weight:500;font-variant-numeric:tabular-nums;";
      value.textContent = total == null ? "\u2014" : `${total}%`;
      row.append(icon, copy, value);
      return row;
    }
    function profileAccountRow(state, name, accountState) {
      const profile = accountState.accountProfiles?.[name] || {};
      const isCurrent = accountState.current === name;
      const displayName = profile.name || accountDisplayName(accountState, name, { includeCurrent: false });
      const plan = formatPlan(profile.plan);
      const pct = accountRemainingPct(accountState, name);
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("data-codexpp-profile-account", name);
      button.setAttribute("aria-current", isCurrent ? "true" : "false");
      button.setAttribute(
        "aria-label",
        isCurrent ? `${displayName} (${t2("accounts.current")})` : t2("profile.switchTo", { name: displayName })
      );
      button.disabled = isCurrent || !!state.profileMenuBusy;
      button.style.cssText = "width:100%;border:0;background:transparent;color:inherit;font:inherit;text-align:left;display:flex;align-items:center;gap:10px;padding:8px 10px 8px 7px;border-radius:10px;cursor:pointer;box-sizing:border-box;border-left:3px solid transparent;";
      if (isCurrent) {
        button.style.background = "color-mix(in srgb, #14b8a6 16%, transparent)";
        button.style.borderLeftColor = "#14b8a6";
        button.style.cursor = "default";
      }
      const avatarWrap = document.createElement("div");
      avatarWrap.style.cssText = "position:relative;width:28px;height:28px;flex-shrink:0;";
      const avatar = document.createElement("div");
      avatar.setAttribute("aria-hidden", "true");
      const color = isCurrent ? "#14b8a6" : avatarColor(name);
      avatar.style.cssText = `width:28px;height:28px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:#fff;background:${color};`;
      avatar.textContent = initials(displayName);
      avatarWrap.appendChild(avatar);
      if (isCurrent) {
        const check = document.createElement("div");
        check.setAttribute("aria-hidden", "true");
        check.style.cssText = "position:absolute;right:-3px;bottom:-3px;width:14px;height:14px;border-radius:999px;background:#14b8a6;color:#042f2e;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px var(--color-token-main-surface-primary, #202020);";
        check.innerHTML = '<svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2.2 6.2l2.4 2.4 5.2-5.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        avatarWrap.appendChild(check);
      }
      const copy = document.createElement("div");
      copy.style.cssText = "min-width:0;flex:1;display:flex;flex-direction:column;gap:2px;";
      const title = document.createElement("div");
      title.style.cssText = "font-size:14px;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
      title.textContent = `${displayName} \xB7 ${plan}`;
      title.title = displayName;
      const dots = document.createElement("div");
      dots.style.cssText = "font-size:11px;letter-spacing:1.5px;color:var(--color-token-text-secondary,currentColor);opacity:0.7;";
      dots.textContent = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
      copy.append(title, dots);
      const usage = accountState?.accountUsage?.[name];
      const resetAt = usage?.weekly?.resetAt || usage?.fiveHour?.resetAt;
      if (resetAt) {
        const reset = document.createElement("div");
        reset.style.cssText = "font-size:11px;line-height:15px;color:var(--color-token-text-secondary,currentColor);white-space:normal;";
        reset.textContent = t2("profile.resets", { when: resetAt });
        copy.appendChild(reset);
      }
      const right = document.createElement("div");
      right.style.cssText = "flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:4px;min-width:52px;";
      if (isCurrent) {
        const badge = document.createElement("span");
        badge.textContent = t2("accounts.current");
        badge.style.cssText = "font-size:10px;font-weight:700;letter-spacing:0.04em;line-height:16px;padding:1px 7px;border-radius:999px;background:#14b8a6;color:#042f2e;text-transform:uppercase;";
        right.appendChild(badge);
      }
      const value = document.createElement("div");
      value.style.cssText = "font-size:14px;line-height:18px;font-variant-numeric:tabular-nums;color:var(--color-token-text-primary,currentColor);";
      value.textContent = pct == null ? "\u2014" : `${pct}%`;
      right.appendChild(value);
      button.append(avatarWrap, copy, right);
      protectInteractiveControl(button);
      button.addEventListener("pointerenter", () => {
        if (button.disabled && !isCurrent) return;
        if (isCurrent) {
          button.style.background = "color-mix(in srgb, #14b8a6 22%, transparent)";
          return;
        }
        button.style.background = "color-mix(in srgb, currentColor 10%, transparent)";
      });
      button.addEventListener("pointerleave", () => {
        button.style.background = isCurrent ? "color-mix(in srgb, #14b8a6 16%, transparent)" : "transparent";
      });
      if (!isCurrent) {
        bindButtonAction(button, () => switchFromProfileMenu(state, name, displayName));
      }
      return button;
    }
    function addSubscriptionRow(state) {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("data-codexpp-profile-add", "true");
      button.style.cssText = "width:100%;border:0;background:transparent;color:var(--color-token-text-primary,currentColor);font:inherit;display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;cursor:pointer;text-align:left;";
      const plus = document.createElement("div");
      plus.setAttribute("aria-hidden", "true");
      plus.style.cssText = "width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:18px;line-height:18px;opacity:0.85;";
      plus.textContent = "+";
      const label = document.createElement("div");
      label.style.cssText = "font-size:14px;line-height:18px;";
      label.textContent = t2("profile.addSubscription");
      button.append(plus, label);
      protectInteractiveControl(button);
      button.addEventListener("pointerenter", () => {
        button.style.background = "color-mix(in srgb, currentColor 10%, transparent)";
      });
      button.addEventListener("pointerleave", () => {
        button.style.background = "transparent";
      });
      bindButtonAction(button, () => addAccountFromProfileMenu(state));
      return button;
    }
    function autoSwitchRow(state, accountState) {
      const enabled = accountState?.autoswitchEnabled !== false;
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("data-codexpp-profile-autoswitch", "true");
      button.setAttribute("aria-pressed", enabled ? "true" : "false");
      button.style.cssText = "width:100%;border:0;background:transparent;color:inherit;font:inherit;text-align:left;display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;cursor:pointer;";
      const icon = document.createElement("div");
      icon.setAttribute("aria-hidden", "true");
      icon.style.cssText = "width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;opacity:0.85;";
      icon.textContent = enabled ? "\u21BB" : "\u25CB";
      const copy = document.createElement("div");
      copy.style.cssText = "min-width:0;flex:1;font-size:14px;line-height:18px;";
      copy.textContent = t2("profile.autoSwitch");
      const badge = document.createElement("span");
      badge.textContent = enabled ? t2("profile.autoSwitchOn") : t2("profile.autoSwitchOff");
      badge.style.cssText = "flex-shrink:0;font-size:10px;font-weight:700;letter-spacing:0.04em;line-height:16px;padding:1px 7px;border-radius:999px;" + (enabled ? "background:#14b8a6;color:#042f2e;" : "background:color-mix(in srgb, currentColor 12%, transparent);color:inherit;");
      button.append(icon, copy, badge);
      protectInteractiveControl(button);
      button.addEventListener("pointerenter", () => {
        button.style.background = "color-mix(in srgb, currentColor 10%, transparent)";
      });
      button.addEventListener("pointerleave", () => {
        button.style.background = "transparent";
      });
      bindButtonAction(button, async () => {
        try {
          const next = await invoke(state, "set-autoswitch", { enabled: !enabled });
          refreshProfileMenu(state, next);
        } catch (error) {
          state.api.log.warn("[account-switcher] toggle autoswitch failed", errorMessage(error));
        }
      });
      return button;
    }
    async function addAccountFromProfileMenu(state) {
      if (state.profileMenuBusy) return;
      state.profileMenuBusy = true;
      const popup = findProfilePopup();
      const addBtn = popup?.querySelector("[data-codexpp-profile-add]");
      const label = addBtn?.querySelector("div:last-child");
      const previous = label?.textContent;
      if (addBtn) addBtn.disabled = true;
      if (label) label.textContent = t2("profile.signingIn");
      try {
        const accountState = await invoke(state, "add-account");
        state.api.log.info("[account-switcher] added account without relaunch");
        refreshProfileMenu(state, accountState);
        if (state.directPage?.sections?.isConnected) {
          const { renderAccountsPageState } = require_ui_settings();
          renderAccountsPageState(state, state.directPage.sections, accountState);
        }
      } catch (error) {
        const message = errorMessage(error);
        state.api.log.warn("[account-switcher] add account failed", message);
        const open = findProfilePopup();
        if (open) {
          const cancelled = /cancel/i.test(message);
          renderProfileAccounts(state, open, {
            ...state.lastState || { accounts: [] },
            error: cancelled ? t2("profile.addCancelled") : t2("profile.addFailed", { error: message })
          });
        }
      } finally {
        state.profileMenuBusy = false;
        if (label && previous) label.textContent = previous;
        if (addBtn) addBtn.disabled = false;
      }
    }
    async function switchFromProfileMenu(state, name, displayName) {
      if (state.profileMenuBusy) return;
      state.profileMenuBusy = true;
      const popup = findProfilePopup();
      if (popup) {
        popup.querySelectorAll("[data-codexpp-profile-account]").forEach((button) => {
          button.disabled = true;
        });
        const active = popup.querySelector(`[data-codexpp-profile-account="${cssEscape(name)}"]`);
        if (active) {
          const status = active.querySelector(".text-token-text-secondary, .text-\\[11px\\]") || active;
          active.setAttribute("aria-label", t2("accounts.switching"));
          const hint = document.createElement("div");
          hint.className = "text-[11px] text-token-text-secondary";
          hint.textContent = t2("profile.switching");
          hint.setAttribute("data-codexpp-profile-switching", "true");
          active.querySelector("[data-codexpp-profile-switching]")?.remove();
          status.parentElement?.appendChild(hint);
        }
      }
      try {
        const accountState = await invoke(state, "switch", { name });
        state.api.log.info(`[account-switcher] profile menu switched to ${name} without relaunch`);
        refreshProfileMenu(state, accountState);
        if (state.directPage?.sections?.isConnected) {
          const { renderAccountsPageState } = require_ui_settings();
          renderAccountsPageState(state, state.directPage.sections, accountState);
        }
      } catch (error) {
        state.api.log.warn("[account-switcher] profile menu switch failed", errorMessage(error));
        const open = findProfilePopup();
        if (open) {
          renderProfileAccounts(state, open, {
            ...state.lastState || { accounts: [] },
            error: t2("profile.switchFailed", { error: errorMessage(error) })
          });
        }
      } finally {
        state.profileMenuBusy = false;
        void displayName;
      }
    }
    function cssEscape(value) {
      if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
      return String(value).replace(/"/g, '\\"');
    }
    function findProfilePopup() {
      const fromText = findPopupFromMenuText();
      if (fromText) return fromText;
      const fromStock = findPopupFromStockItems();
      if (fromStock) return fromStock;
      for (const node of document.querySelectorAll(POPUP_SELECTOR)) {
        const popup = popupElement(node);
        if (popup && isProfilePopup(popup)) return popup;
      }
      return null;
    }
    function findPopupFromMenuText() {
      const candidates2 = Array.from(document.querySelectorAll(POPUP_SELECTOR));
      for (const candidate of candidates2) {
        if (!(candidate instanceof HTMLElement) || !isVisible(candidate)) continue;
        if (candidate.closest(`[${BLOCK_ATTR}]`)) continue;
        const text = compactText(candidate);
        if (!/\bsettings\b/i.test(text) || !/\blog out\b/i.test(text)) continue;
        if (!/\brate limits remaining\b/i.test(text) && !/\bpersonal account\b/i.test(text) && !/\busage remaining\b/i.test(text) && !/\bshow pet\b/i.test(text)) {
          continue;
        }
        return candidate.matches("[data-radix-popper-content-wrapper]") ? candidate.querySelector('[role="menu"], [data-radix-menu-content]') || candidate : candidate;
      }
      return null;
    }
    function findPopupFromStockItems() {
      const controls = Array.from(document.querySelectorAll(CONTROL_SELECTOR)).filter((element) => {
        return element instanceof HTMLElement && isVisible(element) && !element.closest(`[${BLOCK_ATTR}]`) && STOCK_ITEM_PATTERN.test(compactText(element)) && !/usage|rate limits remaining/i.test(compactText(element));
      });
      for (const control of controls) {
        const popup = popupRootFor(control);
        if (popup && isProfilePopup(popup)) return popup;
      }
      return null;
    }
    function popupElement(node) {
      if (!(node instanceof HTMLElement) || !isVisible(node)) return null;
      if (node.hasAttribute("data-radix-popper-content-wrapper")) {
        const inner = node.firstElementChild;
        return inner instanceof HTMLElement && isVisible(inner) ? inner : node;
      }
      return node;
    }
    function popupRootFor(element) {
      let current = element;
      while (current && current !== document.body) {
        if (current.closest?.("[data-codexpp-account-page], [data-codexpp-account-confirmation]")) {
          return null;
        }
        if (current.matches?.(POPUP_SELECTOR)) return popupElement(current);
        const role = current.getAttribute?.("role");
        if (role === "menu" || role === "dialog") return current;
        current = current.parentElement;
      }
      current = element.parentElement;
      while (current && current !== document.body) {
        const style = window.getComputedStyle(current);
        if ((style.position === "fixed" || style.position === "absolute") && isVisible(current)) {
          if (isProfilePopup(current)) return current;
        }
        current = current.parentElement;
      }
      return null;
    }
    function isProfilePopup(root) {
      if (!(root instanceof HTMLElement) || !isVisible(root)) return false;
      if (root.closest("[data-codexpp-account-page], [data-codexpp-account-confirmation]")) return false;
      if (root.querySelector("[data-codexpp-account-page]")) return false;
      if (!isLikelyOverlay(root)) return false;
      return isProfilePopupLabels(collectControlLabels(root));
    }
    function isLikelyOverlay(root) {
      const rect = root.getBoundingClientRect();
      if (rect.width < 140 || rect.width > 520) return false;
      if (rect.height < 60 || rect.height > window.innerHeight * 0.95) return false;
      const style = window.getComputedStyle(root);
      return style.position === "fixed" || style.position === "absolute" || !!root.closest("[data-radix-popper-content-wrapper], [role='menu'], [role='dialog']");
    }
    function collectControlLabels(root) {
      return Array.from(root.querySelectorAll(CONTROL_SELECTOR)).filter(
        (element) => element instanceof HTMLElement && isVisible(element) && !element.closest(`[${BLOCK_ATTR}]`)
      ).map((element) => compactText(element)).filter(Boolean);
    }
    function firstStockAnchor(popup) {
      const stocks = Array.from(popup.querySelectorAll(CONTROL_SELECTOR)).filter((element) => {
        return element instanceof HTMLElement && isVisible(element) && !element.closest(`[${BLOCK_ATTR}]`) && STOCK_ITEM_PATTERN.test(compactText(element));
      });
      if (!stocks.length) return null;
      let common = stocks[0].parentElement;
      while (common && common !== popup.parentElement) {
        if (stocks.every((element) => common.contains(element))) {
          const child = Array.from(common.children).find(
            (node) => stocks.some((stock) => node === stock || node.contains(stock))
          );
          if (child) return child;
        }
        if (common === popup) break;
        common = common.parentElement;
      }
      return stocks[0];
    }
    function profileFingerprint(accountState) {
      if (!accountState) return "";
      const accounts = Array.isArray(accountState.accounts) ? accountState.accounts.join(",") : "";
      return `${accounts}|${accountState.current || ""}|${accountState.error || ""}|${accountState.autoswitchEnabled ? 1 : 0}`;
    }
    function normalizeLabel(label) {
      return String(label || "").replace(/\s+/g, " ").trim().toLowerCase();
    }
    function isProfilePopupLabels(labels) {
      const normalized = (Array.isArray(labels) ? labels : []).map(normalizeLabel).filter(Boolean);
      if (!normalized.length) return false;
      const has = (pattern) => normalized.some((label) => pattern.test(label));
      if (has(FILE_MENU_PATTERN)) return false;
      const hasLogout = has(LOGOUT_PATTERN);
      const hasShowPet = has(/^show pet(\b|$)/);
      const hasUsage = has(/^(usage remaining|rate limits remaining)(\b|$)/);
      const hasPersonal = has(/^personal account(\b|$)/);
      const hasSettings = has(/^settings(\b|$)/);
      return hasLogout && (hasShowPet || hasUsage || hasPersonal || hasSettings);
    }
    function hideNativeUsageRows(popup) {
      const controls = Array.from(popup.querySelectorAll(CONTROL_SELECTOR));
      for (const element of controls) {
        if (!(element instanceof HTMLElement) || element.closest(`[${BLOCK_ATTR}]`)) continue;
        const label = compactText(element);
        if (!/usage|rate limits remaining/i.test(label)) continue;
        const row = element.closest("button, a, [role='menuitem'], [role='button']") || element;
        row.style.display = "none";
        row.setAttribute("data-codexpp-hidden-usage", "true");
      }
    }
    module2.exports = {
      mountProfileMenu,
      refreshProfileMenu,
      isProfilePopupLabels,
      STOCK_ITEM_PATTERN
    };
  }
});

// src/ui-settings.js
var require_ui_settings = __commonJS({
  "src/ui-settings.js"(exports2, module2) {
    var { errorMessage } = require_utils();
    var { invoke } = require_ipc();
    var { t: t2 } = require_i18n();
    var {
      settingsButton,
      primaryButton,
      iconButton,
      settingsStatus,
      accountDisplayName,
      bindButtonAction
    } = require_ui_components();
    var {
      accountRemainingPct,
      totalRemainingPct,
      formatPlan,
      initials,
      avatarColor,
      accountResetAt
    } = require_display();
    async function renderAccountsPage(state, root) {
      renderHeaderActions(state, root);
      root.textContent = "";
      root.appendChild(settingsStatus(t2("accounts.loading")));
      try {
        const accountState = await invoke(state, "state");
        renderAccountsPageState(state, root, accountState);
        refreshUsageInBackground(state, root);
      } catch (error) {
        root.textContent = "";
        root.appendChild(settingsStatus(errorMessage(error), true));
      }
    }
    function renderHeaderActions(state, root) {
      const page = root.closest("[data-codexpp-account-page]");
      const actions = page?.querySelector("[data-codexpp-account-page-actions]");
      if (!(actions instanceof HTMLElement)) return;
      actions.textContent = "";
      const refresh = iconButton(t2("accounts.refresh"), refreshIcon());
      bindButtonAction(refresh, () => renderAccountsPage(state, root));
      const add = primaryButton(t2("accounts.add"));
      Object.assign(add.style, {
        height: "28px",
        minHeight: "28px",
        maxHeight: "28px",
        padding: "0 10px",
        borderRadius: "10px",
        fontSize: "12px"
      });
      bindButtonAction(add, () => addAccountFromSettings(state, root));
      actions.append(refresh, add);
    }
    function addAccountFromSettings(state, root) {
      runAccountAction(state, root, "add-account", {}, t2("profile.signingIn"));
    }
    function renderAccountsPageState(state, root, accountState) {
      state.lastState = accountState;
      root.textContent = "";
      const accounts = Array.isArray(accountState.accounts) ? accountState.accounts : [];
      const section = document.createElement("section");
      section.className = "flex flex-col gap-3";
      if (accounts.length) section.appendChild(usageSummaryCard(accountState, accounts.length));
      const list = document.createElement("div");
      list.className = "flex flex-col gap-2";
      if (!accounts.length) list.appendChild(emptyAccountsRow(accountState));
      else {
        for (const name of accounts) list.appendChild(accountCard(state, root, accountState, name));
      }
      section.appendChild(list);
      if (accounts.length) section.appendChild(autoSwitchCard(state, root, accountState));
      root.appendChild(section);
      if (accountState.notice || accountState.error) {
        const status = settingsStatus(accountState.notice || accountState.error, !!accountState.error);
        status.classList.add("pt-2");
        root.appendChild(status);
      }
    }
    function usageSummaryCard(accountState, count) {
      const row = document.createElement("div");
      row.className = "flex items-center gap-3 rounded-2xl px-4 py-3";
      row.style.background = "color-mix(in srgb, var(--color-token-text-primary, #fff) 5%, transparent)";
      const icon = document.createElement("div");
      icon.setAttribute("aria-hidden", "true");
      icon.className = "flex size-10 shrink-0 items-center justify-center text-token-text-secondary";
      icon.appendChild(usageClockIcon());
      const copy = document.createElement("div");
      copy.className = "flex min-w-0 flex-1 flex-col gap-0.5";
      const title = document.createElement("div");
      title.className = "text-base font-medium text-token-text-primary";
      title.textContent = t2("profile.usageRemaining");
      const sub = document.createElement("div");
      sub.className = "text-sm text-token-text-secondary";
      sub.textContent = t2("profile.connected", { n: count });
      copy.append(title, sub);
      const total = totalRemainingPct(accountState);
      const value = document.createElement("div");
      value.className = "shrink-0 text-base font-medium tabular-nums text-token-text-primary";
      value.textContent = total == null ? "\u2014" : `${total}%`;
      row.append(icon, copy, value);
      return row;
    }
    function autoSwitchCard(state, root, accountState) {
      const enabled = accountState?.autoswitchEnabled !== false;
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-pressed", enabled ? "true" : "false");
      button.className = "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left";
      Object.assign(button.style, {
        background: "color-mix(in srgb, var(--color-token-text-primary, #fff) 5%, transparent)",
        border: "0",
        color: "inherit",
        cursor: "pointer"
      });
      const icon = document.createElement("div");
      icon.setAttribute("aria-hidden", "true");
      icon.className = "flex size-10 shrink-0 items-center justify-center text-base text-token-text-secondary";
      icon.textContent = enabled ? "\u21BB" : "\u25CB";
      const copy = document.createElement("div");
      copy.className = "min-w-0 flex-1 text-sm font-medium text-token-text-primary";
      copy.textContent = t2("profile.autoSwitch");
      const badge = document.createElement("span");
      badge.textContent = enabled ? t2("profile.autoSwitchOn") : t2("profile.autoSwitchOff");
      badge.style.cssText = "flex-shrink:0;font-size:10px;font-weight:700;letter-spacing:0.04em;line-height:16px;padding:1px 7px;border-radius:999px;" + (enabled ? "background:#14b8a6;color:#042f2e;" : "background:color-mix(in srgb, currentColor 12%, transparent);color:inherit;");
      button.append(icon, copy, badge);
      bindButtonAction(button, async () => {
        try {
          const next = await invoke(state, "set-autoswitch", { enabled: !enabled });
          if (root.isConnected) renderAccountsPageState(state, root, next);
          const { refreshProfileMenu } = require_ui_profile_menu();
          refreshProfileMenu(state, next);
        } catch (error) {
          state.api.log.warn("[account-switcher] toggle autoswitch failed", errorMessage(error));
        }
      });
      return button;
    }
    function emptyAccountsRow(accountState) {
      const row = rowShell();
      const copy = document.createElement("div");
      copy.className = "flex min-w-0 flex-col gap-1 py-2";
      const title = document.createElement("div");
      title.className = "text-sm text-token-text-primary";
      title.textContent = accountState.hasActiveAuth ? t2("accounts.noSaved") : t2("accounts.noSession");
      const description = document.createElement("div");
      description.className = "text-sm text-token-text-secondary";
      description.textContent = t2("accounts.addHint");
      copy.append(title, description);
      row.appendChild(copy);
      return row;
    }
    function accountCard(state, root, accountState, name) {
      const profile = accountState.accountProfiles?.[name] || {};
      const isCurrent = accountState.current === name;
      const displayName = profile.name || accountDisplayName(accountState, name, { includeCurrent: false });
      const plan = formatPlan(profile.plan);
      const pct = accountRemainingPct(accountState, name);
      const emailText = profile.email || accountState.accountEmails?.[name] || "";
      const resetAt = accountResetAt(accountState, name);
      const usage = accountState.accountUsage?.[name];
      const card = document.createElement("div");
      card.className = "relative flex min-h-20 items-center gap-3 rounded-2xl px-4 py-3";
      card.style.boxSizing = "border-box";
      card.style.borderLeft = "3px solid transparent";
      card.style.background = isCurrent ? "color-mix(in srgb, #14b8a6 16%, transparent)" : "color-mix(in srgb, var(--color-token-text-primary, #fff) 5%, transparent)";
      if (isCurrent) {
        card.style.borderLeftColor = "#14b8a6";
        card.setAttribute("aria-current", "true");
      } else {
        card.style.cursor = "pointer";
        card.setAttribute("role", "button");
        card.setAttribute("tabindex", "0");
        card.setAttribute("aria-label", t2("profile.switchTo", { name: displayName }));
        card.addEventListener("pointerenter", () => {
          card.style.background = "color-mix(in srgb, currentColor 10%, transparent)";
        });
        card.addEventListener("pointerleave", () => {
          card.style.background = "color-mix(in srgb, var(--color-token-text-primary, #fff) 5%, transparent)";
        });
        const switchTo = (event) => {
          if (event.target instanceof Element && event.target.closest("button")) return;
          event.preventDefault();
          event.stopPropagation();
          runAccountAction(state, root, "switch", { name }, t2("accounts.switching"));
        };
        card.addEventListener("click", switchTo);
        card.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          switchTo(event);
        });
      }
      const identity = document.createElement("div");
      identity.className = "flex min-w-0 flex-1 items-center gap-3";
      identity.appendChild(accountAvatar(name, displayName, isCurrent));
      const copy = document.createElement("div");
      copy.className = "flex min-w-0 flex-1 flex-col gap-0.5";
      const title = document.createElement("div");
      title.className = "min-w-0 truncate text-base font-medium text-token-text-primary";
      title.textContent = `${displayName} \xB7 ${plan}`;
      title.title = displayName;
      copy.appendChild(title);
      if (emailText && emailText !== displayName) {
        const email = document.createElement("div");
        email.className = "min-w-0 truncate text-sm text-token-text-secondary";
        email.textContent = emailText;
        email.title = emailText;
        copy.appendChild(email);
      }
      if (resetAt) {
        const reset = document.createElement("div");
        reset.className = "text-xs text-token-text-secondary";
        reset.textContent = t2("profile.resets", { when: resetAt });
        copy.appendChild(reset);
      } else if (!usage) {
        const description = document.createElement("div");
        description.className = "text-xs text-token-text-secondary";
        description.textContent = t2("accounts.usageUnavailable");
        copy.appendChild(description);
      }
      identity.appendChild(copy);
      card.appendChild(identity);
      const right = document.createElement("div");
      right.className = "flex shrink-0 flex-col items-end gap-1";
      right.style.minWidth = "56px";
      if (isCurrent) right.appendChild(currentBadge());
      const value = document.createElement("div");
      value.className = "text-base tabular-nums text-token-text-primary";
      value.textContent = pct == null ? "\u2014" : `${pct}%`;
      right.appendChild(value);
      card.appendChild(right);
      const menuButton = iconButton(t2("accounts.actions", { account: displayName }), ellipsisIcon());
      menuButton.setAttribute("aria-haspopup", "menu");
      menuButton.setAttribute("aria-expanded", "false");
      bindButtonAction(menuButton, () => {
        if (menuButton.getAttribute("aria-expanded") === "true") {
          closeAccountMenus(root);
          return;
        }
        showAccountMenu(state, root, card, menuButton, accountState, name, isCurrent);
      });
      card.appendChild(menuButton);
      return card;
    }
    function accountAvatar(name, displayName, isCurrent) {
      const wrap = document.createElement("div");
      wrap.style.cssText = "position:relative;width:40px;height:40px;flex-shrink:0;";
      const avatar = document.createElement("div");
      avatar.setAttribute("aria-hidden", "true");
      const color = isCurrent ? "#14b8a6" : avatarColor(name);
      avatar.style.cssText = `width:40px;height:40px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;color:#fff;background:${color};`;
      avatar.textContent = initials(displayName);
      wrap.appendChild(avatar);
      if (isCurrent) {
        const check = document.createElement("div");
        check.setAttribute("aria-hidden", "true");
        check.style.cssText = "position:absolute;right:-2px;bottom:-2px;width:16px;height:16px;border-radius:999px;background:#14b8a6;color:#042f2e;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px var(--color-token-main-surface-primary, #202020);";
        check.appendChild(checkmarkIcon());
        wrap.appendChild(check);
      }
      return wrap;
    }
    function currentBadge() {
      const badge = document.createElement("span");
      badge.textContent = t2("accounts.current");
      badge.style.cssText = "font-size:10px;font-weight:700;letter-spacing:0.04em;line-height:16px;padding:1px 7px;border-radius:999px;background:#14b8a6;color:#042f2e;text-transform:uppercase;";
      return badge;
    }
    function checkmarkIcon() {
      const ns = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(ns, "svg");
      svg.setAttribute("width", "10");
      svg.setAttribute("height", "10");
      svg.setAttribute("viewBox", "0 0 12 12");
      svg.setAttribute("fill", "none");
      svg.setAttribute("aria-hidden", "true");
      const path = document.createElementNS(ns, "path");
      path.setAttribute("d", "M2.2 6.2l2.4 2.4 5.2-5.2");
      path.setAttribute("stroke", "currentColor");
      path.setAttribute("stroke-width", "1.8");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      svg.appendChild(path);
      return svg;
    }
    function usageClockIcon() {
      const ns = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(ns, "svg");
      svg.setAttribute("width", "20");
      svg.setAttribute("height", "20");
      svg.setAttribute("viewBox", "0 0 20 20");
      svg.setAttribute("fill", "none");
      svg.setAttribute("aria-hidden", "true");
      const arc = document.createElementNS(ns, "path");
      arc.setAttribute("d", "M10 17.5a7.5 7.5 0 1 0-7.4-8.7");
      arc.setAttribute("stroke", "currentColor");
      arc.setAttribute("stroke-width", "1.5");
      arc.setAttribute("stroke-linecap", "round");
      const hand = document.createElementNS(ns, "path");
      hand.setAttribute("d", "M10 10l4-3.2");
      hand.setAttribute("stroke", "currentColor");
      hand.setAttribute("stroke-width", "1.5");
      hand.setAttribute("stroke-linecap", "round");
      const center = document.createElementNS(ns, "circle");
      center.setAttribute("cx", "10");
      center.setAttribute("cy", "10");
      center.setAttribute("r", "1.2");
      center.setAttribute("fill", "currentColor");
      svg.append(arc, hand, center);
      return svg;
    }
    function showAccountMenu(state, root, card, trigger, accountState, name, isCurrent) {
      closeAccountMenus(root);
      const menu = document.createElement("div");
      menu.setAttribute("data-codexpp-account-menu", "true");
      menu.setAttribute("role", "menu");
      menu.className = "border-token-border absolute right-3 top-12 z-50 flex w-52 flex-col rounded-xl border p-1.5";
      Object.assign(menu.style, {
        background: "var(--color-token-main-surface-secondary, #252525)",
        boxShadow: "0 14px 36px rgba(0, 0, 0, 0.38)"
      });
      if (!isCurrent) {
        menu.appendChild(
          accountMenuItem(t2("accounts.switchAccount"), switchIcon(), false, () => {
            closeAccountMenus(root);
            runAccountAction(state, root, "switch", { name }, t2("accounts.switching"));
          })
        );
      }
      if (!isCurrent) {
        const separator = document.createElement("div");
        separator.className = "border-token-border my-1 border-t";
        menu.appendChild(separator);
      }
      menu.appendChild(
        accountMenuItem(t2("accounts.removeAccount"), trashIcon(), true, () => {
          closeAccountMenus(root);
          runAccountAction(state, root, "delete", { name }, t2("accounts.removing"));
        })
      );
      const close = () => {
        document.removeEventListener("pointerdown", onOutsidePointerDown, true);
        document.removeEventListener("keydown", onKeyDown, true);
        trigger.setAttribute("aria-expanded", "false");
        menu.remove();
        if (trigger.isConnected) trigger.focus();
      };
      const onOutsidePointerDown = (event) => {
        if (menu.contains(event.target) || trigger.contains(event.target)) return;
        close();
      };
      const onKeyDown = (event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        close();
      };
      menu._codexppClose = close;
      card.appendChild(menu);
      trigger.setAttribute("aria-expanded", "true");
      document.addEventListener("pointerdown", onOutsidePointerDown, true);
      document.addEventListener("keydown", onKeyDown, true);
      menu.animate?.(
        [
          { opacity: 0, transform: "translateY(-4px) scale(0.98)" },
          { opacity: 1, transform: "translateY(0) scale(1)" }
        ],
        { duration: 120, easing: "cubic-bezier(0.2, 0, 0, 1)" }
      );
      window.requestAnimationFrame(() => menu.querySelector("button")?.focus());
    }
    function accountMenuItem(label, icon, destructive, onAction) {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("role", "menuitem");
      button.className = "flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm hover:bg-token-foreground/10";
      button.style.color = destructive ? "var(--color-token-text-error, #ff6b6b)" : "var(--color-token-text-primary, currentColor)";
      button.append(icon, document.createTextNode(label));
      bindButtonAction(button, onAction);
      return button;
    }
    function closeAccountMenus(root) {
      root.querySelectorAll("[data-codexpp-account-menu]").forEach((menu) => {
        if (typeof menu._codexppClose === "function") menu._codexppClose();
        else menu.remove();
      });
    }
    function rowShell() {
      const row = document.createElement("div");
      row.className = "border-token-border flex min-h-16 items-center justify-between gap-4 border-b py-3";
      return row;
    }
    function ellipsisIcon() {
      return svgIcon([
        ["circle", { cx: "5", cy: "10", r: "1.25", fill: "currentColor" }],
        ["circle", { cx: "10", cy: "10", r: "1.25", fill: "currentColor" }],
        ["circle", { cx: "15", cy: "10", r: "1.25", fill: "currentColor" }]
      ]);
    }
    function switchIcon() {
      return svgIcon([
        ["path", { d: "M4 6h10m0 0-2.5-2.5M14 6l-2.5 2.5M16 14H6m0 0 2.5-2.5M6 14l2.5 2.5" }]
      ]);
    }
    function trashIcon() {
      return svgIcon([
        ["path", { d: "M4.5 6h11m-7-2h3m-5 4 .5 8h6l.5-8M8.5 9.5v4m3-4v4" }]
      ]);
    }
    function svgIcon(parts) {
      const namespace = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(namespace, "svg");
      svg.setAttribute("width", "20");
      svg.setAttribute("height", "20");
      svg.setAttribute("viewBox", "0 0 20 20");
      svg.setAttribute("fill", "none");
      svg.setAttribute("aria-hidden", "true");
      for (const [tag, attributes] of parts) {
        const element = document.createElementNS(namespace, tag);
        for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
        if (tag === "path") {
          element.setAttribute("stroke", "currentColor");
          element.setAttribute("stroke-width", "1.5");
          element.setAttribute("stroke-linecap", "round");
          element.setAttribute("stroke-linejoin", "round");
        }
        svg.appendChild(element);
      }
      return svg;
    }
    function refreshIcon() {
      const namespace = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(namespace, "svg");
      svg.setAttribute("width", "18");
      svg.setAttribute("height", "18");
      svg.setAttribute("viewBox", "0 0 20 20");
      svg.setAttribute("fill", "none");
      svg.setAttribute("aria-hidden", "true");
      const path = document.createElementNS(namespace, "path");
      path.setAttribute("d", "M15.4 7.1A6 6 0 1 0 16 11m-.6-3.9V3.8m0 3.3h-3.3");
      path.setAttribute("stroke", "currentColor");
      path.setAttribute("stroke-width", "1.5");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      svg.appendChild(path);
      return svg;
    }
    function refreshUsageInBackground(state, root) {
      const now = Date.now();
      if (state.usageRefreshInFlight || now - (state.lastUsageRefreshAt || 0) < 6e4) return;
      state.usageRefreshInFlight = true;
      state.lastUsageRefreshAt = now;
      invoke(state, "refresh-usage").then((accountState) => {
        if (root.isConnected) renderAccountsPageState(state, root, accountState);
      }).catch((error) => {
        state.api.log.warn("[account-switcher] usage refresh failed", errorMessage(error));
      }).finally(() => {
        state.usageRefreshInFlight = false;
      });
    }
    async function runAccountAction(state, root, action, payload, loadingText) {
      root.textContent = "";
      root.appendChild(settingsStatus(loadingText));
      try {
        const accountState = await invoke(state, action, payload);
        if (action === "switch") {
          renderAccountsPageState(state, root, accountState);
          const { refreshProfileMenu } = require_ui_profile_menu();
          refreshProfileMenu(state, accountState);
          return;
        }
        if (action === "clear-active") {
          root.textContent = "";
          root.appendChild(settingsStatus(t2("accounts.sessionClearedRelaunching")));
          scheduleAppRelaunch(state, root);
          return;
        }
        renderAccountsPageState(state, root, accountState);
      } catch (error) {
        renderAccountsPageState(state, root, {
          ...state.lastState || { accounts: [], current: null, hasActiveAuth: false },
          error: errorMessage(error)
        });
      }
    }
    function scheduleAppRelaunch(state, root) {
      window.setTimeout(() => {
        invoke(state, "relaunch").catch((error) => {
          root.textContent = "";
          root.appendChild(
            settingsStatus(t2("accounts.relaunchFailed", { error: errorMessage(error) }), true)
          );
        });
      }, 1200);
    }
    module2.exports = { renderAccountsPage, renderAccountsPageState };
  }
});

// src/ui-sidebar.js
var require_ui_sidebar = __commonJS({
  "src/ui-sidebar.js"(exports2, module2) {
    var { compactText, isVisible } = require_dom_utils();
    var { renderAccountsPage } = require_ui_settings();
    var { t: t2 } = require_i18n();
    var SHORTCUT_ATTR = "data-codexpp-account-switch-shortcut";
    var MAIN_SIDEBAR_SELECTOR = "aside, .window-fx-sidebar-surface.w-token-sidebar, [data-testid*='sidebar' i]";
    var CONTROL_SELECTOR = "button, a, [role='button'], [role='link']";
    function mountAccountSwitchShortcut(state) {
      const schedule = () => {
        if (state.disposed || state.pending) return;
        state.pending = window.requestAnimationFrame(() => {
          state.pending = 0;
          ensureShortcut(state);
        });
      };
      state.observer = new MutationObserver(schedule);
      state.observer.observe(document.documentElement, { childList: true, subtree: true });
      state.disposers.push(() => state.observer?.disconnect());
      state.disposers.push(() => restoreCodexPage(state));
      schedule();
    }
    function ensureShortcut(state) {
      maintainDirectPage(state);
      const plugins = findMainSidebarPluginsControl();
      if (!plugins) return;
      const sidebar = mainSidebarFor(plugins);
      if (!sidebar || sidebar.querySelector(`[${SHORTCUT_ATTR}]`)) return;
      const shortcut = cloneSidebarControl(plugins);
      shortcut.setAttribute(SHORTCUT_ATTR, "true");
      const open = (event) => {
        event.preventDefault();
        event.stopPropagation();
        openAccountsPage(state, sidebar, shortcut);
      };
      shortcut.addEventListener("click", open);
      plugins.after(shortcut);
    }
    function findMainSidebarPluginsControl() {
      return Array.from(document.querySelectorAll(CONTROL_SELECTOR)).find((element) => {
        if (!(element instanceof HTMLElement) || !isVisible(element)) return false;
        if (compactText(element).toLowerCase() !== "plugins") return false;
        const sidebar = mainSidebarFor(element);
        if (!sidebar) return false;
        const labels = visibleControlLabels(sidebar);
        return labels.has("new chat") && (labels.has("pull requests") || labels.has("scheduled"));
      });
    }
    function mainSidebarFor(element) {
      const sidebar = element.closest(MAIN_SIDEBAR_SELECTOR);
      return sidebar instanceof HTMLElement && isVisible(sidebar) ? sidebar : null;
    }
    function visibleControlLabels(root) {
      return new Set(
        Array.from(root.querySelectorAll(CONTROL_SELECTOR)).filter((element) => element instanceof HTMLElement && isVisible(element)).map((element) => compactText(element).toLowerCase())
      );
    }
    function cloneSidebarControl(source) {
      const shortcut = source.cloneNode(true);
      scrubNativeActionAttributes(shortcut);
      replaceLabel(shortcut, "Plugins", "Accounts");
      replaceFirstIcon(shortcut, accountSwitchIcon());
      shortcut.removeAttribute("aria-current");
      shortcut.removeAttribute("data-state");
      shortcut.setAttribute("aria-label", "Accounts");
      shortcut.setAttribute("title", "Open Accounts");
      if (shortcut instanceof HTMLAnchorElement) shortcut.removeAttribute("href");
      if (shortcut instanceof HTMLButtonElement) shortcut.type = "button";
      return shortcut;
    }
    function scrubNativeActionAttributes(root) {
      for (const element of [root, ...root.querySelectorAll("*")]) {
        element.removeAttribute("id");
        for (const name of element.getAttributeNames()) {
          if (name.startsWith("data-app-action") || name.startsWith("data-testid")) {
            element.removeAttribute(name);
          }
        }
      }
    }
    function replaceLabel(root, from, to) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        if ((node.nodeValue || "").trim().toLowerCase() === from.toLowerCase()) {
          node.nodeValue = (node.nodeValue || "").replace(new RegExp(from, "i"), to);
          return;
        }
        node = walker.nextNode();
      }
      const leaf = Array.from(root.querySelectorAll("*")).find(
        (element) => element.children.length === 0 && compactText(element).toLowerCase() === from.toLowerCase()
      );
      if (leaf) leaf.textContent = to;
    }
    function replaceFirstIcon(root, icon) {
      const existing = root.querySelector("svg");
      if (existing) existing.replaceWith(icon);
    }
    function accountSwitchIcon() {
      const namespace = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(namespace, "svg");
      svg.setAttribute("width", "20");
      svg.setAttribute("height", "20");
      svg.setAttribute("viewBox", "0 0 20 20");
      svg.setAttribute("fill", "none");
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("class", "icon-sm");
      const user = document.createElementNS(namespace, "path");
      user.setAttribute("d", "M8.25 9a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5Z");
      user.setAttribute("stroke", "currentColor");
      user.setAttribute("stroke-width", "1.5");
      const shoulders = document.createElementNS(namespace, "path");
      shoulders.setAttribute("d", "M3.75 14.5c.58-1.9 2.23-3 4.5-3 1.15 0 2.12.28 2.88.8");
      shoulders.setAttribute("stroke", "currentColor");
      shoulders.setAttribute("stroke-width", "1.5");
      shoulders.setAttribute("stroke-linecap", "round");
      const arrows = document.createElementNS(namespace, "path");
      arrows.setAttribute("d", "m12.5 10 1.75-1.75L16 10m0 0-1.75 1.75M16 10h-4.25");
      arrows.setAttribute("stroke", "currentColor");
      arrows.setAttribute("stroke-width", "1.5");
      arrows.setAttribute("stroke-linecap", "round");
      arrows.setAttribute("stroke-linejoin", "round");
      svg.append(user, shoulders, arrows);
      return svg;
    }
    function openAccountsPage(state, sidebar, shortcut) {
      if (state.directPage?.panel?.isConnected) {
        renderAccountsPage(state, state.directPage.sections);
        return;
      }
      const content = findMainContent(sidebar);
      if (!content) {
        state.api.log.warn("[account-switcher] main content area not found");
        return;
      }
      const shell = accountsPageShell();
      hideCodexChildren(content, shell.panel);
      content.appendChild(shell.panel);
      shortcut.setAttribute("aria-current", "page");
      shortcut.classList.add("bg-token-list-hover-background");
      const restoreHandler = (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target || shortcut.contains(target)) return;
        if (target.closest(CONTROL_SELECTOR)) restoreCodexPage(state);
      };
      sidebar.addEventListener("click", restoreHandler, true);
      state.directPage = {
        content,
        panel: shell.panel,
        sections: shell.sections,
        shortcut,
        sidebar,
        restoreHandler
      };
      state.api.log.info("[account-switcher] direct Accounts page opened");
      renderAccountsPage(state, shell.sections);
    }
    function findMainContent(sidebar) {
      let parent = sidebar.parentElement;
      while (parent) {
        for (const child of Array.from(parent.children)) {
          if (child === sidebar || child.contains(sidebar)) continue;
          const rect = child.getBoundingClientRect();
          if (rect.width > 300 && rect.height > 200) return child;
        }
        parent = parent.parentElement;
      }
      return null;
    }
    function accountsPageShell() {
      const panel = document.createElement("div");
      panel.setAttribute("data-codexpp-account-page", "true");
      panel.className = "main-surface flex h-full min-h-0 flex-col";
      const toolbar = document.createElement("div");
      toolbar.className = "draggable flex items-center justify-end px-panel electron:h-toolbar extension:h-toolbar-sm";
      const pageActions = document.createElement("div");
      pageActions.setAttribute("data-codexpp-account-page-actions", "true");
      pageActions.className = "no-drag flex items-center gap-2";
      pageActions.style.webkitAppRegion = "no-drag";
      pageActions.style.height = "32px";
      pageActions.style.alignItems = "center";
      toolbar.appendChild(pageActions);
      const scroll = document.createElement("div");
      scroll.className = "flex-1 overflow-y-auto p-panel";
      const inner = document.createElement("div");
      inner.className = "mx-auto flex w-full max-w-3xl flex-col electron:min-w-[calc(320px*var(--codex-window-zoom))]";
      const header = document.createElement("div");
      header.className = "flex min-w-0 flex-col gap-1.5 pb-8";
      const heading = document.createElement("div");
      heading.className = "truncate text-2xl font-normal text-token-text-primary";
      heading.textContent = t2("accounts.pageTitle");
      const subtitle = document.createElement("div");
      subtitle.className = "text-token-text-secondary text-base";
      subtitle.textContent = t2("accounts.pageSubtitle");
      const sections = document.createElement("div");
      sections.className = "flex flex-col gap-8";
      header.append(heading, subtitle);
      inner.append(header, sections);
      scroll.appendChild(inner);
      panel.append(toolbar, scroll);
      return { panel, sections };
    }
    function hideCodexChildren(content, panel) {
      for (const child of Array.from(content.children)) {
        if (child === panel) continue;
        if (child.dataset.codexppAccountHidden === void 0) {
          child.dataset.codexppAccountHidden = child.style.display || "";
        }
        child.style.display = "none";
      }
    }
    function maintainDirectPage(state) {
      const page = state.directPage;
      if (!page) return;
      if (!page.content.isConnected || !page.sidebar.isConnected) {
        page.sidebar.removeEventListener("click", page.restoreHandler, true);
        state.directPage = null;
        return;
      }
      hideCodexChildren(page.content, page.panel);
    }
    function restoreCodexPage(state) {
      const page = state.directPage;
      if (!page) return;
      page.sidebar.removeEventListener("click", page.restoreHandler, true);
      page.panel.remove();
      page.shortcut.removeAttribute("aria-current");
      page.shortcut.classList.remove("bg-token-list-hover-background");
      for (const child of Array.from(page.content.children)) {
        if (child.dataset.codexppAccountHidden === void 0) continue;
        child.style.display = child.dataset.codexppAccountHidden;
        delete child.dataset.codexppAccountHidden;
      }
      state.directPage = null;
    }
    module2.exports = {
      mountAccountSwitchShortcut,
      findMainSidebarPluginsControl,
      findMainContent,
      restoreCodexPage
    };
  }
});

// src/ui-failover.js
var require_ui_failover = __commonJS({
  "src/ui-failover.js"(exports2, module2) {
    var { invoke } = require_ipc();
    var { refreshProfileMenu } = require_ui_profile_menu();
    var { errorMessage } = require_utils();
    var OUT_OF_QUOTA = /out of codex/i;
    var INTERVAL_MS = 45e3;
    function mountFailoverWatch(state) {
      const run = () => {
        if (state.disposed || state.failoverWatchBusy) return;
        state.failoverWatchBusy = true;
        invoke(state, "refresh-usage").then((accountState) => {
          if (state.disposed || !accountState) return;
          if (accountState.autoSwitched) {
            state.api.log.info(
              `[account-switcher] auto-switched to ${accountState.current} after quota empty`
            );
            refreshProfileMenu(state, accountState);
          }
        }).catch((error) => {
          state.api.log.warn("[account-switcher] failover watch failed", errorMessage(error));
        }).finally(() => {
          state.failoverWatchBusy = false;
        });
      };
      const interval = window.setInterval(run, INTERVAL_MS);
      const startup = window.setTimeout(run, 12e3);
      let bannerTimer = 0;
      const observer = new MutationObserver((records) => {
        if (state.disposed) return;
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (!(node instanceof HTMLElement)) continue;
            const text = node.innerText || node.textContent || "";
            if (!OUT_OF_QUOTA.test(text)) continue;
            if (bannerTimer) window.clearTimeout(bannerTimer);
            bannerTimer = window.setTimeout(run, 500);
            return;
          }
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
      state.disposers.push(() => {
        window.clearInterval(interval);
        window.clearTimeout(startup);
        if (bannerTimer) window.clearTimeout(bannerTimer);
        observer.disconnect();
      });
    }
    module2.exports = { mountFailoverWatch };
  }
});

// src/renderer.js
var require_renderer = __commonJS({
  "src/renderer.js"(exports2, module2) {
    var { mountAccountSwitchShortcut } = require_ui_sidebar();
    var { mountProfileMenu } = require_ui_profile_menu();
    var { mountFailoverWatch } = require_ui_failover();
    function startRenderer2(state) {
      mountAccountSwitchShortcut(state);
      mountProfileMenu(state);
      mountFailoverWatch(state);
    }
    module2.exports = { startRenderer: startRenderer2 };
  }
});

// index.js
var { GLOBAL_SERVICE_KEY, IPC_HANDLER_KEY, IPC_CHANNEL } = require_constants();
var { createAccountService } = require_service();
var { startRenderer } = require_renderer();
module.exports = {
  start(api2) {
    if (api2.process === "main") {
      startMain(api2);
      return;
    }
    const state = {
      api: api2,
      observer: null,
      pending: 0,
      disposed: false,
      disposers: [],
      directPage: null,
      lastState: null,
      lastUsageRefreshAt: 0,
      usageRefreshInFlight: false
    };
    this._state = state;
    startRenderer(state);
  },
  stop() {
    const state = this._state;
    if (!state) return;
    state.disposed = true;
    if (state.observer) state.observer.disconnect();
    if (state.pending) window.cancelAnimationFrame(state.pending);
    for (const dispose of state.disposers.splice(0).reverse()) {
      try {
        dispose();
      } catch {
      }
    }
    if (state.profilePending) window.cancelAnimationFrame(state.profilePending);
    document.querySelectorAll("[data-codexpp-account-switch-shortcut]").forEach((element) => {
      element.remove();
    });
    document.querySelectorAll("[data-codexpp-profile-accounts]").forEach((element) => {
      element.remove();
    });
    document.querySelectorAll("[data-codexpp-profile-patched]").forEach((element) => {
      element.removeAttribute("data-codexpp-profile-patched");
    });
  }
};
function startMain(api2) {
  const service = createAccountService(api2);
  globalThis[GLOBAL_SERVICE_KEY] = service;
  if (!globalThis[IPC_HANDLER_KEY]) {
    api2.ipc.handle(IPC_CHANNEL, async (message) => {
      const active = globalThis[GLOBAL_SERVICE_KEY];
      return active.handle(message);
    });
    globalThis[IPC_HANDLER_KEY] = true;
  }
  api2.log.info("[account-switcher] main provider active");
}
