const crypto = require("node:crypto");
const { profileFromAuth } = require("./auth");
const { nodeDeps, accountPath, ensureDir } = require("../node-utils");
const { isSafeLoginNavigation, writeAuthSnapshotFile } = require("../security");
const {
  nextAvailableAccountName,
  findMatchingAccountByEmail,
  listAccountNames,
} = require("./storage");

const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const ISSUER = "https://auth.openai.com";
const REDIRECT_URI = "http://localhost:1455/auth/callback";
const SCOPE =
  "openid profile email offline_access api.connectors.read api.connectors.invoke";
const ORIGINATOR = "codex_cli_rs";
const PARTITION = "persist:codexpp-add-account";
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

let inflight = null;

function electron() {
  const electronRequire = eval("require");
  return electronRequire("electron");
}

function nodeHttps() {
  const nodeRequire = eval("require");
  return nodeRequire("node:https");
}

function base64url(buffer) {
  return Buffer.from(buffer).toString("base64url");
}

function generatePkce() {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

function generateState() {
  return base64url(crypto.randomBytes(32));
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
    originator: ORIGINATOR,
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
    errorDescription: parsed.searchParams.get("error_description") || "",
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
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode || 0,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
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
    code_verifier: verifier,
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
      subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
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
      Buffer.from(String(idToken).split(".")[1], "base64url").toString("utf8"),
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
      refresh_token: tokens.refresh_token,
    },
    last_refresh: new Date().toISOString(),
  };
  if (accountId) auth.tokens.account_id = accountId;
  return auth;
}

function sanitizeAccountName(raw) {
  let name = String(raw || "account")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/^[^a-zA-Z0-9]+/, "")
    .slice(0, 60);
  if (!name) name = "account";
  return name;
}

async function saveIncomingAccount(auth) {
  const { fsp } = nodeDeps();
  const { ACCOUNTS_DIR } = require("../node-utils").codexAuthPaths();
  await ensureDir(ACCOUNTS_DIR);
  const raw = `${JSON.stringify(auth, null, 2)}\n`;
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
        /* already closed */
      }
      ses.clearStorageData().catch(() => {});
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
            callback.errorDescription || `Sign-in failed: ${callback.error}`,
          ),
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
        (error) => finish(error),
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
        parent: parent || undefined,
        modal: Boolean(parent),
        show: true,
        backgroundColor: "#202020",
        webPreferences: {
          partition: PARTITION,
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        },
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

async function runChatGptLogin(api) {
  if (inflight) {
    api?.log?.info?.("[account-switcher] add-account login window already open");
    return inflight;
  }

  const pkce = generatePkce();
  const state = generateState();
  const authUrl = buildAuthorizeUrl(pkce.challenge, state);
  api?.log?.info?.("[account-switcher] opening isolated ChatGPT login window");

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
  runChatGptLogin,
};
