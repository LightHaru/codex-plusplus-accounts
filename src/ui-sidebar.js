const { compactText, isVisible } = require("./dom-utils");
const { renderAccountsPage } = require("./ui-settings");
const { t } = require("./i18n");

const SHORTCUT_ATTR = "data-codexpp-account-switch-shortcut";
const MAIN_SIDEBAR_SELECTOR =
  "aside, .window-fx-sidebar-surface.w-token-sidebar, [data-testid*='sidebar' i]";
const CONTROL_SELECTOR = "button, a, [role='button'], [role='link']";

function mountAccountSwitchShortcut(state) {
  const schedule = () => {
    if (state.disposed || state.pending) return;
    state.pending = window.requestAnimationFrame(() => {
      state.pending = 0;
      ensureShortcut(state);
    });
  };

  state.observer = new MutationObserver(schedule);
  state.observer.observe(document.documentElement, { childList: true, subtree: true });
  state.disposers.push(() => state.observer?.disconnect());
  state.disposers.push(() => restoreCodexPage(state));
  schedule();
}

function ensureShortcut(state) {
  maintainDirectPage(state);
  const plugins = findMainSidebarPluginsControl();
  if (!plugins) return;

  const sidebar = mainSidebarFor(plugins);
  if (!sidebar || sidebar.querySelector(`[${SHORTCUT_ATTR}]`)) return;

  const shortcut = cloneSidebarControl(plugins);
  shortcut.setAttribute(SHORTCUT_ATTR, "true");
  const open = (event) => {
    event.preventDefault();
    event.stopPropagation();
    openAccountsPage(state, sidebar, shortcut);
  };
  shortcut.addEventListener("click", open);
  plugins.after(shortcut);
}

function findMainSidebarPluginsControl() {
  return Array.from(document.querySelectorAll(CONTROL_SELECTOR)).find((element) => {
    if (!(element instanceof HTMLElement) || !isVisible(element)) return false;
    if (compactText(element).toLowerCase() !== "plugins") return false;
    const sidebar = mainSidebarFor(element);
    if (!sidebar) return false;
    const labels = visibleControlLabels(sidebar);
    return labels.has("new chat") && (labels.has("pull requests") || labels.has("scheduled"));
  });
}

function mainSidebarFor(element) {
  const sidebar = element.closest(MAIN_SIDEBAR_SELECTOR);
  return sidebar instanceof HTMLElement && isVisible(sidebar) ? sidebar : null;
}

function visibleControlLabels(root) {
  return new Set(
    Array.from(root.querySelectorAll(CONTROL_SELECTOR))
      .filter((element) => element instanceof HTMLElement && isVisible(element))
      .map((element) => compactText(element).toLowerCase()),
  );
}

function cloneSidebarControl(source) {
  const shortcut = source.cloneNode(true);
  scrubNativeActionAttributes(shortcut);
  replaceLabel(shortcut, "Plugins", "Accounts");
  replaceFirstIcon(shortcut, accountSwitchIcon());
  shortcut.removeAttribute("aria-current");
  shortcut.removeAttribute("data-state");
  shortcut.setAttribute("aria-label", "Accounts");
  shortcut.setAttribute("title", "Open Accounts");
  if (shortcut instanceof HTMLAnchorElement) shortcut.removeAttribute("href");
  if (shortcut instanceof HTMLButtonElement) shortcut.type = "button";
  return shortcut;
}

function scrubNativeActionAttributes(root) {
  for (const element of [root, ...root.querySelectorAll("*")]) {
    element.removeAttribute("id");
    for (const name of element.getAttributeNames()) {
      if (name.startsWith("data-app-action") || name.startsWith("data-testid")) {
        element.removeAttribute(name);
      }
    }
  }
}

function replaceLabel(root, from, to) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if ((node.nodeValue || "").trim().toLowerCase() === from.toLowerCase()) {
      node.nodeValue = (node.nodeValue || "").replace(new RegExp(from, "i"), to);
      return;
    }
    node = walker.nextNode();
  }

  const leaf = Array.from(root.querySelectorAll("*")).find(
    (element) => element.children.length === 0 && compactText(element).toLowerCase() === from.toLowerCase(),
  );
  if (leaf) leaf.textContent = to;
}

function replaceFirstIcon(root, icon) {
  const existing = root.querySelector("svg");
  if (existing) existing.replaceWith(icon);
}

function accountSwitchIcon() {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "20");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("fill", "none");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "icon-sm");

  const user = document.createElementNS(namespace, "path");
  user.setAttribute("d", "M8.25 9a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5Z");
  user.setAttribute("stroke", "currentColor");
  user.setAttribute("stroke-width", "1.5");

  const shoulders = document.createElementNS(namespace, "path");
  shoulders.setAttribute("d", "M3.75 14.5c.58-1.9 2.23-3 4.5-3 1.15 0 2.12.28 2.88.8");
  shoulders.setAttribute("stroke", "currentColor");
  shoulders.setAttribute("stroke-width", "1.5");
  shoulders.setAttribute("stroke-linecap", "round");

  const arrows = document.createElementNS(namespace, "path");
  arrows.setAttribute("d", "m12.5 10 1.75-1.75L16 10m0 0-1.75 1.75M16 10h-4.25");
  arrows.setAttribute("stroke", "currentColor");
  arrows.setAttribute("stroke-width", "1.5");
  arrows.setAttribute("stroke-linecap", "round");
  arrows.setAttribute("stroke-linejoin", "round");

  svg.append(user, shoulders, arrows);
  return svg;
}

