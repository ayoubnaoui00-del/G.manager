# G.manager — Gym Subscription Management App

Owner-only mobile application & REST API for managing gym members, membership plans, subscriptions, payments, and real-time revenue analytics.

## Tech Stack
- **Mobile**: React Native (Expo), React Navigation, Axios, TanStack Query, `expo-secure-store`
- **Backend**: Node.js (ES Modules), Express, PostgreSQL (`pg`), JWT (`jsonwebtoken`), `bcrypt`
- **Database**: PostgreSQL

---

## ⚠️ Mandatory Project Rule: ES Modules Only (`import` / `export`)

> **IMPORTANT FOR ALL TEAM MEMBERS (Dev 1, Dev 2, Dev 3, Dev 4):**
> This project uses **ES Modules** (`"type": "module"` in `package.json`) across the entire codebase (both Backend and Mobile).
> - **DO NOT** use CommonJS (`require()` or `module.exports`).
> - **ALWAYS** use ES Module syntax (`import ... from ...` and `export` / `export default`).
> - In the **backend**, always include the `.js` extension on relative file imports:
>   ```js
>   // ✅ CORRECT (ES Modules)
>   import express from 'express';
>   import { query } from '../config/db.js';
>   import asyncHandler from '../utils/asyncHandler.js';
>   export const getMembers = asyncHandler(async (req, res) => { ... });
>
>   // ❌ WRONG (Do NOT use CommonJS)
>   const express = require('express');
>   module.exports = { getMembers };
>   ```

---

## Project Structure

```text
G.manager/
└── backend/
    ├── .env.example
    ├── package.json                # Configured with "type": "module"
    └── src/
        ├── app.js                  # Express app, middlewares, route mounting
        ├── server.js               # Server entry point
        ├── config/
        │   ├── env.js              # Environment variable loader
        │   └── db.js               # PostgreSQL connection pool & health check
        ├── db/
        │   ├── migrate.js          # Migration runner (up / down)
        │   ├── seed.js             # Sample gym data seeder
        │   └── migrations/
        │       ├── 001_initial_schema.up.sql
        │       └── 001_initial_schema.down.sql
        ├── controllers/
        │   └── health.controller.js
        ├── middlewares/
        │   └── errorHandler.js     # 404 & centralized error handler
        ├── routes/
        │   ├── index.js            # Central API router (/api/*)
        │   └── health.routes.js    # GET /api/health
        └── utils/
            ├── ApiError.js
            └── asyncHandler.js
```

---

## Quick Start (Backend)

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and update `DATABASE_URL` with your local PostgreSQL credentials:
```bash
cp .env.example .env
```

### 3. Create PostgreSQL Database & Run Migrations
Ensure a database named `gmanager` exists in PostgreSQL, then run:
```bash
# Run UP migrations (creates users, members, plans, subscriptions, payments + indexes)
npm run migrate:up

# Seed sample gym owner, plans, members, subscriptions, and payments
npm run seed
```
*(Default seeded owner login: `owner@gmanager.com` / `password123`)*

To roll back the schema:
```bash
npm run migrate:down
```

### 4. Start the Express Server
```bash
# Development mode (auto-reload)
npm run dev

# Production mode
npm start
```

### 5. Verify Health Endpoint
```bash
curl http://localhost:5000/api/health
```

---

## 🤝 Team Git & Branching Workflow

To keep our hackathon repository clean and avoid merge conflicts, all 4 team members should follow this workflow after cloning `main`:

### 1. Clone the Repo & Set Up Locally
```bash
git clone https://github.com/ayoubnaoui00-del/G.manager.git
cd G.manager/backend
npm install
cp .env.example .env
# Update DATABASE_URL in .env with your local PostgreSQL password
npm run migrate:up
npm run seed
npm run dev
```

### 2. Create Your Developer / Feature Branch
**Never push directly to `main` while working on a task.** Always pull the latest `main` and create your own branch (either by your name or Jira issue key):

| Developer | Epic | Suggested Branch Naming | Jira Tasks (Sprint 1 Backend) |
| :--- | :--- | :--- | :--- |
| **Dev 1 (Ennaoui Ayoub)** | Foundation & Auth | `ayoub` or `feat/GM-7-auth-api` | `GM-5` (Done), `GM-6` (Done), `GM-7` |
| **Dev 2 (Mr Arnould)** | Members | `arnould` or `feat/GM-11-members-api` | `GM-11` |
| **Dev 3 (MIRAT SALMA)** | Plans & Subscriptions | `salma` or `feat/GM-16-plans-api` | `GM-16`, `GM-17` |
| **Dev 4 (ayoub55)** | Payments & Dashboard | `ayoub55` or `feat/GM-21-payments-api` | `GM-21`, `GM-22` |

```bash
git checkout main
git pull origin main
git checkout -b <your-branch-name>
```

### 3. Commit with Jira Issue Keys & Push
Include your Jira ticket key in commit messages so Jira automatically links your commits:
```bash
git add .
git commit -m "GM-11: implement members CRUD and search API using ES modules"
git push -u origin <your-branch-name>
```

### 4. Merge into `main` via Pull Request (or Fast-Forward)
1. Before merging into `main`, sync your branch with the latest `main`:
   ```bash
   git pull origin main
   ```
2. Open a Pull Request on GitHub into `main` (or merge after testing).
3. Update your Jira issue status to **Done**.

