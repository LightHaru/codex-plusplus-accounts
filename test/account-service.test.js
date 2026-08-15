const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

function authWithEmail(email, extra = {}) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ email })).toString("base64url");
  return JSON.stringify({
    auth_mode: "chatgpt",
    ...extra,
    tokens: {
      id_token: `${header}.${payload}.`,
      access_token: extra.accessToken || "access",
      refresh_token: "refresh",
      account_id: extra.accountId,
    },
  });
}

function authWithProfile({ email, name, plan }) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      email,
      name,
      "https://api.openai.com/auth": {
        chatgpt_plan_type: plan,
        organizations: [{ title: "Personal", is_default: true }],
      },
    }),
  ).toString("base64url");
  return JSON.stringify({ tokens: { id_token: `${header}.${payload}.` } });
}

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

async function withTempHome(fn) {
  const originalHome = process.env.HOME;
  const originalUserProfile = process.env.USERPROFILE;
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "codex-account-switcher-"));
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  delete require.cache[require.resolve("../src/account/service")];

  try {
    return await fn(home);
  } finally {
    restoreEnv("HOME", originalHome);
    restoreEnv("USERPROFILE", originalUserProfile);
    await fs.rm(home, { recursive: true, force: true });
  }
}

async function touch(filePath, isoDate) {
  const date = new Date(isoDate);
  await fs.utimes(filePath, date, date);
}

test("state includes saved account email metadata", async () => {
  const originalHome = process.env.HOME;
  const originalUserProfile = process.env.USERPROFILE;
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "codex-account-switcher-"));
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  delete require.cache[require.resolve("../src/account/service")];

  try {
    const codexDir = path.join(home, ".codex");
    const accountsDir = path.join(codexDir, "auth_accounts");
    await fs.mkdir(accountsDir, { recursive: true });
    await fs.writeFile(path.join(accountsDir, "work.json"), authWithEmail("work@example.com"));
    await fs.writeFile(path.join(accountsDir, "personal.json"), authWithEmail("me@example.com"));
    await fs.writeFile(path.join(codexDir, "auth.json"), authWithEmail("work@example.com"));

    const { createAccountService } = require("../src/account/service");
    const service = createAccountService({ log: { warn() {} } });
    const result = await service.handle({ action: "state" });

    assert.equal(result.ok, true);
    assert.deepEqual(result.state.accountEmails, {
      personal: "me@example.com",
      work: "work@example.com",
    });
    assert.deepEqual(result.state.accountProfiles, {
      personal: { email: "me@example.com" },
      work: { email: "work@example.com" },
    });
  } finally {
    restoreEnv("HOME", originalHome);
    restoreEnv("USERPROFILE", originalUserProfile);
    await fs.rm(home, { recursive: true, force: true });
  }
});

test("state includes profile metadata stored in account tokens", async () => {
  await withTempHome(async (home) => {
    const codexDir = path.join(home, ".codex");
    const accountsDir = path.join(codexDir, "auth_accounts");
    await fs.mkdir(accountsDir, { recursive: true });
    const auth = authWithProfile({ email: "me@example.com", name: "Example User", plan: "plus" });
    await fs.writeFile(path.join(accountsDir, "personal.json"), auth);
    await fs.writeFile(path.join(codexDir, "auth.json"), auth);

    const { createAccountService } = require("../src/account/service");
    const service = createAccountService({ log: { warn() {} } });
    const result = await service.handle({ action: "state" });

    assert.deepEqual(result.state.accountProfiles.personal, {
      email: "me@example.com",
      name: "Example User",
      plan: "plus",
      organization: "Personal",
    });
  });
});

test("state includes cached account usage metadata", async () => {
  const originalHome = process.env.HOME;
  const originalUserProfile = process.env.USERPROFILE;
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "codex-account-switcher-"));
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  delete require.cache[require.resolve("../src/account/service")];

  try {
    const codexDir = path.join(home, ".codex");
    const accountsDir = path.join(codexDir, "auth_accounts");
    await fs.mkdir(accountsDir, { recursive: true });
    await fs.writeFile(path.join(accountsDir, "work.json"), authWithEmail("work@example.com"));
    await fs.writeFile(path.join(codexDir, "auth.json"), authWithEmail("work@example.com"));
    await fs.writeFile(
      path.join(codexDir, "auth_accounts_usage.json"),
      JSON.stringify({
        work: {
          fiveHour: { label: "5h", pct: 72, resetAt: "8:30 PM" },
          weekly: { label: "Weekly", pct: 91, resetAt: "Sat, 6:00 PM" },
          at: 1777728000000,
        },
      }),
    );

    const { createAccountService } = require("../src/account/service");
    const service = createAccountService({ log: { warn() {} } });
    const result = await service.handle({ action: "state" });

    assert.equal(result.ok, true);
    assert.deepEqual(result.state.accountUsage, {
      work: {
        fiveHour: { label: "5h", pct: 72, resetAt: "8:30 PM" },
        weekly: { label: "Weekly", pct: 91, resetAt: "Sat, 6:00 PM" },
        at: 1777728000000,
      },
    });
  } finally {
    restoreEnv("HOME", originalHome);
    restoreEnv("USERPROFILE", originalUserProfile);
    await fs.rm(home, { recursive: true, force: true });
  }
});