function openAccountsPage(state, sidebar, shortcut) {
  if (state.directPage?.panel?.isConnected) {
    renderAccountsPage(state, state.directPage.sections);
    return;
  }

  const content = findMainContent(sidebar);
  if (!content) {
    state.api.log.warn("[account-switcher] main content area not found");
    return;
  }

  const shell = accountsPageShell();
  hideCodexChildren(content, shell.panel);
  content.appendChild(shell.panel);
  shortcut.setAttribute("aria-current", "page");
  shortcut.classList.add("bg-token-list-hover-background");

  const restoreHandler = (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || shortcut.contains(target)) return;
    if (target.closest(CONTROL_SELECTOR)) restoreCodexPage(state);
  };
  sidebar.addEventListener("click", restoreHandler, true);
  state.directPage = {
    content,
    panel: shell.panel,
    sections: shell.sections,
    shortcut,
    sidebar,
    restoreHandler,
  };
  state.api.log.info("[account-switcher] direct Accounts page opened");
  renderAccountsPage(state, shell.sections);
}

function findMainContent(sidebar) {
  let parent = sidebar.parentElement;
  while (parent) {
    for (const child of Array.from(parent.children)) {
      if (child === sidebar || child.contains(sidebar)) continue;
      const rect = child.getBoundingClientRect();
      if (rect.width > 300 && rect.height > 200) return child;
    }
    parent = parent.parentElement;
  }
  return null;
}

function accountsPageShell() {
  const panel = document.createElement("div");
  panel.setAttribute("data-codexpp-account-page", "true");
  panel.className = "main-surface flex h-full min-h-0 flex-col";

  const toolbar = document.createElement("div");
  toolbar.className =
    "draggable flex items-center justify-end px-panel electron:h-toolbar extension:h-toolbar-sm";

  const pageActions = document.createElement("div");
  pageActions.setAttribute("data-codexpp-account-page-actions", "true");
  pageActions.className = "no-drag flex items-center gap-2";
  pageActions.style.webkitAppRegion = "no-drag";
  pageActions.style.height = "32px";
  pageActions.style.alignItems = "center";
  toolbar.appendChild(pageActions);

  const scroll = document.createElement("div");
  scroll.className = "flex-1 overflow-y-auto p-panel";

  const inner = document.createElement("div");
  inner.className =
    "mx-auto flex w-full max-w-3xl flex-col electron:min-w-[calc(320px*var(--codex-window-zoom))]";

  const header = document.createElement("div");
  header.className = "flex min-w-0 flex-col gap-1.5 pb-8";

  const heading = document.createElement("div");
  heading.className = "truncate text-2xl font-normal text-token-text-primary";
  heading.textContent = t("accounts.pageTitle");

  const subtitle = document.createElement("div");
  subtitle.className = "text-token-text-secondary text-base";
  subtitle.textContent = t("accounts.pageSubtitle");

  const sections = document.createElement("div");
  sections.className = "flex flex-col gap-8";

  header.append(heading, subtitle);
  inner.append(header, sections);
  scroll.appendChild(inner);
  panel.append(toolbar, scroll);
  return { panel, sections };
}

function hideCodexChildren(content, panel) {
  for (const child of Array.from(content.children)) {
    if (child === panel) continue;
    if (child.dataset.codexppAccountHidden === undefined) {
      child.dataset.codexppAccountHidden = child.style.display || "";
    }
    child.style.display = "none";
  }
}

function maintainDirectPage(state) {
  const page = state.directPage;
  if (!page) return;
  if (!page.content.isConnected || !page.sidebar.isConnected) {
    page.sidebar.removeEventListener("click", page.restoreHandler, true);
    state.directPage = null;
    return;
  }
  hideCodexChildren(page.content, page.panel);
}

function restoreCodexPage(state) {
  const page = state.directPage;
  if (!page) return;
  page.sidebar.removeEventListener("click", page.restoreHandler, true);
  page.panel.remove();
  page.shortcut.removeAttribute("aria-current");
  page.shortcut.classList.remove("bg-token-list-hover-background");
  for (const child of Array.from(page.content.children)) {
    if (child.dataset.codexppAccountHidden === undefined) continue;
    child.style.display = child.dataset.codexppAccountHidden;
    delete child.dataset.codexppAccountHidden;
  }
  state.directPage = null;
}

module.exports = {
  mountAccountSwitchShortcut,
  findMainSidebarPluginsControl,
  findMainContent,
  restoreCodexPage,
};
