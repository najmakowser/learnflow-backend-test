# AI-Powered LMS Registration & Nomination Portal

Enterprise Learning Management System — Registration & Nomination Module

## Quick Start

Double-click **`start.bat`** to launch both backend and frontend together.

| Service | URL |
|---------|-----|
| Frontend App | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |

---

## Manual Setup

### Backend (FastAPI + PostgreSQL)

```bash
cd backend
pip install -r requirements.txt
set DATABASE_URL=postgresql://user:password@host/database
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

> If `DATABASE_URL` is not set, the backend falls back to the local SQLite file at `backend/lms.db`.

### Frontend (React + Vite + Tailwind)

```bash
cd frontend
npm install
node node_modules/vite/bin/vite.js --port 5173
```

> Note: Due to the `&` character in the folder path, use `node` to run Vite directly instead of `npm run dev`.

---

## Application Modules

| Page | Path | Description |
|------|------|-------------|
| Dashboard | `/` | Stats, charts, upcoming trainings |
| Training Catalog | `/catalog` | Browse all courses; Self Register / Nominate |
| Self Registration | `/register` | Employee self-enrolment form |
| Manager Nomination | `/nominate` | Nominate multiple employees |
| L&D Validation | `/ld-validation` | Validate/reject submissions |
| Manager Approval | `/manager-approval` | Approve/reject validated requests |
| Finalized Participants | `/participants` | Enrolled list + email simulation |
| Workflow Tracker | `/workflow` | Visual pipeline for all requests |
| Audit Logs | `/audit` | Complete activity trail |

---

## Demo Workflow

### Self Registration Flow
1. Go to **Training Catalog** → click **Self Register** on any course
2. Select employee → fields auto-populate
3. Select training → AI checks duplicates & eligibility
4. Submit → status becomes **Pending L&D Validation**
5. Go to **L&D Validation** → Validate the request
6. Go to **Manager Approval** → Approve the request
7. Go to **Finalized Participants** → Send confirmation email (simulated)

### Manager Nomination Flow
1. Go to **Training Catalog** → click **Nominate Employees**
2. Select manager → fill training requirement
3. Use **AI Suggest** to auto-recommend priority
4. Add multiple participants dynamically
5. Submit → status becomes **Pending L&D Validation**
6. Follow same L&D → Manager Approval flow

---

## User Roles & Sample Logins (Demo)

| Role | Name | ID |
|------|------|----|
| L&D Admin | Kavitha Murthy | LD001 |
| Manager | Rajesh Kapoor | MGR001 |
| Manager | Sunita Agarwal | MGR002 |
| Employee | Arjun Sharma | EMP001 |
| Employee | Ravi Kumar | EMP003 |

---

## Seed Data

- **14 users** (10 employees, 3 managers, 1 L&D admin)
- **6 training courses** across Technical, Soft Skills, Analytics, Security domains
- **3 self-registration requests** in various workflow stages
- **2 manager nominations** with 5 participants total

---

## AI Features (Simulated)

All AI features use rule-based logic — no external API required:

- **Course Suggestion** — recommends training based on designation/department
- **Priority Suggestion** — detects compliance/client keywords to suggest High/Medium/Low
- **Duplicate Detection** — flags if employee already has an active request for the course
- **Eligibility Validation** — checks seat availability

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, Recharts, Lucide Icons |
| Backend | FastAPI, Python 3.x |
| Database | PostgreSQL in production, SQLite fallback for local use |
| HTTP Client | Axios |
