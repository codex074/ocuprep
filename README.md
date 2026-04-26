<div align="center">

# 💊 YATA

### Extemporaneous Eye Drop Preparation Tracking System
**Uttaradit Hospital — Pharmacy Department**

[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-7.3-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![PWA](https://img.shields.io/badge/PWA-Enabled-5A0FC8?style=flat-square&logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps)
[![GitHub Pages](https://img.shields.io/badge/Deployed_on-GitHub_Pages-222222?style=flat-square&logo=github&logoColor=white)](https://pages.github.com)
[![Firebase](https://img.shields.io/badge/Database-Firebase_Firestore-FFCA28?style=flat-square&logo=firebase&logoColor=black)](https://firebase.google.com/docs/firestore)

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
| 🧪 **Preparation Recording** | Patient or stock mode · auto lot number · auto expiry calculation · quantity multiplier · database error messages surfaced on save failure |
| 🖨️ **Label Printing** | Batch sheets · standard patient labels · bottle labels · prep stickers — all browser-printable |
| 💡 **Formula Management** | Admin: create/edit/delete formulas with short names, ingredients, preparation methods, pricing · displayed as a sortable list table |
| 👥 **User Management** | Admin: manage pharmacist accounts, roles, profile images, active status |
| 📜 **History** | Full audit log · filter modal (ห้องยา, ประเภท, ช่วงเวลา, วันที่, คำค้นหา) with active filter chips · paginated 20 per load · Export to Excel |
| 📱 **PWA / Mobile** | Installable on iOS/Android · offline-capable · bottom navigation bar · profile popup in bottom nav (no sidebar on mobile) |
| ⚡ **Performance** | Firestore-backed queries · optimistic UI updates · in-memory cache · load-more pagination |

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
                           │ Firestore Web SDK
                           ▼
┌──────────────────────────────────────────────────────────┐
│                 Database (Firebase Firestore)            │
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
│   ├── 📁 hooks/               # usePreps, useFormulas, useUsers, useFirestoreInit…
│   ├── 📁 lib/
│   │   ├── api.ts              # Firestore data access layer
│   │   ├── firebase.ts         # Firebase app / Firestore init
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
├── 📁 scripts/
│   ├── 📁 lib/
│   │   ├── firebase.mjs        # Firebase init for migration scripts
│   │   └── firestore-migration.mjs
│   ├── import-formulas.mjs     # Import formulas from GAS/Sheets into Firestore
│   └── migrate-gas-to-firestore.mjs
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
- A Firebase project with Firestore enabled

### 1 — Clone & Install

```bash
git clone <repository-url>
cd utth-ed
npm install
```

### 2 — Configure Firestore

The Firebase web config is already wired in `src/lib/firebase.ts`.
If you need to migrate old Google Sheets data, copy `.env.example` to `.env` and set `VITE_GAS_URL` for the migration script only.

### 3 — Start Development Server

```bash
npm run dev
# App available at http://localhost:5173
```

---

## ☁️ Deployment

### Step 1 — Enable Firestore

1. Open [Firebase Console](https://console.firebase.google.com/).
2. Select project `yata-e56f7`.
3. Enable **Cloud Firestore**.
4. Publish rules from `firestore.rules`.

### Step 2 — Optional: Migrate Existing GAS / Google Sheets Data

```bash
cp .env.example .env
# set VITE_GAS_URL to your existing GAS Web App URL
npm run migrate:firestore
```

To import formulas only:

```bash
npm run import:formulas
```

---

### Step 3 — Deploy the Frontend (GitHub Pages)

#### Option A — Automated (Recommended)

1. Push to a GitHub repository.
2. Go to **Settings → Pages**, set **Source = GitHub Actions**.
3. Push to `main` — GitHub Actions builds and deploys automatically.

#### Option B — Manual Deploy

```bash
npm run deploy
```

---

### Step 4 — First Login

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
| **Refresh** | Force-refresh data from Firestore, bypassing the client-side cache |

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

Three Firestore collections are used by the app.

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

## 📦 Available Scripts

```bash
npm run dev          # Start local dev server (http://localhost:5173)
npm run build        # Production build → dist/
npm run preview      # Preview the production build locally
npm run lint         # Run ESLint
npm run migrate:firestore   # Import users/formulas/preps from GAS into Firestore
npm run import:formulas     # Import formulas only from GAS into Firestore
npm run deploy       # Build and deploy to GitHub Pages (manual)
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
| Database | Firebase Firestore |
| Hosting | GitHub Pages |
| CI/CD | GitHub Actions |

---

## 🔑 Default Accounts

Use the existing user records migrated into Firestore. If you are starting from an empty database, create an `admin` user in the `users` collection first.

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

### Firestore Date Filter
Dashboard fetches the selected month by querying Firestore with `startDate` / `endDate`, then sorts client-side by numeric `id`.

### Optimistic UI Updates
`createPrep`, `updatePrep`, and `deletePrep` update the local React state and `resourceCache` immediately after Firestore confirms success — no full refetch required.

### Date Normalization
The frontend still keeps `toDateOnly()` in `usePreps.ts` as a safety layer so migrated records from the old Sheets/GAS system remain stable even if some dates were stored as ISO timestamps.

### Pagination
Both Dashboard and History display **20 records at a time** with a load-more button. History resets to page 1 whenever any filter changes. Excel export always includes **all filtered records**.

---

## 🗺️ Deployment Checklist

```
1. Enable Firestore and publish `firestore.rules`
2. If migrating old data, set `VITE_GAS_URL` in `.env` and run `npm run migrate:firestore`
3. Push to main → GitHub Actions deploys frontend automatically
4. Verify login with a Firestore user account
```

---

<div align="center">

Built for **Uttaradit Hospital — Pharmacy Department** 🏥

</div>
