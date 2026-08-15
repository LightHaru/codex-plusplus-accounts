const { errorMessage } = require("./utils");
const { invoke } = require("./ipc");
const { t } = require("./i18n");
const {
  settingsButton,
  primaryButton,
  iconButton,
  settingsStatus,
  accountDisplayName,
  bindButtonAction,
} = require("./ui-components");
const {
  accountRemainingPct,
  totalRemainingPct,
  formatPlan,
  initials,
  avatarColor,
  accountResetAt,
} = require("./display");

async function renderAccountsPage(state, root) {
  renderHeaderActions(state, root);
  root.textContent = "";
  root.appendChild(settingsStatus(t("accounts.loading")));
  try {
    const accountState = await invoke(state, "state");
    renderAccountsPageState(state, root, accountState);
    refreshUsageInBackground(state, root);
  } catch (error) {
    root.textContent = "";
    root.appendChild(settingsStatus(errorMessage(error), true));
  }
}

function renderHeaderActions(state, root) {
  const page = root.closest("[data-codexpp-account-page]");
  const actions = page?.querySelector("[data-codexpp-account-page-actions]");
  if (!(actions instanceof HTMLElement)) return;
  actions.textContent = "";

  const refresh = iconButton(t("accounts.refresh"), refreshIcon());
  bindButtonAction(refresh, () => renderAccountsPage(state, root));

  const add = primaryButton(t("accounts.add"));
  Object.assign(add.style, {
    height: "28px",
    minHeight: "28px",
    maxHeight: "28px",
    padding: "0 10px",
    borderRadius: "10px",
    fontSize: "12px",
  });
  bindButtonAction(add, () => addAccountFromSettings(state, root));
  actions.append(refresh, add);
}


function addAccountFromSettings(state, root) {
  runAccountAction(state, root, "add-account", {}, t("profile.signingIn"));
}

function showAddAccountConfirmation(state, root, trigger) {
  const page = root.closest("[data-codexpp-account-page]");
  if (!(page instanceof HTMLElement)) return;
  page.querySelector("[data-codexpp-account-confirmation]")?.remove();

  const overlay = document.createElement("div");
  overlay.setAttribute("data-codexpp-account-confirmation", "true");
  overlay.setAttribute("role", "presentation");
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "1000",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    background: "rgba(0, 0, 0, 0.52)",
    backdropFilter: "blur(2px)",
  });

  const dialog = document.createElement("div");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "codexpp-add-account-title");
  dialog.className = "border-token-border flex flex-col overflow-hidden rounded-xl border";
  Object.assign(dialog.style, {
    width: "420px",
    maxWidth: "calc(100vw - 48px)",
    background: "var(--color-token-main-surface-primary, #181818)",
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.42)",
  });

  const content = document.createElement("div");
  content.className = "flex flex-col gap-2 p-5";

  const title = document.createElement("div");
  title.id = "codexpp-add-account-title";
  title.className = "text-base font-medium text-token-text-primary";
  title.textContent = t("accounts.confirmTitle");

  const message = document.createElement("div");
  message.className = "text-sm leading-5 text-token-text-secondary";
  message.textContent = t("accounts.confirmMessage");
  content.append(title, message);

  const footer = document.createElement("div");
  footer.className = "border-token-border flex items-center justify-end gap-2 border-t px-5 py-3";

  const cancel = settingsButton(t("accounts.cancel"));
  const confirm = primaryButton(t("accounts.confirmAdd"));
  footer.append(cancel, confirm);
  dialog.append(content, footer);
  overlay.appendChild(dialog);
  page.appendChild(overlay);

  const close = () => {
    overlay.remove();
    if (trigger.isConnected) trigger.focus();
  };
  bindButtonAction(cancel, close);
  bindButtonAction(confirm, () => {
    overlay.remove();
    clearActiveFromAccounts(state, root);
  });
  overlay.addEventListener("pointerdown", (event) => {
    if (event.target === overlay) close();
  });
  overlay.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    close();
  });

  overlay.animate?.([{ opacity: 0 }, { opacity: 1 }], {
    duration: 120,
    easing: "ease-out",
  });
  dialog.animate?.(
    [
      { opacity: 0, transform: "translateY(6px) scale(0.98)" },
      { opacity: 1, transform: "translateY(0) scale(1)" },
    ],
    { duration: 160, easing: "cubic-bezier(0.2, 0, 0, 1)" },
  );
  window.requestAnimationFrame(() => cancel.focus());
}

