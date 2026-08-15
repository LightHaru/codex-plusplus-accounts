const { nodeDeps, codexAuthPaths, ensureDir } = require("../node-utils");

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
    accounts
      .map((name) => [name, normalizeUsageSnapshot(raw[name])])
      .filter(([, usage]) => usage),
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
    /* start a new cache */
  }
  cache[name] = usage;
  await ensureDir(CODEX_DIR);
  await fsp.writeFile(USAGE_CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
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
    at: Number.isFinite(at) ? at : Date.now(),
  };
}

function normalizeUsageWindow(window) {
  if (!window || typeof window !== "object") return null;
  const pct = Number(window.pct);
  if (!Number.isFinite(pct)) return null;
  return {
    label: typeof window.label === "string" && window.label ? window.label : null,
    pct: Math.max(0, Math.min(100, Math.round(pct))),
    resetAt: typeof window.resetAt === "string" && window.resetAt ? window.resetAt : null,
  };
}

async function fetchActiveUsageSnapshot(api) {
  if (typeof api?.fetchActiveUsage === "function") {
    return api.fetchActiveUsage();
  }
  const usage = await fetchUsageInCodexWebview();
  return snapshotFromUsagePayload(usage);
}

async function fetchUsageInCodexWebview() {
  const electronRequire = eval("require");
  const { webContents } = electronRequire("electron");
  const candidates = webContents
    .getAllWebContents()
    .filter((wc) => {
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
    at: Date.now(),
  };
}

function collectUsageWindows(value, out = [], seen = new WeakSet()) {
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
  for (const window of windows) {
    const minutes = Number(window?.limit_window_seconds) / 60;
    if (!Number.isFinite(minutes) || !predicate(minutes)) continue;
    const distance = Math.abs(minutes - targetMinutes);
    if (!best || distance < bestDistance) {
      best = window;
      bestDistance = distance;
    }
  }
  return best;
}

function usageWindowSnapshot(window, label) {
  if (!window || typeof window !== "object") return null;
  const used = Number(window.used_percent);
  if (!Number.isFinite(used)) return null;
  const resetAt = formatUsageResetAt(window.reset_at, Number(window.limit_window_seconds) >= 86400);
  return {
    label,
    pct: Math.round(Math.min(Math.max(100 - used, 0), 100)),
    resetAt,
  };
}

function formatUsageResetAt(epochSeconds, includeDay) {
  const seconds = Number(epochSeconds);
  if (!Number.isFinite(seconds)) return null;
  const date = new Date(seconds * 1000);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleString("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Saigon",
  });
}

module.exports = {
  readAccountUsage,
  writeAccountUsage,
  normalizeUsageSnapshot,
  normalizeUsageWindow,
  fetchActiveUsageSnapshot,
  snapshotFromUsagePayload,
};
