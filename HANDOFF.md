# LearnFlow — Zoho People Sync: Handoff for Production Deploy

## Summary
Zoho People → LearnFlow LMS employee sync is **working on the test environment**
(Render + PostgreSQL). All code fixes are committed and pushed to `main` on
`github.com/najmakowser/learnflow-backend-test`. This doc explains what was fixed
and what's needed to deploy to the **main/production** environment.

## Current status — fully validated end-to-end on the test environment
- ✅ Backend deploys and runs on Render against PostgreSQL.
- ✅ `POST /api/zoho/employees/sync` works end-to-end from a Zoho People custom function.
- ✅ New joiner (create), detail update, and **exit auto-deactivation**
  (Inactive when `dateOfExit` is on/before today, or when Zoho status is a separation).
- ✅ Real Zoho statuses mapped correctly (e.g. "Separated through Resignation" → Inactive).
- ✅ Manager & FH references resolved to real IDs (e.g. "Najma … - 3772" → `3772`).
- ✅ Managers auto-detected from designation, get a login password, and can sign in.
- ✅ Reporting manager sees their **active** team; exited employees are filtered out.
- ✅ Data persists across restarts/redeploys (PostgreSQL, not ephemeral SQLite).
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
7. `a069da7` — Resolve Zoho manager/FH `'Name - ID'` refs to real LMS employee IDs.
8. `92fc13b` — Protect Zoho-synced employees from the seed's stale-deletion (they were
   being wiped on every restart because they aren't in dataset.xlsx).
9. `ab19bf9` — Map the full Zoho status list to Active/Inactive (Abscond, Terminated,
   Deceased, Separated through Resignation, Transfer to PreludeSys …, Resigned →
   Inactive; Active / Serving notice period → Active).
10. `9c47c85` — Replace SQLite-only `date('now')` in the dashboard and FH-PDF queries
    (was 500 on Postgres).
11. `8744b26` — Give synced manager/FH/L&D accounts a default login password
    (`LS@<employee_id>#2026`) so they can sign in; employees stay password-less.
12. `69744f7` — Infer manager/functional_head role from designation when Zoho sends
    `employee` (Manager/Lead/Head → manager; Functional Head/Director/VP/Head of → FH).
(The trainings seed-insert column fix `4d46fa8` was already on `main`.)

## Role & login reference
- **Role:** send an explicit `role` from Zoho for precision, or rely on designation
  inference (`derive_lms_role` in `main.py`). Employees have no portal login.
- **Manager/FH/L&D login password:** `LS@<employee_id>#2026` (e.g. `LS@3772#2026`).
  Set on sync only if no password exists yet (never overwrites a chosen password).
  For production, consider forcing a password reset / SSO instead of the default scheme.
- **Verify a manager's reportees (no login needed):**
  `GET /api/employees/<manager_id>/reportees` (add `?include_inactive=true` to see exited).

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

### ZOHO_SYNC_API_TOKEN — what it is and how to set it
This is **a secret you create yourself** (NOT obtained from Zoho). It's a shared key
that must match in two places so only your Zoho function can call the sync endpoint.

1. **Generate a strong secret** (PowerShell):
   ```powershell
   [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
   ```
   (Any long random string with no spaces works.)
2. **Backend:** Render → production backend service → Environment → set
   `ZOHO_SYNC_API_TOKEN = <the secret>` → Save (redeploys).
3. **Zoho:** in the Deluge function change
   `headers.put("Authorization","Bearer test123");` to
   `headers.put("Authorization","Bearer <the same secret>");`
4. **Test:** run the sync. A `401 "Invalid Zoho sync token"` means the two values
   don't match exactly (typo/space).
- Keep it secret: never commit it to Git or share it. If it leaks, generate a new one
  and update both the backend env var and the Zoho header.

## Resolved
- **Reporting manager / FH mapping (DONE):** Zoho sends these as `'Full Name - EmployeeID'`.
  `resolve_manager_id` now extracts and resolves the real LMS `employee_id`
  (by email → extracted ID → name → fallback to extracted ID). Confirmed: a payload
  of `"Najma Kowser Siddicque - 3772"` is stored as `3772`. Managers are stored in the
  LMS with their Zoho numeric ID, so linkage connects once the manager is also synced.
- **Persistence (DONE):** verified `action:"updated"` survives a full rebuild + restart
  on PostgreSQL.
- **Employee status mapping (DONE):** `normalize_employee_status` maps the full Zoho
  status list. `Active` and `Serving notice period` stay Active; all separation
  statuses (Abscond, Terminated, Deceased, Separated through Resignation, Transfer to
  PreludeSys Inc - India/US, Resigned) map to Inactive. An employee is also set Inactive
  when `dateOfExit` is on/before today.

## Open items / to review before go-live
- **Free-tier cold start:** on Render free tier the instance sleeps after ~15 min idle;
  the first request takes 50s+ to wake and Zoho returns 'Socket timeout exception'.
  Fix for prod: use a paid (always-on) instance, or add a retry in the Zoho Deluge
  function (catch timeout → wait a few seconds → retry once).
