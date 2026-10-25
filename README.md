# FinSort — Utho Cloud FinOps & Resource Optimization UI (`utho_frontend`)

> **Jury Overview:** FinSort is an end-to-end Cloud Cost & Resource Optimization platform purpose-built for **Utho Cloud** (`in-mumbai-1`, `in-noida-1`, `in-bangalore-1`). After a 40% cloud spend increase over 6 months (`₹4,85,000/mo → ₹6,79,000/mo`), FinSort analyzes 30-day hourly telemetry across **85 cloud resources** (VMs, Block SSD Volumes, Public IPv4s) to deliver **`p95`/`p99` peak-safe rightsizing**, **Temporal Fusion Transformer (TFT) P10/P50/P90 forecasting**, **anomaly root-cause alerts**, **interactive What-If simulations**, and **1-click Terraform HCL & Utho CLI remediation manifests**.

---

## 3-Repository System Architecture

| Repository | Tech Stack | Port | Responsibility |
| :--- | :--- | :--- | :--- |
| **`utho_frontend`** *(this repo)* | React 19, TypeScript, Vite 8, Tailwind CSS 4 | `:5173` | Executive FinOps Dashboard, Resource Drill-Down, Recommendations, What-If Simulator, Forecast & AI Copilot UI |
| **`utho_backend`** | Go 1.22+ (`net/http`), In-Memory Seed 42 Engine | `:8080` | Peak-safety (`p95`/`p99`) rightsizing math, What-If engine, Terraform HCL/CLI generator, AI proxy with deterministic fallback |
| **`utho_ai_app`** | Python 3.11+, FastAPI, PyTorch TFT, Google Gemini | `:8001` | Pooled TFT `P10/P50/P90` forecasting, SRE root-cause audit, ordinal capacity risk scoring, NL What-If parser & grounded chat |

---

## Full-Stack Setup Instructions (All 3 Repos)

### 1. Start Python AI & Forecasting Service (`utho_ai_app` — Port `:8001`)
```bash
cd utho_ai_app
python -m venv .venv
# Windows: .venv\Scripts\activate | macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001
```
*(Note: If `:8001` is offline, `utho_backend` automatically falls back to its built-in deterministic mathematical rule engine with zero downtime.)*

### 2. Start Go FinOps Engine & API (`utho_backend` — Port `:8080`)
```bash
cd utho_backend
go run ./cmd/server
# Binds to http://localhost:8080 (Healthcheck: GET http://localhost:8080/healthz)
```

### 3. Start React FinOps Frontend (`utho_frontend` — Port `:5173`)
```bash
cd utho_frontend
npm install
npm run dev
# Open http://localhost:5173
```

---

## Key UI Capabilities for Jury Evaluation

1. **Dashboard & Resource Drill-Down (`src/views/DashboardView.tsx`, `ResourceDetailModal.tsx`)**
   - Filter 85 Utho Cloud resources by **Region** (`in-mumbai-1`, `in-noida-1`, `in-bangalore-1`), **Environment** (`prod`, `staging`, `dev`), **Team**, and **Status**.
   - **Before vs. After Spend Comparison:** Real-time monthly spend (`₹6,79,000/mo`) vs. optimized projected spend as recommendations are accepted/rejected.
   - **Peak-Safety Trap Guardrail:** Click `prod-payment-webhook-01` (`res-vm-021`). Even though average CPU is `13.8%`, daily checkout surges hit `p95 = 86.4%` and `p99 = 93.2%`. FinSort locks the instance as `PROTECTED_PEAK_LOAD` to prevent a catastrophic downsizing outage, and displays the mathematical proof + locked Terraform HCL.
2. **Actionable Recommendations (`src/views/RecommendationsView.tsx`)**
   - Covers all 4 core optimization actions: **Rightsize VMs**, **Off-Hours Schedules** (`Mon–Fri 19:00–09:00 IST + Weekends`), **Terminate Zombie VMs** (with 30-day safety snapshots), and **Purge Orphaned Block Volumes / Floating IPs**.
   - Accept/Reject individual rows or **Approve All Low-Risk**; savings totals update live across environments.
3. **30 / 60 / 90-Day Quantile Forecast (`src/views/ForecastAndBriefingsView.tsx`)**
   - Displays **P10 / P50 / P90 uncertainty fan chart** comparing Baseline Run-Rate vs. FinOps Optimized trajectory, alongside validation MAE vs. seasonal-naive baseline MAE.
4. **What-If Simulator & Active Anomaly Alerts (`src/views/SimulatorAndAlertsView.tsx`)**
   - **Interactive Sliders & Natural-Language Scenarios:** Simulate dev/staging off-hours shutdowns, safety headroom buffers (`15%–40%`), and orphan cleanup thresholds.
   - **Anomaly Alerts with "Why" Root-Cause Proof:** Memory leak detection (`prod-search-indexer-04` OOM in 14h), cost spikes (`staging-loadtest-cluster`), and disk capacity exhaustion (`prod-postgres-wal-volume`).
5. **1-Click Terraform HCL & Utho CLI Export (`src/components/common/RemediationModal.tsx`)**
   - Click **Terraform & CLI** / **Export CSV & HCL Plan** from any screen to view, copy, or download `.tf` (Terraform Utho Provider HCL), `.sh` (Utho CLI runbook), and `.csv` (Executive Audit).
6. **Grounded AI FinOps Copilot (`src/components/common/AIChatDrawer.tsx`)**
   - Floating assistant wired to `/api/v1/ai/chat` answering fleet, resource, and scenario queries with telemetry citations.

---

## Verification & Build Commands

```bash
# Lint (Oxlint — 0 warnings, 0 errors)
npm run lint

# Production TypeScript typecheck + Vite bundle build
npm run build
```

## Directory Structure

```text
utho_frontend/
├── src/
│   ├── api/client.ts                  # Typed REST client targeting :8080/api/v1
│   ├── types/api.ts                   # Shared TypeScript contracts with Go & Python
│   ├── components/
│   │   ├── layout/                    # Sidebar, Header, GlassCard primitives
│   │   └── common/
│   │       ├── RemediationModal.tsx   # Terraform HCL (.tf), Utho CLI (.sh) & CSV export modal
│   │       └── AIChatDrawer.tsx       # Grounded FinOps AI Copilot drawer
│   ├── views/
│   │   ├── DashboardView.tsx          # KPIs, Before/After spend, filters, resource inventory table
│   │   ├── ResourceDetailModal.tsx    # 30-day p95/p99 telemetry drill-down, SRE proof & per-VM HCL
│   │   ├── RecommendationsView.tsx    # Accept/Reject actions, assumptions & Utho pricing catalog
│   │   ├── SimulatorAndAlertsView.tsx # Sliders + NL What-If simulator & anomaly alerts
│   │   ├── ForecastAndBriefingsView.tsx # 30/60/90d P10-P50-P90 forecast & role briefings
│   │   └── GreenOpsView.tsx           # CEA India (0.71 kg CO2/kWh) carbon & PUE impact
│   └── App.tsx                        # State orchestration & local HCL/CLI fallback builder
└── vite.config.ts
```
