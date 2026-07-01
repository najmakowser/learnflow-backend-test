import hashlib
import os
import sqlite3

try:
    import psycopg
except ImportError:
    psycopg = None

BASE_DIR = os.path.dirname(__file__)
DATA_DIR = os.environ.get("LMS_DATA_DIR", BASE_DIR)
POSTGRES_DSN = (
    os.environ.get("DATABASE_URL")
    or os.environ.get("POSTGRES_DSN")
    or os.environ.get("TARGET_POSTGRES_DSN")
    or ""
).strip()


def ensure_data_dir(path: str) -> str:
    try:
        os.makedirs(path, exist_ok=True)
        return path
    except PermissionError:
        if POSTGRES_DSN:
            return BASE_DIR
        raise


DATA_DIR = ensure_data_dir(DATA_DIR)
DB_PATH = os.environ.get("LMS_DB_PATH", os.path.join(DATA_DIR, "lms.db"))

SQLITE_BOOTSTRAP = """
CREATE TABLE IF NOT EXISTS employees (
    employee_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    department TEXT,
    business_unit TEXT,
    designation TEXT,
    manager_id TEXT,
    current_skills TEXT,
    role TEXT DEFAULT 'employee'
);

CREATE TABLE IF NOT EXISTS trainings (
    training_id TEXT PRIMARY KEY,
    course_name TEXT NOT NULL,
    category TEXT,
    mode TEXT,
    duration TEXT,
    trainer_name TEXT,
    training_date TEXT,
    seats_available INTEGER,
    skill_tags TEXT,
    status TEXT DEFAULT 'Active',
    batches TEXT,
    curriculum_file_name TEXT DEFAULT '',
    curriculum_file_url TEXT DEFAULT '',
    source_request_id TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS registration_requests (
    request_id TEXT PRIMARY KEY,
    request_type TEXT DEFAULT 'Self',
    employee_id TEXT,
    employee_name TEXT,
    email TEXT,
    department TEXT,
    business_unit TEXT,
    designation TEXT,
    manager_id TEXT,
    reporting_manager TEXT,
    training_id TEXT,
    course_name TEXT,
    training_mode TEXT,
    preferred_batch TEXT,
    reason TEXT,
    expected_outcome TEXT,
    status TEXT DEFAULT 'Pending L&D Validation',
    submitted_date TEXT,
    ld_validated_date TEXT,
    manager_approved_date TEXT,
    ld_remarks TEXT,
    manager_remarks TEXT,
    confirmation_sent INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS nomination_requests (
    nomination_id TEXT PRIMARY KEY,
    manager_id TEXT,
    manager_name TEXT,
    manager_email TEXT,
    department TEXT,
    business_unit TEXT,
    training_id TEXT,
    course_name TEXT,
    business_need TEXT,
    skill_gap TEXT,
    priority TEXT,
    target_completion_date TEXT,
    status TEXT DEFAULT 'Pending L&D Validation',
    submitted_date TEXT,
    ld_validated_date TEXT,
    manager_approved_date TEXT,
    ld_remarks TEXT,
    manager_remarks TEXT,
    assigned_to_id TEXT,
    assigned_to_name TEXT
);

CREATE TABLE IF NOT EXISTS nomination_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nomination_id TEXT,
    employee_id TEXT,
    employee_name TEXT,
    email TEXT,
    department TEXT,
    current_skill_level TEXT,
    required_skill_level TEXT,
    nomination_reason TEXT,
    status TEXT DEFAULT 'Nominated',
    confirmation_sent INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS course_requests (
    request_id TEXT PRIMARY KEY,
    request_type TEXT DEFAULT 'New Course',
    manager_id TEXT,
    manager_name TEXT,
    manager_email TEXT,
    department TEXT,
    business_unit TEXT,
    course_name TEXT,
    category TEXT,
    mode TEXT,
    duration TEXT,
    business_need TEXT,
    skill_gap TEXT,
    expected_participants INTEGER,
    priority TEXT DEFAULT 'Medium',
    expected_start_date TEXT,
    additional_notes TEXT,
    status TEXT DEFAULT 'Pending L&D Validation',
    submitted_date TEXT,
    ld_validated_date TEXT,
    fh_remarks TEXT,
    ld_remarks TEXT,
    assigned_to_id TEXT,
    assigned_to_name TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT,
    performed_by TEXT,
    role TEXT,
    timestamp TEXT,
    remarks TEXT,
    entity_id TEXT,
    entity_type TEXT
);

CREATE TABLE IF NOT EXISTS ai_agent_runs (
    run_id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_key TEXT NOT NULL,
    agent_label TEXT NOT NULL,
    entity_id TEXT,
    entity_type TEXT,
    trigger_event TEXT,
    input_payload TEXT,
    output_payload TEXT,
    created_at TEXT NOT NULL
);
"""