test("refresh-usage stores active account usage", async () => {
  const originalHome = process.env.HOME;
  const originalUserProfile = process.env.USERPROFILE;
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "codex-account-switcher-"));
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  delete require.cache[require.resolve("../src/account/service")];

  try {
    const codexDir = path.join(home, ".codex");
    const accountsDir = path.join(codexDir, "auth_accounts");
    await fs.mkdir(accountsDir, { recursive: true });
    await fs.writeFile(path.join(accountsDir, "work.json"), authWithEmail("work@example.com"));
    await fs.writeFile(path.join(codexDir, "auth.json"), authWithEmail("work@example.com"));

    const { createAccountService } = require("../src/account/service");
    const service = createAccountService({
      log: { warn() {} },
      fetchActiveUsage: async () => ({
        fiveHour: { label: "5h", pct: 64, resetAt: "9:00 PM" },
        weekly: { label: "Weekly", pct: 88, resetAt: "Sun, 6:00 PM" },
        at: 1777729000000,
      }),
    });
    const result = await service.handle({ action: "refresh-usage" });

    assert.equal(result.ok, true);
    assert.deepEqual(result.state.accountUsage.work, {
      fiveHour: { label: "5h", pct: 64, resetAt: "9:00 PM" },
      weekly: { label: "Weekly", pct: 88, resetAt: "Sun, 6:00 PM" },
      at: 1777729000000,
    });
    const usageCache = JSON.parse(
      await fs.readFile(path.join(codexDir, "auth_accounts_usage.json"), "utf8"),
    );
    assert.equal(usageCache.work.fiveHour.pct, 64);
  } finally {
    restoreEnv("HOME", originalHome);
    restoreEnv("USERPROFILE", originalUserProfile);
    await fs.rm(home, { recursive: true, force: true });
  }
});

test("switch syncs API account base URL into Codex config", async () => {
  await withTempHome(async (home) => {
    const codexDir = path.join(home, ".codex");
    const accountsDir = path.join(codexDir, "auth_accounts");
    await fs.mkdir(accountsDir, { recursive: true });
    await fs.writeFile(path.join(accountsDir, "chatgpt.json"), authWithEmail("me@example.com"));
    await fs.writeFile(
      path.join(accountsDir, "api.json"),
      `${JSON.stringify(
        {
          auth_mode: "apikey",
          OPENAI_API_KEY: "sk-test",
          base_url: "https://example.com/v1",
        },
        null,
        2,
      )}\n`,
    );
    await fs.writeFile(path.join(codexDir, "auth.json"), authWithEmail("me@example.com"));
    await fs.writeFile(
      path.join(codexDir, "config.toml"),
      'model = "gpt-5.5"\n\n[projects.test]\ntrust_level = "trusted"\n',
    );

    const { createAccountService } = require("../src/account/service");
    const service = createAccountService({ log: { info() {}, warn() {} } });
    const apiResult = await service.handle({ action: "switch", name: "api" });

    assert.equal(apiResult.ok, true);
    assert.match(
      await fs.readFile(path.join(codexDir, "config.toml"), "utf8"),
      /^openai_base_url = "https:\/\/example\.com\/v1"$/m,
    );

    const chatgptResult = await service.handle({ action: "switch", name: "chatgpt" });
    assert.equal(chatgptResult.ok, true);
    assert.doesNotMatch(
      await fs.readFile(path.join(codexDir, "config.toml"), "utf8"),
      /^openai_base_url\s*=/m,
    );
  });
});