function renderAccountsPageState(state, root, accountState) {
  state.lastState = accountState;
  root.textContent = "";

  const accounts = Array.isArray(accountState.accounts) ? accountState.accounts : [];
  const section = document.createElement("section");
  section.className = "flex flex-col gap-3";

  if (accounts.length) section.appendChild(usageSummaryCard(accountState, accounts.length));

  const list = document.createElement("div");
  list.className = "flex flex-col gap-2";
  if (!accounts.length) list.appendChild(emptyAccountsRow(accountState));
  else {
    for (const name of accounts) list.appendChild(accountCard(state, root, accountState, name));
  }
  section.appendChild(list);
  if (accounts.length) section.appendChild(autoSwitchCard(state, root, accountState));
  root.appendChild(section);

  if (accountState.notice || accountState.error) {
    const status = settingsStatus(accountState.notice || accountState.error, !!accountState.error);
    status.classList.add("pt-2");
    root.appendChild(status);
  }
}

function usageSummaryCard(accountState, count) {
  const row = document.createElement("div");
  row.className = "flex items-center gap-3 rounded-2xl px-4 py-3";
  row.style.background = "color-mix(in srgb, var(--color-token-text-primary, #fff) 5%, transparent)";

  const icon = document.createElement("div");
  icon.setAttribute("aria-hidden", "true");
  icon.className = "flex size-10 shrink-0 items-center justify-center text-token-text-secondary";
  icon.appendChild(usageClockIcon());

  const copy = document.createElement("div");
  copy.className = "flex min-w-0 flex-1 flex-col gap-0.5";
  const title = document.createElement("div");
  title.className = "text-base font-medium text-token-text-primary";
  title.textContent = t("profile.usageRemaining");
  const sub = document.createElement("div");
  sub.className = "text-sm text-token-text-secondary";
  sub.textContent = t("profile.connected", { n: count });
  copy.append(title, sub);

  const total = totalRemainingPct(accountState);
  const value = document.createElement("div");
  value.className = "shrink-0 text-base font-medium tabular-nums text-token-text-primary";
  value.textContent = total == null ? "—" : `${total}%`;

  row.append(icon, copy, value);
  return row;
}

function autoSwitchCard(state, root, accountState) {
  const enabled = accountState?.autoswitchEnabled !== false;
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-pressed", enabled ? "true" : "false");
  button.className = "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left";
  Object.assign(button.style, {
    background: "color-mix(in srgb, var(--color-token-text-primary, #fff) 5%, transparent)",
    border: "0",
    color: "inherit",
    cursor: "pointer",
  });

  const icon = document.createElement("div");
  icon.setAttribute("aria-hidden", "true");
  icon.className = "flex size-10 shrink-0 items-center justify-center text-base text-token-text-secondary";
  icon.textContent = enabled ? "↻" : "○";

  const copy = document.createElement("div");
  copy.className = "min-w-0 flex-1 text-sm font-medium text-token-text-primary";
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

  bindButtonAction(button, async () => {
    try {
      const next = await invoke(state, "set-autoswitch", { enabled: !enabled });
      if (root.isConnected) renderAccountsPageState(state, root, next);
      const { refreshProfileMenu } = require("./ui-profile-menu");
      refreshProfileMenu(state, next);
    } catch (error) {
      state.api.log.warn("[account-switcher] toggle autoswitch failed", errorMessage(error));
    }
  });
  return button;
}

function emptyAccountsRow(accountState) {
  const row = rowShell();
  const copy = document.createElement("div");
  copy.className = "flex min-w-0 flex-col gap-1 py-2";

  const title = document.createElement("div");
  title.className = "text-sm text-token-text-primary";
  title.textContent = accountState.hasActiveAuth
    ? t("accounts.noSaved")
    : t("accounts.noSession");

  const description = document.createElement("div");
  description.className = "text-sm text-token-text-secondary";
  description.textContent = t("accounts.addHint");
  copy.append(title, description);
  row.appendChild(copy);
  return row;
}

