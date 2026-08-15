const STRINGS = {
  "accounts.loading": "Loading saved accounts...",
  "accounts.refresh": "Refresh accounts",
  "accounts.add": "Add account",
  "accounts.confirmTitle": "Add another account?",
  "accounts.confirmMessage": "Codex will log out of the current account and restart. After it reopens, you can sign in with another account.",
  "accounts.cancel": "Cancel",
  "accounts.confirmAdd": "Log out and restart",
  "accounts.saved": "Saved accounts",
  "accounts.noSaved": "No saved accounts",
  "accounts.noSession": "No active session",
  "accounts.addHint": "Add an account to start switching between sessions.",
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
  "profile.switchFailed": "Could not switch: {error}",
  "service.saved": "Saved current account as {name}.",
  "service.switched": "Switched to {name}.",
  "service.removed": "Removed saved account {name}.",
  "service.sessionCleared": "Session cleared. Relaunching Codex for sign-in.",
  "service.relaunching": "Relaunching Codex...",
};

function t(key, params = {}) {
  const template = STRINGS[key] || key;
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name) => {
    return Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match;
  });
}

module.exports = { t };