POSTGRES_BOOTSTRAP = [
    """
    CREATE TABLE IF NOT EXISTS employees (
        employee_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        department TEXT,
        business_unit TEXT,
        designation TEXT,
        manager_id TEXT,
        current_skills TEXT,
        role TEXT DEFAULT 'employee',
        password_hash TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS trainings (
        training_id TEXT PRIMARY KEY,
        course_name TEXT NOT NULL,
        category TEXT,
        mode TEXT,
        duration TEXT,
        trainer_name TEXT,
        training_date TEXT,
        seats_available BIGINT,
        skill_tags TEXT,
        status TEXT DEFAULT 'Active',
        batches TEXT,
        curriculum_file_name TEXT DEFAULT '',
        curriculum_file_url TEXT DEFAULT '',
        source_request_id TEXT DEFAULT ''
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS registration_requests (
        request_id TEXT PRIMARY KEY,
        request_type TEXT DEFAULT 'Self',
        employee_id TEXT,
        employee_name TEXT,
        email TEXT,
        department TEXT,
        business_unit TEXT,
        designation TEXT,
        manager_id TEXT,
        reporting_manager TEXT,
        training_id TEXT,
        course_name TEXT,
        training_mode TEXT,
        preferred_batch TEXT,
        training_date TEXT,
        reason TEXT,
        expected_outcome TEXT,
        status TEXT DEFAULT 'Pending L&D Validation',
        submitted_date TEXT,
        ld_validated_date TEXT,
        manager_approved_date TEXT,
        ld_remarks TEXT,
        manager_remarks TEXT,
        confirmation_sent INTEGER DEFAULT 0,
        curriculum_title TEXT,
        curriculum_outline TEXT,
        curriculum_link TEXT,
        curriculum_uploaded_date TEXT,
        curriculum_uploaded_by TEXT,
        curriculum_approved_date TEXT,
        curriculum_rejection_reason TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS nomination_requests (
        nomination_id TEXT PRIMARY KEY,
        manager_id TEXT,
        manager_name TEXT,
        manager_email TEXT,
        department TEXT,
        business_unit TEXT,
        training_id TEXT,
        course_name TEXT,
        business_need TEXT,
        skill_gap TEXT,
        priority TEXT,
        training_date TEXT,
        target_completion_date TEXT,
        status TEXT DEFAULT 'Pending L&D Validation',
        submitted_date TEXT,
        ld_validated_date TEXT,
        manager_approved_date TEXT,
        ld_remarks TEXT,
        manager_remarks TEXT,
        curriculum_title TEXT,
        curriculum_outline TEXT,
        curriculum_link TEXT,
        curriculum_uploaded_date TEXT,
        curriculum_uploaded_by TEXT,
        curriculum_approved_date TEXT,
        curriculum_rejection_reason TEXT,
        assigned_to_id TEXT,
        assigned_to_name TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS nomination_participants (
        id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        nomination_id TEXT,
        employee_id TEXT,
        employee_name TEXT,
        email TEXT,
        department TEXT,
        current_skill_level TEXT,
        required_skill_level TEXT,
        nomination_reason TEXT,
        status TEXT DEFAULT 'Nominated',
        confirmation_sent INTEGER DEFAULT 0
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS course_requests (
        request_id TEXT PRIMARY KEY,
        request_type TEXT DEFAULT 'New Course',
        manager_id TEXT,
        manager_name TEXT,
        manager_email TEXT,
        department TEXT,
        business_unit TEXT,
        course_name TEXT,
        category TEXT,
        mode TEXT,
        duration TEXT,
        business_need TEXT,
        skill_gap TEXT,
        expected_participants INTEGER,
        priority TEXT DEFAULT 'Medium',
        expected_start_date TEXT,
        additional_notes TEXT,
        status TEXT DEFAULT 'Pending L&D Validation',
        submitted_date TEXT,
        ld_validated_date TEXT,
        fh_remarks TEXT,
        ld_remarks TEXT,
        curriculum_title TEXT,
        curriculum_outline TEXT,
        curriculum_link TEXT,
        curriculum_uploaded_date TEXT,
        curriculum_uploaded_by TEXT,
        curriculum_approved_date TEXT,
        curriculum_rejection_reason TEXT,
        manager_approved_date TEXT,
        assigned_to_id TEXT,
        assigned_to_name TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS audit_logs (
        log_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        action TEXT,
        performed_by TEXT,
        role TEXT,
        timestamp TEXT,
        remarks TEXT,
        entity_id TEXT,
        entity_type TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS ai_agent_runs (
        run_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        agent_key TEXT NOT NULL,
        agent_label TEXT NOT NULL,
        entity_id TEXT,
        entity_type TEXT,
        trigger_event TEXT,
        input_payload TEXT,
        output_payload TEXT,
        created_at TEXT NOT NULL
    )
    """,
]

