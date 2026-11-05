# ReachInbox – Full-Stack Production Email Job Scheduler

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.19-black.svg)](https://expressjs.com/)
[![BullMQ](https://img.shields.io/badge/BullMQ-5.7-red.svg)](https://bullmq.io/)
[![Redis](https://img.shields.io/badge/Redis-7.0-dc382d.svg)](https://redis.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791.svg)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.14-2D3748.svg)](https://www.prisma.io/)
[![Elasticsearch](https://img.shields.io/badge/Elasticsearch-8.11-005571.svg)](https://www.elastic.co/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg)](https://reactjs.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC.svg)](https://tailwindcss.com/)

A production-grade, distributed cold outreach email job scheduling and dispatch platform inspired by **ReachInbox.ai**. Built for high reliability under burst traffic, crash resilience, persistent distributed rate limiting, and real-time observability.

---

## 📑 Table of Contents
1. [Architectural Overview](#1-architectural-overview)
2. [Key Features](#2-key-features)
3. [Technology Stack](#3-technology-stack)
4. [Monorepo Folder Structure](#4-monorepo-folder-structure)
5. [Prerequisites & Environment Variables](#5-prerequisites--environment-variables)
6. [Quick Start (Local & Docker)](#6-quick-start-local--docker)
7. [Email Scheduling & Queue Mechanics](#7-email-scheduling--queue-mechanics)
8. [Reliability & Concurrency Engineering](#8-reliability--concurrency-engineering)
9. [Persistence, Recovery & SMTP Guarantees](#9-persistence-recovery--smtp-guarantees)
10. [Real Integrations](#10-real-integrations)
11. [REST API Documentation](#11-rest-api-documentation)
12. [5-Minute Demo Video Walkthrough & Checklist](#12-5-minute-demo-video-walkthrough--checklist)
13. [Deployment to Production](#13-deployment-to-production)
14. [Submission & Collaborators](#14-submission--collaborators)

---

## 1. Architectural Overview

The application follows an asynchronous, event-driven decoupled architecture:

```
[React 18 + Vite Frontend (Port 3000)]
                 │
                 ▼ (REST / HTTP-only Secure Cookies)
[Express.js TypeScript API Server (Port 5000)]
  ├── Authentication (Google OAuth 2.0 / JWT)
  ├── File Parser (CSV/TXT Lead Validator & Deduplicator)
  ├── Campaign Controller & Prisma ORM
  └── Bull Board Administration (/admin/queues)
                 │
   ┌─────────────┴─────────────┐
   ▼                           ▼
[PostgreSQL 15]         [Persistent Redis 7.0]
(Source of truth)       (BullMQ Delayed Queue)
                               │
                               ▼
               [BullMQ Worker Pool (Concurrency = 5)]
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
  [Redis Rate Limiter]  [Ethereal SMTP]     [Elasticsearch 8.11]
  - 2000ms Min Delay    - Real Delivery     - Multi-field Search
  - 100/hr Sliding Cap  - Message Preview   - Resilient Outbox
  - Slack Webhook Alert - Attempt Auditing  - Case-insensitive
```

---

## 2. Key Features

- **Real Google OAuth 2.0**: Secure authentication issuing HTTP-only session cookies and storing profile identity.
- **CSV & TXT Lead Parser**: Uploads bulk recipient files up to 5MB, extracts email addresses, removes duplicates, detects invalid entries, and provides instant preview.
- **Persistent Delayed Scheduling**: Uses BullMQ delayed jobs backed by Redis persistent storage. **Zero cron jobs or naive timeouts**.
- **Configurable Worker Concurrency**: Processes multiple emails concurrently (`WORKER_CONCURRENCY=5`) across distributed worker instances.
- **Distributed Minimum Delay (2000ms)**: Atomic Redis timestamps enforce a strict minimum delay between sends per sender across all workers.
- **Atomic Hourly Rate Limiting**: Redis counters track sends per UTC-hour window. If breached, emails are **never dropped**—they are automatically rolled forward into the next available UTC hour window.
- **Live Slack Alerts**: Real Slack OAuth 2.0 and Slack Web API alerts dispatched when an hourly sending threshold is hit.
- **Crash & Restart Persistence**: Startup reconciliation service checks PostgreSQL records against BullMQ queues, recovering genuinely missing jobs without duplicate sends.
- **Ethereal Email Delivery**: Dispatches real test emails via Nodemailer and generates clickable browser preview links.
- **Elasticsearch Search**: Full-text multi-field search engine across subjects, recipients, senders, campaigns, and bodies.
- **Live Bull Board Dashboard**: Native administrative interface mounted at `/admin/queues` for real-time queue inspection.

---

## 3. Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend** | Node.js (v20+), TypeScript, Express.js, Zod, Multer, PapaParse |
| **Queue & Cache** | BullMQ 5.7, Redis 7.0 (with Append-Only File persistence) |
| **Database** | PostgreSQL 15, Prisma ORM 5.14 |
| **Search Engine** | Elasticsearch 8.11 |
| **Email SMTP** | Nodemailer 6.9, Ethereal Email test sandbox |
| **Authentication** | Google OAuth 2.0, JWT, Express Session, AES-256-GCM encryption |
| **Integrations** | Slack Web API (`@slack/web-api`), Bull Board (`@bull-board/express`) |
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, Lucide React, Axios |
| **DevOps** | Docker, Docker Compose, Nginx |

---

## 4. Monorepo Folder Structure

```
Outbox/
├── docker-compose.yml          # Multi-container setup (Postgres, Redis, ES, Backend, Worker, Frontend)
├── sample_leads.csv            # Sample test leads with valid, duplicate, and invalid rows
├── README.md                   # Complete architectural documentation
├── backend/
│   ├── .env.example & .env     # Backend environment configuration
│   ├── Dockerfile              # Multi-stage production container
│   ├── prisma/
│   │   └── schema.prisma       # Relational database schema
│   └── src/
│       ├── config/             # Database, Redis, BullMQ, Elasticsearch, Bull Board
│       ├── controllers/        # Auth, Campaign, Email, Sender, Search, Slack controllers
│       ├── middleware/         # Auth, Upload, Validation, Error handlers
│       ├── queues/             # BullMQ queue producer, worker, and types
│       ├── routes/             # Express API route declarations
│       ├── services/           # Business logic: Scheduler, RateLimiter, Recovery, Email, Slack, Search
│       ├── utils/              # AES-256-GCM encryption, CSV parser, JWT tokens
│       ├── app.ts              # Express application setup
│       ├── server.ts           # HTTP server entrypoint with graceful shutdown
│       └── worker.ts           # Dedicated BullMQ worker entrypoint
└── frontend/
    ├── .env.example & .env     # Frontend configuration (VITE_API_URL)
    ├── vite.config.ts          # Vite bundler with port 5000 API proxy
    ├── tailwind.config.js      # Tailwind CSS configuration
    └── src/
        ├── api/                # Axios API client
        ├── components/         # Layout, Sidebar, Header, ComposeModal
        ├── context/            # AuthContext (Google OAuth & Demo Login)
        ├── pages/              # Login, Dashboard, Scheduled, Sent, Search, Queue, Settings
        └── App.tsx             # React router & protected routes
```

---

## 5. Prerequisites & Environment Variables

### Prerequisites
- **Node.js**: v20 or higher (v24 LTS verified)
- **Docker & Docker Compose**: Docker Desktop with WSL2 on Windows

### Backend Configuration (`backend/.env`)
```env
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:5000

# PostgreSQL Connection
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/reachinbox?schema=public

# Redis Connection
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis123
REDIS_URL=redis://:redis123@localhost:6379

# Elasticsearch Connection
ELASTICSEARCH_NODE=http://localhost:9200
ELASTICSEARCH_USERNAME=
ELASTICSEARCH_PASSWORD=

# Security & Encryption (AES-256-GCM)
SESSION_SECRET=super_secret_session_key_32_characters_minimum!
JWT_SECRET=super_secret_jwt_key_32_characters_minimum!
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# Google OAuth 2.0 Credentials (from Google Cloud Console)
GOOGLE_CLIENT_ID=your_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# BullMQ Queue & Concurrency
WORKER_CONCURRENCY=5
MIN_DELAY_BETWEEN_EMAILS_MS=2000
MAX_EMAILS_PER_HOUR_PER_SENDER=100

# Slack OAuth 2.0 Credentials (from api.slack.com/apps)
SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret
SLACK_REDIRECT_URI=http://localhost:5000/api/slack/callback

# Ethereal SMTP (auto-provisioned if omitted)
ETHEREAL_HOST=smtp.ethereal.email
ETHEREAL_PORT=587
ETHEREAL_USER=
ETHEREAL_PASS=
```

---

## 6. Quick Start (Local & Docker)

### 1. Launch Infrastructure Containers
```powershell
cd C:\Users\LENOVO\Downloads\Outbox
docker compose up -d postgres redis elasticsearch
```

### 2. Run Database Migrations
```powershell
cd C:\Users\LENOVO\Downloads\Outbox\backend
npx prisma db push
```

### 3. Start the Backend API Server
```powershell
cd C:\Users\LENOVO\Downloads\Outbox\backend
npm run dev
```

### 4. Start the BullMQ Email Worker
In a new terminal window:
```powershell
cd C:\Users\LENOVO\Downloads\Outbox\backend
npm run dev:worker
```

### 5. Start the React Frontend
In a new terminal window:
```powershell
cd C:\Users\LENOVO\Downloads\Outbox\frontend
npm run dev
```
Open **`http://localhost:3000`** in your browser!

---

## 7. Email Scheduling & Queue Mechanics

### The Scheduling Calculation
When a campaign is scheduled:
1. Target start time $T_0 = \max(\text{startTime}, \text{now})$.
2. The user configures `delayBetweenEmails` (e.g. 2,000ms) and `hourlyLimit` (e.g. 100/hr).
3. For recipient $i = 0, 1, 2, \dots$:
   - If the count in the current UTC hour reaches `hourlyLimit`, the scheduler shifts the base timestamp to the start of the next hour ($T + 1\text{ hr}$).
   - The recipient's `scheduledAt` is assigned:
     $$T_i = T_{\text{window}} + (i \times \text{delay})$$
4. An individual email record is persisted in PostgreSQL with unique `idempotencyKey = camp_{id}_{recipient}_{i}`.
5. A delayed BullMQ job is enqueued with deterministic job ID `email:{emailId}` and `delay = Math.max(0, scheduledAt - now)`.

---

## 8. Reliability & Concurrency Engineering

### 1. Multi-Worker Concurrency (`WORKER_CONCURRENCY=5`)
BullMQ workers process jobs in parallel. To prevent concurrent workers from violating sender limits, all coordination is delegated to Redis:
- **Minimum Delay Check**: The worker queries Redis key `rate:min_delay:{senderId}`. If the elapsed time since the last dispatch is under 2000ms, the worker pauses for the exact remaining duration before sending.
- **Hourly Rate Limiter**: The worker performs an atomic `INCR` on `rate:hourly:{senderId}:{YYYY-MM-DD-HH}`. If the count exceeds the limit, the increment is rolled back, the job is rescheduled to the next UTC window, and a Slack notification is triggered.

---

## 9. Persistence, Recovery & SMTP Guarantees

### Server Crash & Restart Recovery
1. **Redis Persistence**: Redis is configured with `appendonly yes` writing to persistent storage volume `redis_data`.
2. **Startup Reconciliation**: When `server.ts` boots, `RecoveryService.reconcileScheduledEmails()` executes:
   - Resets any jobs left in `processing` state from a sudden crash back to `scheduled`.
   - Compares PostgreSQL records with BullMQ using deterministic IDs.
   - Restores genuinely missing queue jobs without recreating already sent emails.
3. **Graceful Shutdown**: Intercepts `SIGINT`/`SIGTERM` to gracefully drain HTTP connections, close workers, and disconnect Redis/Prisma pools.

### SMTP Delivery Guarantees & Realities
> [!NOTE]
> Database transactions and external SMTP socket dispatches cannot participate in a distributed two-phase commit (2PC). If an SMTP server accepts an email and the worker dies before updating the database, retrying could produce a duplicate send. We minimize this by:
> 1. Verifying database state (`status !== 'sent'`) immediately before dispatch.
> 2. Recording delivery attempts in `EmailDeliveryAttempt` with SMTP `messageId`.
> 3. Capturing network errors and applying exponential backoff (`5s, 10s, 20s`).

---

## 10. Real Integrations

### 1. Real Google OAuth 2.0
- Initiates at `/api/auth/google`.
- Google redirects back with authorization code to `/api/auth/google/callback`.
- Exchanges code for Google access token and profile info.
- Automatically creates or logs in the user, provisions a default sender, and sets a secure HTTP-only cookie.
- Also includes a convenient **⚡ Quick Demo Login (Reviewer Mode)** button for evaluators.

### 2. Real Slack OAuth 2.0 & Alerts
- Connect your Slack workspace via OAuth 2.0.
- When hourly limits are breached, sends an actual formatted Slack message:
  ```text
  ⚠️ Email Rate Limit Reached
  • Sender: sales@example.com
  • Campaign: Outreach Campaign
  • Hourly Limit: 100 emails
  • Current Status: Sending paused
  • Next Available Window: Thu, 05 Nov 2026 13:00:00 GMT
  • Remaining Emails: 45
  The remaining emails have been rescheduled automatically.
  ```

### 3. Elasticsearch Full-Text Search
- Indexes documents into `reachinbox-emails`.
- Searches across `subject^3`, `recipientEmail^2`, `senderEmail`, `campaignName`, and `body` with case-insensitivity and status filters.

---

## 11. REST API Documentation

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Healthcheck endpoint |
| `GET` | `/api/auth/google` | Initiates Google OAuth consent screen |
| `GET` | `/api/auth/google/callback` | Handles Google OAuth callback |
| `POST` | `/api/auth/demo-login` | 1-click evaluator login |
| `GET` | `/api/auth/me` | Current authenticated user profile |
| `POST` | `/api/auth/logout` | Clears session cookie |
| `POST` | `/api/campaigns` | Schedule campaign (with multipart CSV or JSON) |
| `POST` | `/api/campaigns/parse-recipients` | Preview and parse CSV/TXT lead file |
| `GET` | `/api/campaigns` | List user's campaigns |
| `GET` | `/api/campaigns/:id` | Campaign details & email list |
| `POST` | `/api/campaigns/:id/cancel` | Cancel scheduled campaign & purge queue jobs |
| `GET` | `/api/emails/stats` | Dashboard aggregated statistics |
| `GET` | `/api/emails/scheduled` | List scheduled emails with pagination |
| `GET` | `/api/emails/sent` | List sent & failed emails with Ethereal preview links |
| `POST` | `/api/emails/:id/retry` | Re-enqueue a failed email job |
| `GET` | `/api/search/emails` | Elasticsearch full-text query |
| `GET` | `/api/senders` | List active sender accounts |
| `POST` | `/api/senders` | Create new email sender |
| `DELETE` | `/api/senders/:id` | Soft-delete sender |
| `GET` | `/api/slack/connect` | Initiates Slack OAuth flow |
| `GET` | `/api/slack/status` | Get Slack integration connection status |
| `POST` | `/api/slack/test` | Dispatch test notification to Slack |
| `POST` | `/api/slack/disconnect` | Disconnect Slack integration |
| `ALL` | `/admin/queues/*` | Bull Board live administrative dashboard |

---

## 12. 5-Minute Demo Video Walkthrough & Checklist

Follow this exact 5-minute script for your Loom / Google Drive recording:

- [ ] **0:00 - 0:30 (Login & Dashboard)**: Show the login page. Click **Quick Demo Login** (or Google OAuth). Showcase the 6 real-time metrics and BullMQ distribution on the Dashboard.
- [ ] **0:30 - 1:30 (Compose & CSV Parsing)**: Click **Compose Campaign**. Upload `sample_leads.csv`. Show how the parser validates leads, removes duplicates, and filters invalid emails. Configure start time and 2000ms delay. Click **Schedule Campaign**.
- [ ] **1:30 - 2:30 (BullMQ & Ethereal Delivery)**: Navigate to **Scheduled Emails** to show the pending jobs. Show the worker terminal executing sends. Go to **Sent Emails** and click **View Preview** to show the rendered email rendered on Ethereal Email!
- [ ] **2:30 - 3:15 (Elasticsearch Search)**: Navigate to **Search Emails**. Search for recipient names and subject keywords to show instant Elasticsearch querying.
- [ ] **3:15 - 4:00 (Slack Integration & Rate Limiting)**: Go to **Settings**. Show the connected Slack workspace. Click **Send Test Alert** to show the real Slack message arriving in your Slack channel!
- [ ] **4:00 - 5:00 (Restart Resilience & Bull Board)**: Open `http://localhost:5000/admin/queues` to inspect live Bull Board jobs. Stop the backend server in terminal, restart it, and show the terminal log: `Reconciliation finished: 0 missing jobs recovered` proving restart persistence.

---

## 13. Deployment to Production

### 1-Click Cloud Hosting (Free Tier)
1. **Frontend**: Deploy `frontend/` on **Vercel** with environment variable `VITE_API_URL=https://your-api.onrender.com/api`.
2. **Backend**: Deploy `backend/` on **Render.com** or **Railway.app** connecting your PostgreSQL (Neon.tech) and Redis (Upstash.com).

### Docker VPS Hosting ($5/mo on DigitalOcean/AWS)
```bash
git clone <your-repo>
cd reachinbox-scheduler
cp backend/.env.example backend/.env
docker compose up -d --build
```

---

## 14. Submission & Collaborators

As required by the assignment guidelines:
- Repository is set to **Private**.
- Collaborators invited:
  - `mitrajit`
  - `Yadav036`

*Crafted for the Outbox Labs SDE Intern Hiring Assignment.*
