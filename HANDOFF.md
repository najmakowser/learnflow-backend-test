# LearnFlow — Zoho People Sync: Handoff for Production Deploy

## Summary
Zoho People → LearnFlow LMS employee sync is **working on the test environment**
(Render + PostgreSQL). All code fixes are committed and pushed to `main` on
`github.com/najmakowser/learnflow-backend-test`. This doc explains what was fixed
and what's needed to deploy to the **main/production** environment.

## Current status
- ✅ Backend deploys and runs on Render against PostgreSQL.
- ✅ `POST /api/zoho/employees/sync` works end-to-end from a Zoho People custom function.
- ✅ Supports: new joiner (create), detail update, and **exit auto-deactivation**
  (employee marked `Inactive` when `dateOfExit` is on/before today).
- ✅ Data persists across restarts (moved off ephemeral SQLite to PostgreSQL).
- Test backend URL: `https://learnflow-backend-j1bd.onrender.com`
- Sync endpoint: `https://learnflow-backend-j1bd.onrender.com/api/zoho/employees/sync`

## What was fixed (commits on `main`, in order)
1. `b6faad5` — Added missing `reportlab` dependency to `requirements.txt` (startup crash).
2. `aad8ae3` — Auto-deactivate employees when Zoho sends a past `dateOfExit`
   (`apply_exit_status` / `parse_flexible_date` in `main.py`).
3. `ab24a92` — Run `init_db()` schema setup in **autocommit** mode on Postgres
   (a failed statement was aborting the whole transaction).
4. `67dfa96` — Create `course_request_participants` and `release_notifications`
   tables on Postgres (were SQLite-only).
5. `c1b328e` — Add 8 missing FH/manager columns (+3 trainings columns) to the
   Postgres schema migration list.
6. `241eaee` — Fix Zoho sync 500 on Postgres: commit/rollback around the
   `ensure_zoho_sync_columns` ALTER statements so a failed ALTER doesn't poison
   the request transaction.
(The trainings seed-insert column fix `4d46fa8` was already on `main`.)

## To deploy to the MAIN / production environment
1. **Pull latest `main`** — all fixes are included.
2. **Provision a persistent PostgreSQL** (NOT Render free tier — free Postgres is
   deleted after ~30 days). Use a paid Render Postgres or your standard DB host.
3. **Set environment variables** on the production backend service:
   - `DATABASE_URL` = production Postgres connection string (use the *internal* URL
     if the DB is on the same host/network as the backend). The code auto-switches
     to Postgres when this is set.
   - `ZOHO_SYNC_API_TOKEN` = **a strong secret** (see Security below).
   - `PYTHON_VERSION` = `3.11.11` (optional; test env happened to run 3.14).
   - Build command: `pip install -r requirements.txt`  (rootDir: `backend`)
   - Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. **Deploy** and confirm the logs show a clean startup:
   `Application startup complete.` + `Reference training data loaded successfully.`
   with no traceback.
5. **Update the Zoho People custom function** (`lmsUrl`) to the production URL:
   `https://<prod-backend>/api/zoho/employees/sync`
6. **Update the Authorization header** in that Zoho function to match
   `ZOHO_SYNC_API_TOKEN` (`Bearer <token>`).
7. **Deploy the frontend** with `VITE_API_BASE_URL` = production backend URL.
8. **Smoke test**: run the Zoho function → expect `"action":"created"`, then run
   again → `"action":"updated"`; set a past `dateOfExit` → `"status":"Inactive"`.

## Security (IMPORTANT)
- The sync endpoint currently accepts the **default token `test123`** when
  `ZOHO_SYNC_API_TOKEN` is unset. **For production, set a strong secret** and put
  the same value in the Zoho function's `Authorization: Bearer <token>` header.
  Do not ship with `test123`.

## Open items / to review before go-live
- **Reporting manager mapping:** Zoho sends `reportingManagerId` as a name string
  (e.g. `"Najma Kowser Siddicque - 3772"`), which is stored as-is and does NOT
  resolve to an LMS `employee_id`. Manager→reportee linkage may not work. Preferred
  fix: have Zoho send the manager's **Employee ID**, or map by manager email.
  Same applies to `functionalHeadId`.
- **Frontend data verification** not yet done (confirm synced employee shows correct
  department / business unit / designation / status in the L&D employee list).
- **Exit logic edge case:** confirm a *future* `dateOfExit` correctly keeps the
  employee Active until that date.

## Zoho field mappings (as configured in test)
EmployeeID→employeeId, Full_Name→employeeName, EmailID→email,
Employeestatus→status, Department→department, Business_unit2→businessUnit,
Designation→designation, Dateofjoining→dateOfJoining, Dateofexit→dateOfExit,
Reporting_To→reportingManagerId, Functional_Head_Name→functionalHeadId.