test("switch leaves config unchanged for API account without base URL", async () => {
  await withTempHome(async (home) => {
    const codexDir = path.join(home, ".codex");
    const accountsDir = path.join(codexDir, "auth_accounts");
    await fs.mkdir(accountsDir, { recursive: true });
    await fs.writeFile(
      path.join(accountsDir, "api.json"),
      `${JSON.stringify({ auth_mode: "apikey", OPENAI_API_KEY: "sk-test" }, null, 2)}\n`,
    );
    await fs.writeFile(path.join(codexDir, "auth.json"), authWithEmail("me@example.com"));
    const config = 'openai_base_url = "https://existing.example/v1"\nmodel = "gpt-5.5"\n';
    await fs.writeFile(path.join(codexDir, "config.toml"), config);

    const { createAccountService } = require("../src/account/service");
    const service = createAccountService({ log: { info() {}, warn() {} } });
    const result = await service.handle({ action: "switch", name: "api" });

    assert.equal(result.ok, true);
    assert.equal(await fs.readFile(path.join(codexDir, "config.toml"), "utf8"), config);
  });
});

test("switch still copies account when base URL sync cannot parse JSON", async () => {
  await withTempHome(async (home) => {
    const codexDir = path.join(home, ".codex");
    const accountsDir = path.join(codexDir, "auth_accounts");
    await fs.mkdir(accountsDir, { recursive: true });
    await fs.writeFile(path.join(accountsDir, "broken.json"), "{not valid json");
    await fs.writeFile(path.join(codexDir, "auth.json"), authWithEmail("me@example.com"));
    const warnings = [];

    const { createAccountService } = require("../src/account/service");
    const service = createAccountService({
      log: { info() {}, warn(message) { warnings.push(message); } },
    });
    const result = await service.handle({ action: "switch", name: "broken" });

    assert.equal(result.ok, true);
    assert.equal(await fs.readFile(path.join(codexDir, "auth.json"), "utf8"), "{not valid json");
    assert.equal((await fs.readFile(path.join(codexDir, "current_account"), "utf8")).trim(), "broken");
    assert.match(warnings[0], /skipped base URL sync/);
  });
});

test("clear-active removes configured base URL", async () => {
  await withTempHome(async (home) => {
    const codexDir = path.join(home, ".codex");
    await fs.mkdir(codexDir, { recursive: true });
    await fs.writeFile(path.join(codexDir, "auth.json"), authWithEmail("me@example.com"));
    await fs.writeFile(
      path.join(codexDir, "config.toml"),
      'openai_base_url = "https://example.com/v1"\nmodel = "gpt-5.5"\n',
    );

    const { createAccountService } = require("../src/account/service");
    const service = createAccountService({ log: { info() {}, warn() {} } });
    const result = await service.handle({ action: "clear-active" });

    assert.equal(result.ok, true);
    assert.doesNotMatch(
      await fs.readFile(path.join(codexDir, "config.toml"), "utf8"),
      /^openai_base_url\s*=/m,
    );
  });
});

test("state hides duplicate email accounts and keeps the active match", async () => {
  await withTempHome(async (home) => {
    const codexDir = path.join(home, ".codex");
    const accountsDir = path.join(codexDir, "auth_accounts");
    await fs.mkdir(accountsDir, { recursive: true });

    const oldAuth = authWithEmail("work@example.com", { profile_id: "old" });
    const activeAuth = authWithEmail("work@example.com", { profile_id: "active" });
    await fs.writeFile(path.join(accountsDir, "work-old.json"), oldAuth);
    await fs.writeFile(path.join(accountsDir, "work-current.json"), activeAuth);
    await fs.writeFile(path.join(codexDir, "auth.json"), activeAuth);
    await touch(path.join(accountsDir, "work-old.json"), "2026-05-13T10:00:00.000Z");
    await touch(path.join(accountsDir, "work-current.json"), "2026-05-12T10:00:00.000Z");

    const { createAccountService } = require("../src/account/service");
    const service = createAccountService({ log: { warn() {} } });
    const result = await service.handle({ action: "state" });

    assert.equal(result.ok, true);
    assert.deepEqual(result.state.accounts, ["work-current"]);
    assert.equal(result.state.current, "work-current");
    assert.deepEqual(result.state.accountEmails, { "work-current": "work@example.com" });
    assert.deepEqual((await fs.readdir(accountsDir)).sort(), ["work-current.json", "work-old.json"]);
  });
});

