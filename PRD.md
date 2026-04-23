# Product Requirements Document
# WA Supervisor — AI-Powered Task Reminder & Performance Review System

**Version:** 1.0  
**Date:** 2026-04-23  
**Author:** luhur@budikaryateknologi.com  
**Status:** Active Development

---

## 1. Overview

### 1.1 Problem Statement

Supervisors managing distributed field teams (Persons In Charge / PIC) face a recurring operational bottleneck:

- Daily task reminders are sent manually (WhatsApp, phone calls)
- Task completion status is tracked informally or not at all
- Proof of work (photos, notes) is scattered across personal chats
- Performance evaluations are subjective and infrequent
- Supervisor time is consumed by follow-ups that should be automated

This creates inefficiency, missed tasks, lack of accountability, and difficulty generating objective performance data.

### 1.2 Solution

WA Supervisor is a system that automates the full daily work loop for supervisor-to-PIC task management via WhatsApp:

1. **AI reads daily tasks** from a database and generates personalized reminder messages
2. **Sends via WhatsApp CRM** (CloudChat) at scheduled times
3. **PIC responds** directly in WhatsApp — submits photos, reports completion or problems
4. **AI analyzes responses**, updates task status, flags issues, and alerts the supervisor
5. **Weekly/monthly AI performance reviews** are generated per PIC and delivered via WhatsApp
6. **Supervisor dashboard** (web) provides full visibility into tasks, responses, photos, and reviews

### 1.3 Goals

| Goal | Metric |
|---|---|
| Reduce manual reminder effort | Supervisor sends 0 manual daily reminders |
| Increase task response rate | ≥ 80% of reminded tasks receive a PIC response |
| Centralize proof of work | 100% of completed tasks have photo/text record |
| Enable data-driven performance review | Weekly review available per PIC, score 0–10 |
| Reduce overdue tasks | Overdue rate < 15% of assigned tasks |

---

## 2. Users & Roles

### 2.1 Supervisor

**Who:** Manager or team lead responsible for assigning and tracking work.

**Needs:**
- Assign tasks to specific PICs with deadlines
- Know which tasks are done, pending, or problematic each day
- See photo evidence of completed work
- Get alerted immediately when a PIC reports a serious problem
- Review PIC performance objectively over time

**Interaction channels:** Web dashboard (PHP), WhatsApp (receives daily summary + alerts)

---

### 2.2 PIC (Person In Charge)

**Who:** Field worker, technician, or staff member assigned to execute tasks.

**Needs:**
- Receive clear daily task reminders without needing to check an app
- Report task completion easily (photo + short note via WhatsApp)
- Report problems without friction
- Receive fair performance feedback

**Interaction channels:** WhatsApp only — no app install required

---

### 2.3 System / AI Agent ("OpenClaw")

**Who:** Automated Claude API-powered agent running on the VPS.

**Responsibilities:**
- Generate personalized reminder messages (Bahasa Indonesia)
- Analyze PIC text responses and classify status
- Flag problematic responses and escalate to supervisor
- Generate weekly/monthly performance reviews

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  SUPERVISOR                    PICs (Field Workers)          │
│  Web Dashboard (PHP)           WhatsApp (no app needed)      │
│       │                              │                        │
│       │ REST API (Bearer)            │ CloudChat Webhook      │
│       ▼                              ▼                        │
│  ┌────────────────────────────────────────────┐              │
│  │          VPS — Node.js Application         │              │
│  │                                            │              │
│  │  ┌──────────────┐  ┌───────────────────┐  │              │
│  │  │ HTTP Server  │  │  Cron Workers     │  │              │
│  │  │ (Express)    │  │  08:00 reminders  │  │              │
│  │  │ REST API     │  │  13:00 follow-up  │  │              │
│  │  │ Webhook recv │  │  17:00 overdue    │  │              │
│  │  └──────┬───────┘  │  Mon reviews      │  │              │
│  │         │          └────────┬──────────┘  │              │
│  │         ▼                   ▼             │              │
│  │  ┌──────────────────────────────────────┐ │              │
│  │  │   OpenClaw — Claude AI Agent         │ │              │
│  │  │   Mode A: Generate reminders         │ │              │
│  │  │   Mode B: Analyze PIC responses      │ │              │
│  │  │   Mode C: Performance reviews        │ │              │
│  │  └──────────────────────────────────────┘ │              │
│  │                    │                       │              │
│  │         ┌──────────▼──────────┐            │              │
│  │         │  PostgreSQL DB      │            │              │
│  │         │  tasks, responses   │            │              │
│  │         │  reviews, users     │            │              │
│  │         └─────────────────────┘            │              │
│  └────────────────────────────────────────────┘              │
│                       │                                       │
│              CloudChat API (WA CRM)                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Core Features

