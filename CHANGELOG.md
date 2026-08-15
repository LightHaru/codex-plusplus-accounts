# Changelog

All notable changes to [Codex Accounts](https://github.com/LightHaru/codex-plusplus-accounts) are listed here.

[English](#english) · [Tiếng Việt](#tiếng-việt)

---

# English

## 2.5.2 — 2026-08-16

Security pass on tokens, files, login, and IPC.

- Switch copies only a validated Codex auth snapshot (regular file, size cap, JSON, real tokens). Invalid JSON and random files are refused.
- Symlinks and `../` names are ignored in the accounts folder.
- Usage fetch follows HTTPS redirects only on `chatgpt.com`. Bearer tokens are not sent off-site.
- Add-account window allows `https:` and the localhost OAuth callback. `javascript:` / `file:` are blocked. Partition cookies are cleared after login.
- IPC unknown actions are rejected without echoing the payload. Logs redact JWTs, API keys, and Bearer headers.
- Snapshot files are written with user-only permissions when the OS allows it.
- Renderer no longer receives local filesystem paths.

## 2.5.1 — 2026-08-16

Per-account quota reset times.

- Remaining % and reset weekday/date/time are fetched with **that account's** access token, not the live window session.
- Refresh walks every saved account, so the popup no longer shows one shared clock on every row.
- Renderer load no longer crashes on `node:https` (lazy require in main only).

## 2.5.0 — 2026-08-16

Rebrand to **Codex Accounts** (`me.lightharu.codex-accounts`).

- Switch accounts from the avatar popup without restarting Codex.
- **Current** badge on the live account.
- **Add another subscription** opens a separate OAuth window. The current session stays until you click the new row.
- **Auto-switch when quota runs out** (on by default): hops only when the live account's 5h or weekly remaining is 0, and only to an account that still has remaining %. If every account is 0%, it stays put.
- Not a quota pool and not a proxy. One live session at a time.
- Store icon + bilingual README. Do not Tweak Store Update Easy Account Switcher.

## 2.2.1 — 2026-08-15

Initial public snapshot (then named Codex Avatar Switcher).

- Fork of [Easy Account Switcher](https://github.com/erknvl/codex-plusplus-account-switcher) by erknvl.
- Avatar-menu switch of `~/.codex/auth.json` without `app.relaunch()`.

---

# Tiếng Việt

## 2.5.2 — 2026-08-16

Siết bảo mật token, file, cửa sổ login, và IPC.

- Switch chỉ nhận snapshot auth Codex hợp lệ (file thường, giới hạn size, JSON, có token). File hỏng / file lạ bị từ chối.
- Bỏ qua symlink và tên `../` trong thư mục accounts.
- Fetch usage chỉ theo redirect HTTPS trên `chatgpt.com`. Không gửi Bearer ra host khác.
- Cửa sổ Add account chỉ đi `https:` và callback localhost. Chặn `javascript:` / `file:`. Xóa cookie partition sau khi login.
- IPC action lạ bị từ chối, không echo payload. Log redact JWT, API key, Bearer.
- File snapshot ghi quyền user-only khi OS cho phép.
- Renderer không còn nhận đường dẫn filesystem máy.

## 2.5.1 — 2026-08-16

Giờ reset quota theo từng tài khoản.

- % còn lại và giờ reset lấy bằng **token của acc đó**, không lấy từ session cửa sổ đang mở.
- Refresh đi hết acc đã lưu, popup không còn hiện cùng một giờ cho mọi dòng.
- Sửa renderer gãy vì `node:https` (chỉ require khi chạy main).

## 2.5.0 — 2026-08-16

Đổi tên thành **Codex Accounts** (`me.lightharu.codex-accounts`).

- Đổi acc từ popup avatar, không restart Codex.
- Badge **Current** trên acc đang dùng.
- **Add another subscription** mở cửa sổ OAuth riêng. Session hiện tại giữ nguyên đến khi bấm acc mới.
- **Auto-switch when quota runs out** (mặc định bật): chỉ hop khi acc đang dùng hết 5h hoặc weekly, và chỉ sang acc còn %. Cả list 0% thì đứng yên.
- Không phải bể quota, không proxy. Một session sống tại một thời điểm.
- Icon store + README bilingual. Đừng Tweak Store Update Easy Account Switcher.

## 2.2.1 — 2026-08-15

Bản public đầu (lúc đó tên Codex Avatar Switcher).

- Fork [Easy Account Switcher](https://github.com/erknvl/codex-plusplus-account-switcher) của erknvl.
- Đổi `~/.codex/auth.json` từ menu avatar, không `app.relaunch()`.
