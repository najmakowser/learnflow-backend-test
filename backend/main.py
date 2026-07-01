from fastapi import FastAPI, HTTPException, UploadFile, File, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from collections import Counter
import json
import uuid
import os
import shutil
import math
import re

from dotenv import load_dotenv
load_dotenv()

from database import DATA_DIR, get_connection, init_db, hash_password
from seed_data import seed

init_db()
seed()


def backfill_finalized_course_requests_to_catalog():
    """
    One-time backfill: any course_request that is Finalized/Enrolled but has no
    training_id linked (i.e. was finalized before the auto-catalog logic was added)
    gets inserted into the trainings table now.
    """
    conn = get_connection()
    orphans = conn.execute(
        """SELECT * FROM course_requests
           WHERE status IN ('Finalized','Enrolled')
             AND (training_id IS NULL OR training_id = '')"""
    ).fetchall()

    for cr in orphans:
        cr = dict(cr)
        training_id = "TRN" + str(uuid.uuid4())[:6].upper()
        conn.execute(
            """INSERT OR IGNORE INTO trainings
               (training_id, course_name, category, mode, duration, trainer_name,
                seats_available, skill_tags, status, training_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                training_id,
                cr["course_name"],
                cr.get("category") or "",
                cr.get("mode") or "Online",
                cr.get("duration") or "",
                cr.get("trainer_name") or "",
                30,
                cr.get("category") or "",
                "Active",
                cr.get("training_date") or "",
            )
        )
        conn.execute(
            "UPDATE course_requests SET training_id=? WHERE request_id=?",
            (training_id, cr["request_id"])
        )

    if orphans:
        conn.commit()
        print(f"[startup] Backfilled {len(orphans)} finalized course request(s) into training catalog.")
    conn.close()


backfill_finalized_course_requests_to_catalog()

app = FastAPI(title="LMS Registration & Nomination API")

allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://lms-registration-fbls.vercel.app",
]
allowed_origin_regex = r"https://.*\.vercel\.app"

cors_origins_env = os.environ.get("CORS_ALLOW_ORIGINS", "").strip()
if cors_origins_env:
    allowed_origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]

cors_origin_regex_env = os.environ.get("CORS_ALLOW_ORIGIN_REGEX", "").strip()
if cors_origin_regex_env:
    allowed_origin_regex = cors_origin_regex_env

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=allowed_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health_check():
    return {"status": "ok", "service": "LMS Registration & Nomination API"}

# ── Zoho People Employee Sync ────────────────────────────────────────────────

class ZohoEmployeeSyncRequest(BaseModel):
    employeeId: str
    employeeName: str
    email: str
    status: Optional[str] = "Active"
    reportingManagerId: Optional[str] = ""
    reportingManagerEmail: Optional[str] = ""
    functionalHeadId: Optional[str] = ""
    functionalHeadEmail: Optional[str] = ""
    department: Optional[str] = ""
    businessUnit: Optional[str] = ""
    designation: Optional[str] = ""
    dateOfJoining: Optional[str] = ""
    dateOfExit: Optional[str] = ""
    role: Optional[str] = "employee"
    currentSkills: Optional[str] = ""


def ensure_zoho_sync_columns(conn):
    """Adds required Zoho sync columns once. Safe for SQLite local testing."""
    columns = [
        "ALTER TABLE employees ADD COLUMN status TEXT DEFAULT 'Active'",
        "ALTER TABLE employees ADD COLUMN reporting_manager_email TEXT",
        "ALTER TABLE employees ADD COLUMN functional_head_id TEXT",
        "ALTER TABLE employees ADD COLUMN functional_head_email TEXT",
        "ALTER TABLE employees ADD COLUMN date_of_joining TEXT",
        "ALTER TABLE employees ADD COLUMN date_of_exit TEXT",
        "ALTER TABLE employees ADD COLUMN last_synced_from_zoho TEXT",
    ]

    for stmt in columns:
        try:
            conn.execute(stmt)
        except Exception:
            pass


def normalize_employee_status(status: str) -> str:
    value = (status or "").strip().lower()
    if value in ["inactive", "exit", "exited", "terminated", "resigned", "left", "disabled"]:
        return "Inactive"
    return "Active"


def normalize_lms_role(role: str) -> str:
    """Map Zoho/frontend role wording to LMS DB role values."""
    value = (role or "employee").strip().lower()
    role_map = {
        "employee": "employee",
        "reportee": "employee",
        "manager": "manager",
        "reporting_manager": "manager",
        "reporting manager": "manager",
        "functional_head": "functional_head",
        "functional head": "functional_head",
        "fh": "functional_head",
        "ld_admin": "ld_admin",
        "ld_team": "ld_admin",
        "ld team": "ld_admin",
        "ld_manager": "ld_manager",
        "ld manager": "ld_manager",
    }
    return role_map.get(value, "employee")


def find_employee_id_by_email(conn, email: str) -> str:
    email = (email or "").strip().lower()
    if not email:
        return ""
    found = row(conn.execute(
        "SELECT employee_id FROM employees WHERE lower(email)=lower(?) LIMIT 1",
        (email,),
    ))
    return found["employee_id"] if found else ""


def resolve_manager_id(conn, manager_id: str, manager_email: str) -> str:
    """Prefer Zoho manager id. If blank, resolve LMS employee_id from manager email."""
    manager_id = (manager_id or "").strip()
    if manager_id:
        return manager_id
    return find_employee_id_by_email(conn, manager_email)


def sync_update_existing_employee(conn, existing_employee_id: str, payload: ZohoEmployeeSyncRequest, status: str, manager_id: str, functional_head_id: str):
    conn.execute(
        """
        UPDATE employees
        SET
            name=?,
            email=?,
            department=?,
            business_unit=?,
            designation=?,
            manager_id=?,
            current_skills=?,
            role=?,
            status=?,
            reporting_manager_email=?,
            functional_head_id=?,
            functional_head_email=?,
            date_of_joining=?,
            date_of_exit=?,
            last_synced_from_zoho=?
        WHERE employee_id=?
        """,
        (
            payload.employeeName.strip(),
            payload.email.strip().lower(),
            payload.department or "",
            payload.businessUnit or "",
            payload.designation or "",
            manager_id,
            payload.currentSkills or "",
            normalize_lms_role(payload.role),
            status,
            payload.reportingManagerEmail or "",
            functional_head_id,
            payload.functionalHeadEmail or "",
            payload.dateOfJoining or "",
            payload.dateOfExit or "",
            now_str(),
            existing_employee_id,
        ),
    )


def sync_insert_new_employee(conn, payload: ZohoEmployeeSyncRequest, status: str, manager_id: str, functional_head_id: str):
    conn.execute(
        """
        INSERT INTO employees
        (
            employee_id,
            name,
            email,
            department,
            business_unit,
            designation,
            manager_id,
            current_skills,
            role,
            status,
            reporting_manager_email,
            functional_head_id,
            functional_head_email,
            date_of_joining,
            date_of_exit,
            last_synced_from_zoho
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            payload.employeeId.strip(),
            payload.employeeName.strip(),
            payload.email.strip().lower(),
            payload.department or "",
            payload.businessUnit or "",
            payload.designation or "",
            manager_id,
            payload.currentSkills or "",
            normalize_lms_role(payload.role),
            status,
            payload.reportingManagerEmail or "",
            functional_head_id,
            payload.functionalHeadEmail or "",
            payload.dateOfJoining or "",
            payload.dateOfExit or "",
            now_str(),
        ),
    )


