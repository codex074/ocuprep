# AUDIT.md — Active Issues & Risk Register (YATA)

> **For AI agents and developers.** Read `CLAUDE.md` first for project context.
> This file records the P0 label-rotation bug, its verified root cause
> and the correct fix, plus a prioritized risk register from the 2026-07-04 code audit.
> When an item is fixed, move it to the **Resolved log** at the bottom with commit hash + date.

- **Last updated:** 2026-07-07
- **Released builds:** YATA 1.0.5–1.0.12 (Electron 30.5.1 / Chromium 124; NSIS installer since electron-builder change)
- **P0 fix status:** ⚠️ the fix drafted 2026-07-04 was **lost before any build** — every build
  1.0.5→1.0.12 shipped with `{ width: 85000, height: 60000 }, landscape: false` (the bug).
  Re-applied 2026-07-07 in the working tree for **v1.0.13**; physical printer validation and release remain.

---

## P0 — FIXED IN CODE (v1.0.13): labels print rotated 90° on some machines

### Symptom
From the Electron .exe (observed on 1.0.5 through 1.0.12), the 8.5×6 cm sticker prints with
content rotated 90°, laid out as a ~60 mm × ~85 mm strip running **along the feed direction**,
crossing from one sticker into the next. Other machines print correctly. **All machines have
identical Seagull/BarTender driver preferences** (stock `USER 85.0 × 60.0 mm`, orientation แนวตั้ง).
The web/PWA version printed via Chrome's dialog was never affected.

### Root cause (verified 2026-07-04 — do not re-derive)
1. v1.0.5+ prints via `webContents.print()` with
   `pageSize: { width: 85000, height: 60000 }, landscape: false` (commit `b670c10`).
2. Windows convention: paper sizes in DEVMODE are **portrait dimensions (width ≤ length)**;
   orientation is a separate flag. `85×60 + portrait` violates that convention.
3. Driver-dependent normalization: some Seagull driver builds accept `85×60 portrait`
   literally (canvas 85 wide × 60 long → prints correctly); spec-stricter builds swap it
   to `60×85 portrait` (canvas 60 wide × 85 long).
4. Chromium renders the PDF page at CSS `@page { size: 8.5cm 6cm }` (landscape-shaped) and
   spools with **autorotate**: when the driver canvas comes back as 60×85, autorotate turns
   the content 90° to fit → exactly the rotated strip seen in field photos.
5. The Printing Preferences dialog looks identical everywhere because **the difference is in
   the driver binary (version / printer model), not the preference values.** Do not chase
   the Preferences dialog as the cause.

### Implemented fix (`electron/main.cjs`, re-applied 2026-07-07)
```js
pageSize: { width: 60000, height: 85000 },  // portrait-normalized 6 × 8.5 cm
landscape: true,
```
- This is the canonical Windows encoding (portrait media + landscape flag) — identical to
  what desktop Chrome sends when printing the PWA with `@page { size: 8.5cm 6cm }`, which
  historically printed correctly on this printer fleet.
- Keep `@page { size: 8.5cm 6cm }` in `src/lib/print.ts` (`buildLabelPrintDocument`) **unchanged**.
  CSS controls the page layout; `pageSize` + `landscape` control the Windows DEVMODE.

### DO NOT (regression traps)
- ❌ Do NOT revert to `{ width: 85000, height: 60000 }, landscape: false` — that combination **is** this bug.
- ❌ Do NOT remove the `print-labels` IPC path / `pageSize` lock — this was attempted 2026-07-07
  ("just use the browser print dialog") and reverted the same day: machines with a wrong driver
  default then skip several blank stickers per print job (the bug `b670c10` fixed), **and**
  rotation persists anyway because Electron `window.print()` uses the driver-default paper
  (the same ambiguous `85×60 แนวตั้ง` preference the strict drivers normalize).
- ❌ Do NOT add a `landscape` keyword to the CSS `@page` rule — invalid syntax risks A4
  fallback (removed in `b670c10` for that reason).
