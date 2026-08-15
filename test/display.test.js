const assert = require("node:assert/strict");
const test = require("node:test");
const {
  initials,
  formatPlan,
  accountRemainingPct,
  totalRemainingPct,
  accountResetAt,
  avatarColor,
} = require("../src/display");

test("initials uses two letters from a name", () => {
  assert.equal(initials("Susan Jones"), "SJ");
  assert.equal(initials("hahha"), "HA");
  assert.equal(initials(""), "A");
});

test("formatPlan defaults empty plans to Plus", () => {
  assert.equal(formatPlan(""), "Plus");
  assert.equal(formatPlan("plus"), "Plus");
  assert.equal(formatPlan("pro"), "Pro");
});

test("accountRemainingPct prefers weekly over 5h", () => {
  const state = {
    accountUsage: {
      a: { weekly: { pct: 12 }, fiveHour: { pct: 80 } },
      b: { fiveHour: { pct: 40 } },
    },
  };
  assert.equal(accountRemainingPct(state, "a"), 12);
  assert.equal(accountRemainingPct(state, "b"), 40);
  assert.equal(accountRemainingPct(state, "missing"), null);
});

test("totalRemainingPct sums known percents", () => {
  const state = {
    accounts: ["a", "b", "c"],
    accountUsage: {
      a: { weekly: { pct: 10 } },
      b: { weekly: { pct: 0 } },
    },
  };
  assert.equal(totalRemainingPct(state), 10);
});

test("accountResetAt uses weekly then 5h", () => {
  const state = {
    accountUsage: {
      a: { weekly: { resetAt: "Thu 20:00" }, fiveHour: { resetAt: "now" } },
      b: { fiveHour: { resetAt: "Fri 13:00" } },
    },
  };
  assert.equal(accountResetAt(state, "a"), "Thu 20:00");
  assert.equal(accountResetAt(state, "b"), "Fri 13:00");
});

test("avatarColor is stable for a given account name", () => {
  assert.equal(avatarColor("account"), avatarColor("account"));
  assert.notEqual(avatarColor("account"), avatarColor("account-2"));
});
