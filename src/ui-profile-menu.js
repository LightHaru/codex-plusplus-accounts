const { compactText, isVisible, protectInteractiveControl } = require("./dom-utils");
const { invoke } = require("./ipc");
const { t } = require("./i18n");
const { errorMessage } = require("./utils");
const {
  accountDisplayName,
  bindButtonAction,
} = require("./ui-components");
const {
  accountRemainingPct,
  totalRemainingPct,
  formatPlan,
  initials,
  avatarColor,
} = require("./display");

const BLOCK_ATTR = "data-codexpp-profile-accounts";
const PATCHED_ATTR = "data-codexpp-profile-patched";
const POPUP_SELECTOR = [
  '[role="menu"]',
  '[role="dialog"]',
  '[data-radix-menu-content]',
  '[data-radix-dropdown-menu-content]',
  '[data-radix-popover-content]',
  '[data-radix-popper-content-wrapper]',
].join(", ");
const CONTROL_SELECTOR =
  "button, a, [role='menuitem'], [role='link'], [role='option'], [data-radix-collection-item]";

const STOCK_ITEM_PATTERN = /^(show pet|usage remaining|rate limits remaining|personal account|settings|log\s*out|sign\s*out)(\b|$)/i;
const LOGOUT_PATTERN = /^(log\s*out|sign\s*out)(\b|$)/i;
const FILE_MENU_PATTERN = /^(new chat|new window|open folder|exit|quit)(\b|$)/i;

