const { errorMessage } = require("./utils");
const { invoke } = require("./ipc");
const { t } = require("./i18n");
const {
  settingsButton,
  primaryButton,
  iconButton,
  settingsStatus,
  accountDisplayName,
  accountUsageSummary,
  bindButtonAction,
} = require("./ui-components");

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
  bindButtonAction(add, () => showAddAccountConfirmation(state, root, add));
  actions.append(refresh, add);
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
  root.textContent = "";

  const section = document.createElement("section");
  section.className = "flex flex-col";

  const heading = document.createElement("div");
  heading.className =
    "border-token-border flex items-center justify-between border-b pb-2 text-base font-medium text-token-text-primary";
  heading.textContent = t("accounts.saved");
  section.appendChild(heading);

  const list = document.createElement("div");
  list.className = "flex flex-col gap-2 pt-3";

  const accounts = Array.isArray(accountState.accounts) ? accountState.accounts : [];
  if (!accounts.length) {
    list.appendChild(emptyAccountsRow(accountState));
  } else {
    for (const name of accounts) {
      list.appendChild(accountCard(state, root, accountState, name));
    }
  }
  section.appendChild(list);
  root.appendChild(section);

  if (accountState.notice || accountState.error) {
    const status = settingsStatus(accountState.notice || accountState.error, !!accountState.error);
    status.classList.add("pt-4");
    root.appendChild(status);
  }
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
  const card = document.createElement("div");
  card.className = "relative flex min-h-20 items-center gap-3 rounded-2xl px-4 py-3";
  card.style.background = "color-mix(in srgb, var(--color-token-text-primary, #fff) 5%, transparent)";

  const identity = document.createElement("div");
  identity.className = "flex min-w-0 flex-1 items-center gap-3";

  const displayName = accountDisplayName(accountState, name, { includeCurrent: false });
  const profile = accountState.accountProfiles?.[name] || {};
  identity.appendChild(accountAvatar(profile.name || displayName));

  const copy = document.createElement("div");
  copy.className = "flex min-w-0 flex-1 flex-col gap-0.5";

  const titleLine = document.createElement("div");
  titleLine.className = "flex min-w-0 items-center gap-2";

  const title = document.createElement("div");
  title.className = "min-w-0 truncate text-base font-medium text-token-text-primary";
  title.textContent = profile.name || displayName;
  title.title = title.textContent;
  titleLine.appendChild(title);

  const isCurrent = accountState.current === name;
  if (isCurrent) titleLine.appendChild(currentBadge());

  const profileLine = document.createElement("div");
  profileLine.className = "flex min-w-0 items-center gap-2 text-sm text-token-text-secondary";
  const email = document.createElement("span");
  email.className = "min-w-0 truncate";
  email.textContent = profile.email || displayName;
  email.title = email.textContent;
  profileLine.appendChild(email);
  if (profile.organization) {
    const organization = document.createElement("span");
    organization.className = "shrink-0";
    organization.textContent = `· ${profile.organization}`;
    profileLine.appendChild(organization);
  }
  if (profile.plan) profileLine.appendChild(planBadge(profile.plan));

  const description = document.createElement("div");
  description.className = "min-w-0 truncate text-xs text-token-text-secondary";
  description.textContent =
    accountUsageSummary(accountState, name) ||
    (isCurrent ? t("accounts.currentSession") : t("accounts.usageUnavailable"));

  copy.append(titleLine, profileLine, description);
  identity.appendChild(copy);
  card.appendChild(identity);

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

function accountAvatar(label) {
  const avatar = document.createElement("div");
  avatar.setAttribute("aria-hidden", "true");
  avatar.className =
    "border-token-border flex size-10 shrink-0 items-center justify-center rounded-full border bg-token-foreground/5 text-sm font-medium text-token-text-primary";
  const first = String(label || "A").trim().charAt(0).toUpperCase();
  avatar.textContent = first || "A";
  return avatar;
}

function currentBadge() {
  const badge = document.createElement("span");
  badge.className =
    "shrink-0 rounded-md bg-token-foreground/10 px-1.5 py-0.5 text-[11px] font-medium text-token-text-secondary";
  badge.textContent = t("accounts.current");
  return badge;
}

function planBadge(plan) {
  const badge = document.createElement("span");
  badge.className =
    "shrink-0 rounded-md border border-token-border px-1.5 py-0.5 text-[11px] capitalize text-token-text-secondary";
  badge.textContent = plan;
  return badge;
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