- **Frontend data verification** not yet done (confirm synced employee shows correct
  department / business unit / designation / status in the L&D employee list).
- **Exit logic edge case:** confirm a *future* `dateOfExit` correctly keeps the
  employee Active until that date.

## Zoho field mappings (as configured in test)
EmployeeID→employeeId, Full_Name→employeeName, EmailID→email,
Employeestatus→status, Department→department, Business_unit2→businessUnit,
Designation→designation, Dateofjoining→dateOfJoining, Dateofexit→dateOfExit,
Reporting_To→reportingManagerId, Functional_Head_Name→functionalHeadId.

> NOTE: the `status` argument must map to the **Employee Status** field (values like
> Active / Serving notice period / Abscond / Terminated / Resigned / Transfer …),
> not a separate "Exit status" field, so the backend can mark leavers Inactive.

## Zoho People custom function (with cold-start retry)
Update `lmsUrl` to the production URL and the `Authorization` bearer to the production
`ZOHO_SYNC_API_TOKEN` before go-live.

```javascript
// LearnFlow LMS Employee Sync from Zoho People
recordId = ifnull(input.ID,"");
info "LEARNFLOW EMPLOYEE SYNC START | Zoho Record ID = " + recordId;

// Backend URL — change to the production URL when going live
lmsUrl = "https://learnflow-backend-j1bd.onrender.com/api/zoho/employees/sync";

payload = Map();
payload.put("employeeId",ifnull(input.EmployeeID,""));
payload.put("employeeName",ifnull(input.Full_Name,""));
payload.put("email",ifnull(input.EmailID,""));
payload.put("status",ifnull(input.Employeestatus,"Active"));
payload.put("department",ifnull(input.Department,""));
payload.put("businessUnit",ifnull(input.Business_unit2,""));
payload.put("designation",ifnull(input.Designation,""));
payload.put("dateOfJoining",ifnull(input.Dateofjoining,""));
payload.put("dateOfExit",ifnull(input.Dateofexit,""));
payload.put("role","employee");
payload.put("currentSkills","");

payload.put("reportingManagerId","");
payload.put("reportingManagerEmail","");
payload.put("functionalHeadId","");
payload.put("functionalHeadEmail","");

try
{
	if(input.Reporting_To != null)
	{
		payload.put("reportingManagerId", input.Reporting_To.toString());
	}
}
catch (e)
{
	info "Reporting manager mapping skipped: " + e;
}

try
{
	if(input.Functional_Head_Name != null)
	{
		payload.put("functionalHeadId", input.Functional_Head_Name.toString());
	}
}
catch (e)
{
	info "Functional head mapping skipped: " + e;
}

headers = Map();
headers.put("Content-Type","application/json");
headers.put("Authorization","Bearer test123");   // change to production ZOHO_SYNC_API_TOKEN

info "LEARNFLOW LMS SYNC PAYLOAD:";
info payload;

// Retry up to 3 times: the free-tier instance can time out on the first (cold-start) call
response = "";
success = false;
attempt = 1;
while(attempt <= 3 && success == false)
{
	try
	{
		response = invokeurl
		[
			url :lmsUrl
			type :POST
			body:payload.toString()
			headers:headers
		];
		success = true;
	}
	catch (e)
	{
		info "Attempt " + attempt + " failed (likely cold start): " + e;
		attempt = attempt + 1;
	}
}

info "LEARNFLOW LMS SYNC RESPONSE:";
info response;
info "LEARNFLOW EMPLOYEE SYNC END";
return "success";
```

## Detailed go-live steps (production)
Order: (A) live database → (B) live backend → (C) point Zoho at it → (D) live frontend.

### A. Live PostgreSQL database
1. Render → New + → PostgreSQL → name it (e.g. `learnflow-db-prod`) → **paid plan**
   (the free Postgres is deleted after ~30 days) → Create.
2. Open it → copy the **Internal Database URL**.

### B. Live backend web service
1. Render → New + → Web Service → connect this GitHub repo → branch `main`.
2. Root Directory: `backend`
   Build Command: `pip install -r requirements.txt`
   Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   Instance: **paid / always-on** (avoids cold-start timeouts).
3. Environment variables:
   - `DATABASE_URL` = Internal Database URL from step A
   - `ZOHO_SYNC_API_TOKEN` = a strong secret (NOT `test123`)
4. Deploy; confirm logs show `Application startup complete.` +
   `Reference training data loaded successfully.` with no traceback.
5. Note the live backend URL.

### C. Point Zoho at production
1. In the Zoho function, set `lmsUrl` to `<live-backend-url>/api/zoho/employees/sync`.
2. Set the `Authorization` header to `Bearer <ZOHO_SYNC_API_TOKEN>` (same secret as B3).
3. Test: run once → `action:"created"`; run again → `action:"updated"`; set a past
   `dateOfExit` → `status:"Inactive"`.

### D. Live frontend
1. Deploy the `frontend` folder (Render Static Site or Vercel).
2. Set `VITE_API_BASE_URL` = the live backend URL.
3. Build: `npm install && npm run build`; publish `dist`.
4. Log in as L&D and confirm a synced employee shows correct department / BU /
   designation / status.