function accountCard(state, root, accountState, name) {
  const profile = accountState.accountProfiles?.[name] || {};
  const isCurrent = accountState.current === name;
  const displayName = profile.name || accountDisplayName(accountState, name, { includeCurrent: false });
  const plan = formatPlan(profile.plan);
  const pct = accountRemainingPct(accountState, name);
  const emailText = profile.email || accountState.accountEmails?.[name] || "";
  const resetAt = accountResetAt(accountState, name);
  const usage = accountState.accountUsage?.[name];

  const card = document.createElement("div");
  card.className = "relative flex min-h-20 items-center gap-3 rounded-2xl px-4 py-3";
  card.style.boxSizing = "border-box";
  card.style.borderLeft = "3px solid transparent";
  card.style.background = isCurrent
    ? "color-mix(in srgb, #14b8a6 16%, transparent)"
    : "color-mix(in srgb, var(--color-token-text-primary, #fff) 5%, transparent)";
  if (isCurrent) {
    card.style.borderLeftColor = "#14b8a6";
    card.setAttribute("aria-current", "true");
  } else {
    card.style.cursor = "pointer";
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", t("profile.switchTo", { name: displayName }));
    card.addEventListener("pointerenter", () => {
      card.style.background = "color-mix(in srgb, currentColor 10%, transparent)";
    });
    card.addEventListener("pointerleave", () => {
      card.style.background = "color-mix(in srgb, var(--color-token-text-primary, #fff) 5%, transparent)";
    });
    const switchTo = (event) => {
      if (event.target instanceof Element && event.target.closest("button")) return;
      event.preventDefault();
      event.stopPropagation();
      runAccountAction(state, root, "switch", { name }, t("accounts.switching"));
    };
    card.addEventListener("click", switchTo);
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      switchTo(event);
    });
  }

  const identity = document.createElement("div");
  identity.className = "flex min-w-0 flex-1 items-center gap-3";
  identity.appendChild(accountAvatar(name, displayName, isCurrent));

  const copy = document.createElement("div");
  copy.className = "flex min-w-0 flex-1 flex-col gap-0.5";

  const title = document.createElement("div");
  title.className = "min-w-0 truncate text-base font-medium text-token-text-primary";
  title.textContent = `${displayName} · ${plan}`;
  title.title = displayName;
  copy.appendChild(title);

  if (emailText && emailText !== displayName) {
    const email = document.createElement("div");
    email.className = "min-w-0 truncate text-sm text-token-text-secondary";
    email.textContent = emailText;
    email.title = emailText;
    copy.appendChild(email);
  }

  if (resetAt) {
    const reset = document.createElement("div");
    reset.className = "text-xs text-token-text-secondary";
    reset.textContent = t("profile.resets", { when: resetAt });
    copy.appendChild(reset);
  } else if (!usage) {
    const description = document.createElement("div");
    description.className = "text-xs text-token-text-secondary";
    description.textContent = t("accounts.usageUnavailable");
    copy.appendChild(description);
  }

  identity.appendChild(copy);
  card.appendChild(identity);

  const right = document.createElement("div");
  right.className = "flex shrink-0 flex-col items-end gap-1";
  right.style.minWidth = "56px";
  if (isCurrent) right.appendChild(currentBadge());
  const value = document.createElement("div");
  value.className = "text-base tabular-nums text-token-text-primary";
  value.textContent = pct == null ? "—" : `${pct}%`;
  right.appendChild(value);
  card.appendChild(right);

  const menuButton = iconButton(t("accounts.actions", { account: displayName }), ellipsisIcon());
  menuButton.setAttribute("aria-haspopup", "menu");
  menuButton.setAttribute("aria-expanded", "false");
  bindButtonAction(menuButton, () => {
    if (menuButton.getAttribute("aria-expanded") === "true") {
      closeAccountMenus(root);
      return;
    }
    showAccountMenu(state, root, card, menuButton, accountState, name, isCurrent);
  });
  card.appendChild(menuButton);
  return card;
}

function accountAvatar(name, displayName, isCurrent) {
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:relative;width:40px;height:40px;flex-shrink:0;";
  const avatar = document.createElement("div");
  avatar.setAttribute("aria-hidden", "true");
  const color = isCurrent ? "#14b8a6" : avatarColor(name);
  avatar.style.cssText =
    "width:40px;height:40px;border-radius:999px;display:flex;align-items:center;justify-content:center;" +
    `font-size:13px;font-weight:600;color:#fff;background:${color};`;
  avatar.textContent = initials(displayName);
  wrap.appendChild(avatar);
  if (isCurrent) {
    const check = document.createElement("div");
    check.setAttribute("aria-hidden", "true");
    check.style.cssText =
      "position:absolute;right:-2px;bottom:-2px;width:16px;height:16px;border-radius:999px;" +
      "background:#14b8a6;color:#042f2e;display:flex;align-items:center;justify-content:center;" +
      "box-shadow:0 0 0 2px var(--color-token-main-surface-primary, #202020);";
    check.appendChild(checkmarkIcon());
    wrap.appendChild(check);
  }
  return wrap;
}

