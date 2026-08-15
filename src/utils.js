function ok(state) {
  return { ok: true, state };
}

function fail(error) {
  return { ok: false, error };
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function stringifyError(error) {
  return error instanceof Error ? error.stack || error.message : String(error);
}

module.exports = { ok, fail, errorMessage, stringifyError };