@app.post("/api/zoho/employees/sync")
def sync_zoho_employee(
    payload: ZohoEmployeeSyncRequest,
    authorization: Optional[str] = Header(default="")
):
    """
    Real-time employee master sync from Zoho People to LearnFlow LMS.

    Supports:
    - New joiner create
    - Employee detail update
    - Employee exit/inactive update
    - Reporting manager change
    - Functional head change
    - Department / business unit change
    - Real-time manager reportee list through manager_id mapping
    """
    expected_token = os.environ.get("ZOHO_SYNC_API_TOKEN", "").strip()

    # For local testing: if ZOHO_SYNC_API_TOKEN is blank, token check is skipped.
    # For production: set ZOHO_SYNC_API_TOKEN and send Authorization: Bearer <token>.
    if expected_token and authorization != f"Bearer {expected_token}":
        raise HTTPException(status_code=401, detail="Invalid Zoho sync token")

    employee_id = (payload.employeeId or "").strip()
    employee_name = (payload.employeeName or "").strip()
    email = (payload.email or "").strip().lower()

    if not employee_id:
        raise HTTPException(status_code=400, detail="employeeId is required")
    if not employee_name:
        raise HTTPException(status_code=400, detail="employeeName is required")
    if not email:
        raise HTTPException(status_code=400, detail="email is required")

    conn = get_connection()
    ensure_zoho_sync_columns(conn)

    existing = row(
        conn.execute(
            "SELECT * FROM employees WHERE employee_id=? OR lower(email)=lower(?) LIMIT 1",
            (employee_id, email),
        )
    )

    status = normalize_employee_status(payload.status)
    manager_id = resolve_manager_id(conn, payload.reportingManagerId, payload.reportingManagerEmail)
    functional_head_id = resolve_manager_id(conn, payload.functionalHeadId, payload.functionalHeadEmail)

    if existing:
        sync_update_existing_employee(conn, existing["employee_id"], payload, status, manager_id, functional_head_id)
        action = "updated"
        target_employee_id = existing["employee_id"]
    else:
        sync_insert_new_employee(conn, payload, status, manager_id, functional_head_id)
        action = "created"
        target_employee_id = employee_id

    log_action(
        conn,
        "Zoho People Employee Sync",
        "Zoho People",
        "integration",
        target_employee_id,
        "Employee",
        (
            f"Employee {action} from Zoho People sync. "
            f"Status={status}; Manager={manager_id or payload.reportingManagerEmail or 'Not mapped'}; "
            f"FH={functional_head_id or payload.functionalHeadEmail or 'Not mapped'}"
        ),
    )

    conn.commit()
    conn.close()

    return {
        "success": True,
        "action": action,
        "employeeId": target_employee_id,
        "email": email,
        "status": status,
        "managerId": manager_id,
        "functionalHeadId": functional_head_id,
        "message": f"Employee {action} successfully"
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

def rows(cursor) -> list:
    cols = [d[0] for d in cursor.description]
    return [dict(zip(cols, row)) for row in cursor.fetchall()]


def row(cursor) -> Optional[dict]:
    result = rows(cursor)
    return result[0] if result else None


def now_str() -> str:
    return datetime.now().isoformat(sep=' ', timespec='seconds')


def gen_id(prefix: str) -> str:
    return prefix + str(uuid.uuid4())[:6].upper()


def get_azure_openai_client():
    az_key = os.environ.get("AZURE_OPENAI_API_KEY", "")
    az_endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT", "")
    az_deployment = os.environ.get("AZURE_OPENAI_DEPLOYMENT", "gpt-4o")
    az_api_version = os.environ.get("AZURE_OPENAI_API_VERSION", "2024-08-01-preview")

    if not az_key or not az_endpoint or "REPLACE" in az_key:
        return None, None

    from openai import AzureOpenAI

    client = AzureOpenAI(
        api_key=az_key,
        azure_endpoint=az_endpoint,
        api_version=az_api_version,
    )
    return client, az_deployment


def get_anthropic_client():
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key or "REPLACE" in api_key:
        return None
    try:
        import anthropic
        return anthropic.Anthropic(api_key=api_key)
    except ImportError:
        return None


TRAILING_COMMA_PATTERN = re.compile(r",\s*([}\]])")


def _extract_json_candidate(content: str) -> str:
    stripped = (content or "").strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?\s*", "", stripped)
        stripped = re.sub(r"\s*```$", "", stripped)

    start = min((index for index in [stripped.find("{"), stripped.find("[")] if index != -1), default=-1)
    if start == -1:
        return stripped

    left = stripped[start]
    right = "}" if left == "{" else "]"
    depth = 0
    in_string = False
    escape = False
    for index in range(start, len(stripped)):
        char = stripped[index]
        if in_string:
          if escape:
              escape = False
          elif char == "\\":
              escape = True
          elif char == '"':
              in_string = False
          continue
        if char == '"':
            in_string = True
        elif char == left:
            depth += 1
        elif char == right:
            depth -= 1
            if depth == 0:
                return stripped[start:index + 1]
    return stripped[start:]


def _escape_raw_control_chars_in_strings(content: str) -> str:
    pieces = []
    in_string = False
    escape = False
    for char in content:
        if in_string:
            if escape:
                pieces.append(char)
                escape = False
                continue
            if char == "\\":
                pieces.append(char)
                escape = True
                continue
            if char == '"':
                pieces.append(char)
                in_string = False
                continue
            if char == "\n":
                pieces.append("\\n")
                continue
            if char == "\r":
                pieces.append("\\r")
                continue
            if char == "\t":
                pieces.append("\\t")
                continue
            pieces.append(char)
            continue
        pieces.append(char)
        if char == '"':
            in_string = True
    return "".join(pieces)


def parse_llm_json(content: str) -> Optional[dict]:
    if not content:
        return None

    candidate = _extract_json_candidate(content)
    attempts = [candidate]
    attempts.append(TRAILING_COMMA_PATTERN.sub(r"\1", candidate))
    escaped_candidate = _escape_raw_control_chars_in_strings(candidate)
    attempts.append(escaped_candidate)
    attempts.append(TRAILING_COMMA_PATTERN.sub(r"\1", escaped_candidate))

    last_error = None
    for attempt in attempts:
        if not attempt:
            continue
        try:
            return json.loads(attempt)
        except json.JSONDecodeError as exc:
            last_error = exc

    raise ValueError(f"Unable to parse LLM JSON response: {last_error}")


def generate_llm_json(system_prompt: str, user_prompt: str, max_completion_tokens: int = 1200) -> Optional[dict]:
    # Try Anthropic first
    anthropic_client = get_anthropic_client()
    if anthropic_client:
        try:
            model = os.environ.get("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
            message = anthropic_client.messages.create(
                model=model,
                max_tokens=max_completion_tokens,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )
            content = (message.content[0].text or "").strip()
            if content:
                return parse_llm_json(content)
        except Exception:
            pass  # fall through to Azure

    # Fall back to Azure OpenAI
    az_client, deployment = get_azure_openai_client()
    if not az_client:
        return None

    response = az_client.chat.completions.create(
        model=deployment,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        max_completion_tokens=max_completion_tokens,
        temperature=0.4,
        response_format={"type": "json_object"},
    )

    content = (response.choices[0].message.content or "").strip()
    if not content:
        return None
    return parse_llm_json(content)


ROLE_MAP = {
    "ld_admin":        "ld_team",
    "ld_manager":      "ld_manager",
    "functional_head": "functional_head",
    "manager":         "reporting_manager",   # DB "manager" = Reporting Manager in frontend
    "employee":        "employee",
}


REGISTER_ROLE_MAP = {
    # Maps frontend role name (sent during registration) → DB role value
    "reporting_manager": "manager",          # RM selects "Reporting Manager" → stored as "manager" in DB
    "functional_head":   "functional_head",  # FH selects "Functional Head"  → stored as "functional_head" in DB
    "ld_team":           "ld_admin",
    "ld_manager":        "ld_manager",
}


ROLE_ID_PREFIX = {
    "employee": "EMP",
    "manager":  "MGR",
    "ld_admin": "LD",
    "ld_manager": "LD",
}


ROLE_LABELS = {
    "ld_team":          "L&D Team",
    "ld_manager":       "L&D Manager",
    "functional_head":  "Functional Head",
    "reporting_manager":"Reporting Manager",
    "employee":         "Employee",
}


ROLE_COLORS = {
    "ld_team":          ["bg-emerald-600", "bg-teal-600"],
    "ld_manager":       ["bg-violet-700", "bg-purple-700"],
    "functional_head":  ["bg-sky-600", "bg-violet-600", "bg-rose-600", "bg-amber-600"],
    "reporting_manager":["bg-blue-600", "bg-indigo-600", "bg-cyan-600", "bg-teal-600"],
    "employee": [
        "bg-orange-500", "bg-pink-500", "bg-blue-500", "bg-indigo-500", "bg-cyan-500",
        "bg-purple-500", "bg-fuchsia-500", "bg-emerald-500", "bg-teal-500", "bg-violet-500",
        "bg-rose-500", "bg-amber-500", "bg-lime-500", "bg-yellow-600", "bg-pink-600",
        "bg-sky-500", "bg-slate-500", "bg-rose-600", "bg-lime-600", "bg-orange-600",
    ],
}


def log_action(conn, action, performed_by, role, entity_id, entity_type, remarks=""):
    conn.execute(
        "INSERT INTO audit_logs (action,performed_by,role,timestamp,remarks,entity_id,entity_type) VALUES (?,?,?,?,?,?,?)",
        (action, performed_by, role, now_str(), remarks, entity_id, entity_type)
    )


def persist_agent_run(
    agent_key: str,
    agent_label: str,
    input_payload: dict,
    output_payload: dict,
    entity_id: str = "",
    entity_type: str = "",
    trigger_event: str = "",
):
    conn = get_connection()
    conn.execute(
        """INSERT INTO ai_agent_runs
        (agent_key,agent_label,entity_id,entity_type,trigger_event,input_payload,output_payload,created_at)
        VALUES (?,?,?,?,?,?,?,?)""",
        (
            agent_key,
            agent_label,
            entity_id or "",
            entity_type or "",
            trigger_event or "",
            json.dumps(input_payload, ensure_ascii=True),
            json.dumps(output_payload, ensure_ascii=True),
            now_str(),
        ),
    )
    conn.commit()
    conn.close()


def agent_entity_type_from_kind(kind: str) -> str:
    return {
        "registration": "Registration",
        "nomination": "Nomination",
        "course_request": "Course Request",
    }.get(kind, kind or "")


def frontend_role(role: str) -> str:
    return ROLE_MAP.get(role, "employee")


def initials_for(name: str) -> str:
    parts = [part for part in (name or "").split() if part]
    if not parts:
        return "NA"
    return "".join(part[0] for part in parts[:2]).upper()


def avatar_color_for(role: str, employee_id: str) -> str:
    palette = ROLE_COLORS.get(role, ROLE_COLORS["employee"])
    idx = sum(ord(ch) for ch in (employee_id or role)) % len(palette)
    return palette[idx]


def serialize_user(employee: dict) -> dict:
    role = frontend_role(employee.get("role"))
    return {
        "id": employee["employee_id"],
        "employee_id": employee["employee_id"],
        "name": employee["name"],
        "email": employee["email"],
        "department": employee.get("department") or "",
        "business_unit": employee.get("business_unit") or "",
        "manager_id": employee.get("manager_id") or "",
        "designation": employee.get("designation") or "",
        "current_skills": employee.get("current_skills") or "",
        "role": role,
        "roleLabel": ROLE_LABELS[role],
        "initials": initials_for(employee.get("name", "")),
        "avatarColor": avatar_color_for(role, employee.get("employee_id", "")),
        "status": employee.get("status") or "Active",
        "reporting_manager_email": employee.get("reporting_manager_email") or "",
        "functional_head_id": employee.get("functional_head_id") or "",
        "functional_head_email": employee.get("functional_head_email") or "",
        "date_of_joining": employee.get("date_of_joining") or "",
        "date_of_exit": employee.get("date_of_exit") or "",
        "last_synced_from_zoho": employee.get("last_synced_from_zoho") or "",
    }


def serialize_employee(employee: dict) -> dict:
    return {
        "employee_id": employee["employee_id"],
        "name": employee["name"],
        "email": employee["email"],
        "department": employee.get("department") or "",
        "business_unit": employee.get("business_unit") or "",
        "designation": employee.get("designation") or "",
        "manager_id": employee.get("manager_id") or "",
        "current_skills": employee.get("current_skills") or "",
        "role": employee.get("role") or "employee",
        "status": employee.get("status") or "Active",
        "reporting_manager_email": employee.get("reporting_manager_email") or "",
        "functional_head_id": employee.get("functional_head_id") or "",
        "functional_head_email": employee.get("functional_head_email") or "",
        "date_of_joining": employee.get("date_of_joining") or "",
        "date_of_exit": employee.get("date_of_exit") or "",
        "last_synced_from_zoho": employee.get("last_synced_from_zoho") or "",
    }


def next_employee_id(conn, role: str) -> str:
    prefix = ROLE_ID_PREFIX.get(role, "EMP")
    latest = conn.execute(
        "SELECT employee_id FROM employees WHERE employee_id LIKE ? ORDER BY CAST(SUBSTR(employee_id, 4) AS INTEGER) DESC LIMIT 1",
        (f"{prefix}%",),
    ).fetchone()
    next_num = int(latest[0][3:]) + 1 if latest and latest[0][3:].isdigit() else 1
    return f"{prefix}{next_num:03d}"


# ── AI Helpers ────────────────────────────────────────────────────────────────

def ai_suggest_priority(skill_gap: str, business_need: str) -> dict:
    high = ["compliance", "mandatory", "urgent", "critical", "audit", "client", "regulation"]
    medium = ["project", "upcoming", "certification", "skill gap", "deadline"]
    text = (skill_gap + " " + business_need).lower()
    if any(k in text for k in high):
        return {"suggested_priority": "High", "reason": "Compliance/client-critical keywords detected — flagging High priority"}
    if any(k in text for k in medium):
        return {"suggested_priority": "Medium", "reason": "Project-related skill gap — recommending Medium priority"}
    return {"suggested_priority": "Low", "reason": "General upskilling — suggesting Low priority"}


def ai_suggest_course(designation: str, department: str, current_skills: str) -> dict:
    role_map = {
        "developer": ("Advanced Python for Data Science", "Python is foundational for modern development"),
        "devops": ("Cloud Architecture on AWS", "Cloud skills are essential for DevOps roles"),
        "data analyst": ("Power BI & Advanced Analytics", "Analytics visualization is critical for this role"),
        "ml engineer": ("Advanced Python for Data Science", "Python and ML libraries align with this role"),
        "hr": ("Leadership & People Management", "Core competency for HR professionals"),
        "financial analyst": ("Power BI & Advanced Analytics", "Financial dashboards benefit from Power BI"),
        "operations": ("Agile & Scrum Certification Prep", "Agile methods improve operational efficiency"),
    }
    dept_map = {
        "Engineering": ("Agile & Scrum Certification Prep", "Standard methodology for engineering teams"),
        "Data Science": ("Advanced Python for Data Science", "Python is the data science standard"),
        "HR": ("Leadership & People Management", "Core HR leadership competency"),
        "Finance": ("Power BI & Advanced Analytics", "Data-driven finance reporting"),
        "Marketing": ("Power BI & Advanced Analytics", "Marketing analytics and reporting"),
    }
    role_l = designation.lower()
    for k, v in role_map.items():
        if k in role_l:
            return {"course": v[0], "reason": v[1]}
    if department in dept_map:
        v = dept_map[department]
        return {"course": v[0], "reason": v[1]}
    return {"course": "Cybersecurity Fundamentals", "reason": "Recommended for all employees per compliance mandate"}


def ai_suggest_priority_with_llm(skill_gap: str, business_need: str) -> dict:
    fallback = ai_suggest_priority(skill_gap, business_need)

    try:
        result = generate_llm_json(
            "You are an enterprise L&D prioritization assistant. Return JSON only.",
            f"""Assess the nomination priority for the learning request below.

Skill gap:
{skill_gap or 'Not provided'}

Business need:
{business_need or 'Not provided'}

Return JSON in this shape only:
{{
  \"suggested_priority\": \"High|Medium|Low\",
  \"reason\": \"One concise business-focused sentence\"
}}

Rules:
- Choose High only for urgent compliance, audit, production-critical, customer-critical, or immediate delivery risk.
- Choose Medium for meaningful project delivery, certification, or role-readiness gaps.
- Choose Low for broad upskilling with no immediate business risk.
- Keep the reason under 25 words.
""",
        )
    except Exception:
        return fallback

    if not isinstance(result, dict):
        return fallback

    suggested_priority = str(result.get("suggested_priority", "")).strip().title()
    reason = str(result.get("reason", "")).strip()

    if suggested_priority not in {"High", "Medium", "Low"} or not reason:
        return fallback

    return {"suggested_priority": suggested_priority, "reason": reason}


def ai_suggest_course_with_llm(designation: str, department: str, current_skills: str) -> dict:
    fallback = ai_suggest_course(designation, department, current_skills)

    conn = get_connection()
    training_rows = rows(conn.execute("SELECT course_name, category, skill_tags, mode FROM trainings WHERE status='Active' ORDER BY course_name"))
    conn.close()

    training_catalog = [
        {
            "course_name": training["course_name"],
            "category": training.get("category") or "",
            "skill_tags": training.get("skill_tags") or "",
            "mode": training.get("mode") or "",
        }
        for training in training_rows
    ]

    if not training_catalog:
        return fallback

    try:
        result = generate_llm_json(
            "You are an LMS course recommendation assistant. Return JSON only.",
            f"""Recommend one best-fit course from the available catalog.

Employee designation:
{designation or 'Not provided'}

Department:
{department or 'Not provided'}

Current skills:
{current_skills or 'Not provided'}

Available catalog:
{json.dumps(training_catalog)}

Return JSON in this shape only:
{{
  \"course\": \"exact course_name from the catalog\",
  \"reason\": \"One concise sentence explaining the fit\"
}}

Rules:
- The course value must exactly match one catalog course_name.
- Prefer the most role-relevant and immediately useful option.
- Keep the reason under 30 words.
""",
        )
    except Exception:
        return fallback

    if not isinstance(result, dict):
        return fallback

    course = str(result.get("course", "")).strip()
    reason = str(result.get("reason", "")).strip()
    valid_courses = {training["course_name"] for training in training_catalog}

    if course not in valid_courses or not reason:
        return fallback

    return {"course": course, "reason": reason}


TOKEN_PATTERN = re.compile(r"[a-z0-9]+")

# Common English stop words — excluded from similarity matching to reduce noise
STOP_WORDS = {
    "and", "or", "the", "a", "an", "of", "for", "in", "on", "to", "with",
    "at", "by", "from", "as", "is", "are", "was", "be", "it", "its",
    "this", "that", "which", "their", "how", "what", "we", "our",
}


def tokenize_text(value: str) -> List[str]:
    return TOKEN_PATTERN.findall((value or "").lower())


def tokenize_no_stop(value: str) -> List[str]:
    return [t for t in tokenize_text(value) if t not in STOP_WORDS and len(t) > 1]


def normalize_org_value(value: str) -> str:
    return "".join(tokenize_text(value))


def cosine_similarity_from_tokens(left_tokens: List[str], right_tokens: List[str]) -> float:
    if not left_tokens or not right_tokens:
        return 0.0
    left_counts = Counter(left_tokens)
    right_counts = Counter(right_tokens)
    common = set(left_counts) & set(right_counts)
    numerator = sum(left_counts[token] * right_counts[token] for token in common)
    left_norm = math.sqrt(sum(value * value for value in left_counts.values()))
    right_norm = math.sqrt(sum(value * value for value in right_counts.values()))
    if not left_norm or not right_norm:
        return 0.0
    return numerator / (left_norm * right_norm)


def training_text(training: dict) -> str:
    return " ".join([
        training.get("course_name") or "",
        training.get("category") or "",
        training.get("skill_tags") or "",
        training.get("trainer_name") or "",
    ])


def training_matches_for_request(course_name: str, business_need: str, skill_gap: str, limit: int = 5) -> List[dict]:
    conn = get_connection()
    trainings = rows(conn.execute("SELECT * FROM trainings WHERE status='Active' ORDER BY course_name"))
    conn.close()

    # Separate token sets — course name gets 3x weight so an exact name match dominates
    name_tokens   = tokenize_no_stop(course_name) * 3
    content_tokens = tokenize_no_stop(" ".join([business_need, skill_gap]))
    query_tokens  = name_tokens + content_tokens

    matches = []
    for training in trainings:
        catalog_name_tokens    = tokenize_no_stop(training.get("course_name") or "")
        catalog_content_tokens = tokenize_no_stop(" ".join([
            training.get("category") or "",
            training.get("skill_tags") or "",
        ]))
        catalog_tokens = catalog_name_tokens + catalog_content_tokens

        # Primary score: full weighted query vs full catalog entry
        score = cosine_similarity_from_tokens(query_tokens, catalog_tokens)

        # Boost: direct course-name-to-course-name comparison
        if name_tokens and catalog_name_tokens:
            name_score = cosine_similarity_from_tokens(
                tokenize_no_stop(course_name),
                catalog_name_tokens,
            )
            score = max(score, name_score * 0.9)  # name match can carry up to 90% alone

        if score <= 0:
            continue
        matches.append({
            "training_id": training["training_id"],
            "course_name": training["course_name"],
            "category": training.get("category") or "",
            "trainer_name": training.get("trainer_name") or "",
            "mode": training.get("mode") or "",
            "skill_tags": training.get("skill_tags") or "",
            "similarity": round(min(score, 1.0), 3),
        })
    return sorted(matches, key=lambda item: item["similarity"], reverse=True)[:limit]


def learning_need_analysis_fallback(team_domain: str, business_need: str, skill_gap: str, course_name: str) -> dict:
    priority = ai_suggest_priority(skill_gap, business_need)
    title = course_name or "Requested training"
    objective_source = business_need or skill_gap or f"Address the need for {title}"
    gaps = [part.strip() for part in re.split(r"[\n,;]+", skill_gap or "") if part.strip()][:3]
    if not gaps:
        gaps = [f"Capability uplift required for {title}"]
    objectives = [
        f"Enable {team_domain or 'the requesting team'} to apply {title.lower()} in current work.",
        f"Address the core business driver: {objective_source.strip()[:120]}",
    ]
    score_map = {"High": 90, "Medium": 65, "Low": 35}
    return {
        "priority": priority["suggested_priority"],
        "priority_score": score_map.get(priority["suggested_priority"], 50),
        "priority_reason": priority["reason"],
        "key_objectives": objectives,
        "skill_gaps": gaps,
    }


def analyze_learning_need_with_llm(team_domain: str, business_need: str, skill_gap: str, course_name: str) -> dict:
    fallback = learning_need_analysis_fallback(team_domain, business_need, skill_gap, course_name)
    try:
        result = generate_llm_json(
            "You are a learning need analysis agent for enterprise training operations. Return JSON only.",
            f"""Analyze this training request.

Team or domain:
{team_domain or 'Not provided'}

Course requested:
{course_name or 'Not provided'}

Business need:
{business_need or 'Not provided'}

Skill gap:
{skill_gap or 'Not provided'}

Return JSON in this shape only:
{{
  \"priority\": \"High|Medium|Low\",
  \"priority_score\": 0,
  \"priority_reason\": \"one concise sentence\",
  \"key_objectives\": [\"...\", \"...\"],
  \"skill_gaps\": [\"...\", \"...\"]
}}

Rules:
- priority_score must be an integer from 0 to 100.
- key_objectives should have 2 or 3 short items.
- skill_gaps should have 2 or 3 short items.
""",
        )
    except Exception:
        return fallback

    if not isinstance(result, dict):
        return fallback

    priority = str(result.get("priority", "")).strip().title()
    score = result.get("priority_score", 0)
    reason = str(result.get("priority_reason", "")).strip()
    objectives = [str(item).strip() for item in (result.get("key_objectives") or []) if str(item).strip()]
    gaps = [str(item).strip() for item in (result.get("skill_gaps") or []) if str(item).strip()]
    if priority not in {"High", "Medium", "Low"} or not isinstance(score, int) or not reason or not objectives:
        return fallback
    return {
        "priority": priority,
        "priority_score": max(0, min(score, 100)),
        "priority_reason": reason,
        "key_objectives": objectives[:3],
        "skill_gaps": gaps[:3] or fallback["skill_gaps"],
    }


def recommend_course_path_with_llm(course_name: str, business_need: str, skill_gap: str) -> dict:
    matches = training_matches_for_request(course_name, business_need, skill_gap, limit=3)
    has_good_match = bool(matches and matches[0]["similarity"] >= 0.35)
    fallback_decision = "reuse_existing" if has_good_match else "create_new"
    fallback = {
        "decision": fallback_decision,
        "reason": "Closest current catalog matches were evaluated against the requested business need and skill gap.",
        "catalog_has_good_match": has_good_match,
        "top_matches": matches,
        "suggested_objectives": [],
        "priority_assessment": "Medium",
        "next_steps": [],
    }
    try:
        result = generate_llm_json(
            "You are a course recommendation agent. Decide whether to reuse an existing catalog course or create a new one. Return JSON only.",
            f"""Requested course: {course_name or 'Not provided'}
Business need: {business_need or 'Not provided'}
Skill gap: {skill_gap or 'Not provided'}
Top catalog matches (with similarity scores): {json.dumps(matches)}

Return ONLY this JSON shape:
{{
  "decision": "reuse_existing or create_new",
  "reason": "one concise sentence explaining the decision",
  "catalog_has_good_match": true or false,
  "recommended_training_id": "training id if reusing, else empty string",
  "suggested_objectives": ["objective 1", "objective 2", "objective 3"],
  "priority_assessment": "High, Medium, or Low",
  "next_steps": ["step 1", "step 2", "step 3"]
}}
""",
        )
    except Exception:
        return fallback

    if not isinstance(result, dict):
        return fallback
    decision = str(result.get("decision", "")).strip().lower()
    reason = str(result.get("reason", "")).strip()
    if decision not in {"reuse_existing", "create_new"} or not reason:
        return fallback
    training_id = str(result.get("recommended_training_id", "")).strip()
    resolved_matches = matches
    if decision == "reuse_existing" and training_id:
        resolved_matches = sorted(matches, key=lambda m: m["training_id"] != training_id)
    catalog_good = result.get("catalog_has_good_match")
    if not isinstance(catalog_good, bool):
        catalog_good = has_good_match
    return {
        "decision": decision,
        "reason": reason,
        "catalog_has_good_match": catalog_good,
        "top_matches": resolved_matches,
        "suggested_objectives": result.get("suggested_objectives", []) if isinstance(result.get("suggested_objectives"), list) else [],
        "priority_assessment": str(result.get("priority_assessment", "Medium")).strip(),
        "next_steps": result.get("next_steps", []) if isinstance(result.get("next_steps"), list) else [],
    }


def recommend_trainers_with_llm(course_name: str, category: str, skill_gap: str) -> dict:
    conn = get_connection()
    trainings = rows(conn.execute("SELECT course_name, category, trainer_name, skill_tags, mode FROM trainings WHERE status='Active' ORDER BY course_name"))
    conn.close()
    trainers = []
    trainer_map = {}
    request_tokens = tokenize_text(" ".join([course_name, category, skill_gap]))
    for training in trainings:
        trainer_name = (training.get("trainer_name") or "").strip()
        if not trainer_name:
            continue
        score = cosine_similarity_from_tokens(request_tokens, tokenize_text(training_text(training)))
        existing = trainer_map.get(trainer_name)
        entry = {
            "trainer_name": trainer_name,
            "score": round(score, 3),
            "based_on_course": training.get("course_name") or "",
            "category": training.get("category") or "",
            "mode": training.get("mode") or "",
        }
        if not existing or entry["score"] > existing["score"]:
            trainer_map[trainer_name] = entry
    trainers = sorted(trainer_map.values(), key=lambda item: item["score"], reverse=True)[:5]
    fallback = {
        "recommendations": [
            {
                "trainer_name": trainer["trainer_name"],
                "fit_score": int(round(trainer["score"] * 100)),
                "reason": f"Previously aligned with {trainer['based_on_course']} in {trainer['category']}.",
            }
            for trainer in trainers[:3]
        ]
    }
    try:
        result = generate_llm_json(
            "You are a trainer recommendation agent. Rank trainers for the curriculum request. Return JSON only.",
            f"""Requested course:
{course_name or 'Not provided'}

Category:
{category or 'Not provided'}

Skill gap:
{skill_gap or 'Not provided'}

Candidate trainers:
{json.dumps(trainers)}

Return JSON in this shape only:
{{
  \"recommendations\": [
    {{ \"trainer_name\": \"\", \"fit_score\": 0, \"reason\": \"\" }}
  ]
}}

Rules:
- Return up to 3 recommendations.
- fit_score must be 0 to 100.
""",
        )
    except Exception:
        return fallback
    if not isinstance(result, dict) or not isinstance(result.get("recommendations"), list):
        return fallback
    cleaned = []
    known = {trainer["trainer_name"] for trainer in trainers}
    for item in result["recommendations"]:
        trainer_name = str(item.get("trainer_name", "")).strip()
        reason = str(item.get("reason", "")).strip()
        fit_score = item.get("fit_score", 0)
        if trainer_name in known and isinstance(fit_score, int) and reason:
            cleaned.append({"trainer_name": trainer_name, "fit_score": max(0, min(fit_score, 100)), "reason": reason})
    return {"recommendations": cleaned[:3] or fallback["recommendations"]}


def level_score(level: str) -> int:
    return {"beginner": 1, "intermediate": 2, "advanced": 3, "expert": 4}.get((level or "").lower(), 0)


def recommend_participants_for_request(request_kind: str, request_id: str, limit: int = 5) -> dict:
    conn = get_connection()
    if request_kind == "nomination":
        item = row(conn.execute("SELECT * FROM nomination_requests WHERE nomination_id=?", (request_id,)))
        if not item:
            conn.close()
            raise HTTPException(status_code=404, detail="Nomination request not found")
        department = item.get("department") or ""
        business_unit = item.get("business_unit") or ""
        manager_id = item.get("manager_id") or ""
        course_name = item.get("course_name") or ""
        skill_gap = item.get("skill_gap") or item.get("business_need") or ""
        existing_ids = {part["employee_id"] for part in rows(conn.execute("SELECT employee_id FROM nomination_participants WHERE nomination_id=?", (request_id,)))}
    elif request_kind == "course_request":
        item = row(conn.execute("SELECT * FROM course_requests WHERE request_id=?", (request_id,)))
        if not item:
            conn.close()
            raise HTTPException(status_code=404, detail="Course request not found")
        department = item.get("department") or ""
        business_unit = item.get("business_unit") or ""
        manager_id = item.get("manager_id") or ""
        course_name = item.get("course_name") or ""
        skill_gap = item.get("skill_gap") or item.get("business_need") or ""
        existing_ids = set()
    else:
        conn.close()
        raise HTTPException(status_code=400, detail="Unsupported request kind")

    training = row(conn.execute("SELECT * FROM trainings WHERE lower(course_name)=lower(?) LIMIT 1", (course_name,)))
    manager_scoped = rows(conn.execute(
        """SELECT * FROM employees
        WHERE role='employee'
          AND COALESCE(status,'Active')='Active'
          AND (?='' OR manager_id=?)
          AND (?='' OR department=?)
          AND (?='' OR business_unit=?)""",
        (manager_id, manager_id, department, department, business_unit, business_unit),
    ))

    employees = manager_scoped
    if not employees:
        fallback_pool = rows(conn.execute("SELECT * FROM employees WHERE role='employee' AND COALESCE(status,'Active')='Active'"))
        normalized_department = normalize_org_value(department)
        normalized_business_unit = normalize_org_value(business_unit)
        employees = [
            employee for employee in fallback_pool
            if (
                (normalized_department and normalize_org_value(employee.get("department") or "") == normalized_department)
                or (normalized_business_unit and normalize_org_value(employee.get("business_unit") or "") == normalized_business_unit)
            )
        ]
    conn.close()

    course_tokens = tokenize_text(" ".join([course_name, training.get("skill_tags", "") if training else "", skill_gap]))
    ranked = []
    for employee in employees:
        if employee["employee_id"] in existing_ids:
            continue
        skill_tokens = tokenize_text(employee.get("current_skills") or "")
        overlap = cosine_similarity_from_tokens(course_tokens, skill_tokens)
        gap_score = 1 - overlap
        ranked.append({
            "employee_id": employee["employee_id"],
            "employee_name": employee["name"],
            "email": employee["email"],
            "department": employee.get("department") or "",
            "designation": employee.get("designation") or "",
            "business_unit": employee.get("business_unit") or "",
            "current_skills": employee.get("current_skills") or "",
            "fit_score": int(round(gap_score * 100)),
            "reason": f"Current skills suggest meaningful headroom against the requested capability profile for {course_name}.",
        })
    ranked = sorted(ranked, key=lambda item: item["fit_score"], reverse=True)[:limit]
    return {"recommendations": ranked}


def run_registration_automation(request_type: str, request_id: str, performed_by: str = "Automation Agent") -> dict:
    conn = get_connection()
    if request_type == "registration":
        registration = row(conn.execute("SELECT * FROM registration_requests WHERE request_id=?", (request_id,)))
        if not registration:
            conn.close()
            raise HTTPException(status_code=404, detail="Registration not found")
        conn.execute("UPDATE registration_requests SET confirmation_sent=1 WHERE request_id=?", (request_id,))
        log_action(conn, "Registration Automation Executed", performed_by, "AI Agent", request_id, "Registration", "Enrollment email and meeting details prepared")
        payload = {
            "emails_sent": 1,
            "teams_notifications": 1,
            "enrollment_links": [f"https://lms.local/enroll/{request_id}"],
            "message": f"Enrollment automation completed for {registration['employee_name']}",
        }
    elif request_type == "nomination":
        participants = rows(conn.execute("SELECT * FROM nomination_participants WHERE nomination_id=?", (request_id,)))
        if not participants:
            conn.close()
            raise HTTPException(status_code=404, detail="Nomination participants not found")
        conn.execute("UPDATE nomination_participants SET confirmation_sent=1 WHERE nomination_id=?", (request_id,))
        log_action(conn, "Registration Automation Executed", performed_by, "AI Agent", request_id, "Nomination", f"Enrollment messages prepared for {len(participants)} participants")
        payload = {
            "emails_sent": len(participants),
            "teams_notifications": len(participants),
            "enrollment_links": [f"https://lms.local/enroll/{request_id}/{index + 1}" for index, _ in enumerate(participants)],
            "message": f"Enrollment automation completed for {len(participants)} nominated participants",
        }
    else:
        conn.close()
        raise HTTPException(status_code=400, detail="Unsupported request type")
    conn.commit()
    conn.close()
    return payload


def run_reminder_agent(performed_by: str = "Reminder Agent") -> dict:
    conn = get_connection()
    participants = get_participants()
    reminders = []
    today = datetime.now().date()
    for participant in participants:
        training_date = participant.get("training_date")
        if not training_date:
            continue
        try:
            scheduled = datetime.fromisoformat(training_date).date()
        except ValueError:
            continue
        days_remaining = (scheduled - today).days
        if days_remaining in {7, 3, 0}:
            window = "7-day" if days_remaining == 7 else "3-day" if days_remaining == 3 else "day-of"
            reminders.append({
                "employee_name": participant["employee_name"],
                "email": participant["email"],
                "course_name": participant["course_name"],
                "window": window,
                "days_remaining": days_remaining,
            })
    if reminders:
        log_action(conn, "Reminder Agent Executed", performed_by, "AI Agent", f"RMD{len(reminders):03d}", "Reminder Batch", f"Triggered {len(reminders)} reminder(s)")
    conn.commit()
    conn.close()
    return {
        "reminder_count": len(reminders),
        "reminders": reminders,
        "message": f"Prepared {len(reminders)} scheduled reminder(s)",
    }


# ── Pydantic Models ───────────────────────────────────────────────────────────

class RegistrationCreate(BaseModel):
    employee_id: str
    employee_name: str
    email: str
    department: str
    business_unit: str
    designation: str
    reporting_manager: str
    training_id: str
    course_name: str
    training_mode: str
    preferred_batch: str
    training_date: str
    reason: str
    expected_outcome: str


class ParticipantIn(BaseModel):
    employee_id: str
    employee_name: str
    email: str
    department: str
    current_skill_level: str
    required_skill_level: str
    nomination_reason: str


class NominationCreate(BaseModel):
    manager_id: str
    manager_name: str
    manager_email: str
    department: str
    business_unit: str
    training_id: str
    course_name: str
    business_need: str
    skill_gap: Optional[str] = ''
    priority: str
    training_date: Optional[str] = None
    target_completion_date: Optional[str] = None
    participants: List[ParticipantIn] = []
    fh_id: Optional[str] = None
    fh_name: Optional[str] = None
    requested_by_fh: Optional[bool] = False


class ActionBody(BaseModel):
    performed_by: str
    role: str
    remarks: Optional[str] = ""


class FileData(BaseModel):
    name: str
    data: str  # base64
    mime: Optional[str] = ""

class CurriculumUpload(BaseModel):
    performed_by: str
    role: str
    curriculum_title: str
    curriculum_outline: Optional[str] = ""
    curriculum_link: Optional[str] = ""
    file_data: Optional[FileData] = None


class AddParticipantsBody(BaseModel):
    performed_by: str
    role: str
    participants: List[ParticipantIn]


class LoginRequest(BaseModel):
    email: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class RegisterRequest(BaseModel):
    role: Optional[str] = ""
    employee_id: Optional[str] = ""
    name: str
    email: str
    department: str
    business_unit: Optional[str] = ""
    designation: Optional[str] = ""
    password: str
    current_skills: Optional[str] = ""
    manager_id: Optional[str] = ""


class AssignBody(BaseModel):
    performed_by: str
    role: str
    assigned_to_id: str
    assigned_to_name: str
    remarks: Optional[str] = ""


class RegistrationLookupRequest(BaseModel):
    employee_id: Optional[str] = ""
    name: Optional[str] = ""
    email: Optional[str] = ""


def registration_role_allowed(role: str) -> bool:
    return role in {"manager", "ld_admin", "ld_manager", "functional_head"}


def find_registration_roster_user(conn, employee_id: str = "", email: str = ""):
    employee_id = (employee_id or "").strip()
    email = (email or "").strip().lower()
    if employee_id and email:
        employee = row(
            conn.execute(
                "SELECT * FROM employees WHERE employee_id=? AND lower(email)=lower(?) AND COALESCE(status,'Active')='Active'",
                (employee_id, email),
            )
        )
        if employee and registration_role_allowed(employee.get("role") or ""):
            return employee
        return None
    if employee_id:
        employee = row(conn.execute("SELECT * FROM employees WHERE employee_id=?", (employee_id,)))
        if employee and registration_role_allowed(employee.get("role") or ""):
            return employee
        return None
    if email:
        employee = row(conn.execute("SELECT * FROM employees WHERE lower(email)=lower(?)", (email,)))
        if employee and registration_role_allowed(employee.get("role") or ""):
            return employee
        return None
    return None


# ── Authentication ────────────────────────────────────────────────────────────

@app.post("/api/auth/registration-profile")
def registration_profile_lookup(payload: RegistrationLookupRequest):
    employee_id = (payload.employee_id or "").strip()
    email = (payload.email or "").strip().lower()
    name = (payload.name or "").strip()
    if not employee_id and not email:
        raise HTTPException(status_code=400, detail="Employee ID or work email is required")

    conn = get_connection()
    employee = find_registration_roster_user(conn, employee_id, email)
    conn.close()
    if not employee:
        raise HTTPException(status_code=404, detail="No approved manager or L&D dataset record matches these details")

    if name:
        normalized_name = re.sub(r"\s+", " ", name).strip().lower()
        roster_name = re.sub(r"\s+", " ", (employee.get("name") or "")).strip().lower()
        if normalized_name != roster_name:
            raise HTTPException(status_code=400, detail="Name does not match the approved dataset record")

    profile = serialize_employee(employee)
    profile["role"] = frontend_role(employee.get("role"))
    profile["roleLabel"] = ROLE_LABELS[profile["role"]]
    profile["activated"] = bool(employee.get("password_hash"))
    return profile

@app.post("/api/auth/login")
def login(payload: LoginRequest):
    conn = get_connection()
    employee = row(
        conn.execute(
            "SELECT * FROM employees WHERE lower(email)=lower(?)",
            (payload.email.strip().lower(),),
        )
    )
    conn.close()

    if employee and employee.get("role") == "employee":
        raise HTTPException(status_code=403, detail="Employees do not have portal access.")

    if employee and (employee.get("status") or "Active") != "Active":
        raise HTTPException(status_code=403, detail="This account is inactive in Zoho People/LMS.")

    if employee and not employee.get("password_hash"):
        raise HTTPException(status_code=403, detail="This dataset account is not activated yet. Use Register to set your password first.")

    if not employee or employee.get("password_hash") != hash_password(payload.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return {"user": serialize_user(employee)}


@app.post("/api/auth/register")
def register(payload: RegisterRequest):
    requested_role = REGISTER_ROLE_MAP.get((payload.role or "").strip()) if payload.role else None
    employee_id = (payload.employee_id or "").strip()
    email = payload.email.strip().lower()
    name = payload.name.strip()
    department = payload.department.strip()
    password = payload.password.strip()

    if not employee_id or not name or not email or not department or not password:
        raise HTTPException(status_code=400, detail="Employee ID, name, email, department, and password are required")

    conn = get_connection()
    roster_user = find_registration_roster_user(conn, employee_id, email)
    if not roster_user:
        conn.close()
        raise HTTPException(status_code=403, detail="These details are not part of the approved manager or L&D registration dataset")

    inferred_role = frontend_role(roster_user.get("role") or "")
    if requested_role and requested_role != roster_user.get("role"):
        conn.close()
        raise HTTPException(status_code=400, detail="Selected role does not match the approved dataset record")

    normalized_name = re.sub(r"\s+", " ", name).strip().lower()
    roster_name = re.sub(r"\s+", " ", (roster_user.get("name") or "")).strip().lower()
    if normalized_name != roster_name:
        conn.close()
        raise HTTPException(status_code=400, detail="Name does not match the approved dataset record for this email")

    normalized_department = normalize_org_value(department)
    roster_department = normalize_org_value(roster_user.get("department") or "")
    if normalized_department and roster_department and normalized_department != roster_department:
        conn.close()
        raise HTTPException(status_code=400, detail="Department does not match the approved dataset record for this email")

    if roster_user.get("password_hash"):
        conn.close()
        raise HTTPException(status_code=409, detail="This account is already registered. Sign in with your existing credentials or use forgot password.")

    conn.execute(
        "UPDATE employees SET password_hash=? WHERE employee_id=?",
        (hash_password(password), roster_user["employee_id"]),
    )
    employee = row(conn.execute("SELECT * FROM employees WHERE employee_id=?", (roster_user["employee_id"],)))
    log_action(conn, "Account Registered", employee["name"], ROLE_LABELS[inferred_role], employee["employee_id"], "Employee", f"Dataset-backed portal registration completed for {ROLE_LABELS[inferred_role]}")
    conn.commit()
    conn.close()

    return {
        "message": "Account activated successfully. Sign in with your new credentials.",
        "user": serialize_user(employee),
    }


@app.post("/api/auth/forgot-password")
def forgot_password(payload: ForgotPasswordRequest):
    conn = get_connection()
    conn.close()

    return {
        "success": True,
        "message": "If the account exists, a reset request has been recorded. Contact L&D support to reset the password in this demo environment.",
    }


# ── Dashboard ─────────────────────────────────────────────────────────────────

@app.get("/api/dashboard")
def get_dashboard():
    conn = get_connection()
    c = conn.cursor()

    reg_total = c.execute("SELECT COUNT(*) FROM registration_requests").fetchone()[0]
    nom_total = c.execute("SELECT COUNT(*) FROM nomination_requests").fetchone()[0]

    pending_ld = (
        c.execute("SELECT COUNT(*) FROM registration_requests WHERE status='Pending L&D Validation'").fetchone()[0] +
        c.execute("SELECT COUNT(*) FROM nomination_requests WHERE status='Pending L&D Validation'").fetchone()[0] +
        c.execute("SELECT COUNT(*) FROM course_requests WHERE status='Pending L&D Validation'").fetchone()[0]
    )
    pending_ld_manager_review = (
        c.execute("SELECT COUNT(*) FROM nomination_requests WHERE status='Pending L&D Manager Review'").fetchone()[0] +
        c.execute("SELECT COUNT(*) FROM course_requests WHERE status='Pending L&D Manager Review'").fetchone()[0]
    )
    pending_mgr = (
        c.execute("SELECT COUNT(*) FROM registration_requests WHERE status='Pending Manager Approval'").fetchone()[0] +
        c.execute("SELECT COUNT(*) FROM nomination_requests WHERE status='Pending Manager Approval'").fetchone()[0]
    )
    approved = (
        c.execute("SELECT COUNT(*) FROM registration_requests WHERE status='Approved'").fetchone()[0] +
        c.execute("SELECT COUNT(*) FROM nomination_requests WHERE status='Approved'").fetchone()[0]
    )
    rejected = (
        c.execute("SELECT COUNT(*) FROM registration_requests WHERE status='Rejected'").fetchone()[0] +
        c.execute("SELECT COUNT(*) FROM nomination_requests WHERE status='Rejected'").fetchone()[0]
    )

    status_dist = {}
    for r in c.execute("SELECT status FROM registration_requests").fetchall():
        status_dist[r[0]] = status_dist.get(r[0], 0) + 1
    for r in c.execute("SELECT status FROM nomination_requests").fetchall():
        status_dist[r[0]] = status_dist.get(r[0], 0) + 1

    course_regs = {}
    for r in c.execute("SELECT course_name FROM registration_requests").fetchall():
        course_regs[r[0]] = course_regs.get(r[0], 0) + 1

    dept_noms = {}
    for r in c.execute("SELECT department FROM nomination_requests").fetchall():
        dept_noms[r[0]] = dept_noms.get(r[0], 0) + 1

    upcoming = rows(c.execute(
        "SELECT training_id, course_name, mode, trainer_name, seats_available, training_date "
        "FROM trainings WHERE status='Active' AND training_date >= date('now') "
        "ORDER BY training_date ASC LIMIT 3"
    ))

    conn.close()
    return {
        "total_requests": reg_total + nom_total,
        "self_registrations": reg_total,
        "manager_nominations": nom_total,
        "pending_ld_validation": pending_ld,
        "pending_ld_manager_review": pending_ld_manager_review,
        "pending_manager_approval": pending_mgr,
        "approved": approved,
        "rejected": rejected,
        "status_distribution": status_dist,
        "course_registrations": course_regs,
        "department_nominations": dept_noms,
        "upcoming_trainings": upcoming,
    }


# ── Employees ─────────────────────────────────────────────────────────────────

@app.get("/api/employees")
def get_employees(include_inactive: bool = False):
    conn = get_connection()
    ensure_zoho_sync_columns(conn)

    if include_inactive:
        query = "SELECT * FROM employees ORDER BY name"
    else:
        query = "SELECT * FROM employees WHERE COALESCE(status,'Active')='Active' ORDER BY name"

    result = [serialize_employee(employee) for employee in rows(conn.execute(query))]
    conn.close()
    return result


@app.get("/api/employees/{manager_id}/reportees")
def get_manager_reportees(manager_id: str, include_inactive: bool = False):
    conn = get_connection()
    ensure_zoho_sync_columns(conn)

    if include_inactive:
        result = rows(conn.execute(
            """
            SELECT * FROM employees
            WHERE manager_id=?
            ORDER BY name
            """,
            (manager_id,)
        ))
    else:
        result = rows(conn.execute(
            """
            SELECT * FROM employees
            WHERE manager_id=?
              AND COALESCE(status,'Active')='Active'
            ORDER BY name
            """,
            (manager_id,)
        ))

    conn.close()
    return [serialize_employee(employee) for employee in result]

@app.get("/api/employees/ld-team")
def get_ld_team_members():
    """Return all active L&D team members (role=ld_admin) for assignment by the L&D Manager."""
    conn = get_connection()
    result = [serialize_employee(e) for e in rows(conn.execute(
        "SELECT * FROM employees WHERE role='ld_admin' AND COALESCE(status,'Active')='Active' ORDER BY name"
    ))]
    conn.close()
    return result


@app.get("/api/employees/{employee_id}/my-nominations")
def get_my_nominations(employee_id: str):
    conn = get_connection()
    result = rows(conn.execute("""
        SELECT np.*, nr.course_name, nr.status as nomination_status, nr.submitted_date,
               nr.ld_validated_date, nr.manager_approved_date, nr.ld_remarks,
               nr.manager_remarks, nr.manager_name, nr.department as nom_department,
               nr.training_id, nr.business_need, nr.curriculum_title, nr.curriculum_link
        FROM nomination_participants np
        JOIN nomination_requests nr ON np.nomination_id = nr.nomination_id
        WHERE np.employee_id = ?
        ORDER BY nr.submitted_date DESC
    """, (employee_id,)))
    conn.close()
    return result


@app.get("/api/employees/{employee_id}/managed-domains")
def get_managed_domains(employee_id: str):
    """Return distinct departments managed under a Functional Head, with their reporting managers."""
    conn = get_connection()
    # Managers who report to this FH have manager_id = fh.employee_id
    managers = rows(conn.execute(
        """SELECT employee_id, name, email, department, business_unit
        FROM employees
        WHERE role='manager'
          AND manager_id=?
          AND COALESCE(status,'Active')='Active'
        ORDER BY name""",
        (employee_id,)
    ))
    conn.close()

    # Deduplicate by department, collecting manager names
    dept_map = {}
    for m in managers:
        dept = m.get("department") or m.get("business_unit") or "General"
        if dept not in dept_map:
            dept_map[dept] = {
                "department": dept,
                "manager_name": m["name"],
                "manager_id": m["employee_id"],
                "manager_email": m.get("email", ""),
            }
        else:
            dept_map[dept]["manager_name"] += f", {m['name']}"

    return list(dept_map.values())


@app.get("/api/employees/{employee_id}")
def get_employee(employee_id: str):
    conn = get_connection()
    ensure_zoho_sync_columns(conn)
    emp = row(conn.execute("SELECT * FROM employees WHERE employee_id=?", (employee_id,)))
    conn.close()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    return serialize_employee(emp)


# ── Trainings ─────────────────────────────────────────────────────────────────

@app.get("/api/trainings")
def get_trainings():
    conn = get_connection()
    result = rows(conn.execute("SELECT * FROM trainings"))
    conn.close()
    return result


@app.get("/api/trainings/seat-counts")
def get_seat_counts():
    """Return {training_id: enrolled_count} — counts all finalized participants."""
    conn = get_connection()

    # Nomination participants from finalized/enrolled nominations
    nom_rows = conn.execute("""
        SELECT nr.training_id, COUNT(np.id) AS cnt
        FROM nomination_participants np
        JOIN nomination_requests nr ON np.nomination_id = nr.nomination_id
        WHERE nr.training_id IS NOT NULL AND nr.training_id != ''
          AND nr.status IN ('Finalized', 'Enrolled')
        GROUP BY nr.training_id
    """).fetchall()

    # Self-registrations that are approved/finalized
    reg_rows = conn.execute("""
        SELECT training_id, COUNT(*) AS cnt
        FROM registration_requests
        WHERE training_id IS NOT NULL AND training_id != ''
          AND status IN ('Approved', 'Finalized', 'Enrolled')
        GROUP BY training_id
    """).fetchall()

    # Course request participants from finalized/enrolled course requests
    crq_rows = conn.execute("""
        SELECT cr.training_id, COUNT(crp.id) AS cnt
        FROM course_request_participants crp
        JOIN course_requests cr ON crp.request_id = cr.request_id
        WHERE cr.training_id IS NOT NULL AND cr.training_id != ''
          AND cr.status IN ('Finalized', 'Enrolled')
        GROUP BY cr.training_id
    """).fetchall()

    conn.close()

    result = {}
    for r in nom_rows:
        if r[0]:
            result[r[0]] = result.get(r[0], 0) + r[1]
    for r in reg_rows:
        if r[0]:
            result[r[0]] = result.get(r[0], 0) + r[1]
    for r in crq_rows:
        if r[0]:
            result[r[0]] = result.get(r[0], 0) + r[1]

    return result


class TrainingUpsert(BaseModel):
    performed_by: str
    role: str
    course_name: str
    category: str
    mode: Optional[str] = "Online"
    duration: Optional[str] = ""
    trainer_name: Optional[str] = ""
    seats_available: Optional[int] = 0
    skill_tags: Optional[str] = ""
    status: Optional[str] = "Active"
    batches: Optional[str] = ""
    training_date: Optional[str] = ""
    released_to_domains: Optional[str] = ""   # JSON array string e.g. '["Business Intelligence","Cloud"]'
    curriculum_summary: Optional[str] = ""
    curriculum_file_name: Optional[str] = ""
    curriculum_file_url: Optional[str] = ""


@app.get("/api/departments")
def get_departments():
    """Return all distinct departments with their assigned FH and RM info."""
    conn = get_connection()
    depts = rows(conn.execute(
        """SELECT DISTINCT department FROM employees
           WHERE department IS NOT NULL AND department != ''
             AND COALESCE(status,'Active')='Active'
           ORDER BY department"""
    ))
    conn.close()
    return [d["department"] for d in depts]


@app.post("/api/trainings")
def create_training(payload: TrainingUpsert):
    if payload.role != "ld_team":
        raise HTTPException(status_code=403, detail="Only L&D Team can add courses")
    tid = gen_id("TRN")
    release_date = now_str() if payload.released_to_domains else ""
    conn = get_connection()
    conn.execute(
        """INSERT INTO trainings
           (training_id, course_name, category, mode, duration, trainer_name,
            seats_available, skill_tags, status, batches, training_date,
            released_to_domains, release_date, curriculum_summary,
            curriculum_file_name, curriculum_file_url)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (tid, payload.course_name, payload.category, payload.mode, payload.duration,
         payload.trainer_name, payload.seats_available, payload.skill_tags,
         payload.status, payload.batches, payload.training_date or "",
         payload.released_to_domains or "", release_date,
         payload.curriculum_summary or "",
         payload.curriculum_file_name or "", payload.curriculum_file_url or "")
    )
    action = "Course Released" if payload.released_to_domains else "Course Added"
    log_action(conn, action, payload.performed_by, payload.role, tid, "Training",
               f"Released: {payload.course_name} to domains: {payload.released_to_domains or 'All'}")

    # Create release notifications for FH and RM of targeted domains
    if payload.released_to_domains:
        try:
            domains = json.loads(payload.released_to_domains)
            if domains:
                recipients = rows(conn.execute(
                    """SELECT employee_id, role FROM employees
                       WHERE department IN ({}) AND role IN ('functional_head','manager')
                         AND COALESCE(status,'Active')='Active'""".format(
                        ",".join("?" * len(domains))
                    ), domains
                ))
                for r in recipients:
                    nid = gen_id("NTF")
                    role_label = "functional_head" if r["role"] == "functional_head" else "reporting_manager"
                    conn.execute(
                        """INSERT INTO release_notifications
                           (id, training_id, course_name, released_by, released_at,
                            released_to_domains, category, mode, training_date, trainer_name,
                            curriculum_summary, curriculum_file_url, curriculum_file_name,
                            recipient_employee_id, recipient_role, seen)
                        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)""",
                        (nid, tid, payload.course_name, payload.performed_by, release_date,
                         payload.released_to_domains, payload.category or "",
                         payload.mode or "", payload.batches or "",
                         payload.trainer_name or "",
                         payload.curriculum_summary or "",
                         payload.curriculum_file_url or "", payload.curriculum_file_name or "",
                         r["employee_id"], role_label)
                    )
        except Exception:
            pass  # Don't block course creation if notification fails

    conn.commit()
    result = row(conn.execute("SELECT * FROM trainings WHERE training_id=?", (tid,)))
    conn.close()
    return result


@app.put("/api/trainings/{training_id}")
def update_training(training_id: str, payload: TrainingUpsert):
    if payload.role != "ld_team":
        raise HTTPException(status_code=403, detail="Only L&D Team can edit courses")
    conn = get_connection()
    t = row(conn.execute("SELECT * FROM trainings WHERE training_id=?", (training_id,)))
    if not t:
        conn.close()
        raise HTTPException(status_code=404, detail="Training not found")
    conn.execute(
        """UPDATE trainings SET course_name=?,category=?,mode=?,duration=?,trainer_name=?,
        seats_available=?,skill_tags=?,status=?,batches=?,training_date=?,
        curriculum_summary=?,curriculum_file_name=?,curriculum_file_url=?
        WHERE training_id=?""",
        (payload.course_name, payload.category, payload.mode, payload.duration,
         payload.trainer_name, payload.seats_available, payload.skill_tags,
         payload.status, payload.batches, payload.training_date or "",
         payload.curriculum_summary or "", payload.curriculum_file_name or "",
         payload.curriculum_file_url or "", training_id)
    )
    log_action(conn, "Course Updated", payload.performed_by, payload.role, training_id, "Training", f"Updated: {payload.course_name}")
    conn.commit()
    result = row(conn.execute("SELECT * FROM trainings WHERE training_id=?", (training_id,)))
    conn.close()
    return result


@app.get("/api/release-notifications")
def get_release_notifications(employee_id: str):
    conn = get_connection()
    notifs = rows(conn.execute(
        "SELECT * FROM release_notifications WHERE recipient_employee_id=? ORDER BY released_at DESC",
        (employee_id,)
    ))
    conn.close()
    return notifs


@app.get("/api/release-notifications/count")
def get_release_notifications_count(employee_id: str):
    conn = get_connection()
    r = conn.execute(
        "SELECT COUNT(*) as cnt FROM release_notifications WHERE recipient_employee_id=? AND seen=0",
        (employee_id,)
    ).fetchone()
    conn.close()
    return {"count": r[0] if r else 0}


@app.put("/api/release-notifications/mark-seen")
def mark_notifications_seen(body: dict):
    employee_id = body.get("employee_id", "")
    if not employee_id:
        raise HTTPException(status_code=400, detail="employee_id required")
    conn = get_connection()
    conn.execute(
        "UPDATE release_notifications SET seen=1 WHERE recipient_employee_id=? AND seen=0",
        (employee_id,)
    )
    conn.commit()
    conn.close()
    return {"ok": True}


@app.get("/api/trainings/{training_id}")
def get_training(training_id: str):
    conn = get_connection()
    t = row(conn.execute("SELECT * FROM trainings WHERE training_id=?", (training_id,)))
    conn.close()
    if not t:
        raise HTTPException(status_code=404, detail="Training not found")
    return t


# ── Self Registrations ────────────────────────────────────────────────────────

@app.get("/api/registrations")
def get_registrations():
    conn = get_connection()
    result = rows(conn.execute("SELECT * FROM registration_requests ORDER BY submitted_date DESC"))
    conn.close()
    return result


@app.post("/api/registrations")
def create_registration(payload: RegistrationCreate):
    req_id = gen_id("REG")
    conn = get_connection()
    employee = row(conn.execute("SELECT * FROM employees WHERE employee_id=? AND COALESCE(status,'Active')='Active'", (payload.employee_id,)))
    if not employee:
        conn.close()
        raise HTTPException(status_code=404, detail="Employee record not found")

    manager_id = (employee.get("manager_id") or "").strip()
    if not manager_id:
        conn.close()
        raise HTTPException(status_code=400, detail="No domain manager is mapped to this employee")

    manager = row(conn.execute("SELECT * FROM employees WHERE employee_id=? AND COALESCE(status,'Active')='Active'", (manager_id,)))
    if not manager:
        conn.close()
        raise HTTPException(status_code=400, detail="Mapped domain manager record was not found")

    conn.execute(
        """INSERT INTO registration_requests
        (request_id,request_type,employee_id,employee_name,email,department,business_unit,designation,
        manager_id,reporting_manager,training_id,course_name,training_mode,preferred_batch,training_date,
        reason,expected_outcome,status,submitted_date,confirmation_sent)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (req_id, "Self", employee["employee_id"], employee["name"], employee["email"],
         employee.get("department") or "", employee.get("business_unit") or "", employee.get("designation") or "", manager_id,
         manager.get("name") or "", payload.training_id, payload.course_name, payload.training_mode, payload.preferred_batch,
         payload.training_date, payload.reason, payload.expected_outcome,
         "Pending Manager Approval", now_str(), 0)
    )
    log_action(conn, "Self Registration Submitted", employee["name"], "Employee",
               req_id, "Registration", f"Submitted for {payload.course_name} — routed only to assigned domain manager {manager.get('name') or manager_id}")
    conn.commit()
    result = row(conn.execute("SELECT * FROM registration_requests WHERE request_id=?", (req_id,)))
    conn.close()

    agent_output = analyze_learning_need_with_llm(
        payload.department,
        payload.reason,
        payload.expected_outcome,
        payload.course_name,
    )
    persist_agent_run(
        "learning_need_analysis",
        "Learning Need Analysis Agent",
        {
            "department": employee.get("department") or "",
            "reason": payload.reason,
            "expected_outcome": payload.expected_outcome,
            "course_name": payload.course_name,
        },
        agent_output,
        req_id,
        "Registration",
        "registration_created",
    )
    return result


@app.put("/api/registrations/{request_id}/validate")
def validate_registration(request_id: str, body: ActionBody):
    conn = get_connection()
    r = row(conn.execute("SELECT * FROM registration_requests WHERE request_id=?", (request_id,)))
    if not r:
        conn.close()
        raise HTTPException(status_code=404, detail="Not found")
    conn.execute("UPDATE registration_requests SET status='Pending Manager Approval', ld_validated_date=?, ld_remarks=? WHERE request_id=?",
                 (now_str(), body.remarks, request_id))
    log_action(conn, "L&D Validation Completed", body.performed_by, body.role, request_id, "Registration", body.remarks)
    conn.commit()
    conn.close()
    return {"message": "Validated", "status": "Pending Manager Approval"}


@app.put("/api/registrations/{request_id}/approve")
def approve_registration(request_id: str, body: ActionBody):
    conn = get_connection()
    r = row(conn.execute("SELECT * FROM registration_requests WHERE request_id=?", (request_id,)))
    if not r:
        conn.close()
        raise HTTPException(status_code=404, detail="Not found")
    conn.execute("UPDATE registration_requests SET status='Approved', manager_approved_date=?, manager_remarks=? WHERE request_id=?",
                 (now_str(), body.remarks, request_id))
    log_action(conn, "Manager Approval Granted", body.performed_by, body.role, request_id, "Registration", body.remarks)
    conn.commit()
    conn.close()
    return {"message": "Approved", "status": "Approved"}


@app.put("/api/registrations/{request_id}/reject")
def reject_registration(request_id: str, body: ActionBody):
    conn = get_connection()
    r = row(conn.execute("SELECT * FROM registration_requests WHERE request_id=?", (request_id,)))
    if not r:
        conn.close()
        raise HTTPException(status_code=404, detail="Not found")
    conn.execute("UPDATE registration_requests SET status='Rejected', ld_remarks=? WHERE request_id=?",
                 (body.remarks, request_id))
    log_action(conn, "Request Rejected", body.performed_by, body.role, request_id, "Registration", body.remarks)
    conn.commit()
    conn.close()
    return {"message": "Rejected", "status": "Rejected"}


@app.put("/api/registrations/{request_id}/send-email")
def send_reg_email(request_id: str):
    conn = get_connection()
    r = row(conn.execute("SELECT * FROM registration_requests WHERE request_id=?", (request_id,)))
    if not r:
        conn.close()
        raise HTTPException(status_code=404, detail="Not found")
    conn.execute("UPDATE registration_requests SET confirmation_sent=1, status='Enrolled' WHERE request_id=?", (request_id,))
    conn.commit()
    conn.close()
    return {"message": f"Confirmation email simulated to {r['email']}", "sent": True}


# ── Manager Nominations ────────────────────────────────────────────────────────

@app.get("/api/nominations")
def get_nominations():
    conn = get_connection()
    noms = rows(conn.execute("SELECT * FROM nomination_requests ORDER BY submitted_date DESC"))
    for n in noms:
        parts = rows(conn.execute("SELECT * FROM nomination_participants WHERE nomination_id=?", (n["nomination_id"],)))
        n["participants"] = parts
        n["participant_count"] = len(parts)
    conn.close()
    return noms


@app.post("/api/nominations")
def create_nomination(payload: NominationCreate):
    nom_id = gen_id("NOM")
    conn = get_connection()
    # All nominations (FH or manager) go to L&D first for validation.
    # Manager gets an fh_notifications badge when requested_by_fh=True (seen_by_manager=0).
    initial_status = "Pending L&D Validation"
    conn.execute(
        """INSERT INTO nomination_requests
        (nomination_id,manager_id,manager_name,manager_email,department,business_unit,
        training_id,course_name,business_need,skill_gap,priority,training_date,
        target_completion_date,status,submitted_date,fh_id,fh_name,requested_by_fh,seen_by_manager)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (nom_id, payload.manager_id, payload.manager_name, payload.manager_email,
         payload.department, payload.business_unit, payload.training_id, payload.course_name,
         payload.business_need, payload.skill_gap, payload.priority, payload.training_date,
         payload.target_completion_date, initial_status, now_str(),
         payload.fh_id, payload.fh_name, 1 if payload.requested_by_fh else 0, 0)
    )
    for p in payload.participants:
        conn.execute(
            """INSERT INTO nomination_participants
            (nomination_id,employee_id,employee_name,email,department,current_skill_level,required_skill_level,nomination_reason,status,confirmation_sent)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (nom_id, p.employee_id, p.employee_name, p.email, p.department,
             p.current_skill_level, p.required_skill_level, p.nomination_reason, "Nominated", 0)
        )
    submitter = payload.fh_name or payload.manager_name
    role_label = "Functional Head" if payload.requested_by_fh else "Manager"
    log_action(conn, "Nomination Submitted", submitter, role_label,
               nom_id, "Nomination", f"Requested {payload.course_name} for {payload.department} — {initial_status}")
    conn.commit()
    result = row(conn.execute("SELECT * FROM nomination_requests WHERE nomination_id=?", (nom_id,)))
    conn.close()

    agent_output = analyze_learning_need_with_llm(
        payload.department,
        payload.business_need,
        payload.skill_gap,
        payload.course_name,
    )
    persist_agent_run(
        "learning_need_analysis",
        "Learning Need Analysis Agent",
        {
            "department": payload.department,
            "business_need": payload.business_need,
            "skill_gap": payload.skill_gap,
            "course_name": payload.course_name,
        },
        agent_output,
        nom_id,
        "Nomination",
        "nomination_created",
    )
    return result


@app.put("/api/nominations/{nomination_id}/validate")
def validate_nomination(nomination_id: str, body: ActionBody):
    conn = get_connection()
    n = row(conn.execute("SELECT * FROM nomination_requests WHERE nomination_id=?", (nomination_id,)))
    if not n:
        conn.close()
        raise HTTPException(status_code=404, detail="Not found")
    # Nominations = existing course — L&D validates, then RM must confirm/add participants.
    # Move to Participants Requested so RM is prompted in the Approval Queue.
    conn.execute("UPDATE nomination_requests SET status='Participants Requested', ld_validated_date=?, ld_remarks=? WHERE nomination_id=?",
                 (now_str(), body.remarks, nomination_id))
    log_action(conn, "L&D Nomination Validated", body.performed_by, body.role, nomination_id, "Nomination",
               f"Validated — Manager prompted to confirm participants. {body.remarks or ''}")
    conn.commit()
    conn.close()
    return {"message": "Validated — Manager notified to confirm participants", "status": "Participants Requested"}


@app.put("/api/nominations/{nomination_id}/assign")
def assign_nomination(nomination_id: str, body: AssignBody):
    """L&D Manager assigns a nomination to a specific L&D team member."""
    conn = get_connection()
    n = row(conn.execute("SELECT * FROM nomination_requests WHERE nomination_id=?", (nomination_id,)))
    if not n:
        conn.close()
        raise HTTPException(status_code=404, detail="Not found")
    conn.execute(
        "UPDATE nomination_requests SET status='Pending L&D Validation', assigned_to_id=?, assigned_to_name=? WHERE nomination_id=?",
        (body.assigned_to_id, body.assigned_to_name, nomination_id)
    )
    log_action(conn, "Request Assigned to L&D Team", body.performed_by, body.role,
               nomination_id, "Nomination", f"Assigned to {body.assigned_to_name}")
    conn.commit()
    conn.close()
    return {"message": "Assigned", "status": "Pending L&D Validation"}


@app.put("/api/nominations/{nomination_id}/approve")
def approve_nomination(nomination_id: str, body: ActionBody):
    conn = get_connection()
    n = row(conn.execute("SELECT * FROM nomination_requests WHERE nomination_id=?", (nomination_id,)))
    if not n:
        conn.close()
        raise HTTPException(status_code=404, detail="Not found")
    conn.execute("UPDATE nomination_requests SET status='Approved', manager_approved_date=?, manager_remarks=? WHERE nomination_id=?",
                 (now_str(), body.remarks, nomination_id))
    conn.execute("UPDATE nomination_participants SET status='Approved' WHERE nomination_id=?", (nomination_id,))
    log_action(conn, "Manager Approved Nomination", body.performed_by, body.role, nomination_id, "Nomination", body.remarks)
    conn.commit()
    conn.close()
    return {"message": "Approved", "status": "Approved"}


@app.put("/api/nominations/{nomination_id}/mark-seen")
def mark_nomination_seen(nomination_id: str):
    conn = get_connection()
    conn.execute("UPDATE nomination_requests SET seen_by_manager=1 WHERE nomination_id=?", (nomination_id,))
    conn.commit()
    conn.close()
    return {"message": "Marked as seen"}


@app.put("/api/nominations/{nomination_id}/reject")
def reject_nomination(nomination_id: str, body: ActionBody):
    conn = get_connection()
    n = row(conn.execute("SELECT * FROM nomination_requests WHERE nomination_id=?", (nomination_id,)))
    if not n:
        conn.close()
        raise HTTPException(status_code=404, detail="Not found")
    conn.execute("UPDATE nomination_requests SET status='Rejected', ld_remarks=? WHERE nomination_id=?",
                 (body.remarks, nomination_id))
    log_action(conn, "Nomination Rejected", body.performed_by, body.role, nomination_id, "Nomination", body.remarks)
    conn.commit()
    conn.close()
    return {"message": "Rejected", "status": "Rejected"}


@app.put("/api/nominations/{nomination_id}/upload-curriculum")
def upload_curriculum_nom(nomination_id: str, body: CurriculumUpload):
    conn = get_connection()
    n = row(conn.execute("SELECT * FROM nomination_requests WHERE nomination_id=?", (nomination_id,)))
    if not n:
        conn.close()
        raise HTTPException(status_code=404, detail="Not found")
    file_url = body.curriculum_link or ""
    if body.file_data and body.file_data.data:
        mime = body.file_data.mime or "application/octet-stream"
        file_url = f"data:{mime};base64,{body.file_data.data}"
    conn.execute(
        "UPDATE nomination_requests SET status='Curriculum Shared', curriculum_title=?, curriculum_outline=?, curriculum_link=?, curriculum_uploaded_date=?, curriculum_uploaded_by=? WHERE nomination_id=?",
        (body.curriculum_title, body.curriculum_outline, file_url, now_str(), body.performed_by, nomination_id)
    )
    log_action(conn, "Curriculum Uploaded", body.performed_by, body.role, nomination_id, "Nomination", f"Curriculum: {body.curriculum_title}")
    conn.commit()
    conn.close()
    return {"message": "Curriculum shared", "status": "Curriculum Shared"}


@app.put("/api/nominations/{nomination_id}/approve-curriculum")
def approve_curriculum_nom(nomination_id: str, body: ActionBody):
    conn = get_connection()
    n = row(conn.execute("SELECT * FROM nomination_requests WHERE nomination_id=?", (nomination_id,)))
    if not n:
        conn.close()
        raise HTTPException(status_code=404, detail="Not found")
    conn.execute(
        "UPDATE nomination_requests SET status='Curriculum Approved', curriculum_approved_date=? WHERE nomination_id=?",
        (now_str(), nomination_id)
    )
    log_action(conn, "Curriculum Approved", body.performed_by, body.role, nomination_id, "Nomination")
    conn.commit()
    conn.close()
    return {"message": "Curriculum approved", "status": "Curriculum Approved"}


@app.put("/api/nominations/{nomination_id}/reject-curriculum")
def reject_curriculum_nom(nomination_id: str, body: ActionBody):
    conn = get_connection()
    n = row(conn.execute("SELECT * FROM nomination_requests WHERE nomination_id=?", (nomination_id,)))
    if not n:
        conn.close()
        raise HTTPException(status_code=404, detail="Not found")
    conn.execute(
        "UPDATE nomination_requests SET status='Curriculum Rejected', curriculum_rejection_reason=? WHERE nomination_id=?",
        (body.remarks, nomination_id)
    )
    log_action(conn, "Curriculum Rejected", body.performed_by, body.role, nomination_id, "Nomination", body.remarks)
    conn.commit()
    conn.close()
    return {"message": "Curriculum rejected", "status": "Curriculum Rejected"}


@app.put("/api/registrations/{request_id}/approve-curriculum")
def approve_curriculum_reg(request_id: str, body: ActionBody):
    conn = get_connection()
    r = row(conn.execute("SELECT * FROM registration_requests WHERE request_id=?", (request_id,)))
    if not r:
        conn.close()
        raise HTTPException(status_code=404, detail="Not found")
    conn.execute(
        "UPDATE registration_requests SET status='Curriculum Approved', curriculum_approved_date=? WHERE request_id=?",
        (now_str(), request_id)
    )
    log_action(conn, "Curriculum Approved", body.performed_by, body.role, request_id, "Registration")
    conn.commit()
    conn.close()
    return {"message": "Curriculum approved", "status": "Curriculum Approved"}


@app.put("/api/registrations/{request_id}/reject-curriculum")
def reject_curriculum_reg(request_id: str, body: ActionBody):
    conn = get_connection()
    r = row(conn.execute("SELECT * FROM registration_requests WHERE request_id=?", (request_id,)))
    if not r:
        conn.close()
        raise HTTPException(status_code=404, detail="Not found")
    conn.execute(
        "UPDATE registration_requests SET status='Curriculum Rejected', curriculum_rejection_reason=? WHERE request_id=?",
        (body.remarks, request_id)
    )
    log_action(conn, "Curriculum Rejected", body.performed_by, body.role, request_id, "Registration", body.remarks)
    conn.commit()
    conn.close()
    return {"message": "Curriculum rejected", "status": "Curriculum Rejected"}


@app.get("/api/nominations/{nomination_id}/participants")
def get_nomination_participants(nomination_id: str):
    conn = get_connection()
    result = rows(conn.execute(
        "SELECT * FROM nomination_participants WHERE nomination_id=? ORDER BY id",
        (nomination_id,)
    ))
    conn.close()
    return result


@app.put("/api/nominations/{nomination_id}/add-participants")
def add_participants_nom(nomination_id: str, body: AddParticipantsBody):
    conn = get_connection()
    n = row(conn.execute("SELECT * FROM nomination_requests WHERE nomination_id=?", (nomination_id,)))
    if not n:
        conn.close()
        raise HTTPException(status_code=404, detail="Not found")
    # Replace existing participants (handles re-confirmation without duplicates)
    conn.execute("DELETE FROM nomination_participants WHERE nomination_id=?", (nomination_id,))
    for p in body.participants:
        conn.execute(
            """INSERT INTO nomination_participants
            (nomination_id,employee_id,employee_name,email,department,current_skill_level,required_skill_level,nomination_reason,status,confirmation_sent)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (nomination_id, p.employee_id, p.employee_name, p.email, p.department,
             p.current_skill_level, p.required_skill_level, p.nomination_reason, "Enrolled", 0)
        )
    conn.execute("UPDATE nomination_requests SET status='Finalized', manager_approved_date=? WHERE nomination_id=?",
                 (now_str(), nomination_id))
    log_action(conn, "Participants Confirmed", body.performed_by, body.role, nomination_id, "Nomination",
               f"Confirmed {len(body.participants)} participants")
    conn.commit()
    conn.close()
    return {"message": "Participants confirmed and nomination finalized", "status": "Finalized"}


@app.put("/api/registrations/{request_id}/upload-curriculum")
def upload_curriculum_reg(request_id: str, body: CurriculumUpload):
    conn = get_connection()
    r = row(conn.execute("SELECT * FROM registration_requests WHERE request_id=?", (request_id,)))
    if not r:
        conn.close()
        raise HTTPException(status_code=404, detail="Not found")
    file_url = body.curriculum_link or ""
    if body.file_data and body.file_data.data:
        mime = body.file_data.mime or "application/octet-stream"
        file_url = f"data:{mime};base64,{body.file_data.data}"
    conn.execute(
        "UPDATE registration_requests SET status='Curriculum Approved', curriculum_title=?, curriculum_outline=?, curriculum_link=?, curriculum_uploaded_date=?, curriculum_uploaded_by=?, curriculum_approved_date=? WHERE request_id=?",
        (body.curriculum_title, body.curriculum_outline, file_url, now_str(), body.performed_by, now_str(), request_id)
    )
    log_action(conn, "Curriculum Uploaded & Approved", body.performed_by, body.role, request_id, "Registration", f"Curriculum: {body.curriculum_title}")
    conn.commit()
    conn.close()
    return {"message": "Curriculum uploaded and approved", "status": "Curriculum Approved"}


@app.put("/api/registrations/{request_id}/finalize")
def finalize_registration(request_id: str, body: ActionBody):
    conn = get_connection()
    conn.execute("UPDATE registration_requests SET status='Finalized' WHERE request_id=?", (request_id,))
    log_action(conn, "Enrollment Finalized", body.performed_by, body.role, request_id, "Registration")
    conn.commit()
    conn.close()
    return {"message": "Finalized", "status": "Finalized"}


@app.put("/api/nominations/{nomination_id}/request-participants")
def request_participants_nom(nomination_id: str, body: dict):
    conn = get_connection()
    trainer = body.get("trainer_name", "")
    t_date  = body.get("training_date", "")
    conn.execute(
        "UPDATE nomination_requests SET status='Participants Requested', trainer_name=?, training_date=? WHERE nomination_id=?",
        (trainer, t_date, nomination_id)
    )
    log_action(conn, "Trainer Set & Nominations Requested", body.get("performed_by",""), body.get("role",""),
               nomination_id, "Nomination", f"Trainer: {trainer}, Date: {t_date}")
    conn.commit()
    conn.close()
    return {"message": "Nominations requested", "status": "Participants Requested"}


@app.put("/api/course-requests/{request_id}/request-participants")
def request_participants_crq(request_id: str, body: dict):
    conn = get_connection()
    trainer = body.get("trainer_name", "")
    t_date  = body.get("training_date", "")
    conn.execute(
        "UPDATE course_requests SET status='Participants Requested', trainer_name=?, training_date=? WHERE request_id=?",
        (trainer, t_date, request_id)
    )
    log_action(conn, "Trainer Set & Nominations Requested", body.get("performed_by",""), body.get("role",""),
               request_id, "Course Request", f"Trainer: {trainer}, Date: {t_date}")
    conn.commit()
    conn.close()
    return {"message": "Nominations requested", "status": "Participants Requested"}


@app.put("/api/nominations/{nomination_id}/send-email")
def send_nom_email(nomination_id: str):
    conn = get_connection()
    count = conn.execute("SELECT COUNT(*) FROM nomination_participants WHERE nomination_id=?", (nomination_id,)).fetchone()[0]
    conn.execute("UPDATE nomination_participants SET confirmation_sent=1 WHERE nomination_id=?", (nomination_id,))
    conn.execute("UPDATE nomination_requests SET status='Enrolled' WHERE nomination_id=?", (nomination_id,))
    conn.commit()
    conn.close()
    return {"message": f"Confirmation emails simulated for {count} participants", "sent": True}


# ── Finalized Participants ────────────────────────────────────────────────────

@app.get("/api/participants")
def get_participants():
    conn = get_connection()
    ENROLLED_STATUSES = "('Approved','Enrolled','Finalized')"

    # 1. Self-registrations that reached enrolled/approved status
    approved_regs = rows(conn.execute(f"""
        SELECT rr.*,
               COALESCE(e.designation, '') AS designation,
               COALESCE(mgr.name, '') AS manager_name
        FROM registration_requests rr
        LEFT JOIN employees e ON rr.employee_id = e.employee_id
        LEFT JOIN employees mgr ON e.manager_id = mgr.employee_id
        WHERE rr.status IN {ENROLLED_STATUSES}
    """))

    # 2. Participants added via manager nomination flow
    approved_nom_parts = rows(conn.execute(f"""
        SELECT np.*, nr.course_name, nr.manager_approved_date AS approval_date_nom,
               nr.training_date, COALESCE(t.mode, '') AS training_mode,
               nr.requested_by_fh,
               COALESCE(e.designation, '') AS designation,
               COALESCE(mgr.name, '') AS manager_name
        FROM nomination_participants np
        JOIN nomination_requests nr ON np.nomination_id = nr.nomination_id
        LEFT JOIN trainings t ON nr.training_id = t.training_id
        LEFT JOIN employees e ON np.employee_id = e.employee_id
        LEFT JOIN employees mgr ON e.manager_id = mgr.employee_id
        WHERE nr.status IN {ENROLLED_STATUSES}
    """))

    # 3. Participants added via new-course-request flow (course_request_participants)
    approved_crq_parts = rows(conn.execute(f"""
        SELECT crp.*, cr.course_name, cr.training_date, cr.submitted_date AS approval_date_crq,
               cr.mode AS training_mode, cr.requested_by_rm, cr.requested_by_fh,
               COALESCE(e.designation, '') AS designation,
               COALESCE(mgr.name, '') AS manager_name
        FROM course_request_participants crp
        JOIN course_requests cr ON crp.request_id = cr.request_id
        LEFT JOIN employees e ON crp.employee_id = e.employee_id
        LEFT JOIN employees mgr ON e.manager_id = mgr.employee_id
        WHERE cr.status IN {ENROLLED_STATUSES}
    """))

    conn.close()

    result = []
    for r in approved_regs:
        result.append({
            "id": f"REG_{r['request_id']}",
            "employee_id": r["employee_id"],
            "employee_name": r["employee_name"],
            "email": r["email"],
            "course_name": r["course_name"],
            "department": r["department"],
            "designation": r.get("designation") or "",
            "manager_name": r.get("manager_name") or "",
            "training_mode": r.get("training_mode") or "—",
            "training_date": (r["training_date"] or "")[:10],
            "approval_date": (r["manager_approved_date"] or "")[:10],
            "enrollment_status": "Finalized",
            "confirmation_sent": bool(r["confirmation_sent"]),
            "source": "Self Registration",
            "request_id": r["request_id"],
            "request_type": "Registration",
        })
    for p in approved_nom_parts:
        nom_source = "Functional Head" if p.get("requested_by_fh") else "Reporting Manager"
        result.append({
            "id": f"NOM_{p['id']}",
            "employee_id": p["employee_id"],
            "employee_name": p["employee_name"],
            "email": p["email"],
            "course_name": p["course_name"],
            "department": p["department"],
            "designation": p.get("designation") or "",
            "manager_name": p.get("manager_name") or "",
            "training_mode": p.get("training_mode") or "—",
            "training_date": (p["training_date"] or "")[:10],
            "approval_date": (p["approval_date_nom"] or "")[:10],
            "enrollment_status": "Finalized",
            "confirmation_sent": bool(p["confirmation_sent"]),
            "source": nom_source,
            "request_id": p["nomination_id"],
            "request_type": "Nomination",
        })
    for p in approved_crq_parts:
        crq_source = "Functional Head" if p.get("requested_by_fh") else "Reporting Manager"
        result.append({
            "id": f"CRQ_{p['id']}",
            "employee_id": p["employee_id"],
            "employee_name": p["employee_name"],
            "email": p["email"],
            "course_name": p["course_name"],
            "department": p["department"],
            "designation": p.get("designation") or "",
            "manager_name": p.get("manager_name") or "",
            "training_mode": p.get("training_mode") or "—",
            "training_date": (p.get("training_date") or "")[:10],
            "approval_date": (p["approval_date_crq"] or "")[:10],
            "enrollment_status": "Finalized",
            "confirmation_sent": bool(p["confirmation_sent"]),
            "source": crq_source,
            "request_id": p["request_id"],
            "request_type": "Course Request",
        })
    return result




# ── FH Dashboard PDF Export ───────────────────────────────────────────────────
from fh_pdf import generate_fh_pdf

@app.get("/api/fh-summary-pdf")
def fh_summary_pdf(employee_id: str):
    """Return a PDF summary of the FH dashboard for the given employee_id."""
    from fastapi.responses import StreamingResponse
    from datetime import datetime

    conn = get_connection()
    c = conn.cursor()

    fh = row(c.execute("SELECT * FROM employees WHERE employee_id=?", (employee_id,)))
    if not fh:
        conn.close()
        raise HTTPException(status_code=404, detail="Employee not found")

    my_managers = rows(c.execute("SELECT * FROM employees WHERE manager_id=?", (employee_id,)))
    manager_ids = [m["employee_id"] for m in my_managers]

    all_noms = rows(c.execute("SELECT * FROM nomination_requests"))
    all_crqs = rows(c.execute("SELECT * FROM course_requests"))

    team_noms = [n for n in all_noms if n.get("manager_id") in manager_ids or n.get("fh_id") == employee_id]
    team_crqs = [x for x in all_crqs if x.get("manager_id") in manager_ids or x.get("fh_id") == employee_id]

    upcoming = rows(c.execute(
        "SELECT * FROM trainings WHERE status='Active' AND training_date >= date('now') "
        "ORDER BY training_date ASC LIMIT 3"
    ))
    conn.close()

    buf, safe_name = generate_fh_pdf(fh, my_managers, team_noms, team_crqs, upcoming)
    filename = "FH_Dashboard_Summary_{}_{}.pdf".format(safe_name, datetime.now().strftime("%Y%m%d"))
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="{}"'.format(filename)},
    )

# ── Audit Logs ────────────────────────────────────────────────────────────────

@app.get("/api/audit-logs")
def get_audit_logs():
    conn = get_connection()
    result = rows(conn.execute("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100"))
    conn.close()
    return result


# ── Course Requests (New Course) ─────────────────────────────────────────────

class CourseRequestCreate(BaseModel):
    manager_id: str
    manager_name: str
    manager_email: str
    department: str
    business_unit: str
    course_name: str
    category: Optional[str] = ""
    mode: Optional[str] = "Online"
    duration: Optional[str] = ""
    business_need: str
    skill_gap: Optional[str] = ""
    expected_participants: int = 1
    priority: str = "Medium"
    expected_start_date: Optional[str] = ""
    additional_notes: Optional[str] = ""
    fh_id: Optional[str] = None
    fh_name: Optional[str] = None
    requested_by_fh: Optional[bool] = False
    requested_by_rm: Optional[bool] = False


@app.get("/api/course-requests")
def get_course_requests():
    conn = get_connection()
    result = rows(conn.execute("SELECT * FROM course_requests ORDER BY submitted_date DESC"))
    conn.close()
    return result


@app.post("/api/course-requests")
def create_course_request(payload: CourseRequestCreate):
    req_id = gen_id("CRQ")
    conn = get_connection()

    # ── Determine submitter's actual role from DB (don't trust frontend flags alone) ──
    submitter_emp = row(conn.execute(
        "SELECT role, manager_id, name FROM employees WHERE employee_id=?", (payload.manager_id,)
    ))
    submitter_db_role = submitter_emp.get("role", "") if submitter_emp else ""

    # Treat as RM-initiated if DB role is 'manager', regardless of frontend flag
    is_rm_initiated = (submitter_db_role == "manager") and not payload.requested_by_fh
    is_fh_initiated = bool(payload.requested_by_fh)

    # Auto-resolve FH from RM's manager_id if fh_id not provided
    fh_id = payload.fh_id or ""
    fh_name = payload.fh_name or ""
    if is_rm_initiated and not fh_id and submitter_emp:
        rm_manager_id = submitter_emp.get("manager_id", "")
        if rm_manager_id:
            fh_emp = row(conn.execute(
                "SELECT employee_id, name FROM employees WHERE employee_id=? AND role='functional_head'",
                (rm_manager_id,)
            ))
            if fh_emp:
                fh_id = fh_emp["employee_id"]
                fh_name = fh_emp["name"]

    # Route to FH first for RM-initiated; FH-initiated and L&D-direct go straight to L&D
    initial_status = "Pending FH Approval" if is_rm_initiated else "Pending L&D Validation"

    conn.execute(
        """INSERT INTO course_requests
        (request_id,request_type,manager_id,manager_name,manager_email,department,business_unit,
        course_name,category,mode,duration,business_need,skill_gap,expected_participants,
        priority,expected_start_date,additional_notes,status,submitted_date,
        fh_id,fh_name,requested_by_fh,seen_by_manager,requested_by_rm)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (req_id, "New Course", payload.manager_id, payload.manager_name, payload.manager_email,
         payload.department, payload.business_unit, payload.course_name, payload.category,
         payload.mode, payload.duration, payload.business_need, payload.skill_gap,
         payload.expected_participants, payload.priority, payload.expected_start_date,
         payload.additional_notes, initial_status, now_str(),
         fh_id or None, fh_name or None, 1 if is_fh_initiated else 0, 0,
         1 if is_rm_initiated else 0)
    )
    submitter = payload.fh_name or payload.manager_name
    role_label = "Functional Head" if is_fh_initiated else "Reporting Manager" if is_rm_initiated else "Manager"
    log_action(conn, "New Course Request Raised", submitter, role_label,
               req_id, "Course Request", f"Requested new course: {payload.course_name}")
    conn.commit()
    result = row(conn.execute("SELECT * FROM course_requests WHERE request_id=?", (req_id,)))
    conn.close()

    learning_need_output = analyze_learning_need_with_llm(
        payload.department,
        payload.business_need,
        payload.skill_gap,
        payload.course_name,
    )
    persist_agent_run(
        "learning_need_analysis",
        "Learning Need Analysis Agent",
        {
            "department": payload.department,
            "business_need": payload.business_need,
            "skill_gap": payload.skill_gap,
            "course_name": payload.course_name,
        },
        learning_need_output,
        req_id,
        "Course Request",
        "course_request_created",
    )
    course_path_output = recommend_course_path_with_llm(
        payload.course_name,
        payload.business_need,
        payload.skill_gap,
    )
    persist_agent_run(
        "course_recommendation",
        "Course Recommendation Agent",
        {
            "course_name": payload.course_name,
            "business_need": payload.business_need,
            "skill_gap": payload.skill_gap,
        },
        course_path_output,
        req_id,
        "Course Request",
        "course_request_created",
    )
    return result


@app.put("/api/course-requests/{request_id}/validate")
def validate_course_request(request_id: str, body: ActionBody):
    conn = get_connection()
    r = row(conn.execute("SELECT * FROM course_requests WHERE request_id=?", (request_id,)))
    if not r:
        conn.close()
        raise HTTPException(status_code=404, detail="Not found")
    conn.execute(
        "UPDATE course_requests SET status='Approved', ld_validated_date=?, ld_remarks=? WHERE request_id=?",
        (now_str(), body.remarks, request_id)
    )
    log_action(conn, "Course Request Validated", body.performed_by, body.role,
               request_id, "Course Request", body.remarks)
    conn.commit()
    conn.close()
    return {"message": "Validated — L&D will coordinate trainer and date", "status": "Approved"}


@app.put("/api/course-requests/{request_id}/assign")
def assign_course_request(request_id: str, body: AssignBody):
    """L&D Manager assigns a course request to a specific L&D team member."""
    conn = get_connection()
    r = row(conn.execute("SELECT * FROM course_requests WHERE request_id=?", (request_id,)))
    if not r:
        conn.close()
        raise HTTPException(status_code=404, detail="Not found")
    conn.execute(
        "UPDATE course_requests SET status='Pending L&D Validation', assigned_to_id=?, assigned_to_name=? WHERE request_id=?",
        (body.assigned_to_id, body.assigned_to_name, request_id)
    )
    log_action(conn, "Request Assigned to L&D Team", body.performed_by, body.role,
               request_id, "Course Request", f"Assigned to {body.assigned_to_name}")
    conn.commit()
    conn.close()
    return {"message": "Assigned", "status": "Pending L&D Validation"}


@app.put("/api/course-requests/{request_id}/mark-seen")
def mark_course_request_seen(request_id: str):
    conn = get_connection()
    conn.execute("UPDATE course_requests SET seen_by_manager=1 WHERE request_id=?", (request_id,))
    conn.commit()
    conn.close()
    return {"message": "Marked as seen"}


@app.put("/api/course-requests/{request_id}/reject")
def reject_course_request(request_id: str, body: ActionBody):
    conn = get_connection()
    r = row(conn.execute("SELECT * FROM course_requests WHERE request_id=?", (request_id,)))
    if not r:
        conn.close()
        raise HTTPException(status_code=404, detail="Not found")
    conn.execute(
        "UPDATE course_requests SET status='Rejected', ld_remarks=? WHERE request_id=?",
        (body.remarks, request_id)
    )
    log_action(conn, "Course Request Rejected", body.performed_by, body.role,
               request_id, "Course Request", body.remarks)
    conn.commit()
    conn.close()
    return {"message": "Rejected", "status": "Rejected"}


@app.put("/api/course-requests/{request_id}/approve")
def approve_course_request(request_id: str, body: ActionBody):
    conn = get_connection()
    r = row(conn.execute("SELECT * FROM course_requests WHERE request_id=?", (request_id,)))
    if not r:
        conn.close()
        raise HTTPException(status_code=404, detail="Not found")
    # FH approving an RM-submitted request → send to L&D validation (not Approved)
    if r.get("requested_by_rm") and r.get("status") == "Pending FH Approval":
        note = f"Approved by {body.performed_by} (Functional Head). {body.remarks or ''}".strip()
        conn.execute(
            "UPDATE course_requests SET status='Pending L&D Validation', fh_approved_note=? WHERE request_id=?",
            (note, request_id)
        )
        log_action(conn, "FH Approved — Sent to L&D", body.performed_by, body.role,
                   request_id, "Course Request", note)
        conn.commit()
        conn.close()
        return {"message": "FH approved. Sent to L&D for validation.", "status": "Pending L&D Validation"}
    # FH-initiated or L&D validation → mark as Approved
    conn.execute(
        "UPDATE course_requests SET status='Approved', ld_validated_date=? WHERE request_id=?",
        (now_str(), request_id)
    )
    log_action(conn, "Course Request Approved", body.performed_by, body.role,
               request_id, "Course Request", body.remarks)
    conn.commit()
    conn.close()
    return {"message": "Approved", "status": "Approved"}


@app.put("/api/course-requests/{request_id}/upload-curriculum")
def upload_curriculum_course(request_id: str, body: CurriculumUpload):
    conn = get_connection()
    r = row(conn.execute("SELECT * FROM course_requests WHERE request_id=?", (request_id,)))
    if not r:
        conn.close()
        raise HTTPException(status_code=404, detail="Not found")
    file_url = body.curriculum_link or ""
    if body.file_data and body.file_data.data:
        mime = body.file_data.mime or "application/octet-stream"
        file_url = f"data:{mime};base64,{body.file_data.data}"
    conn.execute(
        "UPDATE course_requests SET status='Curriculum Shared', curriculum_title=?, curriculum_outline=?, curriculum_link=?, curriculum_uploaded_date=?, curriculum_uploaded_by=? WHERE request_id=?",
        (body.curriculum_title, body.curriculum_outline, file_url, now_str(), body.performed_by, request_id)
    )
    log_action(conn, "Curriculum Uploaded", body.performed_by, body.role,
               request_id, "Course Request", f"Curriculum: {body.curriculum_title}")
    conn.commit()
    conn.close()
    return {"message": "Curriculum shared", "status": "Curriculum Shared"}


@app.put("/api/course-requests/{request_id}/approve-curriculum")
def approve_curriculum_course(request_id: str, body: ActionBody):
    conn = get_connection()
    r = row(conn.execute("SELECT * FROM course_requests WHERE request_id=?", (request_id,)))
    if not r:
        conn.close()
        raise HTTPException(status_code=404, detail="Not found")
    conn.execute(
        "UPDATE course_requests SET status='Curriculum Approved', curriculum_approved_date=? WHERE request_id=?",
        (now_str(), request_id)
    )
    log_action(conn, "Curriculum Approved", body.performed_by, body.role,
               request_id, "Course Request")
    conn.commit()
    conn.close()
    return {"message": "Curriculum approved", "status": "Curriculum Approved"}


@app.put("/api/course-requests/{request_id}/reject-curriculum")
def reject_curriculum_course(request_id: str, body: ActionBody):
    conn = get_connection()
    r = row(conn.execute("SELECT * FROM course_requests WHERE request_id=?", (request_id,)))
    if not r:
        conn.close()
        raise HTTPException(status_code=404, detail="Not found")
    conn.execute(
        "UPDATE course_requests SET status='Curriculum Rejected', curriculum_rejection_reason=? WHERE request_id=?",
        (body.remarks, request_id)
    )
    log_action(conn, "Curriculum Rejected", body.performed_by, body.role,
               request_id, "Course Request", body.remarks)
    conn.commit()
    conn.close()
    return {"message": "Curriculum rejected", "status": "Curriculum Rejected"}


@app.put("/api/course-requests/{request_id}/finalize")
def finalize_course_request(request_id: str, body: AddParticipantsBody):
    conn = get_connection()
    cr = row(conn.execute("SELECT * FROM course_requests WHERE request_id=?", (request_id,)))
    if not cr:
        conn.close()
        raise HTTPException(status_code=404, detail="Course request not found")
    for p in body.participants:
        conn.execute(
            """INSERT INTO course_request_participants
            (request_id, employee_id, employee_name, email, department, status, confirmation_sent)
            VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (request_id, p.employee_id, p.employee_name, p.email, p.department, "Enrolled", 0)
        )
    conn.execute(
        "UPDATE course_requests SET status='Finalized', manager_approved_date=? WHERE request_id=?",
        (now_str(), request_id)
    )
    log_action(conn, "Participants Confirmed", body.performed_by, body.role,
               request_id, "Course Request", f"Added {len(body.participants)} participants")

    # Auto-add course to Training Catalog if not already there
    training_id = cr.get("training_id") or ""
    if not training_id:
        training_id = gen_id("TRN")
        conn.execute(
            """INSERT INTO trainings
               (training_id, course_name, category, mode, duration, trainer_name,
                seats_available, skill_tags, status, training_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                training_id,
                cr["course_name"],
                cr.get("category") or "",
                cr.get("mode") or "Online",
                cr.get("duration") or "",
                cr.get("trainer_name") or "",
                30,
                cr.get("category") or "",
                "Active",
                cr.get("training_date") or "",
            )
        )
        # Link the new training back to the course request
        conn.execute(
            "UPDATE course_requests SET training_id=? WHERE request_id=?",
            (training_id, request_id)
        )

    conn.commit()
    conn.close()
    return {"message": "Finalized and course added to catalog", "status": "Finalized", "training_id": training_id}


@app.put("/api/course-requests/{request_id}/send-email")
def send_crq_email(request_id: str):
    conn = get_connection()
    cr = row(conn.execute("SELECT * FROM course_requests WHERE request_id=?", (request_id,)))
    if not cr:
        conn.close()
        raise HTTPException(status_code=404, detail="Course request not found")

    count = conn.execute("SELECT COUNT(*) FROM course_request_participants WHERE request_id=?", (request_id,)).fetchone()[0]

    # Auto-add course to Training Catalog if not already linked
    training_id = cr.get("training_id") or ""
    if not training_id:
        training_id = gen_id("TRN")
        conn.execute(
            """INSERT INTO trainings
               (training_id, course_name, category, mode, duration, trainer_name,
                seats_available, skill_tags, status, training_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                training_id,
                cr["course_name"],
                cr.get("category") or "",
                cr.get("mode") or "Online",
                cr.get("duration") or "",
                cr.get("trainer_name") or "",
                30,                                   # default 30 seats
                cr.get("category") or "",             # use category as initial skill tag
                "Active",
                cr.get("training_date") or "",
            )
        )
        # Link training back to the course request so seat-counts can track it
        conn.execute(
            "UPDATE course_requests SET training_id=? WHERE request_id=?",
            (training_id, request_id)
        )

    conn.execute("UPDATE course_request_participants SET confirmation_sent=1 WHERE request_id=?", (request_id,))
    conn.execute("UPDATE course_requests SET status='Enrolled' WHERE request_id=?", (request_id,))
    conn.commit()
    conn.close()
    return {"message": f"Confirmation emails simulated for {count} participants. Course added to catalog as {training_id}.", "sent": True, "training_id": training_id}


# ── Curriculum File Upload / Download ────────────────────────────────────────

UPLOAD_DIR = os.environ.get("LMS_UPLOAD_DIR", os.path.join(DATA_DIR, "uploads"))
os.makedirs(UPLOAD_DIR, exist_ok=True)


@app.post("/api/curriculum-upload")
async def upload_curriculum_file(request: Request, file: UploadFile = File(...)):
    try:
        ext = os.path.splitext(file.filename)[1]
        stored_name = f"{uuid.uuid4().hex}{ext}"
        file_path = os.path.join(UPLOAD_DIR, stored_name)
        contents = await file.read()
        with open(file_path, "wb") as f:
            f.write(contents)
        public_url = str(request.base_url).rstrip("/") + f"/api/curriculum-files/{stored_name}"
        return {"stored_name": stored_name, "original_name": file.filename,
                "url": public_url}
    except Exception as e:
        import traceback
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {str(e)} | {traceback.format_exc()}")


@app.get("/api/curriculum-files/{stored_name}")
def download_curriculum_file(stored_name: str):
    file_path = os.path.join(UPLOAD_DIR, stored_name)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path, filename=stored_name, media_type="application/octet-stream")


# ── AI Endpoints ──────────────────────────────────────────────────────────────

def _rule_based_curriculum(course_name: str, team_domain: str, business_need: str, skill_gap: str) -> dict:
    """Generate a structured curriculum without an LLM when AI is not configured."""
    import random
    title = course_name or f"{team_domain} – Skill Development Programme"
    domain_lower = (team_domain or course_name or "").lower()

    # Pick module topics based on domain keywords
    if any(k in domain_lower for k in ["python", "data science", "ml", "ai", "analytics"]):
        topics = ["Python Fundamentals", "Data Wrangling & Pandas", "Statistical Analysis", "Machine Learning Pipelines", "Model Evaluation & Deployment"]
        mode = "Self-paced / Instructor-led"
        prereqs = ["Basic programming knowledge", "Familiarity with spreadsheets"]
    elif any(k in domain_lower for k in ["cloud", "devops", "aws", "azure", "gcp", "kubernetes"]):
        topics = ["Cloud Fundamentals", "Infrastructure as Code (Terraform)", "CI/CD Pipeline Design", "Container Orchestration", "Monitoring & Observability"]
        mode = "Instructor-led / Hybrid"
        prereqs = ["Linux basics", "Networking fundamentals"]
    elif any(k in domain_lower for k in ["security", "cyber", "owasp", "soc", "iam"]):
        topics = ["Threat Landscape Overview", "Identity & Access Management", "Application Security (OWASP Top 10)", "Incident Response", "Compliance & Audit Frameworks"]
        mode = "Instructor-led / Workshop"
        prereqs = ["Networking knowledge", "Basic IT security awareness"]
    elif any(k in domain_lower for k in ["leadership", "management", "people", "hr"]):
        topics = ["Situational Leadership", "Coaching & Feedback Techniques", "Conflict Resolution", "Team Performance Management", "Change Leadership"]
        mode = "Workshop / Blended"
        prereqs = ["Minimum 2 years in a team lead role"]
    elif any(k in domain_lower for k in ["agile", "scrum", "product", "project"]):
        topics = ["Agile Principles & Values", "Scrum Framework Deep Dive", "Sprint Planning & Backlog Grooming", "Stakeholder Communication", "Metrics & Retrospectives"]
        mode = "Instructor-led / Workshop"
        prereqs = ["Basic project management awareness"]
    elif any(k in domain_lower for k in ["finance", "compliance", "audit", "sox"]):
        topics = ["Financial Reporting Frameworks", "Internal Controls & SOX", "Risk Assessment Techniques", "Regulatory Compliance Essentials", "Data-Driven Finance Analysis"]
        mode = "Self-paced / Instructor-led"
        prereqs = ["Accounting fundamentals"]
    elif any(k in domain_lower for k in ["sales", "customer", "crm", "revenue"]):
        topics = ["Consultative Selling Techniques", "CRM Best Practices", "Negotiation & Objection Handling", "Customer Success Metrics", "Pipeline & Forecasting"]
        mode = "Workshop / Blended"
        prereqs = ["None"]
    else:
        topics = ["Foundations & Core Concepts", "Practical Techniques & Tools", "Case Studies & Application", "Advanced Practices", "Assessment & Certification Prep"]
        mode = "Hybrid"
        prereqs = ["Basic domain knowledge"]

    modules = [
        {"module_name": f"Module {i+1}: {t}", "description": f"Covers {t.lower()} with hands-on exercises and real-world scenarios.", "duration": f"{random.choice([3, 4, 6, 8])} hours"}
        for i, t in enumerate(topics)
    ]
    total_hours = sum(int(m["duration"].split()[0]) for m in modules)

    return {
        "curriculum_title": title,
        "target_audience": f"{team_domain} professionals seeking to enhance their {skill_gap or 'domain'} capabilities",
        "learning_objective": f"Equip participants with practical skills in {', '.join(topics[:3])} to address: {business_need or skill_gap or 'identified skill gaps'}",
        "recommended_topics": topics,
        "modules": modules,
        "priority": "High",
        "training_mode": mode,
        "prerequisites": prereqs,
        "expected_outcomes": [
            f"Apply {topics[0]} in day-to-day work",
            f"Demonstrate proficiency in {topics[1]}",
            "Improve team productivity and delivery quality",
            "Achieve certification readiness where applicable",
        ],
        "assessment_method": "Quiz after each module + final project submission",
        "certification_recommendation": f"{title} Completion Certificate (internal) — external certification recommended after 6 months",
        "business_impact": f"Addresses the identified skill gap in {team_domain or 'the team'}, expected to improve performance metrics within 60–90 days of training completion.",
        "suggested_duration": f"{total_hours} hours total ({len(modules)} modules)",
        "_generated_by": "rule-based-fallback",
    }


@app.post("/api/ai/generate-curriculum")
def generate_curriculum(payload: dict):
    team_domain = payload.get("team_domain", "")
    business_need = payload.get("business_need", "")
    skill_gap = payload.get("skill_gap", "")
    course_name = payload.get("course_name", "")
    if course_name and not business_need:
        business_need = course_name
    if course_name and not skill_gap:
        skill_gap = f"Skills required for: {course_name}"

    if not any([team_domain, business_need, skill_gap]):
        raise HTTPException(status_code=400, detail="At least one input field is required")

    # Use AI if configured, otherwise fall back to rule-based generation
    client, _ = get_azure_openai_client()
    if not client:
        curriculum = _rule_based_curriculum(course_name, team_domain, business_need, skill_gap)
        entity_id = payload.get("entity_id", "")
        entity_type = payload.get("entity_type", "")
        if entity_id and entity_type:
            persist_agent_run("curriculum_builder", "Curriculum Builder Agent", payload, curriculum, entity_id, entity_type, "curriculum_generated")
        return curriculum

    try:
        prompt = f"""You are an expert Learning & Development curriculum designer.

Generate a structured training curriculum based on the user input fields below:

Team / Domain:
{team_domain}

Business Need / Purpose:
{business_need}

Skill Gap Identified:
{skill_gap}

Create an auto-generated curriculum that includes:

1. Curriculum Title
2. Target Audience
3. Learning Objective
4. Recommended Training Topics
5. Course Modules with descriptions
6. Priority Level: High / Medium / Low
7. Suggested Duration
8. Training Mode: Self-paced / Instructor-led / Workshop / Hybrid
9. Prerequisites
10. Expected Outcomes
11. Assessment Method
12. Certification Recommendation
13. Business Impact

Rules:
- Make the curriculum practical and business-focused.
- Align the topics directly with the skill gap.
- Keep the output clear and suitable for an LMS system.
- Do not generate unrelated topics.
- Return the response in JSON format only, no extra text.

JSON Output Format:
{{
  "curriculum_title": "",
  "target_audience": "",
  "learning_objective": "",
  "recommended_topics": [],
  "modules": [
    {{
      "module_name": "",
      "description": "",
      "duration": ""
    }}
  ],
  "priority": "",
  "training_mode": "",
  "prerequisites": [],
  "expected_outcomes": [],
  "assessment_method": "",
  "certification_recommendation": "",
  "business_impact": ""
}}"""

        curriculum = generate_llm_json(
            "You are an expert Learning & Development curriculum designer. Return JSON only.",
            prompt,
            max_completion_tokens=2800,
        )
        if not curriculum:
            raise ValueError("Empty curriculum response")
        entity_id = payload.get("entity_id", "")
        entity_type = payload.get("entity_type", "")
        if entity_id and entity_type:
            persist_agent_run(
                "curriculum_builder",
                "Curriculum Builder Agent",
                payload,
                curriculum,
                entity_id,
                entity_type,
                "curriculum_generated",
            )
        return curriculum

    except Exception:
        # AI call failed (connection error, quota, etc.) — fall back to rule-based
        curriculum = _rule_based_curriculum(course_name, team_domain, business_need, skill_gap)
        entity_id = payload.get("entity_id", "")
        entity_type = payload.get("entity_type", "")
        if entity_id and entity_type:
            persist_agent_run("curriculum_builder", "Curriculum Builder Agent", payload, curriculum, entity_id, entity_type, "curriculum_generated")
        return curriculum


@app.post("/api/ai/suggest-priority")
def suggest_priority(payload: dict):
    return ai_suggest_priority_with_llm(payload.get("skill_gap", ""), payload.get("business_need", ""))


@app.post("/api/ai/suggest-course")
def suggest_course(payload: dict):
    return ai_suggest_course_with_llm(
        payload.get("designation", ""),
        payload.get("department", ""),
        payload.get("current_skills", "")
    )


@app.post("/api/ai/analyze-learning-need")
def analyze_learning_need(payload: dict):
    result = analyze_learning_need_with_llm(
        payload.get("team_domain", ""),
        payload.get("business_need", ""),
        payload.get("skill_gap", ""),
        payload.get("course_name", ""),
    )
    entity_id = payload.get("entity_id", "")
    entity_type = payload.get("entity_type", "")
    if entity_id and entity_type:
        persist_agent_run("learning_need_analysis", "Learning Need Analysis Agent", payload, result, entity_id, entity_type, payload.get("trigger_event", "manual_run"))
    return result


@app.post("/api/ai/recommend-course-path")
def recommend_course_path(payload: dict):
    course_name   = (payload.get("course_name",   "") or "").strip()
    business_need = (payload.get("business_need", "") or "").strip()

    # Reject if either required field is empty or looks like garbage (< 2 real words AND < 10 chars)
    def _meaningful(text: str, min_chars: int = 10, min_words: int = 2) -> bool:
        words = [w for w in text.split() if len(w) > 1]
        return len(text) >= min_chars or len(words) >= min_words

    if not course_name or not _meaningful(course_name, 10, 2):
        raise HTTPException(
            status_code=422,
            detail="course_name must be a meaningful description (at least 2 words or 10 characters)."
        )
    if not business_need or not _meaningful(business_need, 15, 3):
        raise HTTPException(
            status_code=422,
            detail="business_need must be a meaningful description (at least 3 words or 15 characters)."
        )

    result = recommend_course_path_with_llm(
        course_name,
        business_need,
        (payload.get("skill_gap", "") or "").strip(),
    )
    entity_id = payload.get("entity_id", "")
    entity_type = payload.get("entity_type", "")
    if entity_id and entity_type:
        persist_agent_run("course_recommendation", "Course Recommendation Agent", payload, result, entity_id, entity_type, payload.get("trigger_event", "manual_run"))
    return result


@app.post("/api/ai/recommend-trainers")
def recommend_trainers(payload: dict):
    result = recommend_trainers_with_llm(
        payload.get("course_name", ""),
        payload.get("category", ""),
        payload.get("skill_gap", ""),
    )
    entity_id = payload.get("entity_id", "")
    entity_type = payload.get("entity_type", "")
    if entity_id and entity_type:
        persist_agent_run("trainer_recommendation", "Trainer Recommendation Agent", payload, result, entity_id, entity_type, payload.get("trigger_event", "manual_run"))
    return result


@app.post("/api/ai/recommend-participants")
def recommend_participants(payload: dict):
    request_kind = payload.get("request_kind", "")
    request_id = payload.get("request_id", "")
    limit = int(payload.get("limit", 5) or 5)
    result = recommend_participants_for_request(request_kind, request_id, limit)
    persist_agent_run(
        "participant_recommendation",
        "Participant Recommendation Agent",
        payload,
        result,
        request_id,
        agent_entity_type_from_kind(request_kind),
        payload.get("trigger_event", "manual_run"),
    )
    return result



@app.post("/api/ai/registration-automation")
def registration_automation(payload: dict):
    result = run_registration_automation(
        payload.get("request_type", ""),
        payload.get("request_id", ""),
        payload.get("performed_by", "Registration Automation Agent"),
    )
    persist_agent_run(
        "registration_automation",
        "Registration Automation Agent",
        payload,
        result,
        payload.get("request_id", ""),
        agent_entity_type_from_kind(payload.get("request_type", "")),
        payload.get("trigger_event", "manual_run"),
    )
    return result


@app.post("/api/ai/run-reminders")
def run_reminders(payload: dict = {}):
    result = run_reminder_agent(payload.get("performed_by", "Reminder Agent"))
    persist_agent_run(
        "reminder_agent",
        "Reminder Agent",
        payload,
        result,
        payload.get("entity_id", "GLOBAL"),
        payload.get("entity_type", "Reminder Batch"),
        payload.get("trigger_event", "manual_run"),
    )
    return result


@app.get("/api/ai/agent-runs")
def get_agent_runs(entity_id: Optional[str] = None, entity_type: Optional[str] = None, limit: int = 20):
    conn = get_connection()
    query = "SELECT * FROM ai_agent_runs"
    params = []
    clauses = []
    if entity_id:
        clauses.append("entity_id=?")
        params.append(entity_id)
    if entity_type:
        clauses.append("entity_type=?")
        params.append(entity_type)
    if clauses:
        query += " WHERE " + " AND ".join(clauses)
    query += " ORDER BY created_at DESC LIMIT ?"
    params.append(max(1, min(limit, 100)))
    runs = rows(conn.execute(query, tuple(params)))
    conn.close()
    for agent_run in runs:
        agent_run["input_payload"] = json.loads(agent_run.get("input_payload") or "{}")
        agent_run["output_payload"] = json.loads(agent_run.get("output_payload") or "{}")
    return runs


@app.post("/api/ai/check-duplicate")
def check_duplicate(payload: dict):
    conn = get_connection()
    r = row(conn.execute(
        "SELECT * FROM registration_requests WHERE employee_id=? AND training_id=? AND status != 'Rejected'",
        (payload.get("employee_id", ""), payload.get("training_id", ""))
    ))
    conn.close()
    if r:
        return {"duplicate": True, "message": f"Active request {r['request_id']} already exists for this course"}
    return {"duplicate": False, "message": "No duplicate request detected"}


@app.post("/api/ai/validate-eligibility")
def validate_eligibility(payload: dict):
    conn = get_connection()
    t = row(conn.execute("SELECT * FROM trainings WHERE training_id=?", (payload.get("training_id", ""),)))
    conn.close()
    if t and t["seats_available"] <= 0:
        return {"eligible": False, "message": "No seats available for this training"}
    seats = t["seats_available"] if t else "?"
    return {"eligible": True, "message": f"Employee is eligible. {seats} seats available"}