SQLITE_ALTER_STATEMENTS = [
    "ALTER TABLE employees ADD COLUMN password_hash TEXT",
    "ALTER TABLE registration_requests ADD COLUMN manager_id TEXT",
    "ALTER TABLE registration_requests ADD COLUMN training_date TEXT",
    "ALTER TABLE nomination_requests ADD COLUMN training_date TEXT",
    "ALTER TABLE nomination_requests ADD COLUMN curriculum_title TEXT",
    "ALTER TABLE nomination_requests ADD COLUMN curriculum_outline TEXT",
    "ALTER TABLE nomination_requests ADD COLUMN curriculum_link TEXT",
    "ALTER TABLE nomination_requests ADD COLUMN curriculum_uploaded_date TEXT",
    "ALTER TABLE registration_requests ADD COLUMN curriculum_title TEXT",
    "ALTER TABLE registration_requests ADD COLUMN curriculum_outline TEXT",
    "ALTER TABLE registration_requests ADD COLUMN curriculum_link TEXT",
    "ALTER TABLE registration_requests ADD COLUMN curriculum_uploaded_date TEXT",
    "ALTER TABLE nomination_requests ADD COLUMN curriculum_approved_date TEXT",
    "ALTER TABLE nomination_requests ADD COLUMN curriculum_rejection_reason TEXT",
    "ALTER TABLE registration_requests ADD COLUMN curriculum_approved_date TEXT",
    "ALTER TABLE registration_requests ADD COLUMN curriculum_rejection_reason TEXT",
    "ALTER TABLE nomination_requests ADD COLUMN curriculum_uploaded_by TEXT",
    "ALTER TABLE registration_requests ADD COLUMN curriculum_uploaded_by TEXT",
    "ALTER TABLE course_requests ADD COLUMN curriculum_title TEXT",
    "ALTER TABLE course_requests ADD COLUMN curriculum_outline TEXT",
    "ALTER TABLE course_requests ADD COLUMN curriculum_link TEXT",
    "ALTER TABLE course_requests ADD COLUMN curriculum_uploaded_date TEXT",
    "ALTER TABLE course_requests ADD COLUMN curriculum_uploaded_by TEXT",
    "ALTER TABLE course_requests ADD COLUMN curriculum_approved_date TEXT",
    "ALTER TABLE course_requests ADD COLUMN curriculum_rejection_reason TEXT",
    "ALTER TABLE course_requests ADD COLUMN manager_approved_date TEXT",
    "ALTER TABLE course_requests ADD COLUMN fh_remarks TEXT",
    "ALTER TABLE nomination_requests ADD COLUMN assigned_to_id TEXT",
    "ALTER TABLE nomination_requests ADD COLUMN assigned_to_name TEXT",
    "ALTER TABLE nomination_requests ADD COLUMN fh_id TEXT",
    "ALTER TABLE nomination_requests ADD COLUMN fh_name TEXT",
    "ALTER TABLE nomination_requests ADD COLUMN requested_by_fh INTEGER DEFAULT 0",
    "ALTER TABLE nomination_requests ADD COLUMN seen_by_manager INTEGER DEFAULT 0",
    "ALTER TABLE course_requests ADD COLUMN fh_id TEXT",
    "ALTER TABLE course_requests ADD COLUMN fh_name TEXT",
    "ALTER TABLE course_requests ADD COLUMN requested_by_fh INTEGER DEFAULT 0",
    "ALTER TABLE course_requests ADD COLUMN seen_by_manager INTEGER DEFAULT 0",
    "ALTER TABLE course_requests ADD COLUMN assigned_to_id TEXT",
    "ALTER TABLE course_requests ADD COLUMN assigned_to_name TEXT",
    "ALTER TABLE registration_requests ADD COLUMN assigned_to_id TEXT",
    "ALTER TABLE registration_requests ADD COLUMN assigned_to_name TEXT",
    "ALTER TABLE trainings ADD COLUMN curriculum_file_name TEXT",
    "ALTER TABLE trainings ADD COLUMN curriculum_file_url TEXT",
    "ALTER TABLE trainings ADD COLUMN training_date TEXT",
    """CREATE TABLE IF NOT EXISTS course_request_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id TEXT,
    employee_id TEXT,
    employee_name TEXT,
    email TEXT,
    department TEXT,
    status TEXT DEFAULT 'Enrolled',
    confirmation_sent INTEGER DEFAULT 0
)""",
    "ALTER TABLE course_requests ADD COLUMN training_id TEXT",
    "ALTER TABLE course_requests ADD COLUMN requested_by_rm INTEGER DEFAULT 0",
    "ALTER TABLE course_requests ADD COLUMN fh_approved_note TEXT",
    # trainer + date on request tables (set only by L&D)
    "ALTER TABLE course_requests ADD COLUMN trainer_name TEXT",
    "ALTER TABLE course_requests ADD COLUMN training_date TEXT",
    "ALTER TABLE nomination_requests ADD COLUMN trainer_name TEXT",
    "ALTER TABLE course_requests ADD COLUMN participants_requested_date TEXT",
    "ALTER TABLE nomination_requests ADD COLUMN participants_requested_date TEXT",
    "ALTER TABLE nomination_requests ADD COLUMN curriculum_rejection_comment TEXT",
    "ALTER TABLE course_requests ADD COLUMN curriculum_rejection_comment TEXT",
    # L&D Training Release flow
    "ALTER TABLE trainings ADD COLUMN released_to_domains TEXT DEFAULT ''",
    "ALTER TABLE trainings ADD COLUMN release_date TEXT DEFAULT ''",
    "ALTER TABLE trainings ADD COLUMN curriculum_summary TEXT DEFAULT ''",
    "ALTER TABLE trainings ADD COLUMN curriculum_file_name TEXT DEFAULT ''",
    "ALTER TABLE trainings ADD COLUMN curriculum_file_url TEXT DEFAULT ''",
    # Release notifications for FH/RM
    """CREATE TABLE IF NOT EXISTS release_notifications (
        id TEXT PRIMARY KEY,
        training_id TEXT NOT NULL,
        course_name TEXT NOT NULL,
        released_by TEXT NOT NULL,
        released_at TEXT NOT NULL,
        released_to_domains TEXT DEFAULT '',
        category TEXT DEFAULT '',
        mode TEXT DEFAULT '',
        training_date TEXT DEFAULT '',
        trainer_name TEXT DEFAULT '',
        curriculum_summary TEXT DEFAULT '',
        curriculum_file_url TEXT DEFAULT '',
        curriculum_file_name TEXT DEFAULT '',
        recipient_employee_id TEXT NOT NULL,
        recipient_role TEXT NOT NULL,
        seen INTEGER DEFAULT 0
    )""",
]

