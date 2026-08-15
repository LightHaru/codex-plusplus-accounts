const assert = require("node:assert/strict");
const test = require("node:test");
const { EventEmitter } = require("node:events");
const { startTray, destroyTray, showWindow, quitApp } = require("../src/tray");

function mockElectron({ trayThrow = false, hasTray = true } = {}) {
  class FakeTray extends EventEmitter {
    constructor(image) {
      super();
      if (trayThrow) throw new Error("tray boom");
      this.image = image;
      this.tooltip = "";
      this.menu = null;
      this.destroyed = false;
    }
    setToolTip(text) { this.tooltip = text; }
    setContextMenu(menu) { this.menu = menu; }
    destroy() { this.destroyed = true; }
  }
  const image = {
    isEmpty() { return false; },
    resize() { return this; },
  };
  return {
    Tray: hasTray ? FakeTray : undefined,
    Menu: {
      buildFromTemplate(template) { return { template }; },
    },
    nativeImage: {
      createFromPath() { return image; },
      createEmpty() { return image; },
    },
    BrowserWindow: {
      getAllWindows() { return []; },
    },
    app: {
      exitCalls: 0,
      exit() { this.exitCalls += 1; },
    },
  };
}

test("startTray creates a tooltip and Show/Quit menu", () => {
  const electron = mockElectron();
  const logs = [];
  const tray = startTray(
    { log: { info: (m) => logs.push(m), warn: (m) => logs.push(m) } },
    { electron, iconPath: __filename },
  );
  assert.ok(tray);
  assert.equal(tray.tooltip, "Codex Accounts");
  assert.equal(tray.menu.template[0].label, "Show ChatGPT");
  assert.equal(tray.menu.template[2].label, "Quit");
  assert.match(logs.join("\n"), /tray icon ready/);
  destroyTray();
  assert.equal(tray.destroyed, true);
});

test("startTray no-ops when Tray is missing", () => {
  const warnings = [];
  const tray = startTray(
    { log: { info() {}, warn: (m) => warnings.push(m) } },
    { electron: mockElectron({ hasTray: false }) },
  );
  assert.equal(tray, null);
  assert.match(warnings.join("\n"), /Tray API missing/);
});

test("startTray no-ops when Tray constructor throws", () => {
  const warnings = [];
  const tray = startTray(
    { log: { info() {}, warn: (m) => warnings.push(m) } },
    { electron: mockElectron({ trayThrow: true }), iconPath: __filename },
  );
  assert.equal(tray, null);
  assert.match(warnings.join("\n"), /tray create failed/);
});

test("showWindow prefers Owl showLastActivePrimaryWindow", () => {
  let called = false;
  globalThis.__codexpp_window_services__ = {
    showLastActivePrimaryWindow() { called = true; return true; },
  };
  try {
    assert.equal(showWindow({ getAllWindows() { return []; } }), true);
    assert.equal(called, true);
  } finally {
    delete globalThis.__codexpp_window_services__;
  }
});

test("showWindow falls back to a hidden BrowserWindow", () => {
  const hidden = { visible: false, isVisible() { return this.visible; }, show() { this.visible = true; }, focus() { this.focused = true; } };
  assert.equal(showWindow({ getAllWindows() { return [hidden]; } }), true);
  assert.equal(hidden.visible, true);
  assert.equal(hidden.focused, true);
});

test("quitApp marks quitting, exits, and taskkills ChatGPT.exe", () => {
  const cmds = [];
  let marked = false;
  const app = { exitCalls: 0, exit() { this.exitCalls += 1; } };
  globalThis.__codexpp_window_services__ = {
    markAppQuitting() { marked = true; },
  };
  try {
    quitApp(app, (cmd) => cmds.push(cmd));
  } finally {
    delete globalThis.__codexpp_window_services__;
  }
  assert.equal(marked, true);
  assert.equal(app.exitCalls, 1);
  assert.equal(cmds[0], "taskkill /F /IM ChatGPT.exe /T");
});
