const { protectInteractiveControl } = require("./dom-utils");

function addButtonFeedback(element, styles) {
  const normal = {
    background: element.style.background || element.style.backgroundColor || "transparent",
    color: element.style.color || "",
    transform: element.style.transform || "",
  };
  const apply = (values) => {
    if (values.background != null) element.style.background = values.background;
    if (values.color != null) element.style.color = values.color;
    if (values.transform != null) element.style.transform = values.transform;
  };
  const hover = styles.hover || {};
  const active = styles.active || hover;
  const restore = () => apply(styles.normal || normal);
  element.style.transition = "background-color 120ms ease, color 120ms ease, transform 80ms ease";
  element.addEventListener("pointerenter", () => {
    if (element.disabled) return;
    apply(hover);
  });
  element.addEventListener("pointerleave", restore);
  element.addEventListener("focus", () => {
    if (element.disabled) return;
    apply(hover);
  });
  element.addEventListener("blur", restore);
  element.addEventListener("pointerdown", () => {
    if (element.disabled) return;
    apply(active);
  });
  element.addEventListener("pointerup", () => {
    if (element.disabled) return;
    apply(hover);
  });
  element.addEventListener("pointercancel", restore);
}

// ─── Settings-page primitives ─────────────────────────────────────────────────

function settingsButton(label) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.className =
    "inline-flex h-8 shrink-0 items-center justify-center rounded-lg px-3 text-sm " +
    "text-token-text-primary hover:bg-token-foreground/10 disabled:cursor-default disabled:opacity-50";
  button.style.border = "1px solid color-mix(in srgb, currentColor 14%, transparent)";
  button.style.backgroundColor = "color-mix(in srgb, currentColor 5%, transparent)";
  addButtonFeedback(button, {
    hover: {
      background: "color-mix(in srgb, currentColor 10%, transparent)",
    },
    active: {
      background: "color-mix(in srgb, currentColor 16%, transparent)",
      transform: "scale(0.98)",
    },
  });
  protectInteractiveControl(button);
  return button;
}

function primaryButton(label) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.className =
    "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg font-normal";
  Object.assign(button.style, {
    height: "32px",
    minHeight: "32px",
    maxHeight: "32px",
    padding: "0 12px",
    fontSize: "13px",
    lineHeight: "1",
    border: "1px solid transparent",
  });
  button.style.background = "var(--color-token-text-primary, #fff)";
  button.style.color = "var(--color-token-main-surface-primary, #111)";
  addButtonFeedback(button, {
    normal: { background: "var(--color-token-text-primary, #fff)" },
    hover: { background: "color-mix(in srgb,var(--color-token-text-primary,#fff) 88%,transparent)" },
    active: {
      background: "color-mix(in srgb,var(--color-token-text-primary,#fff) 78%,transparent)",
      transform: "scale(0.98)",
    },
  });
  protectInteractiveControl(button);
  return button;
}

function iconButton(label, icon) {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", label);
  button.title = label;
  button.className =
    "inline-flex size-8 shrink-0 cursor-interaction items-center justify-center rounded-lg text-token-text-secondary hover:text-token-text-primary";
  button.style.background = "transparent";
  button.style.border = "0";
  button.appendChild(icon);
  addButtonFeedback(button, {
    normal: { background: "transparent" },
    hover: { background: "color-mix(in srgb,currentColor 9%,transparent)" },
    active: {
      background: "color-mix(in srgb,currentColor 14%,transparent)",
      transform: "scale(0.96)",
    },
  });
  protectInteractiveControl(button);
  return button;
}

function bindButtonAction(button, onAction) {
  let lastRun = 0;
  const run = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (button.disabled) return;
    const now = Date.now();
    if (now - lastRun < 350) return;
    lastRun = now;
    onAction(event);
  };
  button.addEventListener("pointerup", run);
  button.addEventListener("click", run);
}

function settingsStatus(text, isError = false) {
  const status = document.createElement("div");
  status.className = "text-token-text-secondary text-sm";
  status.style.color = isError
    ? "var(--color-token-text-error, #c2410c)"
    : "var(--color-token-text-secondary, currentColor)";
  status.textContent = text;
  return status;
}

function accountDisplayName(accountState, name, options = {}) {
  const email = accountState?.accountEmails?.[name];
  const suffix = accountState?.current === name && options.includeCurrent !== false ? " (current)" : "";
  return email ? `${email}${suffix}` : `${name}${suffix}`;
}

function accountUsageSummary(accountState, name) {
  const usage = accountState?.accountUsage?.[name];
  if (!usage || typeof usage !== "object") return null;
  const parts = [];
  const fiveHour = usageWindowSummary(usage.fiveHour, "5h");
  const weekly = usageWindowSummary(usage.weekly, "Weekly");
  if (fiveHour) parts.push(fiveHour);
  if (weekly) parts.push(weekly);
  if (!parts.length) return null;
  return parts.join(" · ");
}

function usageWindowSummary(window, fallbackLabel) {
  if (typeof window?.pct !== "number") return null;
  const rawLabel = window.label || fallbackLabel;
  const label = /^5h$/i.test(rawLabel) ? "5-hour" : rawLabel;
  const reset = window.pct <= 0 && window.resetAt ? `, resets ${window.resetAt}` : "";
  return `${label} ${window.pct}% remaining${reset}`;
}

module.exports = {
  addButtonFeedback,
  settingsButton,
  primaryButton,
  iconButton,
  settingsStatus,
  bindButtonAction,
  accountDisplayName,
  accountUsageSummary,
};
