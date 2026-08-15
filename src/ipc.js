const { IPC_CHANNEL } = require("./constants");

/**
 * Invokes an IPC action on the main-process account service.
 * Throws on failure so callers can use try/catch uniformly.
 *
 * @param {object} state  - Renderer state (holds api + lastState cache)
 * @param {string} action - IPC action name
 * @param {object} payload
 */
async function invoke(state, action, payload = {}) {
  const result = await state.api.ipc.invoke(IPC_CHANNEL, { ...payload, action });
  if (!result?.ok) throw new Error(result?.error || "Account switcher action failed.");
  state.lastState = result.state;
  return result.state;
}

module.exports = { invoke };
