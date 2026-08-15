const AVATAR_COLORS = ["#3b82f6", "#c4b5a5", "#7f1d1d", "#6366f1", "#a16207", "#0f766e"];

function initials(label) {
  const parts = String(label || "A").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "A";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function avatarColor(name) {
  let hash = 0;
  for (const ch of String(name)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function formatPlan(plan) {
  const raw = String(plan || "").trim();
  if (!raw) return "Plus";
  if (/^plus$/i.test(raw)) return "Plus";
  if (/^pro$/i.test(raw)) return "Pro";
  if (/20x/i.test(raw)) return raw.replace(/^./, (c) => c.toUpperCase());
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function accountRemainingPct(accountState, name) {
  const usage = accountState?.accountUsage?.[name];
  const weekly = usage?.weekly?.pct;
  const five = usage?.fiveHour?.pct;
  if (typeof weekly === "number") return weekly;
  if (typeof five === "number") return five;
  return null;
}

function totalRemainingPct(accountState) {
  const accounts = Array.isArray(accountState?.accounts) ? accountState.accounts : [];
  let sum = 0;
  let any = false;
  for (const name of accounts) {
    const pct = accountRemainingPct(accountState, name);
    if (typeof pct === "number") {
      sum += pct;
      any = true;
    }
  }
  return any ? sum : null;
}

function accountResetAt(accountState, name) {
  const usage = accountState?.accountUsage?.[name];
  return usage?.weekly?.resetAt || usage?.fiveHour?.resetAt || null;
}

module.exports = {
  initials,
  avatarColor,
  formatPlan,
  accountRemainingPct,
  totalRemainingPct,
  accountResetAt,
};