function currentBadge() {
  const badge = document.createElement("span");
  badge.textContent = t("accounts.current");
  badge.style.cssText =
    "font-size:10px;font-weight:700;letter-spacing:0.04em;line-height:16px;padding:1px 7px;" +
    "border-radius:999px;background:#14b8a6;color:#042f2e;text-transform:uppercase;";
  return badge;
}

function checkmarkIcon() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", "10");
  svg.setAttribute("height", "10");
  svg.setAttribute("viewBox", "0 0 12 12");
  svg.setAttribute("fill", "none");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", "M2.2 6.2l2.4 2.4 5.2-5.2");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.8");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.appendChild(path);
  return svg;
}

function usageClockIcon() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "20");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("fill", "none");
  svg.setAttribute("aria-hidden", "true");
  const arc = document.createElementNS(ns, "path");
  arc.setAttribute("d", "M10 17.5a7.5 7.5 0 1 0-7.4-8.7");
  arc.setAttribute("stroke", "currentColor");
  arc.setAttribute("stroke-width", "1.5");
  arc.setAttribute("stroke-linecap", "round");
  const hand = document.createElementNS(ns, "path");
  hand.setAttribute("d", "M10 10l4-3.2");
  hand.setAttribute("stroke", "currentColor");
  hand.setAttribute("stroke-width", "1.5");
  hand.setAttribute("stroke-linecap", "round");
  const center = document.createElementNS(ns, "circle");
  center.setAttribute("cx", "10");
  center.setAttribute("cy", "10");
  center.setAttribute("r", "1.2");
  center.setAttribute("fill", "currentColor");
  svg.append(arc, hand, center);
  return svg;
}

function showAccountMenu(state, root, card, trigger, accountState, name, isCurrent) {
  closeAccountMenus(root);
  const menu = document.createElement("div");
  menu.setAttribute("data-codexpp-account-menu", "true");
  menu.setAttribute("role", "menu");
  menu.className = "border-token-border absolute right-3 top-12 z-50 flex w-52 flex-col rounded-xl border p-1.5";
  Object.assign(menu.style, {
    background: "var(--color-token-main-surface-secondary, #252525)",
    boxShadow: "0 14px 36px rgba(0, 0, 0, 0.38)",
  });

  if (!isCurrent) {
    menu.appendChild(
      accountMenuItem(t("accounts.switchAccount"), switchIcon(), false, () => {
        closeAccountMenus(root);
        runAccountAction(state, root, "switch", { name }, t("accounts.switching"));
      }),
    );
  }

  if (!isCurrent) {
    const separator = document.createElement("div");
    separator.className = "border-token-border my-1 border-t";
    menu.appendChild(separator);
  }
  menu.appendChild(
    accountMenuItem(t("accounts.removeAccount"), trashIcon(), true, () => {
      closeAccountMenus(root);
      runAccountAction(state, root, "delete", { name }, t("accounts.removing"));
    }),
  );

  const close = () => {
    document.removeEventListener("pointerdown", onOutsidePointerDown, true);
    document.removeEventListener("keydown", onKeyDown, true);
    trigger.setAttribute("aria-expanded", "false");
    menu.remove();
    if (trigger.isConnected) trigger.focus();
  };
  const onOutsidePointerDown = (event) => {
    if (menu.contains(event.target) || trigger.contains(event.target)) return;
    close();
  };
  const onKeyDown = (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    close();
  };
  menu._codexppClose = close;
  card.appendChild(menu);
  trigger.setAttribute("aria-expanded", "true");
  document.addEventListener("pointerdown", onOutsidePointerDown, true);
  document.addEventListener("keydown", onKeyDown, true);
  menu.animate?.(
    [
      { opacity: 0, transform: "translateY(-4px) scale(0.98)" },
      { opacity: 1, transform: "translateY(0) scale(1)" },
    ],
    { duration: 120, easing: "cubic-bezier(0.2, 0, 0, 1)" },
  );
  window.requestAnimationFrame(() => menu.querySelector("button")?.focus());
}

