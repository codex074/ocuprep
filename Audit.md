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
  - ⚠️ **FIELD EVIDENCE 2026-07-10 (v1.0.15): the silent path printed rotated 90° CCW on all
    pages** (Zebra ZD230). This was the FIRST physical test of the silent path — the v1.0.14
    "verification" only grepped app.asar for the code, it never printed on a real device.
    **ROOT CAUSE (confirmed by isolation test):** on Electron 30/Windows the silent pipeline
    **drops the custom `pageSize` from the print job but still applies the `landscape` flag.**
    Proof: silent-printing to "Microsoft Print to PDF" produced a correctly-oriented page at
    the driver-DEFAULT size, not 60×85 (pageSize dropped, content not rotated by Chromium);
    on the ZD230 the surviving `landscape: true` rotated the driver's default stock 90°,
    rotating every label. This also explains why setting the driver default to 85×60 "didn't
    help" before — the app itself was rotating that correct stock. Related upstream issues:
    electron#39702 (custom pageSize ineffective on Windows, closed not-planned),
    electron#39179 / PR #41811 (silent-path settings handled differently from dialog),
    PR #50808 (silent mediaSize regression fixed only in Electron 41/42).
    **FIX (v1.0.16):** the silent path now sends `landscape: false` (`landscape: !deviceName`
    in `print-labels`); the dialog path keeps the validated `landscape: true` encoding.
    Because pageSize never reaches the driver when silent, each machine's driver default
    stock MUST be set once to USER 85×60 mm — in BOTH Printing Preferences and
    Printer Properties → Advanced → Printing Defaults (the latter is the machine-wide one).
  - ❌ Do NOT send `landscape: true` on the SILENT path while on Electron 30 — pageSize is
    dropped there, so the flag rotates whatever the driver default stock is (this was the
    v1.0.14–1.0.15 silent-path rotation). `landscape: true` remains correct on the dialog path.
  - If the fleet ever upgrades Electron to ≥41/42 (silent mediaSize fix, PR #50808), re-test
    whether the silent path can go back to program-locked pageSize; until then the silent
    path depends on the driver default stock.
  - **FIELD TEST 2026-07-10 (v1.0.16, `landscape:false` silent):** Microsoft Print to PDF now
    prints ROTATED — this is EXPECTED and is not a failure signal: MS PDF's default paper is
    portrait A4, pageSize still can't reach it, and Chromium auto-rotates the landscape-shaped
    CSS page (8.5×6cm) onto portrait paper. **MS Print to PDF is NOT a valid oracle for the
    silent path anymore**; the only valid test is a label printer whose driver default stock
    is set to USER 85×60. Zebra ZD230 also still rotated in this test → consistent with the
    driver default stock NOT being 85×60 at test time (Chromium rotates CSS-landscape content
    onto any portrait-shaped default paper, e.g. 109.5×297). Pending: verify/set ZD230 default
    stock 85(W)×60(H) in Printing Preferences AND Printing Defaults, retest v1.0.16.
    If it STILL rotates with a confirmed 85×60 default stock, stop iterating on
    webContents.print and switch architecture: printToPDF(preferCSSPageSize) → hand the exact
    85×60 PDF to the printer (bundled SumatraPDF `-print-to`), or raw ZPL for Zebra units.
  - **2026-07-10 (v1.0.16 retest): STILL rotated with the 85×60 default stock confirmed in
    both Printing Preferences and Printing Defaults** → Electron 30's silent
    webContents.print() is unusable on this driver regardless of the landscape flag.
    **ARCHITECTURE CHANGE (v1.0.17):** the silent path no longer uses webContents.print().
    It renders an exact 8.5×6cm PDF via `printToPDF({ preferCSSPageSize: true })` (this
    pipeline honors `@page` deterministically) and spools it with a bundled SumatraPDF:
    `SumatraPDF.exe -print-to <printer> -print-settings noscale -silent <pdf>`.
    Binary at `electron/vendor/SumatraPDF.exe` (v3.5.2 x64, portable), packaged via
    electron-builder `extraResources` → `process.resourcesPath/SumatraPDF.exe`
    (excluded from the asar via `!electron/vendor/**`). If the binary is missing at
    runtime the handler falls back to the DIALOG path (never to Electron silent print).
    The dialog path and its validated v1.0.13 encoding are unchanged.
    Machines still need the one-time driver default stock USER 85×60 (SumatraPDF
    `noscale` prints at 100% onto the driver default paper).
  - **Fleet observation 2026-07-10:** the paper size shown in the app's print dialog
    (`user 109.5×297` vs `85×60`) IS the driver-default stock the silent path will print
    onto — use it as the per-machine readiness check. Machines stuck at 109.5×297 after
    "setting the driver" usually mean: (1) the printer is SHARED from another PC — defaults
    must be set on the HOST machine, not the client; (2) a duplicate driver entry was
    configured instead of the one saved in the app profile; or (3) only one of
    Printing Preferences / Printing Defaults was set. On an unconfigured machine the
    v1.0.17 silent path prints the label at correct size/orientation but feeds a 297 mm
    page → several blank stickers per job. Do not enable silent printing there until the
    dialog shows 85×60.
- ❌ Do NOT change the CSS to `size: 6cm 8.5cm` or pre-rotate content with CSS transforms —
  the physical stock feeds 85 mm across the head × 60 mm long; content must be authored 85 wide.

### 2026-07-13 (v1.0.18) — right edge clipped after a driver update (NOT rotation)

Rotation is gone. New, separate symptom: content prints at the correct orientation and the
correct height, but **the right edge is cut off** (`Exp: 12 ส.ค. 25`, `Lot: 202607-1`).

Evidence that pinned it — do not re-derive:
- **Only the horizontal axis overflows.** A scaling fault would overflow both axes. So the
  page size was right; only the horizontal origin was off.
- **The print dialog reported 85×60** on the affected machine — so this is *not* the
  wrong-default-stock problem above. Setting the driver stock did not help.
- **Machines still on the OLD driver print the same exe correctly.** The app is not at
  fault: the newer driver reserves a wider unprintable margin, and `noscale` (100%) then
  starts the 85 mm-wide page at the printable origin and runs off the right.

**Field test ledger (2026-07-13, the affected new-driver machine).** `-print-settings` is
overridable at runtime via `YATA_PRINT_SETTINGS` (added v1.0.18) so a machine can be probed
without a rebuild. Results:

| Build / setting | Path | Orientation | Size |
|---|---|---|---|
| 1.0.17, **no** printer saved | dialog (`webContents.print`) | ✅ correct | ❌ right edge clipped |
| 1.0.17, printer saved | silent (Sumatra `noscale`) | ❌ **rotated 90°** | ❌ oversized |
| 1.0.18 `paper=85mm x 60mm,fit` | silent | ❌ **rotated 90°** | ✅ fits |
| 1.0.18 `fit` | silent | — | ❌ still oversized |

🔴 **This machine has TWO independent faults, not one:**
1. **Rotation happens only on the Sumatra path.** The dialog path never rotates here. So the
   v1.0.17 architecture change did not "fix rotation" universally — on this driver the
   Sumatra path rotates, i.e. the driver's default stock is being interpreted as portrait
   60×85 and Sumatra turns the landscape-shaped page to fit it.
2. **Clipping happens on BOTH paths** → it is a driver-level geometry fault (horizontal
   offset / unprintable margin), not something the app chose.

**Scaling knobs cannot fix fault 2.** `fit` did not shrink anything, which proves the driver
does not consider the page oversized — the content is being *offset*, not enlarged. Do not
burn more time on `fit`/`shrink`/`noscale`; they are all scale knobs and the fault is
positional. (`paper=85mm x 60mm` did change the size, but only by redefining the stock, which
is what triggered the rotation — do not use it.)

❌ **Do NOT ship `paper=85mm x 60mm`** — it reintroduces the P0 rotation.

**Both faults are driver-version-specific: machines still on the OLD driver print correctly
with the same exe.** The driver was updated to chase the rotation bug, which the app already
fixed in 1.0.17 — so the update was not needed.

### Printer is a **Zebra ZD230** (203 dpi). Fix on the machine, not in the app:

1. **Left Position → 0.** Printer properties → Preferences → **Advanced Setup** → *Left
   Position*. Zebra's own guidance for "prints too far right / truncated on the right" is to
   clear any left-position adjustment (default `0`; a negative value such as `-50` dots pulls
   the content back left). This is the offset fault, and it is exactly what a driver reinstall
   resets. → https://supportcommunity.zebra.com/s/article/Adjusting-Left-Position-and-Top-Position-on-Zebra-Barcode-Printers
2. **Confirm the label width in the driver matches the 85 mm media**, and tighten the physical
   media guides — a width mismatch makes the printer clip and shift sideways.
3. **Roll the driver back to ZDesigner v5** if 1–2 don't take. Zebra documents this for the
   ZD230 specifically: install the v10 driver, and *if you cannot print successfully, uninstall
   it and install the v5 driver*. The machines that still print correctly are on the older
   driver. → https://supportcommunity.zebra.com/s/article/000027608

Note for the rotation fault: with ZDesigner, **application settings override driver settings**,
which is why the Sumatra path (whose job carries its own page geometry) rotates on this driver
while the dialog path does not.

### ✅ RESOLVED (v1.0.18): silent printing removed

Rolling the driver back cleared the clipping and the dialog path went back to printing
correctly. **But the silent path still rotated 90° even on the good driver** — so the silent
path itself was the remaining fault, not the driver.

**Silent printing is gone as of v1.0.18.** Removed: the saved label-printer setting, the
"เครื่องพิมพ์ฉลาก" card on the profile page, the `get-label-printer-settings` /
`save-label-printer` IPC handlers, the `printToPDF` + SumatraPDF spooler, and the bundled
`SumatraPDF.exe` (`extraResources` dropped — the installer is ~15 MB smaller). Every print now
goes through the dialog path with the validated v1.0.13 DEVMODE encoding.

Why removal rather than another fix attempt:
- **No station ever had silent printing working** — the feature had no users to lose.
- The silent path was itself introduced (v1.0.17) *to escape* the rotation bug, and became the
  rotation bug. Every shortcut added around the print dialog has produced a new way to rotate
  labels; the dialog path is the only one with a fleet-wide validation record.
- The whole class of bug dies with it. The cost is one extra click per print job.

🔴 **Do not reintroduce silent printing** (`webContents.print({silent:true})`, printToPDF +
external spooler, or raw ZPL) without a machine that reproduces both paths side by side. This
bug family cost 7 broken releases (1.0.6–1.0.12) plus the 2026-07-13 session.

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

### ✅ SEC-5 — HN Lookup proxy leaked patient names to any website (FIXED 2026-07-13)
- **Was:** `hn-lookup-electron/main.js` served `/api/patient` on `127.0.0.1:3100` with
  `Access-Control-Allow-Origin: *` **and** `Access-Control-Allow-Private-Network: true`.
  Any page open in the same browser could read patient names off localhost by walking
  HN values — no auth, no origin check. This is PHI leaving via a drive-by page.
- **Fix:** the browser path is closed. The CORS/PNA headers are gone and any request
  carrying an `Origin` header (i.e. every browser request) gets a 403. Verified: no origin,
  including the app's own GitHub Pages origin, can read a response; native callers still can.
- **Why this is safe:** every station runs the YATA **desktop** app, which reaches HOSxP over
  IPC (`ipcMain.handle('lookup-hn')`) and never touches this server. The standalone proxy
  existed only to serve the PWA in a browser.
- **Consequence:** the web/PWA build can no longer look up patient names. Accepted — the
  fleet is on the desktop app.
- ❌ **Do NOT restore `Access-Control-Allow-Origin: *`.** If the browser path is ever needed
  again, add an explicit origin allowlist checked against `req.headers.origin` — a wildcard
  on a localhost service that returns PHI is a drive-by data leak, not a convenience.

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

### 🟠 PRN-6 — Compact IPD label (75×35mm) pageSize/landscape pairing not physically validated
- Added 2026-08-21: a size toggle on the label preview (`PreparePage.tsx` and
  `PrepDetailsModal.tsx` — both build their own copy of this preview) lets IPD staff
  print a 75mm × 35mm label instead of the standard 8.5×6cm one. New, fully separate code
  path: `generateCompactLabelHtml` / `buildCompactLabelPrintDocument` / `printCompactLabel`
  (`src/lib/print.ts`), IPC `print-compact-label` (`electron/main.cjs`), exposed as
  `electronAPI.printCompactLabel` (`electron/preload.cjs`, `src/electron.d.ts`).
- Bottle-wrap labels for this size (`generateCompactBottleLabelsHtml`) reuse the standard
  `.bl` label box **unchanged** (6.5cm × 1.7cm) — content and dimensions are identical to
  the standard bottle label — but paginate **1 label per page** instead of 3, so every page
  in the compact print job stays the same 7.5×3.5cm size. This was a deliberate choice: mixing
  two different `@page` sizes in one Electron print job is not reliable (the driver-level
  `pageSize` argument to `webContents.print` locks ONE physical size for the whole job), so
  rather than give bottle pages their own 8.5×6cm size, they're paginated onto the compact
  page size instead.
- The short-prep-method and ingredients pages (`generateCompactPrepStickersHtml`) are the
  same content as `generatePrepStickersHtml`, resized onto the same 7.5×3.5cm compact page.
  Long `short_prep` text or long ingredient lists simply clip (`overflow:hidden`) — this is
  the same tradeoff the standard 8.5×6cm version already makes, not a new limitation.
  `buildCompactLabelPrintDocument(labelHtml, prepStickersHtml, bottleHtml, options)` and
  `printCompactLabel(labelHtml, prepStickersHtml, bottleHtml)` compose the full compact
  print job in that page order: main label → short-prep/ingredients → bottle labels.
- The Electron `pageSize: { width: 35000, height: 75000 }, landscape: true` encoding was
  **derived by the same portrait-normalize + landscape convention** validated for the
  8.5×6cm case (P0 above) — width ≤ height, `landscape:true` — but has **not** been
  physically printed on a real IPD label printer. The P0 rotation bug above shows this
  exact class of value is driver-sensitive and easy to get subtly wrong.
- **Action:** before relying on this for real IPD label stock, physically test
  `electronAPI.printCompactLabel` end-to-end on the actual printer/driver combination IPD
  uses, and confirm the printed label is right-side-up at the correct 75×35mm size (not
  rotated, not scaled to a different paper size). Until validated, prefer the web/PWA
  fallback (browser print dialog) for the compact size, or double-check each print visually.
- The two print paths (`print-labels` / `print-compact-label`) are deliberately kept fully
  independent in `electron/main.cjs` — do not merge them into a single parameterized
  handler without re-reading the P0 history above; the existing standard-label path must
  stay untouched regardless of what happens with the compact one.

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
| `printCompactLabel()` → `electronAPI.printCompactLabel` → IPC `print-compact-label` → hidden BrowserWindow → `webContents.print` | Compact IPD label (Electron exe) — see PRN-6, **not physically validated** | `pageSize`+`landscape` in `electron/main.cjs` **and** CSS `@page 7.5cm 3.5cm` |
| `printCompactLabel()` → `window.open` fallback | Compact IPD label (web/PWA) | CSS `@page` + user's print-dialog settings |

`buildLabelPrintDocument()` (`src/lib/print.ts`) builds the shared label HTML for the standard-size path;
`buildCompactLabelPrintDocument()` builds a fully separate document for the compact 75×35mm path (PRN-6).

---

## Resolved log

- `P0` — ใช้ custom paper แบบ portrait-normalized `60000×85000` และ `landscape: true`;
  bump แอปเป็น v1.0.13 — working tree (uncommitted) — re-applied 2026-07-07
  (draft 2026-07-04 สูญหายก่อน build; 1.0.6–1.0.12 จึงยังหมุน 90°)
- `SEC-2 (quick win)` — ลบ password ออกจาก auth state/localStorage, ทำความสะอาด legacy
  session อัตโนมัติ และย้ายการยืนยันรหัสผ่านของหน้าสูตร/โปรไฟล์ไปตรวจผ่าน API;
  การ hash password ใน Firestore ยังขึ้นกับการแก้ SEC-1 — working tree (uncommitted) — 2026-07-04
