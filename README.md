<p align="center">
  <img src="assets/logo.png" width="128" height="128" alt="Codex Accounts">
</p>

<h1 align="center">Codex Accounts</h1>

<p align="center">
  Switch ChatGPT / Codex sessions from the avatar menu.<br>
  No restart. Separate login window. Auto-switch when quota runs out.
</p>

<p align="center">
  <a href="#english">English</a> ·
  <a href="#tiếng-việt">Tiếng Việt</a>
</p>

<p align="center">
  <img alt="version" src="https://img.shields.io/badge/version-2.5.7-4F8CFF?style=flat-square">
  <img alt="ChatGPT Layer tweak" src="https://img.shields.io/badge/ChatGPT%20Layer-tweak-111827?style=flat-square">
  <img alt="platforms" src="https://img.shields.io/badge/Windows%20%7C%20macOS%20%7C%20Linux-3b82f6?style=flat-square">
  <a href="https://github.com/LightHaru/chatgpt-layer"><img alt="requires ChatGPT Layer" src="https://img.shields.io/badge/requires-ChatGPT%20Layer-6366f1?style=flat-square"></a>
</p>

<p align="center">
  A <a href="https://github.com/LightHaru/chatgpt-layer">ChatGPT Layer</a> tweak ·
  <a href="https://github.com/LightHaru/codex-plusplus-accounts">LightHaru/codex-plusplus-accounts</a>
  · <a href="CHANGELOG.md">Changelog</a>
</p>

---

# English

One live ChatGPT / Codex session at a time. Codex Accounts swaps `auth.json` from the bottom-left avatar popup so you can hop accounts without quitting the app.

It is a **switcher**, not a quota pool. It does not proxy requests or add 100% + 100% into a shared 200% bar.