function accountMenuItem(label, icon, destructive, onAction) {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("role", "menuitem");
  button.className =
    "flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm hover:bg-token-foreground/10";
  button.style.color = destructive
    ? "var(--color-token-text-error, #ff6b6b)"
    : "var(--color-token-text-primary, currentColor)";
  button.append(icon, document.createTextNode(label));
  bindButtonAction(button, onAction);
  return button;
}

function closeAccountMenus(root) {
  root.querySelectorAll("[data-codexpp-account-menu]").forEach((menu) => {
    if (typeof menu._codexppClose === "function") menu._codexppClose();
    else menu.remove();
  });
}

function rowShell() {
  const row = document.createElement("div");
  row.className =
    "border-token-border flex min-h-16 items-center justify-between gap-4 border-b py-3";
  return row;
}

function ellipsisIcon() {
  return svgIcon([
    ["circle", { cx: "5", cy: "10", r: "1.25", fill: "currentColor" }],
    ["circle", { cx: "10", cy: "10", r: "1.25", fill: "currentColor" }],
    ["circle", { cx: "15", cy: "10", r: "1.25", fill: "currentColor" }],
  ]);
}

function switchIcon() {
  return svgIcon([
    ["path", { d: "M4 6h10m0 0-2.5-2.5M14 6l-2.5 2.5M16 14H6m0 0 2.5-2.5M6 14l2.5 2.5" }],
  ]);
}

function trashIcon() {
  return svgIcon([
    ["path", { d: "M4.5 6h11m-7-2h3m-5 4 .5 8h6l.5-8M8.5 9.5v4m3-4v4" }],
  ]);
}

function svgIcon(parts) {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "20");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("fill", "none");
  svg.setAttribute("aria-hidden", "true");
  for (const [tag, attributes] of parts) {
    const element = document.createElementNS(namespace, tag);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    if (tag === "path") {
      element.setAttribute("stroke", "currentColor");
      element.setAttribute("stroke-width", "1.5");
      element.setAttribute("stroke-linecap", "round");
      element.setAttribute("stroke-linejoin", "round");
    }
    svg.appendChild(element);
  }
  return svg;
}

function refreshIcon() {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  svg.setAttribute("width", "18");
  svg.setAttribute("height", "18");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("fill", "none");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(namespace, "path");
  path.setAttribute("d", "M15.4 7.1A6 6 0 1 0 16 11m-.6-3.9V3.8m0 3.3h-3.3");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.5");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.appendChild(path);
  return svg;
}

function clearActiveFromAccounts(state, root) {
  runAccountAction(state, root, "clear-active", {}, t("accounts.preparingSignIn"));
}

function refreshUsageInBackground(state, root) {
  const now = Date.now();
  if (state.usageRefreshInFlight || now - (state.lastUsageRefreshAt || 0) < 60_000) return;
  state.usageRefreshInFlight = true;
  state.lastUsageRefreshAt = now;
  invoke(state, "refresh-usage")
    .then((accountState) => {
      if (root.isConnected) renderAccountsPageState(state, root, accountState);
    })
    .catch((error) => {
      state.api.log.warn("[account-switcher] usage refresh failed", errorMessage(error));
    })
    .finally(() => {
      state.usageRefreshInFlight = false;
    });
}

async function runAccountAction(state, root, action, payload, loadingText) {
  root.textContent = "";
  root.appendChild(settingsStatus(loadingText));
  try {
    const accountState = await invoke(state, action, payload);
    if (action === "switch") {
      renderAccountsPageState(state, root, accountState);
      const { refreshProfileMenu } = require("./ui-profile-menu");
      refreshProfileMenu(state, accountState);
      return;
    }
    if (action === "clear-active") {
      root.textContent = "";
      root.appendChild(settingsStatus(t("accounts.sessionClearedRelaunching")));
      scheduleAppRelaunch(state, root);
      return;
    }
    renderAccountsPageState(state, root, accountState);
  } catch (error) {
    renderAccountsPageState(state, root, {
      ...(state.lastState || { accounts: [], current: null, hasActiveAuth: false }),
      error: errorMessage(error),
    });
  }
}

function scheduleAppRelaunch(state, root) {
  window.setTimeout(() => {
    invoke(state, "relaunch").catch((error) => {
      root.textContent = "";
      root.appendChild(
        settingsStatus(t("accounts.relaunchFailed", { error: errorMessage(error) }), true),
      );
    });
  }, 1200);
}

module.exports = { renderAccountsPage, renderAccountsPageState };