test("state refreshes matching saved email instead of creating generic autosave", async () => {
  await withTempHome(async (home) => {
    const codexDir = path.join(home, ".codex");
    const accountsDir = path.join(codexDir, "auth_accounts");
    await fs.mkdir(accountsDir, { recursive: true });

    const oldAuth = authWithEmail("work@example.com", { profile_id: "old-token" });
    const refreshedAuth = authWithEmail("work@example.com", { profile_id: "refreshed-token" });
    await fs.writeFile(path.join(accountsDir, "work.json"), oldAuth);
    await fs.writeFile(path.join(codexDir, "auth.json"), refreshedAuth);

    const { createAccountService } = require("../src/account/service");
    const service = createAccountService({ log: { warn() {} } });
    const result = await service.handle({ action: "state" });

    assert.equal(result.ok, true);
    assert.deepEqual(result.state.accounts, ["work"]);
    assert.equal(result.state.current, "work");
    assert.equal(await fs.readFile(path.join(accountsDir, "work.json"), "utf8"), refreshedAuth);
    await assert.rejects(fs.stat(path.join(accountsDir, "account.json")), { code: "ENOENT" });
  });
});

test("state hides duplicate email accounts and keeps newest when none is active", async () => {
  await withTempHome(async (home) => {
    const codexDir = path.join(home, ".codex");
    const accountsDir = path.join(codexDir, "auth_accounts");
    await fs.mkdir(accountsDir, { recursive: true });

    await fs.writeFile(path.join(accountsDir, "work-old.json"), authWithEmail("work@example.com", { profile_id: "old" }));
    await fs.writeFile(path.join(accountsDir, "work-new.json"), authWithEmail("work@example.com", { profile_id: "new" }));
    await fs.writeFile(path.join(accountsDir, "other.json"), authWithEmail("other@example.com"));
    await fs.writeFile(path.join(codexDir, "auth.json"), authWithEmail("active@example.com"));
    await touch(path.join(accountsDir, "work-old.json"), "2026-05-12T10:00:00.000Z");
    await touch(path.join(accountsDir, "work-new.json"), "2026-05-13T10:00:00.000Z");

    const { createAccountService } = require("../src/account/service");
    const service = createAccountService({ log: { warn() {} } });
    const result = await service.handle({ action: "state" });

    assert.equal(result.ok, true);
    assert.deepEqual(result.state.accounts, ["account", "other", "work-new"]);
    assert.equal(result.state.current, "account");
    assert.equal(result.state.accountEmails["work-new"], "work@example.com");
    assert.deepEqual(
      (await fs.readdir(accountsDir)).filter((name) => name.startsWith("work-")).sort(),
      ["work-new.json", "work-old.json"],
    );
  });
});

test("usage summary includes reset time for exhausted windows", () => {
  const { accountUsageSummary } = require("../src/ui-components");
  const originalNow = Date.now;
  Date.now = () => 1777728300000;

  try {
    const summary = accountUsageSummary(
      {
        accountUsage: {
          work: {
            fiveHour: { label: "5h", pct: 0, resetAt: "8:30 PM" },
            weekly: { label: "Weekly", pct: 0, resetAt: "Sat, 6:00 PM" },
            at: 1777728000000,
          },
        },
      },
      "work",
    );

    assert.equal(
      summary,
      "5-hour 0% remaining, resets 8:30 PM · Weekly 0% remaining, resets Sat, 6:00 PM",
    );
  } finally {
    Date.now = originalNow;
  }
});

test("usage summary omits cache age for non-exhausted windows", () => {
  const { accountUsageSummary } = require("../src/ui-components");
  const originalNow = Date.now;
  Date.now = () => 1777728300000;

  try {
    const summary = accountUsageSummary(
      {
        accountUsage: {
          work: {
            fiveHour: { label: "5h", pct: 92, resetAt: "8:30 PM" },
            weekly: { label: "Weekly", pct: 82, resetAt: "Sat, 6:00 PM" },
            at: 1777728000000,
          },
        },
      },
      "work",
    );

    assert.equal(summary, "5-hour 92% remaining · Weekly 82% remaining");
  } finally {
    Date.now = originalNow;
  }
});

