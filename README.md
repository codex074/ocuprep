<div align="center">

# 💊 UTTH ED-Extemp

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

**UTTH ED-Extemp** is a web application for recording and tracking the production of custom-compounded (extemporaneous) eye drop medications in the Pharmacy Department of Uttaradit Hospital.

The system manages the full preparation workflow — from formula selection and lot number generation to label printing, historical auditing, and monthly workload reporting — with role-based access for pharmacists and administrators.

---

## ✨ Features

| Category | Features |
|---|---|
| 🔐 **Authentication** | Login with pharmacist ID, forced password change on first login, 1-hour session timeout |
| 📊 **Dashboard** | Monthly prep overview with 5 stat cards (count, today, patient, stock bottles, production value), server-side date filter, inline edit/delete, load-more pagination |
| 🧪 **Preparation Recording** | Patient or stock mode, auto lot number, auto expiry calculation, quantity multiplier, detailed error messages on save failure |
| 🖨️ **Label Printing** | Batch sheets, standard labels, bottle labels, prep stickers — all browser-printable |
| 💡 **Formula Management** | Admin: create/edit/delete drug formulas with short names, ingredients, and preparation methods |
| 👥 **User Management** | Admin: manage pharmacist accounts, roles, profile images, and active status |
| 📜 **History** | Full audit log with search/filter, note column, paginated 20 per page, Export to Excel |
| 📈 **Workload Report** | Monthly workload by day and time slot (เช้า/บ่าย/นอกเวลา), location filter, proportion bars, mini stacked bar chart, Export to Excel |
| 📱 **PWA** | Installable on iOS/Android, offline-capable, home screen icon |
| ⚡ **Performance** | Server-side date filter, GAS formula cache (1 hr), optimistic UI updates, load-more pagination |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React PWA)                 │
│              Hosted on GitHub Pages                     │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │  Pages   │  │  Hooks   │  │  Context │             │
│  │ (Routes) │  │(Data/API)│  │(Auth/UI) │             │
│  └──────────┘  └──────────┘  └──────────┘             │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTP GET (query params)
                        ▼
┌─────────────────────────────────────────────────────────┐
│            Backend (Google Apps Script)                 │
│              gas/Code.gs                                │
└───────────────────────┬─────────────────────────────────┘
                        │ Sheets API
                        ▼
┌─────────────────────────────────────────────────────────┐
│              Database (Google Sheets)                   │
│          users │ formulas │ preps                       │
└─────────────────────────────────────────────────────────┘
```

---

## 🗂️ Project Structure

```
utth-ed/
├── 📁 src/
│   ├── 📁 components/         # Reusable UI components
│   │   ├── 📁 layout/         # App shell / layout wrapper
│   │   ├── 📁 ui/             # Modal, Combobox, LoadingState, Toast…
│   │   ├── EditPrepModal.tsx
│   │   ├── PrepDetailsModal.tsx
│   │   ├── ProfileCard.tsx
│   │   └── SummaryDetailsModal.tsx
│   ├── 📁 contexts/           # AuthContext, ToastContext
│   ├── 📁 hooks/              # usePreps, useFormulas, useUsers, useGasInit…
│   ├── 📁 lib/
│   │   ├── api.ts             # GAS API connector (all HTTP calls)
│   │   ├── print.ts           # Label / batch sheet HTML generation
│   │   ├── resourceCache.ts   # In-memory cache with invalidation
│   │   └── utils.ts           # Date formatting, helpers
│   ├── 📁 pages/              # LoginPage, DashboardPage, PreparePage…
│   │   ├── DashboardPage.tsx  # Monthly overview + 5 stat cards
│   │   ├── HistoryPage.tsx    # Full audit log with note column
│   │   ├── WorkloadPage.tsx   # Workload report by day & time slot
│   │   └── …
│   ├── 📁 types/              # TypeScript interfaces (User, Formula, Prep)
│   └── App.tsx                # Routing & auth guards
├── 📁 gas/
│   └── Code.gs                # Google Apps Script backend
├── 📁 scripts/
│   └── import-formulas.mjs    # Bulk-import formula data to GAS
├── 📁 public/
│   ├── 📁 icons/              # PWA icons (192, 512, maskable)
│   └── 📁 avatars/            # User profile avatar images
├── 📁 .github/workflows/
│   └── deploy-pages.yml       # CI/CD — auto deploy on push to main
├── .env.example
├── vite.config.ts
└── package.json
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) ≥ 18
- A Google account (for Apps Script backend)

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

### 3 — Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## ☁️ Deployment

### Step 1 — Deploy the Backend (Google Apps Script)

