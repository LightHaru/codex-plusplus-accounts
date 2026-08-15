function windowPct(usage, key) {
  const pct = usage?.[key]?.pct;
  return typeof pct === "number" && Number.isFinite(pct) ? pct : null;
}

function isUsageExhausted(usage) {
  if (!usage) return false;
  const weekly = windowPct(usage, "weekly");
  const five = windowPct(usage, "fiveHour");
  if (weekly === 0) return true;
  if (five === 0) return true;
  return false;
}

function remainingScore(usage) {
  if (!usage || isUsageExhausted(usage)) return 0;
  const weekly = windowPct(usage, "weekly");
  const five = windowPct(usage, "fiveHour");
  if (weekly == null && five == null) return 0;
  if (weekly == null) return five;
  if (five == null) return weekly;
  return Math.min(weekly, five);
}

function hasUsageRemaining(usage) {
  return remainingScore(usage) > 0;
}

function pickFailoverAccount(current, accounts, accountUsage, visited = new Set()) {
  if (!isUsageExhausted(accountUsage?.[current])) return null;
  const names = Array.isArray(accounts) ? accounts : [];
  const candidates = names.filter((name) => {
    if (!name || name === current) return false;
    if (visited.has(name)) return false;
    return hasUsageRemaining(accountUsage?.[name]);
  });
  candidates.sort((a, b) => {
    const diff = remainingScore(accountUsage[b]) - remainingScore(accountUsage[a]);
    if (diff) return diff;
    return a.localeCompare(b, undefined, { sensitivity: "base" });
  });
  return candidates[0] || null;
}

module.exports = {
  isUsageExhausted,
  hasUsageRemaining,
  remainingScore,
  pickFailoverAccount,
};