### 4.1 Task Management

**FR-01 — Create Task**
- Supervisor creates task with: title, description, category, assigned PIC, priority (low/medium/high/critical), due date, location, checklist items
- Field: `send_reminder` (toggle) and `reminder_hour` (default 08:00 WIB)
- Tasks support recurrence: daily, weekly, monthly

**FR-02 — Task Status Lifecycle**
```
pending → in_progress → completed
    ↓                       ↑
  overdue ─────────────────
    ↓
  cancelled
```
Status transitions triggered by: PIC button click, AI analysis, overdue cron, supervisor manual edit.

**FR-03 — Task Categories**
Default categories: Maintenance, Laporan, Inspeksi, Administrasi, Operasional. Supervisor can add/edit categories.

**FR-04 — Soft Delete**
Deleted tasks retain response history. Filtered from active views but accessible in audit.

---

### 4.2 WhatsApp Reminder Flow

**FR-05 — Daily Reminder Dispatch (08:00 WIB)**
- Cron queries all tasks with `due_date = today`, `send_reminder = TRUE`, `status IN (pending, in_progress)`
- For each task: Claude (Mode A) generates a personalized Bahasa Indonesia reminder
- Message delivered via CloudChat as an interactive button message:
  - Button 1: **Selesai ✅** — task is done, request photo + note
  - Button 2: **Ada Kendala ⚠️** — problem occurred, request description
  - Button 3: **Tunda ⏳** — mark as in-progress, no further action

**FR-06 — Afternoon Follow-Up (13:00 WIB)**
- Re-reminds PICs who have not responded to any of their tasks today
- Slightly more urgent tone in message

**FR-07 — Overdue Alert (17:00 WIB)**
- Tasks past `due_date` with no completion are marked `overdue`
- Supervisor receives a summary list via WhatsApp

**FR-08 — Manual Remind-Now**
- Supervisor can trigger an immediate reminder for any task from the dashboard
- Sends same button message format as scheduled reminders

---

### 4.3 PIC Response Flow (Conversation State Machine)

**FR-09 — Button: Selesai**
```
PIC clicks "Selesai"
  → System: "Silakan kirim foto bukti penyelesaian tugas."
  → PIC sends photo(s) [optional, can type "-" to skip]
  → System: "Tambahkan keterangan (atau ketik "-" untuk selesai)."
  → PIC sends text
  → Response saved, task → completed, acknowledgment sent
```

**FR-10 — Button: Ada Kendala**
```
PIC clicks "Ada Kendala"
  → System: "Ceritakan kendala yang Anda hadapi. Bisa kirim foto juga."
  → PIC sends text + optional photo
  → Response saved as flagged, supervisor alerted via WA
```

**FR-11 — Button: Tunda**
```
PIC clicks "Tunda"
  → Task status → in_progress
  → Brief acknowledgment sent, no further input needed
```

**FR-12 — Multi-task Handling**
- If PIC has >1 task today, system sends each as a separate button message
- `button_id` format: `{action}__{taskUUID}` — system always knows which task the response belongs to

**FR-13 — Session Expiry**
- Conversation state expires after 2 hours of inactivity
- State is reset to idle; partial responses are discarded

---

### 4.4 AI Agent — OpenClaw (Claude API)

**FR-14 — Mode A: Reminder Generation**
- Input: task details, PIC name, response history this week
- Output: structured JSON `{ header, body, footer, buttons[] }`
- Constraints: body ≤ 280 characters, Bahasa Indonesia, professional + friendly tone
- Fallback: uses hardcoded template if Claude API fails

**FR-15 — Mode B: Response Analysis**
- Triggered async after each PIC response is saved
- Input: task context, PIC message text, photo count, button clicked
- Output: `{ summary, actual_status, flagged, flag_reason, suggested_task_status }`
- If `flagged = true`: supervisor receives immediate WA alert

**FR-16 — Mode C: Performance Review**
- Input: PIC identity, computed metrics for the period
- Output: `{ quality_score (0–10), narrative, strengths[], improvements[], supervisor_summary }`
- Language: Bahasa Indonesia; grounded in data only — no invented facts
- Phase 1: text-only analysis; Phase 2: extend with photo analysis (Claude vision)

---

### 4.5 Performance Reviews

**FR-17 — Weekly Reviews (Monday 07:00 WIB)**
Generated for all active PICs covering the previous week.

