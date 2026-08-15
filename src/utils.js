const { redactSecrets } = require("./security");

function ok(state) {
  return { ok: true, state };
}

function fail(error) {
  return { ok: false, error: redactSecrets(error) };
}

function errorMessage(error) {
  return redactSecrets(error instanceof Error ? error.message : String(error));
}

function stringifyError(error) {
  const text = error instanceof Error ? error.stack || error.message : String(error);
  return redactSecrets(text);
}

module.exports = { ok, fail, errorMessage, stringifyError };