Based on [Easy Account Switcher](https://github.com/erknvl/codex-plusplus-account-switcher) by [erknvl](https://github.com/erknvl/). This fork moves the UI into the avatar menu, drops relaunch on switch, adds accounts without logging you out, and can fail over when the current account is empty.

## Features

- Switch accounts from the avatar popup. Window stays open.
- **Current** badge on the live account (name, not a generic "Primary").
- Per-account 5-hour and weekly remaining %, plus the next reset weekday / date / time.
- **Add another subscription** opens a separate OAuth window. The current session is left alone until you click the new account.
- **Auto-switch when quota runs out** (on by default): hops only when the live account's 5h **or** weekly remaining hits 0, and only to a saved account that still has remaining %. If every account is at 0%, it stays put.
- Sidebar **Accounts** page matches the popup (avatars, Current, %, click to switch). Three-dot menu still deletes a snapshot.
- Windows tray icon (**Codex Accounts**) in the notification overflow: left-click shows the window, right-click **Quit** fully kills `ChatGPT.exe`.

## vs Easy Account Switcher

| | Easy Account Switcher | Codex Accounts |
|---|---|---|
| Switch | Copy `auth.json`, **restart Codex** | Copy `auth.json`, **no restart** |
| UI | Accounts page in the sidebar | Avatar popup + matching sidebar page |
| Quota | Cached 5h / weekly | % on each row, auto-switch when the current one is empty |
| Add account | Logout + restart | Separate login window, live session kept |
| Store | Codex++ Tweak Store (`erknvl/...`) | [ChatGPT Layer Tweak Store](https://github.com/LightHaru/chatgpt-layer) (this repo). **Do not Update Easy Account Switcher** |

## Install

[ChatGPT Layer](https://github.com/LightHaru/chatgpt-layer) is required. Launch ChatGPT with the **ChatGPT Layer** shortcut (`ChatGPT.exe`), not the Microsoft Store icon and not the `Codex.exe` stub in the same folder.

### From the Tweak Store (recommended)

1. Install [ChatGPT Layer](https://github.com/LightHaru/chatgpt-layer).
2. Open the **ChatGPT Layer** shortcut.
3. Settings → Tweak Store → Install **Codex Accounts**.
4. If **Easy Account Switcher** (`me.erkin.codex-plusplus-account-switcher`) is installed, turn it off or remove it. Both tweaks do the same job. A Store Update of that one will overwrite files and bring the old UI back.
5. Fully quit ChatGPT (including the Codex Accounts tray icon), then open the ChatGPT Layer shortcut again. Closing the avatar popup is not enough to load new tweak code.

### Manual copy (fallback)

1. Clone this repo:

```bat
git clone https://github.com/LightHaru/codex-plusplus-accounts.git
```

2. Copy the folder to:

```
%APPDATA%\codex-plusplus\tweaks\codex-plusplus-accounts
```

The folder must contain `manifest.json` and `index.bundled.js`. Data paths did not change with the ChatGPT Layer rebrand.

3. Same Easy Account Switcher warning as above, then fully quit and reopen the **ChatGPT Layer** shortcut.

**macOS**

```
~/Library/Application Support/codex-plusplus/tweaks/codex-plusplus-accounts
```

**Linux**

```
~/.config/codex-plusplus/tweaks/codex-plusplus-accounts
```

### Updates

When you ship a new version, **create a GitHub Release with a semver tag** (for example `v2.5.7`). ChatGPT Layer checks `releases/latest` and prompts **Update**. Pushing `main` without a Release does not notify users.

Tweak id stays `me.lightharu.codex-accounts`. Do not change it — a new id duplicates the install.

## Usage

1. Click the avatar in the bottom-left corner.
2. The popup lists saved accounts: usage remaining, per-account %, reset time, and a **Current** badge.
3. Click another account. Tokens in `auth.json` swap to that account. The window does not close.
4. Leave **Auto-switch when quota runs out** on if you want a hop when the live account hits 0% on 5h or weekly. It will not rotate through empty accounts.
5. **Add another subscription** opens a login window, saves a new snapshot, and does **not** log you out or restart. Click the new row when you actually want to switch.

Use the sidebar **Accounts** page (below Plugins) to delete a saved snapshot.

### Did the session actually change?

Yes. Switch copies `~/.codex/auth_accounts/<name>.json` over `~/.codex/auth.json` (access / refresh / id token). ChatGPT / Codex requests after that pick up the new tokens.

The native header name, avatar, and Usage % can stay stale because the app keeps identity in memory. Trust the popup list. Restart ChatGPT only if you want the stock header to match.

### Quota

The % on each row is that account's own 5-hour / weekly cache. Numbers are not added into one shared pool. The total at the top of the list is only a quick glance.

Reset times use the machine's local timezone (example: `Thu, 20/08/2026, 18:06`).

### What this tweak does not do

- Does not pool several ChatGPT plans into one limit (no fake 360%).
- Does not MITM or proxy ChatGPT / Codex traffic.
- Auto-switch changes the live session when the current account is exhausted. It does not split requests across accounts.

## Windows Store / Owl note

The real GUI binary is `ChatGPT.exe`, not `Codex.exe`. The Store `Codex.exe` in the same folder is a stub that exits. Calling `app.relaunch()` on the Store build often jumps to the unpatched Store app. This tweak does **not** relaunch on switch or Add account. Always launch from the **ChatGPT Layer** shortcut.

## Files on disk

| What | Windows path |
|---|---|
| Live session | `%USERPROFILE%\.codex\auth.json` |
| Per-account snapshots | `%USERPROFILE%\.codex\auth_accounts\<name>.json` |
| Current account marker | `%USERPROFILE%\.codex\current_account` |
| Quota cache | `%USERPROFILE%\.codex\auth_accounts_usage.json` |
| Auto-switch setting | `%USERPROFILE%\.codex\auth_accounts_autoswitch.json` |

Tweak files stay under `%APPDATA%\codex-plusplus\tweaks\codex-plusplus-accounts` (ChatGPT Layer kept the Codex++ data directory).

## Build / test

```sh
npx esbuild index.js --bundle --platform=node --format=cjs --outfile=index.bundled.js --external:electron
node --test test/account-service.test.js test/display.test.js test/profile-menu.test.js test/tray.test.js
node --check index.js
node --check index.bundled.js
```

`manifest.json` → `main`: `index.bundled.js`

Tweak id: `me.lightharu.codex-accounts`

## Credits

- [erknvl](https://github.com/erknvl/) — [Easy Account Switcher](https://github.com/erknvl/codex-plusplus-account-switcher) (`auth.json` snapshots, Accounts page, original host hook)
- [Bennett](https://github.com/b-nnett/codex-plusplus) — original Codex++ loader
- [ChatGPT Layer](https://github.com/LightHaru/chatgpt-layer) — maintained host (LightHaru/chatgpt-layer)

---

# Tiếng Việt

Một session ChatGPT / Codex sống tại một thời điểm. Codex Accounts đổi `auth.json` ngay trong popup avatar góc dưới bên trái, **không cần tắt app**.

Đây là **switcher**, không phải bể quota. Không proxy request, không cộng 100% + 100% thành một thanh 200%.

Phát triển từ [Easy Account Switcher](https://github.com/erknvl/codex-plusplus-account-switcher) của [erknvl](https://github.com/erknvl/). Bản này đưa UI vào menu avatar, bỏ relaunch khi switch, thêm acc không logout, và tự chuyển khi acc đang dùng hết quota.

## Tính năng

- Đổi acc từ popup avatar. Cửa sổ không tắt.
- Badge **Current** trên acc đang dùng (tên thật, không ghi "Primary").
- % còn lại 5 giờ / weekly từng acc, kèm thứ / ngày / giờ reset.
- **Add another subscription** mở cửa sổ OAuth riêng. Session đang dùng giữ nguyên đến khi bạn bấm acc mới.
- **Auto-switch when quota runs out** (mặc định bật): chỉ nhảy khi acc hiện tại hết 5h **hoặc** weekly (còn 0), và chỉ sang acc còn %. Cả list 0% thì đứng yên.
- Trang **Accounts** trên sidebar giống popup (avatar, Current, %, bấm để đổi). Menu 3 chấm vẫn xóa snapshot.
- Icon khay Windows (**Codex Accounts**) trong overflow: chuột trái mở cửa sổ, chuột phải **Quit** tắt hẳn `ChatGPT.exe`.

## Khác gì bản gốc?

| | Easy Account Switcher | Codex Accounts |
|---|---|---|
| Đổi acc | Copy `auth.json` rồi **restart Codex** | Copy `auth.json`, **không restart** |
| UI | Trang Accounts trên sidebar | Popup avatar + trang sidebar cùng style |
| Quota | Cache 5h / weekly | Hiện % từng acc, auto-switch khi acc hiện tại hết |
| Add acc | Logout + restart | Cửa sổ login riêng, session đang dùng giữ nguyên |
| Store | Codex++ Tweak Store (`erknvl/...`) | [ChatGPT Layer Tweak Store](https://github.com/LightHaru/chatgpt-layer) (repo này). **Đừng Update Easy Account Switcher** |

## Cài đặt

Cần [ChatGPT Layer](https://github.com/LightHaru/chatgpt-layer). Bạn mở ChatGPT bằng shortcut **ChatGPT Layer** (`ChatGPT.exe`), không phải icon Microsoft Store, không phải stub `Codex.exe` cùng thư mục.

### Từ Tweak Store (nên dùng)

1. Cài [ChatGPT Layer](https://github.com/LightHaru/chatgpt-layer).
2. Mở shortcut **ChatGPT Layer**.
3. Settings → Tweak Store → Install **Codex Accounts**.
4. Nếu bạn đang cài **Easy Account Switcher** (`me.erkin.codex-plusplus-account-switcher`) thì tắt / gỡ. Hai tweak trùng chức năng. Store Update bản đó sẽ đè file và kéo UI cũ.
5. Đóng **hẳn** ChatGPT (cả icon khay Codex Accounts), rồi mở lại shortcut ChatGPT Layer. Chỉ đóng/mở popup avatar **không** đủ để nạp code mới.

### Copy tay (dự phòng)

1. Clone repo:

```bat
git clone https://github.com/LightHaru/codex-plusplus-accounts.git
```

2. Copy nguyên folder vào:

```
%APPDATA%\codex-plusplus\tweaks\codex-plusplus-accounts
```

Cần có `manifest.json` và `index.bundled.js` trong folder đó. Đường dẫn data **không** đổi khi host chuyển sang ChatGPT Layer.

3. Cùng cảnh báo Easy Account Switcher như trên, rồi đóng hẳn app và mở lại shortcut **ChatGPT Layer**.

**macOS**

```
~/Library/Application Support/codex-plusplus/tweaks/codex-plusplus-accounts
```

**Linux**

```
~/.config/codex-plusplus/tweaks/codex-plusplus-accounts
```

### Cập nhật

Khi bạn ship bản mới, **tạo GitHub Release với tag semver** (ví dụ `v2.5.7`). ChatGPT Layer check `releases/latest` rồi hiện **Update**. Push `main` mà không có Release thì người dùng không được báo.

Tweak id giữ nguyên `me.lightharu.codex-accounts`. Đừng đổi id — id mới sẽ cài trùng bản.

## Hướng dẫn dùng

1. Bấm avatar góc dưới bên trái.
2. List acc hiện trong popup: Usage remaining, % từng acc, giờ reset, badge **Current**.
3. Bấm acc khác: token trong `auth.json` đổi sang acc đó, cửa sổ không tắt.
4. Để **Auto-switch when quota runs out** bật nếu bạn muốn tự hop khi acc đang dùng về 0% (5h hoặc weekly). Không xoay vòng các acc đã hết.
5. **Add another subscription** mở cửa sổ login, lưu snapshot acc mới, **không logout / không restart**. Bấm dòng acc mới khi bạn muốn chuyển.

Trang **Accounts** trên sidebar (sau Plugins) dùng để xóa snapshot.

### Session có đổi thật không?

Có. Switch copy `~/.codex/auth_accounts/<tên>.json` đè lên `~/.codex/auth.json` (access / refresh / id token). Request ChatGPT / Codex sau đó lấy token mới.

Tên, avatar và dòng Usage **gốc** có thể còn stale vì app giữ identity trong bộ nhớ. Nhìn list trong popup. Restart ChatGPT chỉ khi bạn muốn header gốc khớp luôn.

### Quota

% trên từng dòng là cache 5 giờ / weekly **của acc đó**, không cộng thành một bể chung. Số tổng trên đầu list chỉ để nhìn cho nhanh.

Giờ reset theo timezone máy (ví dụ `Th 5, 20/08/2026, 18:06`).

### Không làm gì

- Không pool nhiều gói ChatGPT thành một hạn mức (không cộng 360%).
- Không MITM / proxy request ChatGPT / Codex.
- Auto-switch chỉ đổi session khi acc đang dùng đã hết quota, không chia từng request.

## Lưu ý Windows Store / Owl

App GUI thật là `ChatGPT.exe`, không phải `Codex.exe`. `Codex.exe` cùng thư mục là stub, mở lên là thoát. `app.relaunch()` trên bản Store hay nhảy sang app chưa patch. Tweak này **không** dùng `app.relaunch()` khi switch hay Add account. Luôn mở từ shortcut **ChatGPT Layer**.

## File lưu trên máy

| Việc | Đường dẫn Windows |
|---|---|
| Session đang sống | `%USERPROFILE%\.codex\auth.json` |
| Snapshot từng acc | `%USERPROFILE%\.codex\auth_accounts\<tên>.json` |
| Acc hiện tại | `%USERPROFILE%\.codex\current_account` |
| Cache quota | `%USERPROFILE%\.codex\auth_accounts_usage.json` |
| Auto-switch | `%USERPROFILE%\.codex\auth_accounts_autoswitch.json` |

File tweak vẫn nằm ở `%APPDATA%\codex-plusplus\tweaks\codex-plusplus-accounts` (ChatGPT Layer giữ nguyên thư mục data Codex++).

## Build / test

```sh
npx esbuild index.js --bundle --platform=node --format=cjs --outfile=index.bundled.js --external:electron
node --test test/account-service.test.js test/display.test.js test/profile-menu.test.js test/tray.test.js
node --check index.js
node --check index.bundled.js
```

`manifest.json` → `main`: `index.bundled.js`

Tweak id: `me.lightharu.codex-accounts`

## Cảm ơn

- [erknvl](https://github.com/erknvl/) — [Easy Account Switcher](https://github.com/erknvl/codex-plusplus-account-switcher) (snapshot `auth.json`, trang Accounts, móc host ban đầu)
- [Bennett](https://github.com/b-nnett/codex-plusplus) — loader Codex++ gốc
- [ChatGPT Layer](https://github.com/LightHaru/chatgpt-layer) — host đang maintain (LightHaru/chatgpt-layer)
