<div align="center">

# YATA

Extemporaneous Eye Drop Preparation Tracking System  
Uttaradit Hospital Pharmacy Department

[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-7.3-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Firebase](https://img.shields.io/badge/Database-Firestore-FFCA28?style=flat-square&logo=firebase&logoColor=black)](https://firebase.google.com/docs/firestore)
[![PWA](https://img.shields.io/badge/PWA-Enabled-2563EB?style=flat-square)](https://web.dev/progressive-web-apps/)

</div>

YATA is a Progressive Web App for recording, printing, tracking, and reporting extemporaneous eye drop production. The current app uses Firebase Firestore directly from the frontend and no longer depends on Google Apps Script for normal runtime operations.

## Overview

- Frontend: React 19 + TypeScript + Vite
- Database: Firebase Firestore
- Hosting: GitHub Pages
- Routing: `HashRouter`
- Auth model: app-managed login using records in Firestore `users` collection
- Firebase Auth: not used

The app covers the full workflow:

- login with pharmacist username (`pha_id`)
- station selection before entering the app
- preparation recording for `stock` and `patient`
- automatic lot number and expiry calculation
- browser printing for labels and batch sheets
- history, monthly dashboard, Excel export
- admin management for formulas and users

## Current Architecture

```text
React PWA (GitHub Pages)
        |
        v
Firebase Web SDK
        |
        v
Cloud Firestore
  - users
  - formulas
  - preps
  - meta/counters
```

## Key Behavior

- Runtime data access goes through [src/lib/api.ts](/Users/codex074/Desktop/My-Web-App/utth-ed/src/lib/api.ts)
- Firebase app config is initialized in [src/lib/firebase.ts](/Users/codex074/Desktop/My-Web-App/utth-ed/src/lib/firebase.ts)
- Firestore connectivity is warmed up once at boot in [src/hooks/useFirestoreInit.ts](/Users/codex074/Desktop/My-Web-App/utth-ed/src/hooks/useFirestoreInit.ts)
- Formula data is prefetched on startup via `useAppWarmup`
- Client-side cache is handled in [src/lib/resourceCache.ts](/Users/codex074/Desktop/My-Web-App/utth-ed/src/lib/resourceCache.ts)

### Authentication

- Login uses `pha_id` + password from Firestore
- Session is stored in localStorage
- Firebase Auth is intentionally not used
- Usernames are stored directly in the database
- First login can force password change via `must_change_password`

### Firestore Document IDs

The app now uses meaningful Firestore document IDs:

- `users/{pha_id}`
- `formulas/{code}` such as `F01`
- `preps/{lot_id}` such as `202604-001`

Numeric `id` fields are still stored inside documents for sorting, compatibility, and legacy references.

## Main Features

### Dashboard

- monthly overview with location filter
- 6 statistic cards
- recent production list with inline edit/delete
- formula summary
- workload analysis by time slot
- Excel export

### Preparation Recording

- choose `เฉพาะราย` or `Stock`
- auto lot number generation
- auto expiry date calculation from formula shelf life
- label printing and batch sheet printing
- bottle label now includes package size and concentration
- printed lot number shows `202604-001` instead of `LOT-202604-001`

### Edit Production Modal

- edit preparation date
- edit working room
- edit formula / drug name
- edit type: `Stock` or `เฉพาะราย`
- when changing date or formula, expiry date recalculates automatically
- `Stock` updates destination room from the selected station
- `เฉพาะราย` allows editing HN and patient name

### Formula Management

- create, edit, delete formulas
- formula list search box
- supports code, short name, full name, concentration, category, package size

### User Management

- create, edit, delete users
- search box on users page
- supports search by name, username, role, status

### History

- full production history
- filter modal with chips
- location tags and mode tags use distinct color themes
- record detail modal and edit modal

### Station Handling

- user must select a working station after login
- station can be changed later from the header without logging out

### Mobile / PWA

- installable PWA
- bottom navigation on mobile
- sidebar hidden on small screens
- profile popup from bottom navigation

## Project Structure

```text
utth-ed/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   └── ui/
│   ├── contexts/
│   ├── hooks/
│   ├── lib/
│   ├── pages/
│   └── types/
├── public/
├── scripts/
│   ├── lib/
│   ├── migrate-gas-to-firestore.mjs
│   └── import-formulas.mjs
├── firestore.rules
├── .github/workflows/deploy-pages.yml
├── package.json
└── vite.config.ts
```

## Important Files

- [src/lib/api.ts](/Users/codex074/Desktop/My-Web-App/utth-ed/src/lib/api.ts): Firestore CRUD and login logic
- [src/lib/firebase.ts](/Users/codex074/Desktop/My-Web-App/utth-ed/src/lib/firebase.ts): Firebase configuration
- [src/lib/print.ts](/Users/codex074/Desktop/My-Web-App/utth-ed/src/lib/print.ts): printable HTML for labels and batch sheets
- [src/components/EditPrepModal.tsx](/Users/codex074/Desktop/My-Web-App/utth-ed/src/components/EditPrepModal.tsx): advanced edit workflow for production records
- [src/components/layout/Layout.tsx](/Users/codex074/Desktop/My-Web-App/utth-ed/src/components/layout/Layout.tsx): layout shell and in-app station switching
- [src/pages/DashboardPage.tsx](/Users/codex074/Desktop/My-Web-App/utth-ed/src/pages/DashboardPage.tsx): overview, workload, value card, inline actions
- [src/pages/PreparePage.tsx](/Users/codex074/Desktop/My-Web-App/utth-ed/src/pages/PreparePage.tsx): new production entry flow
- [src/pages/HistoryPage.tsx](/Users/codex074/Desktop/My-Web-App/utth-ed/src/pages/HistoryPage.tsx): audit log, filtering, editing
- [src/pages/FormulasPage.tsx](/Users/codex074/Desktop/My-Web-App/utth-ed/src/pages/FormulasPage.tsx): formula management with search
- [src/pages/UsersPage.tsx](/Users/codex074/Desktop/My-Web-App/utth-ed/src/pages/UsersPage.tsx): user management with search
- [scripts/migrate-gas-to-firestore.mjs](/Users/codex074/Desktop/My-Web-App/utth-ed/scripts/migrate-gas-to-firestore.mjs): migrate legacy data from GAS / Google Sheets
- [scripts/import-formulas.mjs](/Users/codex074/Desktop/My-Web-App/utth-ed/scripts/import-formulas.mjs): import formulas only

## Firestore Collections

### `users`

Document ID = `pha_id`

Key fields:

- `id`
- `name`
- `pha_id`
- `password`
- `role`
- `active`
- `must_change_password`
- `profile_image`
- `created_at`

### `formulas`

Document ID = `code`

Key fields:

- `id`
- `code`
- `name`
- `short_name`
- `description`
- `concentration`
- `expiry_days`
- `category`
- `price`
- `storage`
- `ingredients`
- `method`
- `short_prep`
- `package_size`
- `created_at`

### `preps`

Document ID = normalized lot number, for example `202604-001`

Key fields:

- `id`
- `formula_id`
- `formula_name`
- `concentration`
- `mode`
- `target`
- `hn`
- `patient_name`
- `dest_room`
- `lot_no`
- `date`
- `expiry_date`
- `qty`
- `note`
- `prepared_by`
- `user_pha_id`
- `location`
- `created_at`

## Local Development

### Prerequisites

- Node.js 20 recommended

### Install

```bash
npm install
```

### Run

Standard npm commands:

```bash
npm run dev
npm run build
npm run preview
```

Codex / local tool-safe equivalents used in this repo:

```bash
/usr/local/bin/node ./node_modules/.bin/vite --port 5173
/usr/local/bin/node ./node_modules/.bin/tsc -b --noEmit
/usr/local/bin/node ./node_modules/.bin/vite build
```

## Migration From Legacy GAS / Google Sheets

Normal app runtime does not use GAS anymore. `VITE_GAS_URL` is only needed if you want to pull old data from the previous system.

1. Copy `.env.example` to `.env`
2. Set `VITE_GAS_URL`
3. Run one of these commands:

```bash
npm run migrate:firestore
npm run import:formulas
```

Migration scripts live in [scripts/lib/firestore-migration.mjs](/Users/codex074/Desktop/My-Web-App/utth-ed/scripts/lib/firestore-migration.mjs).

## Firebase Setup

The app currently points to this Firebase project in code:

- project id: `yata-e56f7`

Firebase config is embedded in [src/lib/firebase.ts](/Users/codex074/Desktop/My-Web-App/utth-ed/src/lib/firebase.ts).

Before using the app in a fresh Firebase project or environment:

1. Enable Cloud Firestore
2. Publish rules from [firestore.rules](/Users/codex074/Desktop/My-Web-App/utth-ed/firestore.rules)
3. Ensure `users`, `formulas`, `preps`, and `meta/counters` exist or are created through usage/migration

Current rules are intentionally open for this internal workflow:

```txt
allow read, write: if true;
```

If this app will be exposed outside a trusted internal environment, tighten the rules before production use.

## Available Scripts

- `npm run dev` - start local dev server
- `npm run build` - typecheck and build production bundle
- `npm run preview` - preview built app
- `npm run lint` - run ESLint
- `npm run migrate:firestore` - migrate users, formulas, and preps from legacy GAS
- `npm run import:formulas` - import formulas only
- `npm run deploy` - manual GitHub Pages deploy via `gh-pages`

## Deployment

GitHub Pages deployment is configured in [.github/workflows/deploy-pages.yml](/Users/codex074/Desktop/My-Web-App/utth-ed/.github/workflows/deploy-pages.yml).

On push to `main`, GitHub Actions will:

1. install dependencies with `npm ci`
2. run `npm run build`
3. upload `dist`
4. deploy to GitHub Pages

Because Firebase config is in source code, the frontend build does not require `VITE_GAS_URL`.

## Default Access

There is no hardcoded backend bootstrap account in the app code. Use an existing Firestore user record, or create a user document in `users` first.

Example login shape:

- username: `pha_id`
- password: `password`

## Notes

- `HashRouter` is required for GitHub Pages routing
- production value on dashboard is currently displayed as an integer
- lot display in print output omits the `LOT-` prefix for readability
- Firestore numeric counters are stored in `meta/counters`

---

Built for Uttaradit Hospital Pharmacy Department