test("switch copies auth without requiring an app relaunch", async () => {
  await withTempHome(async (home) => {
    const codexDir = path.join(home, ".codex");
    const accountsDir = path.join(codexDir, "auth_accounts");
    await fs.mkdir(accountsDir, { recursive: true });
    const personal = authWithEmail("me@example.com");
    const work = authWithEmail("work@example.com");
    await fs.writeFile(path.join(accountsDir, "personal.json"), personal);
    await fs.writeFile(path.join(accountsDir, "work.json"), work);
    await fs.writeFile(path.join(codexDir, "auth.json"), personal);
    await fs.writeFile(path.join(codexDir, "current_account"), "personal\n");

    const { createAccountService } = require("../src/account/service");
    const service = createAccountService({ log: { info() {}, warn() {} } });
    const result = await service.handle({ action: "switch", name: "work" });

    assert.equal(result.ok, true);
    assert.equal(result.state.requiresAppRelaunch, false);
    assert.equal(result.state.current, "work");
    assert.equal(result.state.notice, "Switched to work.");
    assert.equal(await fs.readFile(path.join(codexDir, "auth.json"), "utf8"), work);
    assert.equal((await fs.readFile(path.join(codexDir, "current_account"), "utf8")).trim(), "work");
  });
});

test("refresh-usage stores a distinct reset time per saved account", async () => {
  await withTempHome(async (home) => {
    const codexDir = path.join(home, ".codex");
    const accountsDir = path.join(codexDir, "auth_accounts");
    await fs.mkdir(accountsDir, { recursive: true });
    await fs.writeFile(
      path.join(accountsDir, "work.json"),
      authWithEmail("work@example.com", { accessToken: "tok-work" }),
    );
    await fs.writeFile(
      path.join(accountsDir, "personal.json"),
      authWithEmail("me@example.com", { accessToken: "tok-personal" }),
    );
    await fs.writeFile(path.join(codexDir, "auth.json"), authWithEmail("work@example.com", { accessToken: "tok-work" }));
    await fs.writeFile(path.join(codexDir, "current_account"), "work\n");

    const { createAccountService } = require("../src/account/service");
    const service = createAccountService({
      log: { info() {}, warn() {} },
      fetchUsageWithAuth: async (auth) => {
        const token = auth?.tokens?.access_token;
        if (token === "tok-work") {
          return {
            fiveHour: { label: "5h", pct: 0, resetAt: "18:06 Thứ 5, 20/08/2026" },
            weekly: { label: "Weekly", pct: 0, resetAt: "18:06 Thứ 5, 20/08/2026" },
            at: 1777729000000,
          };
        }
        if (token === "tok-personal") {
          return {
            fiveHour: { label: "5h", pct: 12, resetAt: "19:39 Thứ 5, 20/08/2026" },
            weekly: { label: "Weekly", pct: 40, resetAt: "19:39 Thứ 5, 20/08/2026" },
            at: 1777729000000,
          };
        }
        throw new Error(`unexpected token ${token}`);
      },
    });
    const result = await service.handle({ action: "refresh-usage" });

    assert.equal(result.ok, true);
    assert.equal(result.state.accountUsage.work.weekly.resetAt, "18:06 Thứ 5, 20/08/2026");
    assert.equal(result.state.accountUsage.personal.weekly.resetAt, "19:39 Thứ 5, 20/08/2026");
    assert.notEqual(
      result.state.accountUsage.work.weekly.resetAt,
      result.state.accountUsage.personal.weekly.resetAt,
    );
  });
});

test("switch fetches usage for the newly active account", async () => {
  await withTempHome(async (home) => {
    const codexDir = path.join(home, ".codex");
    const accountsDir = path.join(codexDir, "auth_accounts");
    await fs.mkdir(accountsDir, { recursive: true });
    await fs.writeFile(path.join(accountsDir, "work.json"), authWithEmail("work@example.com"));
    await fs.writeFile(path.join(codexDir, "auth.json"), authWithEmail("me@example.com"));

    const { createAccountService } = require("../src/account/service");
    const service = createAccountService({
      log: { info() {}, warn() {} },
      fetchActiveUsage: async () => ({
        fiveHour: { label: "5h", pct: 55, resetAt: "9:00 PM" },
        weekly: { label: "Weekly", pct: 80, resetAt: "Sun, 6:00 PM" },
        at: 1777729000000,
      }),
    });
    const result = await service.handle({ action: "switch", name: "work" });

    assert.equal(result.ok, true);
    assert.equal(result.state.requiresAppRelaunch, false);
    assert.deepEqual(result.state.accountUsage.work, {
      fiveHour: { label: "5h", pct: 55, resetAt: "9:00 PM" },
      weekly: { label: "Weekly", pct: 80, resetAt: "Sun, 6:00 PM" },
      at: 1777729000000,
    });
  });
});

