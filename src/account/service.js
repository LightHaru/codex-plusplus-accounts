const { ok, fail, errorMessage, stringifyError } = require("../utils");
const {
  clearActiveAuth,
  deleteAccount,
  refreshActiveUsage,
  relaunchCodex,
  addAccountWithoutRelaunch,
  maybeFailover,
  saveCurrentAccount,
  setAutoswitchEnabled,
  switchAccount,
} = require("./actions");
const { readState } = require("./state");

const ACTIONS = new Set([
  "state",
  "save",
  "switch",
  "delete",
  "clear-active",
  "refresh-usage",
  "relaunch",
  "add-account",
  "failover-check",
  "set-autoswitch",
]);

function createAccountService(api) {
  return {
    async handle(message) {
      const action = typeof message?.action === "string" ? message.action : "";
      try {
        if (!ACTIONS.has(action)) return fail("Unknown account action.");
        api.log?.info?.(`[account-switcher] action ${action}`);
        if (action === "state") return ok(await readState());
        if (action === "save") return ok(await saveCurrentAccount(message?.name));
        if (action === "switch") return ok(await switchAccount(message?.name, api));
        if (action === "delete") return ok(await deleteAccount(message?.name));
        if (action === "clear-active") return ok(await clearActiveAuth(api));
        if (action === "refresh-usage") return ok(await refreshActiveUsage(api));
        if (action === "relaunch") return ok(await relaunchCodex(api));
        if (action === "add-account") return ok(await addAccountWithoutRelaunch(api));
        if (action === "failover-check") return ok(await maybeFailover(api));
        if (action === "set-autoswitch") return ok(await setAutoswitchEnabled(message?.enabled !== false));
        return fail("Unknown account action.");
      } catch (error) {
        api.log.warn("[account-switcher] action failed", stringifyError(error));
        return fail(errorMessage(error));
      }
    },
  };
}

module.exports = { createAccountService };
