const { mountAccountSwitchShortcut } = require("./ui-sidebar");
const { mountProfileMenu } = require("./ui-profile-menu");
const { mountFailoverWatch } = require("./ui-failover");

/**
 * Exposes account switching from the native avatar menu, with a sidebar
 * Accounts page as fallback. Also watches quota so an exhausted live
 * session can hop to another saved account that still has remaining.
 *
 * @param {object} state - Shared renderer state created in index.js
 */
function startRenderer(state) {
  mountAccountSwitchShortcut(state);
  mountProfileMenu(state);
  mountFailoverWatch(state);
}

module.exports = { startRenderer };