**FR-18 — Monthly Reviews (1st of month 00:00 WIB)**
Generated for all active PICs covering the previous month.

**FR-19 — Review Metrics Computed**
| Metric | Source |
|---|---|
| Tasks assigned | `tasks` table |
| Tasks completed on time | `tasks` table |
| Tasks overdue | `tasks` table |
| Response rate | `reminder_log` vs `task_responses` |
| Avg response time (hours) | Time from reminder sent → response created |
| Problem reports filed | `task_responses.status_reported = 'problem'` |
| AI-flagged responses | `task_responses.flagged = TRUE` |

**FR-20 — Review Delivery**
- PIC receives brief WA summary: score, completion rate, 3 strengths, 3 improvements
- Supervisor receives one-line WA summary per PIC
- Full review visible in web dashboard

---

### 4.6 Supervisor Web Dashboard

**FR-21 — Dashboard Home**
- KPI cards: tasks today, tasks pending, tasks overdue
- Flagged responses list (requires immediate attention)
- Quick links to create task, PIC list, reviews

**FR-22 — Task List**
- Filterable by: status, category, PIC, due date range
- Paginated (20 per page)
- Columns: title, category, PIC, due date, status, priority

**FR-23 — Task Detail**
- Full task info + all PIC responses (newest first)
- Photos displayed as thumbnails, click to open full size
- AI summary shown per response (robot icon)
- Flagged responses highlighted with red border
- "Kirim Pengingat" button (manual remind-now)

**FR-24 — PIC Management**
- List all PICs with name, department, phone
- Add new PIC (name + WA number required)
- Deactivate PIC (soft: stops receiving reminders)

**FR-25 — Review Browser**
- Filter by PIC, period type (weekly/monthly)
- Score badge color-coded: green ≥ 8, yellow ≥ 6, red < 6
- Detail view: narrative, strengths, improvements, metric breakdown

---

## 5. Non-Functional Requirements

### 5.1 Performance

| Requirement | Target |
|---|---|
| Webhook response time | < 200ms (returns 200 immediately, processes async) |
| Reminder batch (100 tasks) | Complete within 5 minutes |
| Dashboard page load | < 3 seconds (PHP curl to VPS) |
| AI response time (Mode B) | < 15 seconds (async, PIC not waiting) |
| Media download before 200 OK | Must complete synchronously before returning to CloudChat |

### 5.2 Reliability

- Worker process runs as separate PM2 instance (fork mode, single) — no duplicate cron triggers
- HTTP server runs in cluster mode (2 instances) for load resilience
- Claude API failures fall back to hardcoded reminder templates
- CloudChat send failures are logged in `reminder_log` with `status = 'failed'`
- Conversation states expire after 2 hours to prevent stuck sessions
- PM2 auto-restart on crash with max 10 restarts before alerting

### 5.3 Security

| Layer | Measure |
|---|---|
| REST API | Bearer token authentication (SHA-256 hashed, timing-safe compare) |
| PHP dashboard | Existing CSRF protection + new `requireSupervisor()` role check |
| Database | PostgreSQL on 127.0.0.1 only — never exposed to internet |
| File uploads | Processed through `sharp` (no raw binary passthrough), size-capped at 10MB |
| Webhook | Rate-limited (300 req/min), optional HMAC signature verification |
| Nginx | SSL/TLS via Let's Encrypt, HTTP → HTTPS redirect |

### 5.4 Scalability

- Phase 1: supports ≤ 50 PICs, ≤ 500 tasks/day comfortably
- Phase 2 scaling path: replace in-process async queue with BullMQ + Redis for high task volume

### 5.5 Observability

- Structured JSON logging via Winston (app.log, error.log)
- Reminder success/failure tracked in `reminder_log` table
- Flagged responses queryable from dashboard
- `audit_log` table for all significant system events

---

## 6. Data Model Summary

```
users           — PICs and supervisors (phone_number is the WA identity)
task_categories — Flexible categories (Maintenance, Laporan, etc.)
tasks           — Core work items with assignment, priority, due date
task_responses  — PIC replies: text, photo_urls[], ai_summary, flagged
reminder_log    — Every WA message sent: status, timing, message_id
conversation_state — Per-phone FSM state (idle → photo → text → idle)
performance_reviews — AI-generated weekly/monthly reviews per PIC
api_keys        — Internal API keys for PHP dashboard auth
audit_log       — Immutable event log for all system actions
```

---

## 7. Integration Points