- ✅ (implemented v1.0.14) `silent: true` printing now exists as an opt-in feature: a label
  printer picked in Profile → "เครื่องพิมพ์ฉลาก" is saved to `settings.json` (`labelPrinter`)
  and jobs go to it silently with the program-supplied paper/orientation — this defeats
  machines whose driver default paper is not the 85×60 USER size (dialog DEVMODE comes from
  driver defaults and can override the app's `pageSize` on some drivers). When no printer is
  saved (or it disappeared), the dialog fallback is used. Silent printing alone still does
  not replace the rotation encoding below — keep both.
- ❌ Do NOT change the CSS to `size: 6cm 8.5cm` or pre-rotate content with CSS transforms —
  the physical stock feeds 85 mm across the head × 60 mm long; content must be authored 85 wide.

### Ship checklist (v1.0.13)
1. Verify `electron/main.cjs` `print-labels` handler has `pageSize: { width: 60000, height: 85000 }, landscape: true`
   and `package.json` version is `1.0.13`. **Confirm the values in the built exe, not just the tree —
   the 2026-07-04 fix was lost between draft and build, which is how 1.0.6–1.0.12 shipped broken.**
2. Build on Windows: `npm run electron:build` (NSIS `YATA-Setup-1.0.13.exe`) or
   `npm run electron:build:portable` (requires local `electron/secrets.cjs`, gitignored).
3. Test on **both** kinds of machines: one that currently rotates AND one that currently
   prints correctly (confirms the fix doesn't flip a good machine).
4. Distribute; regenerate the update manifest (`npm run electron:manifest`) if auto-update is used.
5. Verify **every** machine reports 1.0.13 — see OPS-1: version skew looks exactly like
   "same settings, different output".

### If a machine still rotates after 1.0.13
- That machine's driver ignores the job's orientation flag. Per-machine workaround:
  Printing Preferences → แนวการพิมพ์ → เปลี่ยน แนวตั้ง → แนวนอน (or the 180° variants if upside-down).
- If several machines need this, add an app setting (e.g. `labelPrintMode: 'standard' | 'legacy'`
  in the Electron `settings.json`) that switches between the two pageSize/landscape encodings.

### Print-bug history
| Commit | What |
|---|---|
| `8b9c9ff` | Fixed print popup hang on printer switch (web path) |
| `b096ee4` | Duplicate-prep guard + reuse saved prep across reprints (never create a prep per print click) |
| `b670c10` (v1.0.5) | Electron pageSize lock (fixed blank-sticker skipping); removed invalid CSS `landscape`; trailing-blank-page fix |
| *(lost)* | Rotation fix drafted 2026-07-04 for "v1.0.6" never made it into any build — 1.0.6→1.0.12 all shipped the buggy encoding |
| *(reverted 2026-07-07)* | Agent session removed the entire Electron print path in favor of the browser dialog — hit both regression traps above; reverted same day |
| *(working tree, v1.0.13)* | Rotation fix **re-applied**: `pageSize {width: 60000, height: 85000}`, `landscape: true`; awaiting physical-printer validation and release |

---

## Risk register (2026-07-04 audit)

Severity: 🔴 high · 🟠 medium · 🟡 low. Line refs are as of this audit date.

### 🔴 SEC-1 — Firestore is effectively public (no server-side auth)
- **Evidence:** Firebase config is hardcoded and publicly served (`src/lib/firebase.ts:5`,
  project `yata-e56f7`, bundle on GitHub Pages). "Login" is a client-side string compare
  (`src/lib/api.ts:421`); Firebase Auth is not used, so security rules cannot distinguish users.
- **Impact:** anyone with the public config can read/modify/delete all collections,
  including patient PHI in `preps` (HN + patient names).
- **Action:** verify rules in the Firebase console. Long term: adopt Firebase Auth
  (even anonymous sign-in + custom claims) with restrictive rules, or route writes through a
  small server. Interim: enable App Check and schedule Firestore exports/backups.

### 🟠 SEC-3 — HOSxP API tokens embedded in the exe
- `electron/secrets.cjs` is correctly gitignored, but it is bundled into `app.asar` and
  trivially extractable from the portable exe.
- **Mitigation:** the API is intranet-only (`http://172.17.1.70:3000`). Keep tokens
  scoped/rotated; treat the exe as internal-only. Keep the token-scrubbing in
  `loadSettings` (`electron/main.cjs:35`). Never commit `secrets.cjs`.

### 🟠 SEC-4 — Auto-updater trust chain
- The manifest URL is user-configurable in-app, and the SHA-256 used for verification comes
  from the **same manifest** (`electron/main.cjs:348-377`) — integrity yes, authenticity no.
  Whoever controls the manifest URL (or the Vercel account hosting it) can push an arbitrary
  exe to the fleet. The PowerShell `-ExecutionPolicy Bypass` installer (`main.cjs:332`) may
  also trigger AV.
- **Action:** hard-pin the manifest URL at build time (remove from user-editable settings);
  consider code signing; treat the Vercel account as production-critical (2FA).

### 🟠 PRN-1 — Print HTML depends on Google Fonts (internet)
- `src/lib/print.ts` loads Sarabun from `fonts.googleapis.com` inside print
  documents; the Electron flow even waits on `document.fonts.ready` (`main.cjs`).
- **Impact:** on machines without internet access the fallback font has different metrics →
  label overflow → content pushed onto extra stickers. Another source of
  "works on some machines only".
- **Action:** self-host Sarabun (woff2 in `public/fonts/` → `dist/`) and reference it
  locally in **all** print templates.

### 🟠 PRN-2 — No HTML escaping in print templates
- `generateLabelHtml` / `generateBatchSheetHtml` / `generateBottleLabelsHtml`
  (`src/lib/print.ts`) interpolate `patient_name`, `note`, formula fields, and chemical lot
  strings raw into HTML. A value containing `<`, `&`, or pasted markup breaks the label —
  or executes script in the print window (a `file://` context in Electron).
- **Action:** add an `escapeHtml()` helper and wrap every interpolation of
  user-/HOSxP-sourced data.

### 🟡 PRN-3 — PHI in temp files
- Electron printing writes the full label HTML (patient name + HN) to
  `%TEMP%\yata-label-*.html` (`electron/main.cjs`). Deleted in `finally`, but a crash
  mid-print leaves it on disk.
- **Action:** sweep `yata-label-*` on app start, or load via a `data:` URL instead of a temp file.

### 🟡 PRN-4 — Print failures are silent in the renderer — ✅ resolved v1.0.14
- `printAllLabels` now awaits `printLabels` and shows a SweetAlert error on failure
  (cancellations filtered out). Essential for silent printing, which has no dialog at all.

### 🟡 PRN-5 — A4 batch-sheet printing bypasses the Electron page-size lock
- `PrepDetailsModal` → `printA4Html` (window.open + browser dialog); `PreparePage` uses an
  in-page print modal. Neither locks paper via the Electron IPC path, so a mis-click onto
  the sticker printer prints an A4 document across the label roll.
- **Action (optional):** add a `print-a4` IPC handler mirroring `print-labels` with `pageSize: 'A4'`.

### 🟠 OPS-1 — Fleet version skew
- Auto-update only runs when `updateManifestUrl` is configured (default `''` —
  `electron/main.cjs`); exes are otherwise copied by hand → machines drift
  across versions. A mixed-version fleet produces "same settings, different output"
  symptoms **independent of any driver issue**. Confirmed real: 1.0.6–1.0.12 all
  lacked the rotation fix while the tree claimed it was applied.
- **Action:** pin the manifest URL into the build; show the app version prominently
  (login screen); keep a per-machine rollout checklist when shipping 1.0.13.

### 🟡 OPS-2 — Static-server port assumption
- On `EADDRINUSE`, `main.cjs` assumes "app already running" and loads
  `http://127.0.0.1:37200` anyway — any local process squatting that port would be rendered
  inside the app window.
- **Action:** verify a health endpoint (e.g. `GET /__yata` returning a known token) before
  loading; otherwise show an error dialog.

### 🟡 DATA-1 — Action-log auto-pruning
- `action_logs` older than 90 days are pruned client-side on read (see CLAUDE.md). For a
  pharmacy production record this may conflict with retention policy — confirm 90 days is
  an approved retention period, or export logs before pruning.

### 🟡 WEB-1 — PWA cache staleness
- Service-worker caching means users may keep running an old web build after a deploy
  (F5 is not enough; all tabs must be closed and reopened). Remember this when verifying
  web-side fixes in the field.

---

## Print-path map (for agents)

| Path | Used by | Page size controlled by |
|---|---|---|
| `printAllLabels()` → `electronAPI.printLabels` → IPC `print-labels` → hidden BrowserWindow → `webContents.print` | Sticker labels (Electron exe) | `pageSize`+`landscape` in `electron/main.cjs` **and** CSS `@page 8.5cm 6cm` |
| `printAllLabels()` → `window.open` fallback | Sticker labels (web/PWA) | CSS `@page` + user's print-dialog settings |
| `printA4Html()` → `window.open` | Batch sheet (PrepDetailsModal) | CSS `@page A4` + dialog |
| PreparePage in-page print modal (`setPrintContent` + `buildLabelPrintDocument`) | Label preview/print (PreparePage) | in-app modal + browser print |

`buildLabelPrintDocument()` (`src/lib/print.ts`) builds the shared label HTML for both paths.

---

## Resolved log

- `P0` — ใช้ custom paper แบบ portrait-normalized `60000×85000` และ `landscape: true`;
  bump แอปเป็น v1.0.13 — working tree (uncommitted) — re-applied 2026-07-07
  (draft 2026-07-04 สูญหายก่อน build; 1.0.6–1.0.12 จึงยังหมุน 90°)
- `SEC-2 (quick win)` — ลบ password ออกจาก auth state/localStorage, ทำความสะอาด legacy
  session อัตโนมัติ และย้ายการยืนยันรหัสผ่านของหน้าสูตร/โปรไฟล์ไปตรวจผ่าน API;
  การ hash password ใน Firestore ยังขึ้นกับการแก้ SEC-1 — working tree (uncommitted) — 2026-07-04