function mountProfileMenu(state) {
  const schedule = () => {
    if (state.disposed || state.profilePending) return;
    state.profilePending = window.requestAnimationFrame(() => {
      state.profilePending = 0;
      ensureProfileMenu(state);
    });
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  state.disposers.push(() => observer.disconnect());
  state.disposers.push(() => {
    document.querySelectorAll(`[${BLOCK_ATTR}]`).forEach((element) => element.remove());
    document.querySelectorAll(`[${PATCHED_ATTR}]`).forEach((element) => {
      element.removeAttribute(PATCHED_ATTR);
    });
  });
  schedule();
}

function refreshProfileMenu(state, accountState) {
  state.profileMenuDirty = true;
  if (accountState) state.lastState = accountState;
  const popup = findProfilePopup();
  if (!popup) return;
  const existing = popup.querySelector(`[${BLOCK_ATTR}]`);
  if (existing) existing.remove();
  popup.removeAttribute(PATCHED_ATTR);
  ensureProfileMenu(state, accountState);
}

function ensureProfileMenu(state, knownState) {
  if (state.disposed) return;
  const popup = findProfilePopup();
  if (!popup) return;

  const fingerprint = profileFingerprint(knownState || state.lastState);
  if (
    !state.profileMenuDirty &&
    popup.getAttribute(PATCHED_ATTR) === fingerprint &&
    popup.querySelector(`[${BLOCK_ATTR}]`)
  ) {
    return;
  }

  if (knownState) {
    renderProfileAccounts(state, popup, knownState);
    return;
  }

  const existing = popup.querySelector(`[${BLOCK_ATTR}]`);
  if (!existing) renderProfileAccounts(state, popup, state.lastState || { accounts: [] }, { loading: true });
  popup.setAttribute(PATCHED_ATTR, fingerprint || "pending");

  if (state.profileMenuFetch && !state.profileMenuDirty) return;
  state.profileMenuDirty = false;
  const request = invoke(state, "state");
  state.profileMenuFetch = request;
  request
    .then((accountState) => {
      if (state.disposed || state.profileMenuFetch !== request) return;
      const open = findProfilePopup();
      if (!open) return;
      renderProfileAccounts(state, open, accountState);
    })
    .catch((error) => {
      state.api.log.warn("[account-switcher] profile menu state failed", errorMessage(error));
    })
    .finally(() => {
      if (state.profileMenuFetch === request) state.profileMenuFetch = null;
    });
}

function renderProfileAccounts(state, popup, accountState, options = {}) {
  const accounts = Array.isArray(accountState?.accounts) ? accountState.accounts : [];
  const fingerprint = options.loading ? "loading" : profileFingerprint(accountState);
  popup.setAttribute(PATCHED_ATTR, fingerprint);

  if (!options.loading && !accounts.length) {
    popup.querySelector(`[${BLOCK_ATTR}]`)?.remove();
    return;
  }

  const block = document.createElement("div");
  block.setAttribute(BLOCK_ATTR, "true");
  block.style.cssText =
    "display:flex;flex-direction:column;gap:2px;padding:4px 6px 8px;margin:0 0 4px;border-bottom:1px solid color-mix(in srgb, currentColor 12%, transparent);";

  if (options.loading) {
    const status = document.createElement("div");
    status.style.cssText = "padding:8px 10px;font-size:12px;color:var(--color-token-text-secondary,currentColor);";
    status.textContent = t("accounts.loading");
    block.appendChild(status);
  } else {
    block.appendChild(usageSummaryRow(accountState, accounts.length));
    for (const name of accounts) {
      block.appendChild(profileAccountRow(state, name, accountState));
    }
    block.appendChild(addSubscriptionRow(state));
    block.appendChild(autoSwitchRow(state, accountState));
    if (accountState?.error) {
      const error = document.createElement("div");
      error.style.cssText = "padding:4px 10px;font-size:11px;color:var(--color-token-text-error,#c2410c);";
      error.textContent = accountState.error;
      block.appendChild(error);
    }
  }

  const existing = popup.querySelector(`[${BLOCK_ATTR}]`);
  if (existing) existing.replaceWith(block);
  else {
    const anchor = firstStockAnchor(popup);
    if (anchor) anchor.before(block);
    else popup.prepend(block);
  }
  if (!options.loading) hideNativeUsageRows(popup);
}

function usageSummaryRow(accountState, count) {
  const row = document.createElement("div");
  row.style.cssText =
    "display:flex;align-items:center;gap:10px;padding:8px 10px 10px;color:var(--color-token-text-primary,currentColor);";

  const icon = document.createElement("div");
  icon.setAttribute("aria-hidden", "true");
  icon.style.cssText = "width:18px;height:18px;display:flex;align-items:center;justify-content:center;opacity:0.85;";
  icon.innerHTML =
    '<svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M10 17.5a7.5 7.5 0 1 0-7.4-8.7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M10 10l4-3.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="10" cy="10" r="1.2" fill="currentColor"/></svg>';

  const copy = document.createElement("div");
  copy.style.cssText = "min-width:0;flex:1;display:flex;flex-direction:column;gap:1px;";
  const title = document.createElement("div");
  title.style.cssText = "font-size:14px;line-height:18px;font-weight:500;";
  title.textContent = t("profile.usageRemaining");
  const sub = document.createElement("div");
  sub.style.cssText = "font-size:12px;line-height:16px;color:var(--color-token-text-secondary,currentColor);";
  sub.textContent = t("profile.connected", { n: count });
  copy.append(title, sub);

  const total = totalRemainingPct(accountState);
  const value = document.createElement("div");
  value.style.cssText = "font-size:14px;line-height:18px;font-weight:500;font-variant-numeric:tabular-nums;";
  value.textContent = total == null ? "—" : `${total}%`;

  row.append(icon, copy, value);
  return row;
}

function profileAccountRow(state, name, accountState) {
  const profile = accountState.accountProfiles?.[name] || {};
  const isCurrent = accountState.current === name;
  const displayName = profile.name || accountDisplayName(accountState, name, { includeCurrent: false });
  const plan = formatPlan(profile.plan);
  const pct = accountRemainingPct(accountState, name);

  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("data-codexpp-profile-account", name);
  button.setAttribute("aria-current", isCurrent ? "true" : "false");
  button.setAttribute(
    "aria-label",
    isCurrent ? `${displayName} (${t("accounts.current")})` : t("profile.switchTo", { name: displayName }),
  );
  button.disabled = isCurrent || !!state.profileMenuBusy;
  button.style.cssText =
    "width:100%;border:0;background:transparent;color:inherit;font:inherit;text-align:left;" +
    "display:flex;align-items:center;gap:10px;padding:8px 10px 8px 7px;border-radius:10px;cursor:pointer;" +
    "box-sizing:border-box;border-left:3px solid transparent;";
  if (isCurrent) {
    button.style.background = "color-mix(in srgb, #14b8a6 16%, transparent)";
    button.style.borderLeftColor = "#14b8a6";
    button.style.cursor = "default";
  }

  const avatarWrap = document.createElement("div");
  avatarWrap.style.cssText = "position:relative;width:28px;height:28px;flex-shrink:0;";
  const avatar = document.createElement("div");
  avatar.setAttribute("aria-hidden", "true");
  const color = isCurrent ? "#14b8a6" : avatarColor(name);
  avatar.style.cssText =
    `width:28px;height:28px;border-radius:999px;display:flex;align-items:center;justify-content:center;` +
    `font-size:11px;font-weight:600;color:#fff;background:${color};`;
  avatar.textContent = initials(displayName);
  avatarWrap.appendChild(avatar);
  if (isCurrent) {
    const check = document.createElement("div");
    check.setAttribute("aria-hidden", "true");
    check.style.cssText =
      "position:absolute;right:-3px;bottom:-3px;width:14px;height:14px;border-radius:999px;" +
      "background:#14b8a6;color:#042f2e;display:flex;align-items:center;justify-content:center;" +
      "box-shadow:0 0 0 2px var(--color-token-main-surface-primary, #202020);";
    check.innerHTML =
      '<svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2.2 6.2l2.4 2.4 5.2-5.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    avatarWrap.appendChild(check);
  }

  const copy = document.createElement("div");
  copy.style.cssText = "min-width:0;flex:1;display:flex;flex-direction:column;gap:2px;";
  const title = document.createElement("div");
  title.style.cssText = "font-size:14px;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
  title.textContent = `${displayName} · ${plan}`;
  title.title = displayName;
  const dots = document.createElement("div");
  dots.style.cssText = "font-size:11px;letter-spacing:1.5px;color:var(--color-token-text-secondary,currentColor);opacity:0.7;";
  dots.textContent = "••••••••";
  copy.append(title, dots);
  const usage = accountState?.accountUsage?.[name];
  const resetAt = usage?.weekly?.resetAt || usage?.fiveHour?.resetAt;
  if (resetAt) {
    const reset = document.createElement("div");
    reset.style.cssText = "font-size:11px;line-height:15px;color:var(--color-token-text-secondary,currentColor);white-space:normal;";
    reset.textContent = t("profile.resets", { when: resetAt });
    copy.appendChild(reset);
  }

  const right = document.createElement("div");
  right.style.cssText = "flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:4px;min-width:52px;";
  if (isCurrent) {
    const badge = document.createElement("span");
    badge.textContent = t("accounts.current");
    badge.style.cssText =
      "font-size:10px;font-weight:700;letter-spacing:0.04em;line-height:16px;padding:1px 7px;" +
      "border-radius:999px;background:#14b8a6;color:#042f2e;text-transform:uppercase;";
    right.appendChild(badge);
  }
  const value = document.createElement("div");
  value.style.cssText = "font-size:14px;line-height:18px;font-variant-numeric:tabular-nums;color:var(--color-token-text-primary,currentColor);";
  value.textContent = pct == null ? "—" : `${pct}%`;
  right.appendChild(value);

  button.append(avatarWrap, copy, right);
  protectInteractiveControl(button);
  button.addEventListener("pointerenter", () => {
    if (button.disabled && !isCurrent) return;
    if (isCurrent) {
      button.style.background = "color-mix(in srgb, #14b8a6 22%, transparent)";
      return;
    }
    button.style.background = "color-mix(in srgb, currentColor 10%, transparent)";
  });
  button.addEventListener("pointerleave", () => {
    button.style.background = isCurrent ? "color-mix(in srgb, #14b8a6 16%, transparent)" : "transparent";
  });
  if (!isCurrent) {
    bindButtonAction(button, () => switchFromProfileMenu(state, name, displayName));
  }
  return button;
}


function addSubscriptionRow(state) {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("data-codexpp-profile-add", "true");
  button.style.cssText =
    "width:100%;border:0;background:transparent;color:var(--color-token-text-primary,currentColor);font:inherit;" +
    "display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;cursor:pointer;text-align:left;";
  const plus = document.createElement("div");
  plus.setAttribute("aria-hidden", "true");
  plus.style.cssText =
    "width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:18px;line-height:18px;opacity:0.85;";
  plus.textContent = "+";
  const label = document.createElement("div");
  label.style.cssText = "font-size:14px;line-height:18px;";
  label.textContent = t("profile.addSubscription");
  button.append(plus, label);
  protectInteractiveControl(button);
  button.addEventListener("pointerenter", () => {
    button.style.background = "color-mix(in srgb, currentColor 10%, transparent)";
  });
  button.addEventListener("pointerleave", () => {
    button.style.background = "transparent";
  });
  bindButtonAction(button, () => addAccountFromProfileMenu(state));
  return button;
}

function autoSwitchRow(state, accountState) {
  const enabled = accountState?.autoswitchEnabled !== false;
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("data-codexpp-profile-autoswitch", "true");
  button.setAttribute("aria-pressed", enabled ? "true" : "false");
  button.style.cssText =
    "width:100%;border:0;background:transparent;color:inherit;font:inherit;text-align:left;" +
    "display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;cursor:pointer;";
  const icon = document.createElement("div");
  icon.setAttribute("aria-hidden", "true");
  icon.style.cssText =
    "width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;opacity:0.85;";
  icon.textContent = enabled ? "↻" : "○";
  const copy = document.createElement("div");
  copy.style.cssText = "min-width:0;flex:1;font-size:14px;line-height:18px;";
  copy.textContent = t("profile.autoSwitch");
  const badge = document.createElement("span");
  badge.textContent = enabled ? t("profile.autoSwitchOn") : t("profile.autoSwitchOff");
  badge.style.cssText =
    "flex-shrink:0;font-size:10px;font-weight:700;letter-spacing:0.04em;line-height:16px;padding:1px 7px;" +
    "border-radius:999px;" +
    (enabled
      ? "background:#14b8a6;color:#042f2e;"
      : "background:color-mix(in srgb, currentColor 12%, transparent);color:inherit;");
  button.append(icon, copy, badge);
  protectInteractiveControl(button);
  button.addEventListener("pointerenter", () => {
    button.style.background = "color-mix(in srgb, currentColor 10%, transparent)";
  });
  button.addEventListener("pointerleave", () => {
    button.style.background = "transparent";
  });
  bindButtonAction(button, async () => {
    try {
      const next = await invoke(state, "set-autoswitch", { enabled: !enabled });
      refreshProfileMenu(state, next);
    } catch (error) {
      state.api.log.warn("[account-switcher] toggle autoswitch failed", errorMessage(error));
    }
  });
  return button;
}

async function addAccountFromProfileMenu(state) {
  if (state.profileMenuBusy) return;
  state.profileMenuBusy = true;
  const popup = findProfilePopup();
  const addBtn = popup?.querySelector("[data-codexpp-profile-add]");
  const label = addBtn?.querySelector("div:last-child");
  const previous = label?.textContent;
  if (addBtn) addBtn.disabled = true;
  if (label) label.textContent = t("profile.signingIn");
  try {
    const accountState = await invoke(state, "add-account");
    state.api.log.info("[account-switcher] added account without relaunch");
    refreshProfileMenu(state, accountState);
    if (state.directPage?.sections?.isConnected) {
      const { renderAccountsPageState } = require("./ui-settings");
      renderAccountsPageState(state, state.directPage.sections, accountState);
    }
  } catch (error) {
    const message = errorMessage(error);
    state.api.log.warn("[account-switcher] add account failed", message);
    const open = findProfilePopup();
    if (open) {
      const cancelled = /cancel/i.test(message);
      renderProfileAccounts(state, open, {
        ...(state.lastState || { accounts: [] }),
        error: cancelled ? t("profile.addCancelled") : t("profile.addFailed", { error: message }),
      });
    }
  } finally {
    state.profileMenuBusy = false;
    if (label && previous) label.textContent = previous;
    if (addBtn) addBtn.disabled = false;
  }
}

async function switchFromProfileMenu(state, name, displayName) {
  if (state.profileMenuBusy) return;
  state.profileMenuBusy = true;
  const popup = findProfilePopup();
  if (popup) {
    popup.querySelectorAll("[data-codexpp-profile-account]").forEach((button) => {
      button.disabled = true;
    });
    const active = popup.querySelector(`[data-codexpp-profile-account="${cssEscape(name)}"]`);
    if (active) {
      const status = active.querySelector(".text-token-text-secondary, .text-\\[11px\\]") || active;
      active.setAttribute("aria-label", t("accounts.switching"));
      const hint = document.createElement("div");
      hint.className = "text-[11px] text-token-text-secondary";
      hint.textContent = t("profile.switching");
      hint.setAttribute("data-codexpp-profile-switching", "true");
      active.querySelector("[data-codexpp-profile-switching]")?.remove();
      status.parentElement?.appendChild(hint);
    }
  }

  try {
    const accountState = await invoke(state, "switch", { name });
    state.api.log.info(`[account-switcher] profile menu switched to ${name} without relaunch`);
    refreshProfileMenu(state, accountState);
    if (state.directPage?.sections?.isConnected) {
      const { renderAccountsPageState } = require("./ui-settings");
      renderAccountsPageState(state, state.directPage.sections, accountState);
    }
  } catch (error) {
    state.api.log.warn("[account-switcher] profile menu switch failed", errorMessage(error));
    const open = findProfilePopup();
    if (open) {
      renderProfileAccounts(state, open, {
        ...(state.lastState || { accounts: [] }),
        error: t("profile.switchFailed", { error: errorMessage(error) }),
      });
    }
  } finally {
    state.profileMenuBusy = false;
    void displayName;
  }
}

function cssEscape(value) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
  return String(value).replace(/"/g, '\\"');
}

function findProfilePopup() {
  const fromText = findPopupFromMenuText();
  if (fromText) return fromText;
  const fromStock = findPopupFromStockItems();
  if (fromStock) return fromStock;

  for (const node of document.querySelectorAll(POPUP_SELECTOR)) {
    const popup = popupElement(node);
    if (popup && isProfilePopup(popup)) return popup;
  }
  return null;
}

function findPopupFromMenuText() {
  const candidates = Array.from(document.querySelectorAll(POPUP_SELECTOR));
  for (const candidate of candidates) {
    if (!(candidate instanceof HTMLElement) || !isVisible(candidate)) continue;
    if (candidate.closest(`[${BLOCK_ATTR}]`)) continue;
    const text = compactText(candidate);
    if (!/\bsettings\b/i.test(text) || !/\blog out\b/i.test(text)) continue;
    if (
      !/\brate limits remaining\b/i.test(text) &&
      !/\bpersonal account\b/i.test(text) &&
      !/\busage remaining\b/i.test(text) &&
      !/\bshow pet\b/i.test(text)
    ) {
      continue;
    }
    return candidate.matches("[data-radix-popper-content-wrapper]")
      ? candidate.querySelector('[role="menu"], [data-radix-menu-content]') || candidate
      : candidate;
  }
  return null;
}

function findPopupFromStockItems() {
  const controls = Array.from(document.querySelectorAll(CONTROL_SELECTOR)).filter((element) => {
    return (
      element instanceof HTMLElement &&
      isVisible(element) &&
      !element.closest(`[${BLOCK_ATTR}]`) &&
      STOCK_ITEM_PATTERN.test(compactText(element)) &&
      !/usage|rate limits remaining/i.test(compactText(element))
    );
  });
  for (const control of controls) {
    const popup = popupRootFor(control);
    if (popup && isProfilePopup(popup)) return popup;
  }
  return null;
}

function popupElement(node) {
  if (!(node instanceof HTMLElement) || !isVisible(node)) return null;
  if (node.hasAttribute("data-radix-popper-content-wrapper")) {
    const inner = node.firstElementChild;
    return inner instanceof HTMLElement && isVisible(inner) ? inner : node;
  }
  return node;
}

function popupRootFor(element) {
  let current = element;
  while (current && current !== document.body) {
    if (current.closest?.("[data-codexpp-account-page], [data-codexpp-account-confirmation]")) {
      return null;
    }
    if (current.matches?.(POPUP_SELECTOR)) return popupElement(current);
    const role = current.getAttribute?.("role");
    if (role === "menu" || role === "dialog") return current;
    current = current.parentElement;
  }

  current = element.parentElement;
  while (current && current !== document.body) {
    const style = window.getComputedStyle(current);
    if ((style.position === "fixed" || style.position === "absolute") && isVisible(current)) {
      if (isProfilePopup(current)) return current;
    }
    current = current.parentElement;
  }
  return null;
}

function isProfilePopup(root) {
  if (!(root instanceof HTMLElement) || !isVisible(root)) return false;
  if (root.closest("[data-codexpp-account-page], [data-codexpp-account-confirmation]")) return false;
  if (root.querySelector("[data-codexpp-account-page]")) return false;
  if (!isLikelyOverlay(root)) return false;
  return isProfilePopupLabels(collectControlLabels(root));
}

function isLikelyOverlay(root) {
  const rect = root.getBoundingClientRect();
  if (rect.width < 140 || rect.width > 520) return false;
  if (rect.height < 60 || rect.height > window.innerHeight * 0.95) return false;
  const style = window.getComputedStyle(root);
  return (
    style.position === "fixed" ||
    style.position === "absolute" ||
    !!root.closest("[data-radix-popper-content-wrapper], [role='menu'], [role='dialog']")
  );
}

function collectControlLabels(root) {
  return Array.from(root.querySelectorAll(CONTROL_SELECTOR))
    .filter(
      (element) =>
        element instanceof HTMLElement &&
        isVisible(element) &&
        !element.closest(`[${BLOCK_ATTR}]`),
    )
    .map((element) => compactText(element))
    .filter(Boolean);
}

function firstStockAnchor(popup) {
  const stocks = Array.from(popup.querySelectorAll(CONTROL_SELECTOR)).filter((element) => {
    return (
      element instanceof HTMLElement &&
      isVisible(element) &&
      !element.closest(`[${BLOCK_ATTR}]`) &&
      STOCK_ITEM_PATTERN.test(compactText(element))
    );
  });
  if (!stocks.length) return null;

  let common = stocks[0].parentElement;
  while (common && common !== popup.parentElement) {
    if (stocks.every((element) => common.contains(element))) {
      const child = Array.from(common.children).find((node) =>
        stocks.some((stock) => node === stock || node.contains(stock)),
      );
      if (child) return child;
    }
    if (common === popup) break;
    common = common.parentElement;
  }
  return stocks[0];
}

function profileFingerprint(accountState) {
  if (!accountState) return "";
  const accounts = Array.isArray(accountState.accounts) ? accountState.accounts.join(",") : "";
  return `${accounts}|${accountState.current || ""}|${accountState.error || ""}|${accountState.autoswitchEnabled ? 1 : 0}`;
}

function normalizeLabel(label) {
  return String(label || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isProfilePopupLabels(labels) {
  const normalized = (Array.isArray(labels) ? labels : [])
    .map(normalizeLabel)
    .filter(Boolean);
  if (!normalized.length) return false;

  const has = (pattern) => normalized.some((label) => pattern.test(label));
  if (has(FILE_MENU_PATTERN)) return false;

  const hasLogout = has(LOGOUT_PATTERN);
  const hasShowPet = has(/^show pet(\b|$)/);
  const hasUsage = has(/^(usage remaining|rate limits remaining)(\b|$)/);
  const hasPersonal = has(/^personal account(\b|$)/);
  const hasSettings = has(/^settings(\b|$)/);
  return hasLogout && (hasShowPet || hasUsage || hasPersonal || hasSettings);
}

function hideNativeUsageRows(popup) {
  const controls = Array.from(popup.querySelectorAll(CONTROL_SELECTOR));
  for (const element of controls) {
    if (!(element instanceof HTMLElement) || element.closest(`[${BLOCK_ATTR}]`)) continue;
    const label = compactText(element);
    if (!/usage|rate limits remaining/i.test(label)) continue;
    const row = element.closest("button, a, [role='menuitem'], [role='button']") || element;
    row.style.display = "none";
    row.setAttribute("data-codexpp-hidden-usage", "true");
  }
}

module.exports = {
  mountProfileMenu,
  refreshProfileMenu,
  isProfilePopupLabels,
  STOCK_ITEM_PATTERN,
};
