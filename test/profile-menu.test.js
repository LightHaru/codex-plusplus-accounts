const assert = require("node:assert/strict");
const test = require("node:test");
const { isProfilePopupLabels } = require("../src/ui-profile-menu");

test("profile popup labels match avatar menu stock items", () => {
  assert.equal(
    isProfilePopupLabels(["Show pet", "Settings", "Log out", "Usage remaining"]),
    true,
  );
  assert.equal(isProfilePopupLabels(["Settings", "Log out"]), true);
  assert.equal(isProfilePopupLabels(["Usage remaining", "Log out"]), true);
  assert.equal(isProfilePopupLabels(["Show pet", "Sign out"]), true);
});

test("profile popup labels reject File menu and unrelated chrome", () => {
  assert.equal(
    isProfilePopupLabels(["New chat", "New window", "Settings", "Log out", "Exit"]),
    false,
  );
  assert.equal(isProfilePopupLabels(["Settings"]), false);
  assert.equal(isProfilePopupLabels(["Plugins", "New chat", "Pull requests"]), false);
  assert.equal(isProfilePopupLabels([]), false);
});
