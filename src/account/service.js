const { ok, fail, errorMessage, stringifyError } = require("../utils");
const {
  clearActiveAuth,
  deleteAccount,
  refreshActiveUsage,
  relaunchCodex,
  saveCurrentAccount,
  switchAccount,
} = require("./actions");
const { readState } = require("./state");

function createAccountService(api) {
  return {
    async handle(message) {
      const action = message?.action;
      try {
        api.log?.info?.(`[account-switcher] action ${String(action)}`);
        if (action === "state") return ok(await readState());
        if (action === "save") return ok(await saveCurrentAccount(message?.name));
        if (action === "switch") return ok(await switchAccount(message?.name, api));
        if (action === "delete") return ok(await deleteAccount(message?.name));
        if (action === "clear-active") return ok(await clearActiveAuth(api));
        if (action === "refresh-usage") return ok(await refreshActiveUsage(api));
        if (action === "relaunch") return ok(await relaunchCodex(api));
        return fail(`Unknown account action: ${String(action)}`);
      } catch (error) {
        api.log.warn("[account-switcher] action failed", stringifyError(error));
        return fail(errorMessage(error));
      }
    },
  };
}

module.exports = { createAccountService };
