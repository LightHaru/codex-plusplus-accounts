/**
 * Codex Accounts
 *
 * Codex++ tweak that switches saved Codex sessions from the native avatar
 * menu (sidebar Accounts page remains as fallback). Main process owns all
 * auth file operations; renderer only sends account names and receives
 * snapshot metadata. Switching copies auth.json and does not relaunch.
 *
 * Entry point — delegates immediately to the appropriate process module.
 */

const { GLOBAL_SERVICE_KEY, IPC_HANDLER_KEY, IPC_CHANNEL } = require("./src/constants");
const { createAccountService } = require("./src/account/service");
const { startRenderer } = require("./src/renderer");

// ─── Tweak export ─────────────────────────────────────────────────────────────

/** @type {import("@codex-plusplus/sdk").Tweak} */
module.exports = {
  start(api) {
    if (api.process === "main") {
      startMain(api);
      return;
    }

    const state = {
      api,
      observer: null,
      pending: 0,
      disposed: false,
      disposers: [],
      directPage: null,
      lastState: null,
      lastUsageRefreshAt: 0,
      usageRefreshInFlight: false,
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
        /* listener may already be gone */
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
  },
};

// ─── Main process bootstrap ───────────────────────────────────────────────────

function startMain(api) {
  const service = createAccountService(api);
  globalThis[GLOBAL_SERVICE_KEY] = service;

  if (!globalThis[IPC_HANDLER_KEY]) {
    api.ipc.handle(IPC_CHANNEL, async (message) => {
      const active = globalThis[GLOBAL_SERVICE_KEY];
      return active.handle(message);
    });
    globalThis[IPC_HANDLER_KEY] = true;
  }

  api.log.info("[account-switcher] main provider active");
}