POSTGRES_ALTER_STATEMENTS = [
    "ALTER TABLE employees ADD COLUMN IF NOT EXISTS password_hash TEXT",
    "ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS manager_id TEXT",
    "ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS training_date TEXT",
    "ALTER TABLE nomination_requests ADD COLUMN IF NOT EXISTS training_date TEXT",
    "ALTER TABLE nomination_requests ADD COLUMN IF NOT EXISTS curriculum_title TEXT",
    "ALTER TABLE nomination_requests ADD COLUMN IF NOT EXISTS curriculum_outline TEXT",
    "ALTER TABLE nomination_requests ADD COLUMN IF NOT EXISTS curriculum_link TEXT",
    "ALTER TABLE nomination_requests ADD COLUMN IF NOT EXISTS curriculum_uploaded_date TEXT",
    "ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS curriculum_title TEXT",
    "ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS curriculum_outline TEXT",
    "ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS curriculum_link TEXT",
    "ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS curriculum_uploaded_date TEXT",
    "ALTER TABLE nomination_requests ADD COLUMN IF NOT EXISTS curriculum_approved_date TEXT",
    "ALTER TABLE nomination_requests ADD COLUMN IF NOT EXISTS curriculum_rejection_reason TEXT",
    "ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS curriculum_approved_date TEXT",
    "ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS curriculum_rejection_reason TEXT",
    "ALTER TABLE nomination_requests ADD COLUMN IF NOT EXISTS curriculum_uploaded_by TEXT",
    "ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS curriculum_uploaded_by TEXT",
    "ALTER TABLE course_requests ADD COLUMN IF NOT EXISTS curriculum_title TEXT",
    "ALTER TABLE course_requests ADD COLUMN IF NOT EXISTS curriculum_outline TEXT",
    "ALTER TABLE course_requests ADD COLUMN IF NOT EXISTS curriculum_link TEXT",
    "ALTER TABLE course_requests ADD COLUMN IF NOT EXISTS curriculum_uploaded_date TEXT",
    "ALTER TABLE course_requests ADD COLUMN IF NOT EXISTS curriculum_uploaded_by TEXT",
    "ALTER TABLE course_requests ADD COLUMN IF NOT EXISTS curriculum_approved_date TEXT",
    "ALTER TABLE course_requests ADD COLUMN IF NOT EXISTS curriculum_rejection_reason TEXT",
    "ALTER TABLE course_requests ADD COLUMN IF NOT EXISTS manager_approved_date TEXT",
    "ALTER TABLE course_requests ADD COLUMN IF NOT EXISTS fh_remarks TEXT",
    "ALTER TABLE nomination_requests ADD COLUMN IF NOT EXISTS assigned_to_id TEXT",
    "ALTER TABLE nomination_requests ADD COLUMN IF NOT EXISTS assigned_to_name TEXT",
    "ALTER TABLE course_requests ADD COLUMN IF NOT EXISTS assigned_to_id TEXT",
    "ALTER TABLE course_requests ADD COLUMN IF NOT EXISTS assigned_to_name TEXT",
    "ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS assigned_to_id TEXT",
    "ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS assigned_to_name TEXT",
    "ALTER TABLE trainings ADD COLUMN IF NOT EXISTS curriculum_file_name TEXT",
    "ALTER TABLE trainings ADD COLUMN IF NOT EXISTS curriculum_file_url TEXT",
    "ALTER TABLE trainings ADD COLUMN IF NOT EXISTS training_date TEXT",
    # trainer + date on request tables (set only by L&D)
    "ALTER TABLE course_requests ADD COLUMN IF NOT EXISTS trainer_name TEXT",
    "ALTER TABLE course_requests ADD COLUMN IF NOT EXISTS training_date TEXT",
    "ALTER TABLE nomination_requests ADD COLUMN IF NOT EXISTS trainer_name TEXT",
    # participants_requested_date tracks when L&D asked manager to nominate
    "ALTER TABLE course_requests ADD COLUMN IF NOT EXISTS participants_requested_date TEXT",
    "ALTER TABLE nomination_requests ADD COLUMN IF NOT EXISTS participants_requested_date TEXT",
    # rejection comment from manager on curriculum
    "ALTER TABLE nomination_requests ADD COLUMN IF NOT EXISTS curriculum_rejection_comment TEXT",
    "ALTER TABLE course_requests ADD COLUMN IF NOT EXISTS curriculum_rejection_comment TEXT",
    "ALTER TABLE course_requests ADD COLUMN IF NOT EXISTS training_id TEXT",
    "ALTER TABLE course_requests ADD COLUMN IF NOT EXISTS requested_by_rm INTEGER DEFAULT 0",
    "ALTER TABLE course_requests ADD COLUMN IF NOT EXISTS fh_approved_note TEXT",
    # L&D Training Release flow
    "ALTER TABLE trainings ADD COLUMN IF NOT EXISTS released_to_domains TEXT DEFAULT ''",
    "ALTER TABLE trainings ADD COLUMN IF NOT EXISTS release_date TEXT DEFAULT ''",
    "ALTER TABLE trainings ADD COLUMN IF NOT EXISTS curriculum_summary TEXT DEFAULT ''",
    "ALTER TABLE trainings ADD COLUMN IF NOT EXISTS curriculum_file_name TEXT DEFAULT ''",
    "ALTER TABLE trainings ADD COLUMN IF NOT EXISTS curriculum_file_url TEXT DEFAULT ''",
]