test("clear-active still requires an app relaunch", async () => {
  await withTempHome(async (home) => {
    const codexDir = path.join(home, ".codex");
    await fs.mkdir(codexDir, { recursive: true });
    await fs.writeFile(path.join(codexDir, "auth.json"), authWithEmail("me@example.com"));

    const { createAccountService } = require("../src/account/service");
    const service = createAccountService({ log: { info() {}, warn() {} } });
    const result = await service.handle({ action: "clear-active" });

    assert.equal(result.ok, true);
    assert.equal(result.state.requiresAppRelaunch, true);
  });
});

test("saveIncomingAccount writes a snapshot and leaves live auth.json alone", async () => {
  await withTempHome(async (home) => {
    const { saveIncomingAccount, buildAuthJson, sanitizeAccountName } = require("../src/account/login");
    const fs = require("node:fs/promises");
    const path = require("node:path");
    const codexDir = path.join(home, ".codex");
    const accountsDir = path.join(codexDir, "auth_accounts");
    await fs.mkdir(accountsDir, { recursive: true });
    const live = authWithEmail("live@example.com");
    await fs.writeFile(path.join(codexDir, "auth.json"), live);
    await fs.writeFile(path.join(accountsDir, "account.json"), live);
    await fs.writeFile(path.join(codexDir, "current_account"), "account\n");

    assert.equal(sanitizeAccountName("Susan Jones"), "Susan-Jones");
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        email: "new@example.com",
        name: "New Person",
        "https://api.openai.com/auth": { chatgpt_account_id: "acc-1" },
      }),
    ).toString("base64url");
    const auth = buildAuthJson(
      {
        id_token: `${header}.${payload}.sig`,
        access_token: "access-new",
        refresh_token: "refresh-new",
      },
      null,
    );
    const saved = await saveIncomingAccount(auth);
    assert.equal(saved.name, "New-Person");
    assert.equal(saved.updated, false);
    const liveAfter = await fs.readFile(path.join(codexDir, "auth.json"), "utf8");
    assert.equal(liveAfter, live);
    const current = await fs.readFile(path.join(codexDir, "current_account"), "utf8");
    assert.equal(current.trim(), "account");
    const snapshot = JSON.parse(await fs.readFile(path.join(accountsDir, "New-Person.json"), "utf8"));
    assert.equal(snapshot.tokens.access_token, "access-new");
    assert.equal(snapshot.tokens.account_id, "acc-1");
  });
});

test("add-account action is registered", async () => {
  await withTempHome(async () => {
    const { createAccountService } = require("../src/account/service");
    const service = createAccountService({ log: { info() {}, warn() {} } });
    // Without a login window this fails, but it must not be an unknown action.
    const result = await service.handle({ action: "add-account" });
    assert.equal(result.ok, false);
    assert.match(String(result.error || ""), /Cannot find module 'electron'|Sign-in|electron/i);
  });
});

const {
  isUsageExhausted,
  hasUsageRemaining,
  pickFailoverAccount,
} = require("../src/account/failover");

test("failover only hops off an exhausted current account", () => {
  const usage = {
    a: { weekly: { pct: 0 }, fiveHour: { pct: 0 } },
    b: { weekly: { pct: 40 }, fiveHour: { pct: 80 } },
    c: { weekly: { pct: 10 }, fiveHour: { pct: 5 } },
  };
  assert.equal(isUsageExhausted(usage.a), true);
  assert.equal(hasUsageRemaining(usage.b), true);
  assert.equal(pickFailoverAccount("a", ["a", "b", "c"], usage), "b");
  assert.equal(pickFailoverAccount("b", ["a", "b", "c"], usage), null);
});

test("failover stays put when every saved account is empty", () => {
  const usage = {
    a: { weekly: { pct: 0 } },
    b: { fiveHour: { pct: 0 } },
  };
  assert.equal(pickFailoverAccount("a", ["a", "b"], usage), null);
});

test("set-autoswitch persists enabled flag", async () => {
  await withTempHome(async (home) => {
    const fs = require("node:fs/promises");
    const path = require("node:path");
    const { createAccountService } = require("../src/account/service");
    const service = createAccountService({ log: { info() {}, warn() {} } });
    const off = await service.handle({ action: "set-autoswitch", enabled: false });
    assert.equal(off.ok, true);
    assert.equal(off.state.autoswitchEnabled, false);
    const raw = JSON.parse(
      await fs.readFile(path.join(home, ".codex", "auth_accounts_autoswitch.json"), "utf8"),
    );
    assert.equal(raw.enabled, false);
    const on = await service.handle({ action: "set-autoswitch", enabled: true });
    assert.equal(on.state.autoswitchEnabled, true);
  });
});
