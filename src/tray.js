const ICON_RELATIVE = ["assets", "icon.png"];

let tray = null;

function electron() {
  const electronRequire = eval("require");
  return electronRequire("electron");
}

function nodeFs() {
  const nodeRequire = eval("require");
  return nodeRequire("node:fs");
}

function nodePath() {
  const nodeRequire = eval("require");
  return nodeRequire("node:path");
}

function nodeChildProcess() {
  const nodeRequire = eval("require");
  return nodeRequire("node:child_process");
}

function resolveIconPath() {
  const fs = nodeFs();
  const path = nodePath();
  const candidates = [
    path.join(__dirname, ...ICON_RELATIVE),
    path.join(__dirname, "..", ...ICON_RELATIVE),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      /* ignore missing icon */
    }
  }
  return null;
}

function showWindow(BrowserWindow) {
  try {
    const services = globalThis.__codexpp_window_services__;
    if (services && typeof services.showLastActivePrimaryWindow === "function") {
      if (services.showLastActivePrimaryWindow()) return true;
    }
    const primary = services && typeof services.getPrimaryWindow === "function"
      ? services.getPrimaryWindow()
      : null;
    if (primary && typeof primary.show === "function") {
      primary.show();
      if (typeof primary.focus === "function") primary.focus();
      return true;
    }
  } catch {
    /* Owl services optional */
  }

  try {
    const windows = BrowserWindow && typeof BrowserWindow.getAllWindows === "function"
      ? BrowserWindow.getAllWindows()
      : [];
    const hidden = windows.find((win) => win && win.isVisible && !win.isVisible());
    const target = hidden || windows[0];
    if (!target) return false;
    if (typeof target.show === "function") target.show();
    if (typeof target.focus === "function") target.focus();
    return true;
  } catch {
    return false;
  }
}

function quitApp(app, execFn) {
  try {
    const services = globalThis.__codexpp_window_services__;
    if (services && typeof services.markAppQuitting === "function") {
      services.markAppQuitting();
    }
  } catch {
    /* ignore */
  }

  try {
    if (app && typeof app.exit === "function") app.exit(0);
  } catch {
    /* ignore */
  }

  const kill = typeof execFn === "function"
    ? execFn
    : process.platform === "win32"
      ? (cmd) => nodeChildProcess().exec(cmd)
      : null;
  if (kill) {
    try {
      kill("taskkill /F /IM ChatGPT.exe /T");
    } catch {
      /* last-resort kill is best-effort */
    }
  }
}

function destroyTray() {
  if (!tray) return;
  try {
    tray.destroy();
  } catch {
    /* already gone */
  }
  tray = null;
}

function startTray(api, overrides) {
  destroyTray();
  const log = (api && api.log) || { info() {}, warn() {} };
  const e = overrides && overrides.electron ? overrides.electron : null;
  let Tray;
  let Menu;
  let nativeImage;
  let BrowserWindow;
  let app;
  try {
    ({ Tray, Menu, nativeImage, BrowserWindow, app } = e || electron());
  } catch {
    log.warn("[codex-accounts] electron unavailable for tray");
    return null;
  }
  if (typeof Tray !== "function") {
    log.warn("[codex-accounts] Tray API missing");
    return null;
  }

  let image = null;
  try {
    const iconFile = (overrides && overrides.iconPath) || resolveIconPath();
    if (iconFile && nativeImage && typeof nativeImage.createFromPath === "function") {
      image = nativeImage.createFromPath(iconFile);
      if (image && typeof image.isEmpty === "function" && image.isEmpty()) image = null;
      if (image && process.platform === "win32" && typeof image.resize === "function") {
        image = image.resize({ width: 16, height: 16 });
      }
    }
  } catch {
    image = null;
  }
  if (!image && nativeImage && typeof nativeImage.createEmpty === "function") {
    image = nativeImage.createEmpty();
  }
  if (!image) {
    log.warn("[codex-accounts] tray icon image missing");
    return null;
  }

  try {
    tray = new Tray(image);
  } catch {
    log.warn("[codex-accounts] tray create failed");
    tray = null;
    return null;
  }

  try {
    tray.setToolTip("Codex Accounts");
  } catch {
    /* tooltip optional */
  }

  const clickShow = () => showWindow(BrowserWindow);
  const clickQuit = () => quitApp(app, overrides && overrides.exec);

  try {
    if (Menu && typeof Menu.buildFromTemplate === "function") {
      tray.setContextMenu(
        Menu.buildFromTemplate([
          { label: "Show ChatGPT", click: clickShow },
          { type: "separator" },
          { label: "Quit", click: clickQuit },
        ]),
      );
    }
  } catch {
    /* menu optional; click still quits via no menu */
  }

  try {
    if (typeof tray.on === "function") tray.on("click", clickShow);
  } catch {
    /* click handler optional */
  }

  log.info("[codex-accounts] tray icon ready");
  return tray;
}

module.exports = {
  startTray,
  destroyTray,
  showWindow,
  quitApp,
  resolveIconPath,
};
