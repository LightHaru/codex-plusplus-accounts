const { invoke } = require("./ipc");
const { refreshProfileMenu } = require("./ui-profile-menu");
const { errorMessage } = require("./utils");

const OUT_OF_QUOTA = /out of codex/i;
const INTERVAL_MS = 45_000;

function mountFailoverWatch(state) {
  const run = () => {
    if (state.disposed || state.failoverWatchBusy) return;
    state.failoverWatchBusy = true;
    invoke(state, "refresh-usage")
      .then((accountState) => {
        if (state.disposed || !accountState) return;
        if (accountState.autoSwitched) {
          state.api.log.info(
            `[account-switcher] auto-switched to ${accountState.current} after quota empty`,
          );
          refreshProfileMenu(state, accountState);
        }
      })
      .catch((error) => {
        state.api.log.warn("[account-switcher] failover watch failed", errorMessage(error));
      })
      .finally(() => {
        state.failoverWatchBusy = false;
      });
  };

  const interval = window.setInterval(run, INTERVAL_MS);
  const startup = window.setTimeout(run, 12_000);

  let bannerTimer = 0;
  const observer = new MutationObserver((records) => {
    if (state.disposed) return;
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        const text = node.innerText || node.textContent || "";
        if (!OUT_OF_QUOTA.test(text)) continue;
        if (bannerTimer) window.clearTimeout(bannerTimer);
        bannerTimer = window.setTimeout(run, 500);
        return;
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  state.disposers.push(() => {
    window.clearInterval(interval);
    window.clearTimeout(startup);
    if (bannerTimer) window.clearTimeout(bannerTimer);
    observer.disconnect();
  });
}

module.exports = { mountFailoverWatch };
