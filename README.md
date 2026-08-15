# Codex Accounts

Tweak [Codex++](https://github.com/b-nnett/codex-plusplus) để lưu và đổi session ChatGPT/Codex ngay trong popup avatar (góc dưới bên trái), **không cần restart** app.

Đây là **switcher** (một session sống tại một thời điểm). Khi acc đang dùng hết quota 5h/weekly, tweak có thể **tự chuyển** sang acc còn % (không proxy, không cộng thành một bể quota).

**Phiên bản hiện tại:** 2.5.0

Repo: [LightHaru/codex-plusplus-accounts](https://github.com/LightHaru/codex-plusplus-accounts)

## Cảm ơn repo gốc

Tweak này phát triển từ [Easy Account Switcher](https://github.com/erknvl/codex-plusplus-account-switcher) của [erknvl](https://github.com/erknvl/).

Cảm ơn erknvl vì phần lưu snapshot `auth.json`, trang Accounts, và cách gắn vào Codex++. Bản này đổi UX sang menu avatar, bỏ relaunch khi switch, add acc không logout, và auto-switch khi hết quota.

Cũng cảm ơn [Bennett / Codex++](https://github.com/b-nnett/codex-plusplus) vì runtime load tweak.

## Khác gì bản gốc?

| | Easy Account Switcher (gốc) | Codex Accounts |
|---|---|---|
| Đổi acc | Copy `auth.json` rồi **restart Codex** | Copy `auth.json`, **không restart** |
| UI | Trang Accounts trên sidebar | List trong popup avatar + sidebar fallback |
| Quota | Cache 5h / weekly | Hiện % từng acc, auto-switch khi acc hiện tại hết |
| Add acc | Logout + restart | Cửa sổ login riêng, session đang dùng giữ nguyên |
| Store | Tweak Store (`erknvl/...`) | Repo riêng — **đừng Update bản Store gốc** |

## Cài đặt (Windows + Codex++)

1. Cài [Codex++](https://github.com/b-nnett/codex-plusplus) và mở Codex bằng **shortcut Codex++** (không phải icon Microsoft Store).
2. Clone hoặc tải repo này:
   ```bat
   git clone https://github.com/LightHaru/codex-plusplus-accounts.git
   ```
3. Copy nguyên folder vào:
   ```
   %APPDATA%\codex-plusplus\tweaks\codex-plusplus-accounts
   ```
   Cần có `manifest.json` và `index.bundled.js` trong folder đó.
4. **Tắt / gỡ** tweak Store **Easy Account Switcher** (`me.erkin.codex-plusplus-account-switcher`) nếu đang cài. Hai tweak trùng chức năng; bản Store Update sẽ đè file và kéo UI cũ.
5. Đóng **hẳn** Codex++ (cả khay hệ thống), mở lại shortcut Codex++.

macOS:

```
~/Library/Application Support/codex-plusplus/tweaks/codex-plusplus-accounts
```

Linux:

```
~/.config/codex-plusplus/tweaks/codex-plusplus-accounts
```

Sau khi copy, reload tweaks hoặc restart Codex++. Chỉ đóng/mở popup avatar **không** đủ để nạp code mới.

## Dùng

1. Bấm avatar góc dưới.
2. List acc hiện trong popup (Usage remaining, % từng acc, ngày giờ reset, badge Current).
3. Bấm acc khác: token/`auth.json` đổi sang acc đó, cửa sổ không tắt.
4. **Auto-switch when quota runs out** (mặc định bật): acc hiện tại hết 5h hoặc weekly thì mới nhảy sang acc còn %. Cả list 0% thì đứng yên.
5. **Add another subscription**: mở cửa sổ login riêng, lưu snapshot acc mới, **không logout / không restart**. Acc đang dùng giữ nguyên; bấm acc mới khi muốn chuyển.

Trang **Accounts** trên sidebar (sau Plugins) vẫn dùng được để xóa snapshot.

## Session có đổi thật không?

Có. Switch copy snapshot trong `~/.codex/auth_accounts/` đè lên `~/.codex/auth.json` (access / refresh / id token).

- Request Codex **sau đó** lấy token từ file mới.
- Tên/avatar **gốc** của Codex (header) có thể còn stale vì app giữ identity trong bộ nhớ. List trong popup đánh dấu acc hiện tại.
- Dòng Usage gốc của Codex cũng có thể không nhảy. Nhìn % trên list của tweak.

Muốn header gốc khớp luôn thì restart Codex. Không restart thì vẫn dùng session mới cho turn sau.

## Quota

% trên list là cache 5 giờ / weekly của **từng** acc, không cộng thành một bể quota chung. Số tổng chỉ để nhìn cho nhanh.

Reset hiện dạng ngày + giờ máy local (ví dụ `Th 5, 16/08/2026, 19:39`).

## Lên Codex++ Tweak Store

Trong Codex++: **Settings → Tweak Store → Publish Tweak**, dán `LightHaru/codex-plusplus-accounts`. App lấy commit SHA rồi mở issue review cho maintainer. Cần `iconUrl` trong manifest (đã có). Duyệt xong mới hiện trên shop.

Store đã có Easy Account Switcher; đây là bản fork nâng cấp, không đè bản đó.

## File lưu trên máy

| Việc | Đường dẫn Windows |
|---|---|
| Session đang sống | `%USERPROFILE%\.codex\auth.json` |
| Snapshot từng acc | `%USERPROFILE%\.codex\auth_accounts\<tên>.json` |
| Acc hiện tại | `%USERPROFILE%\.codex\current_account` |
| Cache quota | `%USERPROFILE%\.codex\auth_accounts_usage.json` |
| Auto-switch | `%USERPROFILE%\.codex\auth_accounts_autoswitch.json` |

## Lưu ý Windows Store / Owl

App GUI thật là `ChatGPT.exe`, không phải `Codex.exe`. `app.relaunch()` trên bản Store hay nhảy sang app chưa patch. Tweak này **không** dùng `app.relaunch()` khi switch hay Add account.

## Build / test

```sh
npx esbuild index.js --bundle --platform=node --format=cjs --outfile=index.bundled.js --external:electron
node --test test/account-service.test.js test/profile-menu.test.js
node --check index.js
node --check index.bundled.js
```

`manifest.json` → `main`: `index.bundled.js`

Tweak id: `me.lightharu.codex-accounts`

## Không làm gì

- Không pool nhiều gói ChatGPT thành một hạn mức (không cộng 360%).
- Không MITM / proxy request Codex.
- Auto-switch chỉ đổi session khi acc đang dùng đã hết quota, không chia từng request.