1. Open [Google Apps Script](https://script.google.com/) and create a **new standalone project**.
2. Copy the entire contents of `gas/Code.gs` into the script editor.
3. Click **Deploy → New Deployment → Web app**.
4. Set the following:
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`
5. Click **Deploy** and grant the required Google permissions.
6. Copy the **Web App URL** — you'll need it in the next step.

> **Note:** You don't need to create a Google Sheet manually. The backend automatically creates and seeds the spreadsheet on first run.

> ⚠️ **Important — Updating GAS:** Pushing to GitHub does **not** auto-deploy the GAS backend. Whenever `gas/Code.gs` changes, you must manually re-deploy:
> **Deploy → Manage deployments → ✏️ Edit → New version → Deploy**
> The Web App URL stays the same after re-deployment.

#### Verify the backend is working:

```
https://script.google.com/macros/s/DEPLOYMENT_ID/exec?action=ping
```

You should receive a JSON response like `{"ok": true, ...}`.

---

### Step 2 — Deploy the Frontend (GitHub Pages)

#### Option A — Automated (Recommended)

1. Push your code to a GitHub repository.
2. Go to **Settings → Pages** and set **Source = GitHub Actions**.
3. Go to **Settings → Secrets and variables → Actions → Variables**.
4. Create a repository variable named `VITE_GAS_URL` with your GAS Web App URL.
5. Push to the `main` branch — GitHub Actions will build and deploy automatically.

#### Option B — Manual Deploy

```bash
# Build and deploy to the gh-pages branch
npm run deploy
```

---

### Step 3 — First Login

After deployment, open the app and sign in with the default admin credentials:

| Field | Value |
|---|---|
| Pharmacist ID | `admin` |
| Password | `1234` |

> ⚠️ **You will be forced to change the password immediately on first login.**

---

## 🛢️ Database Schema

The backend uses **Google Sheets** as a database. Three sheets are created automatically:

### `users`
| Column | Description |
|---|---|
| `id` | Unique user ID |
| `name` | Full name |
| `pha_id` | Pharmacist ID (login username) |
| `password` | Hashed password |
| `role` | `admin` or `user` |
| `active` | Account active status |
| `must_change_password` | Force password change flag |
| `profile_image` | Avatar URL |
| `created_at` | Timestamp |

### `formulas`
| Column | Description |
|---|---|
| `id` | Unique formula ID |
| `code` | Formula code |
| `name` | Full formula name |
| `short_name` | Abbreviated name shown in Dashboard summary |
| `concentration` | Drug concentration |
| `expiry_days` | Days until expiry (negative = hours) |
| `ingredients` | JSON array of ingredients |
| `method` | JSON array of preparation steps |
| `price` | Cost per unit (used in production value calculation) |

### `preps`
| Column | Description |
|---|---|
| `id` | Unique prep record ID |
| `formula_id` | Linked formula |
| `mode` | `patient` or `stock` |
| `lot_no` | Auto-generated lot number |
| `date` | Date of preparation (stored as `YYYY-MM-DD`) |
| `expiry_date` | Calculated expiry date |
| `qty` | Quantity prepared |
| `note` | Optional note / remark |
| `prepared_by` | Pharmacist name |
| `location` | Station/ward where prep was made |
| `created_at` | Full timestamp (used for time-slot classification) |

---

## 🔌 API Reference

All API calls are HTTP GET requests to the GAS Web App URL with an `action` query parameter.

```
GET https://script.google.com/.../exec?action=<ACTION>&<params>
```

| Action | Description |
|---|---|
| `ping` | Health check — returns user/formula/prep counts |
| `login` | Authenticate with `pha_id` and `password` |
| `getUsers` | List all users (admin) |
| `createUser` / `updateUser` / `deleteUser` | User CRUD (admin) |
| `getFormulas` | List all formulas (cached 1 hr in GAS CacheService) |
| `createFormula` / `updateFormula` / `deleteFormula` | Formula CRUD (admin, invalidates cache) |
| `getPreps` | List preparation records — optional `startDate` / `endDate` params (`YYYY-MM-DD`) for server-side filtering |
| `createPrep` / `updatePrep` / `deletePrep` | Prep CRUD |

---

## 📈 Workload Report

The **Workload** page (`/workload`) provides a monthly breakdown of preparation activity.

### Time-slot Classification

Slots are classified using the `created_at` timestamp of each record:

| Slot | Condition | Color |
|---|---|---|
| 🟡 **เช้า** (Morning) | Mon–Fri 08:00–12:00 | Amber |
| 🔵 **บ่าย** (Afternoon) | Mon–Fri 12:00–16:30 | Blue |
| 🔴 **นอกเวลา** (Overtime) | Saturday / Sunday (all day) **or** weekday before 08:00 / after 16:30 | Red |

> Records with no `created_at` timestamp are counted as **นอกเวลา** by default.

### Features

- **Month selector** — dropdown covering the past 24 months
- **5 summary stat cards** — total records, total bottles, daily average, busiest day, total production value (฿)
- **Proportion bars** — visual breakdown of each time slot for the month
- **Daily table** — per-day counts for each slot, total records, total bottles, and a mini stacked bar chart
- **Location filter** — appears automatically when the selected month has records from more than one station
- **Toggle** — show only days with data, or all days in the month
- **Export to Excel** — downloads the full monthly table as `.xlsx`

---

## 📦 Available Scripts

```bash
npm run dev          # Start local development server
npm run build        # Build for production (outputs to dist/)
npm run preview      # Preview the production build locally
npm run lint         # Run ESLint
npm run deploy       # Build and deploy to GitHub Pages (manual)
```

### Import Formula Data

To bulk-import formulas from `formular.json` into your GAS backend:

```bash
VITE_GAS_URL=<your-gas-url> node scripts/import-formulas.mjs formular.json
```

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| **UI Framework** | React 19.2 |
| **Language** | TypeScript ~5.9 |
| **Build Tool** | Vite 7.3 |
| **Routing** | React Router 7.13 (HashRouter) |
| **PWA** | vite-plugin-pwa 1.2 |
| **Dialogs** | SweetAlert2 11.26 |
| **Excel Export** | XLSX 0.18 |
| **Backend** | Google Apps Script |
| **Database** | Google Sheets |
| **Hosting** | GitHub Pages |
| **CI/CD** | GitHub Actions |

---

## 🔑 Default Accounts

When the GAS backend initializes the database, it seeds **44 default user accounts**:

| Account | Role | Default Password |
|---|---|---|
| `admin` | Administrator | `1234` |
| `pha0` — `pha211` | Pharmacist | `1234` |

> All accounts have `must_change_password = true` and will be prompted to change their password on first login. **Change the `admin` password immediately after first login.**

---

## 📱 PWA Support

The app is installable as a Progressive Web App on both iOS and Android:

- **Theme Color:** Blue (`#2563eb`)
- **Display Mode:** Standalone (full-screen, no browser chrome)
- **Icons:** 192×192 and 512×512 (with maskable version for Android)
- **Auto-update:** Service worker updates automatically in the background

---

## ⚡ Performance & Optimization

### Server-side Date Filtering
Dashboard and Workload fetch **only the selected month's records** by passing `startDate` / `endDate` to GAS. GAS filters before sending, so payload stays small regardless of total record count.

```
Without filter:  GAS sends ALL records → Frontend filters → heavy on large datasets
With filter:     GAS sends current-month only → instant render
```

> **Note:** Google Sheets auto-converts date strings to `Date` objects internally. The GAS backend uses `Utilities.formatDate(date, tz, 'yyyy-MM-dd')` to normalize them before comparison **and** before returning, preventing off-by-one day bugs caused by UTC serialization.

### Formula Cache (GAS CacheService)
`getFormulas` results are cached in GAS for **1 hour**. Since formulas rarely change, this eliminates repeated Sheets reads on every page load. Cache is invalidated automatically when any formula is created, updated, or deleted.

### Optimistic UI Updates
`createPrep`, `updatePrep`, and `deletePrep` update the local React state **immediately** after the GAS call succeeds — no full refetch needed. The client-side cache (`resourceCache.ts`) is updated in-place.

### Pagination (20 per page)
Both Dashboard and History display **20 records at a time** with a "Load more (+20)" button. History resets to page 1 automatically whenever any filter changes. Excel Export always exports **all filtered records**, not just the visible page.

---

## 📐 Implementation Notes

- **HashRouter** is used instead of BrowserRouter to support GitHub Pages static hosting.
- **Sessions** are stored in `localStorage` under the key `ed-extemp-session` with a 1-hour timeout.
- **Client-side cache** (`resourceCache.ts`) uses month-keyed entries for preps (`preps-YYYY-MM`) and a single entry for formulas, with 5-minute stale time.
- **Date normalization:** Google Sheets stores date strings as `Date` objects. GAS normalizes `date` / `expiry_date` fields with `Utilities.formatDate()` in the local timezone before returning, and the frontend further normalizes via `toDateOnly()` as a safety layer. This prevents UTC midnight serialization causing off-by-one day issues.
- **Lock safety:** GAS `LockService.tryLock()` return value is checked before calling `releaseLock()` in the `finally` block, preventing spurious `LockTimeoutException` errors when lock acquisition fails.
- **Thread safety** in GAS is handled via `LockService` to prevent concurrent write conflicts.
- **Workload time slots** use the `created_at` timestamp: Mon–Fri 08:00–16:30 = regular hours; weekends or outside 08:00–16:30 = นอกเวลา (overtime).
- **Short names:** The Dashboard formula summary displays `short_name` (if set) with the full `name` available on hover.
- **Production value** on Dashboard and Workload is calculated as `formula.price × prep.qty` for each record in the selected month.

---

## 🗺️ Recommended Deployment Order

```
1. Deploy GAS backend  →  2. Verify with ?action=ping  →  3. Set VITE_GAS_URL
        ↓
4. Deploy frontend to GitHub Pages  →  5. Login as admin / 1234
        ↓
6. Change admin password immediately
```

---

<div align="center">

Built for **Uttaradit Hospital Pharmacy Department** 🏥

</div>