def using_postgres() -> bool:
    return bool(POSTGRES_DSN)


def _postgres_dsn() -> str:
    if not POSTGRES_DSN:
        return ""
    if "sslmode=" in POSTGRES_DSN:
        return POSTGRES_DSN
    separator = "&" if "?" in POSTGRES_DSN else "?"
    return f"{POSTGRES_DSN}{separator}sslmode=require"


def _translate_qmark_placeholders(query: str) -> str:
    translated = []
    in_single_quote = False
    index = 0
    while index < len(query):
        char = query[index]
        if char == "'":
            translated.append(char)
            if in_single_quote and index + 1 < len(query) and query[index + 1] == "'":
                translated.append(query[index + 1])
                index += 2
                continue
            in_single_quote = not in_single_quote
        elif char == "?" and not in_single_quote:
            translated.append("%s")
        else:
            translated.append(char)
        index += 1
    return "".join(translated)


class PostgresCursorAdapter:
    def __init__(self, cursor):
        self._cursor = cursor

    def execute(self, query, params=None):
        if params is None:
            self._cursor.execute(_translate_qmark_placeholders(query))
        else:
            self._cursor.execute(_translate_qmark_placeholders(query), params)
        return self

    def executemany(self, query, param_sets):
        self._cursor.executemany(_translate_qmark_placeholders(query), param_sets)
        return self

    def fetchone(self):
        return self._cursor.fetchone()

    def fetchall(self):
        return self._cursor.fetchall()

    @property
    def description(self):
        return self._cursor.description

    def __getattr__(self, name):
        return getattr(self._cursor, name)


