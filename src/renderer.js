const { mountAccountSwitchShortcut } = require("./ui-sidebar");
const { mountProfileMenu } = require("./ui-profile-menu");

/**
 * Exposes account switching from the native avatar menu, with a sidebar
 * Accounts page as fallback.
 *
 * @param {object} state - Shared renderer state created in index.js
 */
function startRenderer(state) {
  mountAccountSwitchShortcut(state);
  mountProfileMenu(state);
}

module.exports = { startRenderer };