| Integration | Direction | Protocol | Auth |
|---|---|---|---|
| CloudChat API | VPS → CloudChat | HTTPS REST | Bearer token |
| CloudChat Webhook | CloudChat → VPS | HTTPS POST | Optional HMAC |
| Anthropic Claude API | VPS → Anthropic | HTTPS REST | API key |
| PHP Dashboard → VPS | Shared hosting → VPS | HTTPS REST | Bearer token |
| VPS → Supervisor WA | VPS → CloudChat | HTTPS REST | Bearer token |

---

## 8. User Stories

### Supervisor Stories

| ID | Story |
|---|---|
| US-01 | As a supervisor, I want to create a task with a deadline and assign it to a PIC so I don't need to manually remind them. |
| US-02 | As a supervisor, I want to see all tasks due today and their response status in one dashboard. |
| US-03 | As a supervisor, I want to be immediately notified via WhatsApp when a PIC reports a serious problem. |
| US-04 | As a supervisor, I want to see photo evidence of completed tasks without leaving the dashboard. |
| US-05 | As a supervisor, I want a weekly WhatsApp summary of each PIC's performance with an AI-generated score. |
| US-06 | As a supervisor, I want to manually trigger a reminder for a task that the PIC missed. |

### PIC Stories

| ID | Story |
|---|---|
| US-07 | As a PIC, I want to receive a clear WhatsApp message each morning with my tasks for the day. |
| US-08 | As a PIC, I want to report task completion by sending a photo and a short note via WhatsApp — no app needed. |
| US-09 | As a PIC, I want to report a problem easily so the supervisor is informed without me making a phone call. |
| US-10 | As a PIC, I want to receive my weekly performance score and feedback via WhatsApp. |

---

## 9. Out of Scope (v1.0)

- Multi-supervisor support (one supervisor phone per deployment)
- Photo content analysis via Claude Vision (planned for v2.0)
- Mobile app for supervisors
- Real-time dashboard (WebSocket push) — current: page-load refresh
- WhatsApp group-based reminders
- Task dependency chains
- Integration with external project management tools (Jira, Asana, etc.)
- Multi-language support beyond Bahasa Indonesia
- Direct PIC-to-supervisor escalation button from WhatsApp

---

## 10. Phased Rollout

### Phase 1 (Current) — Core System
- [x] PostgreSQL schema + migrations
- [x] REST API (tasks, users, responses, reviews)
- [x] CloudChat webhook receiver + FSM
- [x] Photo download + storage
- [x] Claude AI agent (Modes A, B, C)
- [x] Reminder + review cron workers
- [x] PHP supervisor dashboard (all core pages)
- [ ] Production VPS deployment
- [ ] CloudChat webhook URL configured
- [ ] First PIC and task created end-to-end

### Phase 2 — Enhancements
- [ ] Claude Vision for photo analysis in Mode B
- [ ] BullMQ + Redis for high-volume task queue
- [ ] Task recurrence engine (auto-create daily/weekly instances)
- [ ] Supervisor WA commands ("laporan hari ini", "status {pic}")
- [ ] Email digest option for supervisors
- [ ] Dashboard charts (completion trend, response rate graph)

### Phase 3 — Scale
- [ ] Multi-team / multi-supervisor isolation
- [ ] Mobile-optimized dashboard (PWA)
- [ ] Webhook reliability: delivery confirmation + retry queue
- [ ] Audit log UI in dashboard
- [ ] SLA tracking per task category

---

## 11. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| CloudChat 2s webhook timeout | High | High | Return 200 immediately; process async via `setImmediate` |
| Media URL expiry before download | Medium | High | Download media synchronously before returning 200 |
| Claude API downtime | Low | Medium | Fallback to hardcoded reminder template |
| PIC doesn't click buttons | Medium | Medium | Afternoon follow-up at 13:00; plain text reply also handled |
| Duplicate cron on PM2 cluster | High (if misconfigured) | High | Workers run as separate single-instance PM2 process |
| PHP dashboard slow (curl latency) | Medium | Low | Session-cached static data; 20-item pagination |
| Shared hosting API key exposure | Low | High | API key has write-only permissions; no admin access from PHP |

---

## 12. Glossary

| Term | Definition |
|---|---|
| PIC | Person In Charge — field worker assigned to execute tasks |
| OpenClaw | Internal name for the Claude API-powered AI agent |
| FSM | Finite State Machine — per-phone WA conversation state tracker |
| CloudChat | WhatsApp CRM platform used to send/receive WA messages |
| Mode A/B/C | Three distinct Claude invocation modes: reminder gen, response analysis, review gen |
| WIB | Waktu Indonesia Barat (UTC+7) — timezone for all scheduled operations |
| Flagged | A response marked by AI as containing a serious problem requiring supervisor attention |