class PostgresConnectionAdapter:
    def __init__(self, connection):
        self._connection = connection

    def cursor(self):
        return PostgresCursorAdapter(self._connection.cursor())

    def execute(self, query, params=None):
        cursor = self.cursor()
        return cursor.execute(query, params)

    def executemany(self, query, param_sets):
        cursor = self.cursor()
        return cursor.executemany(query, param_sets)

    def commit(self):
        self._connection.commit()

    def rollback(self):
        self._connection.rollback()

    def close(self):
        self._connection.close()

    def __getattr__(self, name):
        return getattr(self._connection, name)

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def default_password_for_user(employee_id: str) -> str:
    employee_token = (employee_id or "USER000").strip().upper()
    return f"LS@{employee_token}#2026"


def get_connection():
    if using_postgres():
        if psycopg is None:
            raise RuntimeError("PostgreSQL support requires psycopg. Install backend requirements first.")
        return PostgresConnectionAdapter(psycopg.connect(_postgres_dsn()))
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    conn = get_connection()
    c = conn.cursor()

    if using_postgres():
        for stmt in POSTGRES_BOOTSTRAP:
            c.execute(stmt)
        for stmt in POSTGRES_ALTER_STATEMENTS:
            c.execute(stmt)
    else:
        c.executescript(SQLITE_BOOTSTRAP)
        for stmt in SQLITE_ALTER_STATEMENTS:
            try:
                c.execute(stmt)
            except Exception:
                pass

    c.execute(
        """UPDATE registration_requests
        SET manager_id = (
            SELECT employees.manager_id
            FROM employees
            WHERE employees.employee_id = registration_requests.employee_id
        )
        WHERE manager_id IS NULL OR manager_id=''"""
    )

    # Fix legacy statuses — everything should start at "Pending L&D Validation"
    c.execute(
        "UPDATE nomination_requests SET status='Pending L&D Validation' WHERE status='Pending L&D Manager Review'"
    )
    c.execute(
        "UPDATE nomination_requests SET status='Pending L&D Validation' WHERE status='Pending Manager Approval'"
    )
    c.execute(
        "UPDATE course_requests SET status='Pending L&D Validation' WHERE status IN ('Pending L&D Manager Review', 'Under Review')"
    )

    # Add designation column to participant tables if missing
    for tbl in ("nomination_participants", "course_request_participants"):
        try:
            c.execute(f"ALTER TABLE {tbl} ADD COLUMN designation TEXT")
        except Exception:
            pass

    # Fix nominations stuck at "Finalized" when all participants already have emails sent
    c.execute("""
        UPDATE nomination_requests
        SET status='Enrolled'
        WHERE status='Finalized'
        AND nomination_id IN (
            SELECT nomination_id FROM nomination_participants
            GROUP BY nomination_id
            HAVING COUNT(*) > 0 AND SUM(CASE WHEN confirmation_sent=0 THEN 1 ELSE 0 END) = 0
        )
    """)

    # Fix course_requests that were "Finalized" without any participants being inserted
    # (caused by old bug where finalize endpoint didn't insert into course_request_participants).
    # Reset them to "Participants Requested" so the RM can re-nominate.
    c.execute("""
        UPDATE course_requests
        SET status='Participants Requested'
        WHERE status='Finalized'
        AND request_id NOT IN (
            SELECT DISTINCT request_id FROM course_request_participants
        )
    """)

    # Similarly, advance course_requests to "Enrolled" if all participants have emails sent
    c.execute("""
        UPDATE course_requests
        SET status='Enrolled'
        WHERE status='Finalized'
        AND request_id IN (
            SELECT request_id FROM course_request_participants
            GROUP BY request_id
            HAVING COUNT(*) > 0 AND SUM(CASE WHEN confirmation_sent=0 THEN 1 ELSE 0 END) = 0
        )
    """)

    # Backfill: create Training Catalog entries for course_requests that were enrolled
    # before the auto-catalog feature was added (no training_id set yet).
    import uuid as _uuid
    enrolled_crqs = c.execute("""
        SELECT request_id, course_name, category, mode, duration,
               trainer_name, training_date, additional_notes
        FROM course_requests
        WHERE status = 'Enrolled'
          AND (training_id IS NULL OR training_id = '')
    """).fetchall()

    for crq in enrolled_crqs:
        tid = "TRN" + _uuid.uuid4().hex[:6].upper()
        c.execute(
            """INSERT INTO trainings
               (training_id, course_name, category, mode, duration, trainer_name,
                seats_available, skill_tags, status, training_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                tid,
                crq[1],                        # course_name
                crq[2] or "",                  # category
                crq[3] or "Online",            # mode
                crq[4] or "",                  # duration
                crq[5] or "",                  # trainer_name
                30,
                crq[2] or "",                  # skill_tags = category
                "Active",
                crq[6] or "",                  # training_date
            )
        )
        c.execute(
            "UPDATE course_requests SET training_id=? WHERE request_id=?",
            (tid, crq[0])
        )

    # ── Repair RM-initiated course requests that bypassed FH approval ──────────
    # Any course_request submitted by a 'manager' role employee with requested_by_fh=0
    # that landed in 'Pending L&D Validation' without going through FH should be
    # redirected back to 'Pending FH Approval' and have requested_by_rm set correctly.
    c.execute("""
        UPDATE course_requests
        SET status = 'Pending FH Approval',
            requested_by_rm = 1,
            fh_id = COALESCE(
                NULLIF(fh_id, ''),
                (SELECT e.manager_id FROM employees e WHERE e.employee_id = course_requests.manager_id AND e.role = 'manager')
            ),
            fh_name = COALESCE(
                NULLIF(fh_name, ''),
                (SELECT fh.name FROM employees fh
                 JOIN employees rm ON rm.manager_id = fh.employee_id
                 WHERE rm.employee_id = course_requests.manager_id AND rm.role = 'manager'
                   AND fh.role = 'functional_head')
            )
        WHERE status = 'Pending L&D Validation'
          AND requested_by_fh = 0
          AND requested_by_rm = 0
          AND manager_id IN (SELECT employee_id FROM employees WHERE role = 'manager')
    """)

    conn.commit()
    conn.close()
