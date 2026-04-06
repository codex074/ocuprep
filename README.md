<div align="center">

# 💊 YATA

### Extemporaneous Eye Drop Preparation Tracking System
**Uttaradit Hospital — Pharmacy Department**

[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-7.3-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![PWA](https://img.shields.io/badge/PWA-Enabled-5A0FC8?style=flat-square&logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps)
[![GitHub Pages](https://img.shields.io/badge/Deployed_on-GitHub_Pages-222222?style=flat-square&logo=github&logoColor=white)](https://pages.github.com)
[![Google Apps Script](https://img.shields.io/badge/Backend-Google_Apps_Script-4285F4?style=flat-square&logo=google&logoColor=white)](https://script.google.com)

</div>

---

## 📋 Overview

**YATA** is a web application for recording and tracking the production of custom-compounded (extemporaneous) eye drop medications in the Pharmacy Department of Uttaradit Hospital.

The system manages the full preparation workflow — from formula selection and lot number generation to label printing, historical auditing, and monthly workload analysis — with role-based access for pharmacists and administrators.

---

## ✨ Features

| Category | Details |
|---|---|
| 🔐 **Authentication** | Login with pharmacist ID, forced password change on first login, 1-hour session timeout |
| 📊 **Dashboard** | Selectable month & location filter · 6 stat cards · recent list with inline edit/delete · formula summary · built-in workload analysis section · Export to Excel |
| 🧪 **Preparation Recording** | Patient or stock mode · auto lot number · auto expiry calculation · quantity multiplier · actual GAS error messages surfaced on save failure |
| 🖨️ **Label Printing** | Batch sheets · standard patient labels · bottle labels · prep stickers — all browser-printable |
| 💡 **Formula Management** | Admin: create/edit/delete formulas with short names, ingredients, preparation methods, pricing · displayed as a sortable list table |
| 👥 **User Management** | Admin: manage pharmacist accounts, roles, profile images, active status |
| 📜 **History** | Full audit log · filter modal (ห้องยา, ประเภท, ช่วงเวลา, วันที่, คำค้นหา) with active filter chips · paginated 20 per load · Export to Excel |
| 📱 **PWA / Mobile** | Installable on iOS/Android · offline-capable · bottom navigation bar · profile popup in bottom nav (no sidebar on mobile) |
| ⚡ **Performance** | Server-side date filter · GAS formula cache (1 hr) · optimistic UI updates · load-more pagination |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   Frontend (React PWA)                   │
│              Hosted on GitHub Pages                      │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────────┐  │
│  │  Pages   │  │  Hooks   │  │  Contexts / Cache     │  │
│  │ (Routes) │  │(Data/API)│  │  Auth · Toast · Prep  │  │
│  └──────────┘  └──────────┘  └───────────────────────┘  │
└──────────────────────────┬───────────────────────────────┘
                           │ HTTP GET (query params)
                           ▼
┌──────────────────────────────────────────────────────────┐
│             Backend (Google Apps Script)                 │
│                    gas/Code.gs                           │
└──────────────────────────┬───────────────────────────────┘
                           │ Sheets API
                           ▼
┌──────────────────────────────────────────────────────────┐
│              Database (Google Sheets)                    │
│            users  │  formulas  │  preps                 │
└──────────────────────────────────────────────────────────┘
```

---

## 🗂️ Project Structure

```
utth-ed/
├── 📁 src/
│   ├── 📁 components/
│   │   ├── 📁 layout/          # App shell (sidebar, header, bottom nav)
│   │   ├── 📁 ui/              # Modal, Combobox, LoadingState, Toast…
│   │   ├── EditPrepModal.tsx
│   │   ├── PrepDetailsModal.tsx
│   │   ├── ProfileCard.tsx
│   │   └── SummaryDetailsModal.tsx
│   ├── 📁 contexts/            # AuthContext, ToastContext
│   ├── 📁 hooks/               # usePreps, useFormulas, useUsers, useGasInit…
│   ├── 📁 lib/
│   │   ├── api.ts              # GAS API connector (all HTTP calls)
│   │   ├── print.ts            # Label / batch sheet HTML generation
│   │   ├── resourceCache.ts    # In-memory cache with TTL & invalidation
│   │   └── utils.ts            # Date formatting, helpers
│   ├── 📁 pages/
│   │   ├── DashboardPage.tsx   # Overview + workload analysis (combined)
│   │   ├── HistoryPage.tsx     # Full audit log with note column
│   │   ├── PreparePage.tsx     # Preparation recording & label printing
│   │   ├── FormulasPage.tsx    # Formula management
│   │   ├── UsersPage.tsx       # User management (admin)
│   │   └── ProfilePage.tsx     # User profile
│   ├── 📁 types/               # TypeScript interfaces (User, Formula, Prep)
│   └── App.tsx                 # Routing & auth guards
├── 📁 gas/
│   └── Code.gs                 # Google Apps Script backend
├── 📁 scripts/
│   └── import-formulas.mjs     # Bulk-import formulas via GAS API
├── 📁 public/
│   ├── 📁 icons/               # PWA icons (192, 512, maskable)
│   └── 📁 avatars/             # User profile avatar images
├── 📁 .github/workflows/
│   └── deploy-pages.yml        # CI/CD — auto deploy on push to main
├── .env.example
├── vite.config.ts
└── package.json
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) ≥ 18
- A Google account (for Google Apps Script backend)

### 1 — Clone & Install

```bash
git clone <repository-url>
cd utth-ed
npm install
```

### 2 — Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set your GAS Web App URL:

```env
VITE_GAS_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

### 3 — Start Development Server

```bash
npm run dev
# App available at http://localhost:5173
```

---

## ☁️ Deployment

### Step 1 — Deploy the Backend (Google Apps Script)

1. Open [Google Apps Script](https://script.google.com/) and create a **new standalone project**.
2. Copy the full contents of `gas/Code.gs` into the editor.
3. Click **Deploy → New Deployment → Web app**.
4. Configure:
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`
5. Click **Deploy**, grant the required permissions, and copy the **Web App URL**.

> **Note:** No manual Google Sheet setup is required — the backend auto-creates and seeds the spreadsheet on the first request.

> ⚠️ **Updating GAS:** Pushing to GitHub does **not** redeploy the GAS backend. After any change to `gas/Code.gs`, you must manually redeploy:
> **Deploy → Manage deployments → ✏️ Edit → New version → Deploy**
> The Web App URL remains the same.

**Verify deployment:**
```
https://script.google.com/macros/s/DEPLOYMENT_ID/exec?action=ping
# Should return: {"ok": true, ...}
```

---

### Step 2 — Deploy the Frontend (GitHub Pages)

#### Option A — Automated (Recommended)

1. Push to a GitHub repository.
2. Go to **Settings → Pages**, set **Source = GitHub Actions**.
3. Go to **Settings → Secrets and variables → Actions → Variables**.
4. Add a variable `VITE_GAS_URL` with your GAS Web App URL.
5. Push to `main` — GitHub Actions builds and deploys automatically.

#### Option B — Manual Deploy

```bash
npm run deploy
```

---

### Step 3 — First Login

| Field | Value |
|---|---|
| Pharmacist ID | `admin` |
| Password | `1234` |

> ⚠️ **You will be forced to change the password on first login. Do it immediately.**

---

## 📊 Dashboard

The Dashboard is the central hub, combining real-time overview and monthly workload analysis in a single page.

### Toolbar

| Control | Description |
|---|---|
| **Month selector** | Dropdown built from all historical prep records — shows every month that has data, plus the current month |
| **Location filter** | Appears automatically when the selected month has records from more than one station/ward |
| **Refresh** | Force-refresh data from GAS, bypassing the client-side cache |

### Stat Cards (6 cards)

| Card | Metric |
|---|---|
| 🔵 จำนวนขวดทั้งหมด | Total bottles produced in the selected month / filter |
| 🟡 จำนวนขวดเฉพาะราย | Bottles for patient-specific (เฉพาะราย) preparations |
| 🟣 จำนวนขวด Stock | Bottles for stock preparations |
| 🟢 ขวดเฉลี่ย/วันที่ผลิต | Average bottles per active production day |
| 🔴 จำนวนขวดวันสูงสุด | Busiest day — total bottles with the date shown |
| 🩵 มูลค่ายาที่ผลิต | Total production value `฿` calculated as `formula.price × qty` |

### Recent List

- Displays the **20 most recent** preparations in the selected month/filter
- Formula name shown as **`short_name`** (falls back to full name if not set)
- Click any row to open full prep details (PrepDetailsModal)
- Inline **Edit** and **Delete** buttons — visible to the record owner or any admin
- **"โหลดเพิ่มอีก 20 รายการ"** button appears when more records remain
- Resets to 20 automatically when the month or location filter changes

### Formula Summary

- Lists all formulas prepared in the selected month, sorted by total bottles (descending)
- Displays **`short_name`** (abbreviated) with the full name available on hover
- Click any formula to open SummaryDetailsModal showing individual prep records

### Workload Analysis Section

Embedded below the main grid — uses the same month/location filter as the rest of the page.

#### Time-slot Proportion

| Slot | Condition | Colour |
|---|---|---|
| 🟡 เช้า (Morning) | Mon–Fri 08:30–13:30 | Amber |
| 🔵 บ่าย (Afternoon) | Mon–Fri 13:30–16:30 | Blue |
| 🔴 นอกเวลา (Overtime) | Saturday/Sunday (all day) **or** weekday before 08:30 / after 16:30 | Red |

> Classification uses the `created_at` timestamp. Records without a timestamp are counted as นอกเวลา.

#### Daily Breakdown Table

- Per-day counts for each time slot, total records, total bottles, and a mini stacked bar chart
- Toggle between **"เฉพาะวันที่ผลิต"** (days with data only) and **"แสดงทุกวัน"** (all days in month)

#### Export Excel

- Downloads a `.xlsx` file (`workload-YYYY-MM.xlsx`) with the daily breakdown table and a summary totals row
- Export reflects the active month and location filter

---

## 🛢️ Database Schema

Three sheets are created automatically on first run.

### `users`
| Column | Description |
|---|---|
| `id` | Unique user ID |
| `name` | Full name |
| `pha_id` | Pharmacist ID (login username, stored lowercase) |
| `password` | Password (plaintext — change immediately in production) |
| `role` | `admin` or `user` |
| `active` | Account enabled flag |
| `must_change_password` | Force password change on next login |
| `profile_image` | Avatar image path |
| `created_at` | ISO timestamp |

### `formulas`
| Column | Description |
|---|---|
| `id` | Unique formula ID |
| `code` | Short formula code |
| `name` | Full formula name |
| `short_name` | Abbreviated name — displayed in Dashboard formula summary |
| `concentration` | Drug concentration |
| `expiry_days` | Shelf life in days; **negative** = hours (e.g. `-4` = 4 hours) |
| `price` | Cost per bottle — used in production value calculations |
| `ingredients` | JSON array of `{name, amount}` objects |
| `method` | JSON array of preparation step strings |

### `preps`
| Column | Description |
|---|---|
| `id` | Unique preparation record ID |
| `formula_id` | Linked formula |
| `mode` | `patient` (เฉพาะราย) or `stock` |
| `lot_no` | Auto-generated lot number (`LOT-YYYYMM-NNN`) |
| `date` | Preparation date — stored and returned as `YYYY-MM-DD` |
| `expiry_date` | Calculated expiry — `YYYY-MM-DD` or full ISO for hour-based expiry |
| `qty` | Number of bottles |
| `note` | Optional remark / หมายเหตุ |
| `prepared_by` | Pharmacist name |
| `user_pha_id` | Pharmacist ID |
| `location` | Station/ward where prep was made — used for location filter |
| `created_at` | Full timestamp — **used for time-slot classification** in workload analysis |

---

## 🔌 API Reference

All requests are HTTP GET to the GAS Web App URL:

```
GET https://script.google.com/.../exec?action=<ACTION>&<params>
```

| Action | Parameters | Description |
|---|---|---|
| `ping` | — | Health check; returns sheet row counts |
| `login` | `pha_id`, `password` | Authenticate; returns user object or error |
| `getUsers` | — | List all users |
| `createUser` / `updateUser` / `deleteUser` | `data` JSON / `id` | User CRUD (admin) |
| `getFormulas` | — | List formulas — **cached 1 hr** in GAS CacheService |
| `createFormula` / `updateFormula` / `deleteFormula` | `data` JSON / `id` | Formula CRUD — **auto-invalidates cache** |
| `getPreps` | `startDate?`, `endDate?` (YYYY-MM-DD) | List preps — **server-side date filter** when dates are provided |
| `createPrep` / `updatePrep` / `deletePrep` | `data` JSON / `id` | Prep CRUD — protected by `LockService` |

---

## 📦 Available Scripts

```bash
npm run dev          # Start local dev server (http://localhost:5173)
npm run build        # Production build → dist/
npm run preview      # Preview the production build locally
npm run lint         # Run ESLint
npm run deploy       # Build and deploy to GitHub Pages (manual)
```

### Bulk Import Formulas

```bash
VITE_GAS_URL=<your-gas-url> node scripts/import-formulas.mjs formular.json
```

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React 19.2 |
| Language | TypeScript ~5.9 |
| Build Tool | Vite 7.3 |
| Routing | React Router 7.13 (HashRouter for GitHub Pages) |
| PWA | vite-plugin-pwa 1.2 |
| Dialogs | SweetAlert2 11.26 |
| Excel Export | XLSX 0.18 |
| Backend | Google Apps Script |
| Database | Google Sheets |
| Hosting | GitHub Pages |
| CI/CD | GitHub Actions |

---

## 🔑 Default Accounts

The backend seeds **44 user accounts** on first initialisation:

| Account | Role | Default Password |
|---|---|---|
| `admin` | Administrator | `1234` |
| `pha0` – `pha211` | Pharmacist | `1234` |

All accounts have `must_change_password = true`. **Change the `admin` password immediately.**

---

## 📱 PWA & Mobile UI

| Property | Value |
|---|---|
| Theme colour | `#2563eb` (blue) |
| Display mode | Standalone (full-screen) |
| Icons | 192×192, 512×512, maskable |
| Service worker | Vite-plugin-pwa — auto-updates in background |

### Mobile Navigation

On screens ≤ 768 px the sidebar is hidden and replaced by a **bottom navigation bar**:

| Tab | Route |
|---|---|
| หน้าหลัก | `/dashboard` |
| เตรียมยา | `/prepare` |
| ประวัติ | `/history` |
| สูตรยา | `/formulas` |
| ผู้ใช้ *(admin only)* | `/users` |
| **โปรไฟล์** *(avatar)* | Popup — profile + logout |

Tapping the avatar at the right end of the bottom nav opens a **slide-up profile popup** showing the user's name, role, station, a link to `/profile`, and a logout button.

---

## ⚡ Performance & Correctness Notes

### Server-side Date Filter
Dashboard fetches **only the selected month** by passing `startDate`/`endDate` to GAS. Payload size stays constant regardless of total record count.

### Formula Cache
`getFormulas` results are cached in **GAS CacheService for 1 hour**. Cache is invalidated automatically on any formula mutation (create / update / delete).

### Optimistic UI Updates
`createPrep`, `updatePrep`, and `deletePrep` update the local React state and `resourceCache` immediately after GAS confirms success — no full refetch required.

### Date Normalization (UTC off-by-one fix)
Google Sheets silently converts `"YYYY-MM-DD"` strings to `Date` objects. Without correction, GAS's `JSON.stringify` would serialize midnight Bangkok time as the previous UTC day (e.g. `"2026-04-03T17:00:00.000Z"` for April 4), breaking all date-based grouping.

**Two-layer fix:**
1. **GAS side** — `normalizeCell_()` in `getAll_()` uses `Utilities.formatDate(date, timezone, 'yyyy-MM-dd')` to format date-only fields in the script's local timezone before returning.
2. **Frontend side** — `toDateOnly()` in `usePreps.ts` converts any ISO datetime string to a `YYYY-MM-DD` local date string as a second safety layer.

### Lock Safety (GAS)
`LockService.tryLock()` returns `false` if the lock cannot be acquired within the timeout. The previous code always called `releaseLock()` in the `finally` block regardless, which throws a `LockTimeoutException` and silently aborts the save. The fix stores the `tryLock()` return value and only calls `releaseLock()` if the lock was actually acquired.

### Error Surfacing
`createPrep` in `usePreps.ts` returns `true | string` — `true` on success or the actual GAS error message string on failure. `PreparePage` shows the real error in the toast rather than a generic fallback, making diagnosis easier.

### Pagination
Both Dashboard and History display **20 records at a time** with a load-more button. History resets to page 1 whenever any filter changes. Excel export always includes **all filtered records**.

---

## 🗺️ Deployment Checklist

```
1. Deploy GAS backend (Code.gs)
2. Verify with ?action=ping
3. Set VITE_GAS_URL in .env (dev) and GitHub Actions Variable (CI)
4. Push to main → GitHub Actions deploys frontend automatically
5. Login as admin / 1234 → change password immediately
```

---

<div align="center">

Built for **Uttaradit Hospital — Pharmacy Department** 🏥

</div>
