"""
FH Dashboard PDF generator - called from main.py via /api/fh-summary-pdf.
Produces a structured, visually rich A4 report for Functional Head logins.
Content width = 210mm - 18mm - 18mm = 174mm = 17.4cm. All table colWidths must sum <= 17.4cm.
"""
import io
import re
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm, cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

W, H = A4
CW = W - 36 * mm  # 174mm content width

# ── Brand palette ──────────────────────────────────────────────────────────────
BRAND       = colors.HexColor("#1e40af")
BRAND_DARK  = colors.HexColor("#1e3a8a")
BRAND_MID   = colors.HexColor("#2563eb")
BRAND_LIGHT = colors.HexColor("#dbeafe")
INDIGO      = colors.HexColor("#4338ca")
TEAL        = colors.HexColor("#0d9488")
TEAL_LIGHT  = colors.HexColor("#ccfbf1")
AMBER       = colors.HexColor("#d97706")
AMBER_LIGHT = colors.HexColor("#fef3c7")
RED         = colors.HexColor("#dc2626")
RED_LIGHT   = colors.HexColor("#fee2e2")
EMERALD     = colors.HexColor("#059669")
EMERALD_LIGHT = colors.HexColor("#d1fae5")
VIOLET      = colors.HexColor("#7c3aed")
S700        = colors.HexColor("#334155")
S600        = colors.HexColor("#475569")
S400        = colors.HexColor("#94a3b8")
S200        = colors.HexColor("#e2e8f0")
S100        = colors.HexColor("#f1f5f9")
S50         = colors.HexColor("#f8fafc")
WHITE       = colors.white

STATUS_COLORS = {
    "Pending FH Approval":    (AMBER,   AMBER_LIGHT),
    "Pending L&D Validation": (BRAND,   BRAND_LIGHT),
    "Approved":               (EMERALD, EMERALD_LIGHT),
    "Curriculum Shared":      (INDIGO,  colors.HexColor("#ede9fe")),
    "Curriculum Approved":    (TEAL,    TEAL_LIGHT),
    "Participants Requested": (VIOLET,  colors.HexColor("#ede9fe")),
    "Finalized":              (TEAL,    TEAL_LIGHT),
    "Enrolled":               (TEAL,    TEAL_LIGHT),
    "Rejected":               (RED,     RED_LIGHT),
}


def _hex(c):
    try:
        return "#{:02x}{:02x}{:02x}".format(
            int(c.red * 255), int(c.green * 255), int(c.blue * 255))
    except Exception:
        return "#334155"


def _esc(text):
    """Escape & so ReportLab's XML Paragraph parser renders it correctly."""
    if text is None:
        return ""
    return str(text).replace("&", "&amp;")


def _mk_styles():
    N = getSampleStyleSheet()["Normal"]
    def s(name, **kw):
        return ParagraphStyle(name, parent=N, **kw)
    return {
        "cov_org":   s("c0",  fontSize=10, textColor=colors.HexColor("#93c5fd"), alignment=TA_CENTER),
        "cov_big":   s("c1",  fontSize=26, textColor=WHITE, fontName="Helvetica-Bold", alignment=TA_CENTER, leading=32),
        "cov_name":  s("c2",  fontSize=18, textColor=WHITE, fontName="Helvetica-Bold", alignment=TA_CENTER),
        "cov_des":   s("c3",  fontSize=11, textColor=colors.HexColor("#bfdbfe"), alignment=TA_CENTER),
        "cov_dep":   s("c4",  fontSize=10, textColor=colors.HexColor("#93c5fd"), alignment=TA_CENTER),
        "cov_met":   s("c5",  fontSize=9,  textColor=colors.HexColor("#93c5fd"), alignment=TA_CENTER, leading=14),
        "cov_ft":    s("c6",  fontSize=8,  textColor=colors.HexColor("#60a5fa"), alignment=TA_CENTER),
        "kpi_num":   s("k1",  fontSize=24, textColor=WHITE, fontName="Helvetica-Bold", alignment=TA_CENTER),
        "kpi_lbl":   s("k2",  fontSize=8,  textColor=WHITE, alignment=TA_CENTER, leading=11),
        "sec":       s("s1",  fontSize=13, textColor=WHITE, fontName="Helvetica-Bold", leading=17),
        "sec_sub":   s("s2",  fontSize=9,  textColor=colors.HexColor("#bfdbfe"), leading=13),
        "sec_num":   s("s3",  fontSize=10, textColor=colors.HexColor("#93c5fd"), fontName="Helvetica-Bold"),
        "sub":       s("sb",  fontSize=10, textColor=BRAND, fontName="Helvetica-Bold", spaceBefore=6, spaceAfter=2, leading=13),
        "body":      s("bo",  fontSize=9,  textColor=S700, leading=14),
        "body_sm":   s("bs",  fontSize=8,  textColor=S600, leading=12),
        "cap":       s("ca",  fontSize=8,  textColor=S400, leading=12, spaceAfter=2),
        "ins":       s("in",  fontSize=9,  textColor=S700, leading=13),
        "ins_h":     s("ih",  fontSize=9,  textColor=BRAND_DARK, fontName="Helvetica-Bold", leading=13),
        "th":        s("th",  fontSize=8,  textColor=WHITE, fontName="Helvetica-Bold", leading=11),
        "tc":        s("tc",  fontSize=9,  textColor=S700, leading=12),
        "tcb":       s("tb",  fontSize=9,  textColor=S700, fontName="Helvetica-Bold", leading=12),
        "tcs":       s("ts",  fontSize=8,  textColor=S600, leading=11),
        "tcc":       s("tt",  fontSize=9,  textColor=S700, leading=12, alignment=TA_CENTER),
        "dis":       s("di",  fontSize=7,  textColor=S400, alignment=TA_CENTER, leading=11),
    }


def _base_ts(hdr_color=None):
    hc = hdr_color or BRAND
    return TableStyle([
        ("BACKGROUND",    (0, 0), (-1,  0), hc),
        ("TEXTCOLOR",     (0, 0), (-1,  0), WHITE),
        ("FONTNAME",      (0, 0), (-1,  0), "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1,  0), 8),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [WHITE, S50]),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 7),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 7),
        ("GRID",          (0, 0), (-1, -1), 0.3, S200),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("FONTNAME",      (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE",      (0, 1), (-1, -1), 8.5),
    ])


def _callout(ST, title, lines, bar_color=BRAND, bg=None):
    """Left-bar highlighted callout box."""
    bg = bg or BRAND_LIGHT
    rows = [[Paragraph("<b>{}</b>".format(_esc(title)), ST["ins_h"])]]
    for ln in lines:
        rows.append([Paragraph(u"•  " + _esc(ln), ST["ins"])])
    t = Table(rows, colWidths=[CW],
              style=TableStyle([
                  ("BACKGROUND",    (0, 0), (-1, -1), bg),
                  ("LEFTPADDING",   (0, 0), (-1, -1), 12),
                  ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
                  ("TOPPADDING",    (0, 0), (-1, -1), 6),
                  ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                  ("LINEAFTER",     (0, 0), (0,  -1), 3, bar_color),
              ]))
    return t


def _banner(ST, num, title, subtitle=""):
    """Full-width section header banner."""
    rows = [
        [Paragraph("SECTION {}".format(num), ST["sec_num"])],
        [Paragraph(_esc(title), ST["sec"])],
    ]
    if subtitle:
        rows.append([Paragraph(_esc(subtitle), ST["sec_sub"])])
    inner = Table(rows, colWidths=[CW - 20],
                  style=TableStyle([
                      ("BACKGROUND",    (0, 0), (-1, -1), BRAND),
                      ("LEFTPADDING",   (0, 0), (-1, -1), 0),
                      ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
                      ("TOPPADDING",    (0, 0), (-1, -1), 2),
                      ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                  ]))
    return Table([[inner]], colWidths=[CW],
                 style=TableStyle([
                     ("BACKGROUND",    (0, 0), (-1, -1), BRAND),
                     ("LEFTPADDING",   (0, 0), (-1, -1), 12),
                     ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
                     ("TOPPADDING",    (0, 0), (-1, -1), 10),
                     ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                 ]))


def _kpi_card(ST, number, label, num_color, bg):
    """A single KPI card: colored background, big number, label below."""
    return Table(
        [[Paragraph(str(number), ST["kpi_num"])],
         [Paragraph(_esc(label),  ST["kpi_lbl"])]],
        colWidths=[3.9 * cm],
        style=TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), bg),
            ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
            ("TOPPADDING",    (0, 0), (-1, -1), 12),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
            ("LEFTPADDING",   (0, 0), (-1, -1), 4),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 4),
        ]),
    )


def _status_p(ST, status):
    fg, bg = STATUS_COLORS.get(status, (S600, S100))
    return Paragraph(
        '<font color="{}">{}</font>'.format(_hex(fg), _esc(status)),
        ParagraphStyle("sp", parent=ST["tcb"], textColor=fg),
    )


def _bar(val, total):
    pct = min(100, round(val / total * 100)) if total else 0
    filled = round(pct / 5)
    return (u"█" * filled + u"░" * (20 - filled) + "  {}%".format(pct))


# ── Main generator ─────────────────────────────────────────────────────────────

def generate_fh_pdf(fh, my_managers, team_noms, team_crqs, upcoming):
    """Return (BytesIO, safe_name_stem) for the FH summary PDF."""
    fh_name  = fh.get("name", "Functional Head")
    fh_desig = fh.get("designation") or "Functional Head"
    fh_dept  = fh.get("department") or fh.get("business_unit") or ""
    fh_email = fh.get("email", "")
    fh_id    = fh.get("employee_id", "")
    rdate    = datetime.now().strftime("%d %B %Y")
    rtime    = datetime.now().strftime("%I:%M %p")

    for n in team_noms:
        n.setdefault("kind", "Nomination")
    for x in team_crqs:
        x.setdefault("kind", "Course Request")
    all_items = team_noms + team_crqs

    # Metrics
    total        = len(all_items)
    pending_fh   = sum(1 for x in team_crqs
                       if x.get("status") == "Pending FH Approval"
                       and (x.get("assigned_to_id") == fh_id
                            or x.get("assigned_to_name") == fh_name))
    raised_by_me = sum(1 for x in all_items if x.get("fh_id") == fh_id)
    ld_review    = sum(1 for x in all_items
                       if "L&D" in (x.get("status") or "") and "Pending" in (x.get("status") or ""))
    approved     = sum(1 for x in all_items if x.get("status") == "Approved")
    awaiting_nom = sum(1 for x in all_items if x.get("status") == "Participants Requested")
    enrolled     = sum(1 for x in all_items if x.get("status") in ("Finalized", "Enrolled"))
    rejected     = sum(1 for x in all_items if x.get("status") == "Rejected")
    enroll_rate  = round(enrolled / total * 100) if total else 0
    reject_rate  = round(rejected / total * 100) if total else 0

    status_dist = {}
    for x in all_items:
        s = x.get("status", "Unknown")
        status_dist[s] = status_dist.get(s, 0) + 1

    pipeline = [
        ("Pending My Approval",  pending_fh),
        ("L&D Review",           ld_review),
        ("Approved by L&D",      approved),
        ("Awaiting Nomination",  awaiting_nom),
        ("Enrolled / Finalized", enrolled),
        ("Rejected",             rejected),
    ]
    PIPE_COL = {
        "Pending My Approval": AMBER, "L&D Review": BRAND,
        "Approved by L&D": EMERALD,   "Awaiting Nomination": VIOLET,
        "Enrolled / Finalized": TEAL, "Rejected": RED,
    }
    PIPE_DESC = {
        "Pending My Approval":  "Course request submitted by a manager; awaiting your approval or rejection before it reaches L&D",
        "L&D Review":           "You approved it; the L&D team is now evaluating feasibility, budget, and scheduling",
        "Approved by L&D":      "L&D has approved the course; trainer, curriculum, and dates are being arranged",
        "Awaiting Nomination":  "Training is confirmed and scheduled; managers must now nominate specific participants",
        "Enrolled / Finalized": "Participants have been confirmed and enrolled - the training journey is complete",
        "Rejected":             "Request was declined at FH or L&D stage; check the portal remarks for the reason",
    }

    mgr_map = {m["employee_id"]: {
        "name": m.get("name", ""), "dept": m.get("department") or "—",
        "total": 0, "pending": 0, "active": 0, "enrolled": 0, "rejected": 0,
    } for m in my_managers}
    for item in all_items:
        mid = item.get("manager_id")
        if mid in mgr_map:
            mgr_map[mid]["total"] += 1
            st = item.get("status", "")
            if st in ("Pending FH Approval", "Pending L&D Validation", "Participants Requested"):
                mgr_map[mid]["pending"] += 1
            elif st in ("Finalized", "Enrolled"):
                mgr_map[mid]["enrolled"] += 1
            elif st == "Rejected":
                mgr_map[mid]["rejected"] += 1
            else:
                mgr_map[mid]["active"] += 1

    dept_dist = {}
    for x in all_items:
        d = x.get("department") or "—"
        dept_dist[d] = dept_dist.get(d, 0) + 1

    ST   = _mk_styles()
    buf  = io.BytesIO()

    def TH(t):  return Paragraph("<b>{}</b>".format(_esc(t)), ST["th"])
    def TC(t):  return Paragraph(_esc(t), ST["tc"])
    def TCB(t): return Paragraph("<b>{}</b>".format(_esc(t)), ST["tcb"])
    def TCS(t): return Paragraph(_esc(t), ST["tcs"])
    def TCC(t): return Paragraph("<b>{}</b>".format(_esc(t)),
                                  ParagraphStyle("tcc2", parent=ST["tcc"]))

    def footer(cv, doc):
        if doc.page == 1:
            return
        cv.saveState()
        cv.setFillColor(S200)
        cv.rect(doc.leftMargin, 16 * mm,
                W - doc.leftMargin - doc.rightMargin, 0.4, fill=1, stroke=0)
        cv.setFont("Helvetica", 7)
        cv.setFillColor(S400)
        cv.drawString(doc.leftMargin, 12 * mm,
                      "LevelShift LMS  |  FH Dashboard Summary  |  {}  |  {}".format(
                          fh_name, fh_dept))
        cv.drawRightString(W - doc.rightMargin, 12 * mm,
                           "Page {}  |  {}".format(doc.page, rdate))
        cv.restoreState()

    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm,
        topMargin=14 * mm,  bottomMargin=26 * mm,
        title="FH Dashboard Summary - {}".format(fh_name),
        author="LevelShift LMS",
    )
    story = []

    # ══════════════════════════════════════════════════════════════════════════
    # COVER PAGE
    # ══════════════════════════════════════════════════════════════════════════
    kpi_strip = Table(
        [[
            _kpi_card(ST, total,           "Total Requests",    WHITE, BRAND_DARK),
            _kpi_card(ST, enrolled,        "Enrolled",          WHITE, colors.HexColor("#065f46")),
            _kpi_card(ST, pending_fh,      "Need My Approval",  WHITE, colors.HexColor("#92400e")),
            _kpi_card(ST, len(my_managers),"Reporting Managers",WHITE, colors.HexColor("#4c1d95")),
        ]],
        colWidths=[3.9 * cm] * 4,
        style=TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), BRAND),
            ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
            ("INNERGRID",     (0, 0), (-1, -1), 2, BRAND),
            ("LEFTPADDING",   (0, 0), (-1, -1), 2),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 2),
            ("TOPPADDING",    (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]),
    )
    rate_bar = Table(
        [[Paragraph(
            "Overall Enrollment Rate: <b>{}%</b>  of all domain requests are Enrolled or Finalized".format(enroll_rate),
            ParagraphStyle("erb", parent=ST["cov_met"], fontSize=9)
        )]],
        colWidths=[CW],
        style=TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), BRAND_DARK),
            ("LEFTPADDING",   (0, 0), (-1, -1), 14),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 14),
            ("TOPPADDING",    (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ]),
    )
    cover_rows = [
        [Spacer(1, 2 * cm)],
        [Paragraph("LevelShift  |  AI-Powered LMS", ST["cov_org"])],
        [Spacer(1, 5 * mm)],
        [Paragraph("Functional Head<br/>Dashboard Summary", ST["cov_big"])],
        [Spacer(1, 7 * mm)],
        [HRFlowable(width="45%", thickness=1.5, color=colors.HexColor("#3b82f6"), hAlign="CENTER")],
        [Spacer(1, 8 * mm)],
        [Paragraph(_esc(fh_name),  ST["cov_name"])],
        [Spacer(1, 2 * mm)],
        [Paragraph(_esc(fh_desig), ST["cov_des"])],
        [Spacer(1, 1 * mm)],
        [Paragraph(_esc(fh_dept),  ST["cov_dep"])],
        [Spacer(1, 10 * mm)],
        [kpi_strip],
        [Spacer(1, 6 * mm)],
        [rate_bar],
        [Spacer(1, 10 * mm)],
        [Paragraph("Report generated on {}  at  {}".format(rdate, rtime), ST["cov_met"])],
        [Spacer(1, 1 * mm)],
        [Paragraph(_esc(fh_email), ST["cov_met"])],
        [Spacer(1, 4 * mm)],
        [Paragraph("LevelShift AI-Powered Learning Management System", ST["cov_ft"])],
    ]
    cover = Table(cover_rows, colWidths=[CW],
                  style=TableStyle([
                      ("BACKGROUND",    (0, 0), (-1, -1), BRAND),
                      ("LEFTPADDING",   (0, 0), (-1, -1), 8),
                      ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
                      ("TOPPADDING",    (0, 0), (-1, -1), 0),
                      ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                      ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
                  ]))
    story.append(cover)
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # PAGE 2 — ABOUT + SECTION 1
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph("About This Report", ST["sub"]))
    story.append(Paragraph(
        "This report is a structured snapshot of the <b>{}</b> Functional Head dashboard, "
        "exported from the LevelShift AI-Powered LMS on <b>{}</b>. It covers all training "
        "nominations and course requests raised by the {} reporting manager(s) under your domain, "
        "as well as any requests you initiated directly as Functional Head.".format(
            _esc(fh_name), rdate, len(my_managers)), ST["body"]))
    story.append(Spacer(1, 3 * mm))
    guide = Table([
        [TH("Section"), TH("Contents"), TH("Why It Matters")],
        [TCB("1 - My Activities"),      TC("KPIs, pipeline, status breakdown"),          TC("See exactly where every request stands in the workflow")],
        [TCB("2 - Domain Overview"),    TC("Manager health and department breakdown"),    TC("Spot teams that need follow-up or have low enrollment rates")],
        [TCB("3 - All Requests"),       TC("Full request listing with status and dates"), TC("Audit trail for compliance or escalation review")],
        [TCB("4 - Upcoming Trainings"), TC("Next 3 active trainings sorted by date"),    TC("Ensure nominations happen before seats fill up")],
    ], colWidths=[4.2 * cm, 7.0 * cm, None])
    guide.setStyle(_base_ts(BRAND_DARK))
    story.append(guide)
    story.append(Spacer(1, 5 * mm))

    story.append(_banner(
        ST, "1", "My Activities & Request Status",
        "Personal KPIs, approval pipeline, and status breakdown across domains managed by {}".format(fh_name),
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph(
        "The <b>{}</b> training requests below span all {} reporting manager(s) under your domain, "
        "plus any requests raised directly by you as Functional Head. Two request types exist: "
        "<b>Nominations</b> (manager nominates employees for an existing training - goes directly to L&amp;D) "
        "and <b>Course Requests</b> (manager proposes a new training need - requires <b>your approval first</b>, "
        "then L&amp;D review). Track progress by stage using the pipeline table below.".format(
            total, len(my_managers)), ST["body"]))
    story.append(Spacer(1, 4 * mm))

    obs = []
    if enroll_rate >= 70:
        obs.append("Strong enrollment rate of {}% - most domain requests have reached Enrolled or Finalized status.".format(enroll_rate))
    elif enroll_rate >= 40:
        obs.append("Moderate enrollment rate of {}% - a significant portion of requests are still mid-workflow.".format(enroll_rate))
    else:
        obs.append("Low enrollment rate of {}% - most requests are pending or in progress. Review bottlenecks in the pipeline below.".format(enroll_rate))
    if pending_fh > 0:
        obs.append("{} course request(s) are waiting for YOUR approval - log in to the portal and action them from the Approval Queue.".format(pending_fh))
    if rejected > 0:
        obs.append("{} request(s) were rejected ({}% of total) - review portal remarks to understand reasons and inform managers.".format(rejected, reject_rate))
    if raised_by_me > 0:
        obs.append("You personally raised {} request(s) as Functional Head. These are tracked separately under 'Raised by Me'.".format(raised_by_me))
    if obs:
        story.append(_callout(ST, "Key Observations", obs))
    story.append(Spacer(1, 5 * mm))

    story.append(Paragraph("Key Performance Indicators", ST["sub"]))
    story.append(Paragraph(
        "Each row below maps to a clickable card on your portal dashboard. "
        "'Action Required?' tells you whether you need to do something right now.", ST["cap"]))
    kpi_rows = [
        [TH("Metric"), TH("Count"), TH("Action Required?"), TH("What It Means")],
        [TCB("Pending My Approval"),   TCC(str(pending_fh)),
         TCB("YES - Review now") if pending_fh > 0 else TC("None"),
         TC("Course requests from managers waiting for your approval before reaching L&amp;D")],
        [TCB("L&amp;D Review"),        TCC(str(ld_review)),    TC("No - L&amp;D acting"),
         TC("Requests you approved; the L&amp;D team is now evaluating and scheduling them")],
        [TCB("Approved by L&amp;D"),   TCC(str(approved)),     TC("No - L&amp;D acting"),
         TC("L&amp;D approved the course; trainer and curriculum arrangements are underway")],
        [TCB("Awaiting Nomination"),   TCC(str(awaiting_nom)),
         TCB("YES - Nominate now") if awaiting_nom > 0 else TC("None"),
         TC("Training confirmed; managers must now nominate the specific employees to attend")],
        [TCB("Enrolled / Finalized"),  TCC(str(enrolled)),     TC("None"),
         TC("Participants have been confirmed and enrolled - these requests are complete")],
        [TCB("Raised by Me (FH)"),     TCC(str(raised_by_me)), TC("Monitor"),
         TC("Training requests you initiated directly as Functional Head for your domain")],
        [TCB("Total Domain Requests"), TCC(str(total)),        TC("-"),
         TC("All nominations and course requests across your domain managers and yourself")],
        [TCB("Rejected"),              TCC(str(rejected)),     TC("Review if needed"),
         TC("Requests declined at FH approval or L&amp;D review - check portal remarks for reasons")],
    ]
    kpi_t = Table(kpi_rows, colWidths=[4.5 * cm, 1.5 * cm, 2.8 * cm, None])
    kpi_t.setStyle(_base_ts(BRAND))
    story.append(kpi_t)
    story.append(Spacer(1, 6 * mm))

    story.append(Paragraph("Request Pipeline - Stage by Stage", ST["sub"]))
    story.append(Paragraph(
        "Every training request follows this workflow from submission to enrollment. "
        "The table shows how many requests are currently at each stage, their share of total, "
        "and what needs to happen next. A healthy pipeline has most requests at 'Enrolled / Finalized'.",
        ST["body"]))
    story.append(Spacer(1, 3 * mm))
    PIPE_OWNER = {
        "Pending My Approval": "You (FH)", "L&D Review": "L&D Team",
        "Approved by L&D": "L&D Team",     "Awaiting Nomination": "Managers",
        "Enrolled / Finalized": "Done",     "Rejected": "Closed",
    }
    pipe_rows = [[TH("Pipeline Stage"), TH("Owner"), TH("Count"), TH("% Total"), TH("Progress"), TH("What Happens Next")]]
    for stage, count in pipeline:
        col = PIPE_COL.get(stage, S600)
        pipe_rows.append([
            Paragraph('<font color="{}"><b>{}</b></font>'.format(_hex(col), _esc(stage)),
                      ParagraphStyle("pl", parent=ST["tcb"], textColor=col)),
            Paragraph('<font color="{}"><b>{}</b></font>'.format(_hex(col), _esc(PIPE_OWNER.get(stage, "-"))),
                      ParagraphStyle("po", parent=ST["tcc"], textColor=col, alignment=TA_CENTER)),
            TCC(str(count)),
            TCC("{}%".format(round(count / total * 100) if total else 0)),
            Paragraph(_bar(count, total),
                      ParagraphStyle("pb", parent=ST["tcs"], textColor=col, fontName="Helvetica")),
            TCS(_esc(PIPE_DESC.get(stage, ""))),
        ])
    pipe_t = Table(pipe_rows, colWidths=[3.8 * cm, 2.0 * cm, 1.4 * cm, 1.6 * cm, 3.8 * cm, None])
    pipe_t.setStyle(_base_ts(BRAND_DARK))
    story.append(pipe_t)
    story.append(Spacer(1, 6 * mm))

    story.append(Paragraph("Full Status Distribution", ST["sub"]))
    story.append(Paragraph(
        "Unlike the pipeline above (which groups stages), this shows the exact status label "
        "stored in the system - useful for precise auditing and tracking.", ST["cap"]))
    if status_dist:
        STATUS_DESC = {
            "Pending FH Approval":    "Course request submitted by manager; waiting for your approval",
            "Pending L&D Validation": "Approved by FH; L&D team is now reviewing and scheduling",
            "Approved":               "L&D approved; trainer and curriculum arrangements in progress",
            "Curriculum Shared":      "Training curriculum has been shared with the reporting manager",
            "Curriculum Approved":    "Manager reviewed and approved the proposed curriculum",
            "Participants Requested": "Training confirmed; managers must nominate employees now",
            "Finalized":              "Employee list finalised; participants confirmed for the training",
            "Enrolled":               "Participants enrolled in the training - process complete",
            "Rejected":               "Request declined; check portal remarks for the reason",
        }
        sd_rows = [[TH("Current Status"), TH("Count"), TH("Share"), TH("What This Means")]]
        for s, cnt in sorted(status_dist.items(), key=lambda x: -x[1]):
            pct = round(cnt / total * 100) if total else 0
            sd_rows.append([
                _status_p(ST, s), TCC(str(cnt)), TCC("{}%".format(pct)),
                TCS(_esc(STATUS_DESC.get(s, "Recorded status in the system"))),
            ])
        sd_t = Table(sd_rows, colWidths=[5.5 * cm, 1.6 * cm, 1.6 * cm, None])
        sd_t.setStyle(_base_ts(BRAND_DARK))
        story.append(sd_t)

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 2 — DOMAIN & MANAGER OVERVIEW
    # ══════════════════════════════════════════════════════════════════════════
    story.append(_banner(
        ST, "2", "Domain & Manager Overview",
        "Training health, enrollment rates, and request breakdown per reporting manager",
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph(
        "You oversee <b>{}</b> reporting manager(s) across your domain. This section shows how "
        "actively each manager is using the LMS - from submitting training requests to getting "
        "their teams enrolled. The <b>Health</b> column gives a quick signal: "
        "<b>Good</b> = 70%+ enrollment rate, <b>Fair</b> = 40-69%, <b>Low</b> = below 40%. "
        "Managers with 0 total requests have not yet submitted any training activity.".format(len(my_managers)),
        ST["body"]))
    story.append(Spacer(1, 3 * mm))

    mgr_vals = list(mgr_map.values())
    active_mgrs   = [m for m in mgr_vals if m["total"] > 0]
    inactive_mgrs = [m for m in mgr_vals if m["total"] == 0]
    top_mgr       = max(mgr_vals, key=lambda m: m["total"]) if mgr_vals else None
    mgr_obs = []
    if active_mgrs:
        mgr_obs.append("{} of {} manager(s) have active training requests in the system.".format(
            len(active_mgrs), len(mgr_vals)))
    if inactive_mgrs:
        mgr_obs.append("{} manager(s) have not yet submitted any requests: {}.".format(
            len(inactive_mgrs), ", ".join(m["name"] for m in inactive_mgrs)))
    if top_mgr and top_mgr["total"] > 0:
        tr = round(top_mgr["enrolled"] / top_mgr["total"] * 100) if top_mgr["total"] else 0
        mgr_obs.append("Most active manager: {} ({}) - {} requests, {}% enrollment rate.".format(
            top_mgr["name"], top_mgr["dept"], top_mgr["total"], tr))
    if mgr_obs:
        story.append(_callout(ST, "Domain Health Observations", mgr_obs, bar_color=INDIGO,
                              bg=colors.HexColor("#ede9fe")))
    story.append(Spacer(1, 5 * mm))

    story.append(Paragraph("Reporting Manager Training Health", ST["sub"]))
    story.append(Paragraph(
        "Pending = requests awaiting FH or L&amp;D action.  Active = in-progress (approved, curriculum stage).  "
        "Enrolled = finalized.  Enroll % = Enrolled as a share of that manager's total.", ST["cap"]))

    if mgr_map:
        # colWidths sum = 3.6+2.8+1.2+1.4+1.3+1.5+1.4+1.8+1.4 = 16.4cm <= 17.4cm
        mgr_rows = [[TH("Manager Name"), TH("Department"), TH("Total"),
                     TH("Pending"), TH("Active"), TH("Enrolled"),
                     TH("Rejected"), TH("Enroll %"), TH("Health")]]
        for mid, m in sorted(mgr_map.items(), key=lambda x: -x[1]["total"]):
            t = m["total"]
            er = round(m["enrolled"] / t * 100) if t else 0
            if   er >= 70: health, hcol = "Good",    EMERALD
            elif er >= 40: health, hcol = "Fair",    AMBER
            elif t == 0:   health, hcol = "No data", S400
            else:          health, hcol = "Low",     RED

            def nc(v, col):
                if v == 0:
                    return Paragraph("0", ParagraphStyle("z0", parent=ST["tcc"], textColor=S400))
                return Paragraph(
                    '<font color="{}"><b>{}</b></font>'.format(_hex(col), v),
                    ParagraphStyle("nc", parent=ST["tcc"], alignment=TA_CENTER))

            er_col = EMERALD if er >= 70 else AMBER if er >= 40 else RED if t > 0 else S400
            mgr_rows.append([
                TCB(m["name"]), TC(m["dept"]), TCC(str(t)),
                nc(m["pending"], AMBER), nc(m["active"], BRAND_MID),
                nc(m["enrolled"], EMERALD), nc(m["rejected"], RED),
                Paragraph('<font color="{}"><b>{}%</b></font>'.format(_hex(er_col), er),
                          ParagraphStyle("er", parent=ST["tcc"], alignment=TA_CENTER)),
                Paragraph('<font color="{}"><b>{}</b></font>'.format(_hex(hcol), health),
                          ParagraphStyle("hl", parent=ST["tcc"], alignment=TA_CENTER)),
            ])
        mgr_t = Table(mgr_rows,
                      colWidths=[3.6*cm, 2.8*cm, 1.2*cm, 1.4*cm, 1.3*cm,
                                 1.5*cm, 1.4*cm, 1.8*cm, 1.4*cm])
        mgr_t.setStyle(_base_ts(INDIGO))
        story.append(mgr_t)
    else:
        story.append(Paragraph("No reporting managers found under your profile.", ST["body"]))

    story.append(Spacer(1, 6 * mm))

    if dept_dist:
        story.append(Paragraph("Training Requests by Department", ST["sub"]))
        story.append(Paragraph(
            "Shows which departments under your domain are most active in submitting training requests. "
            "Departments with zero requests may benefit from outreach to encourage L&amp;D participation.",
            ST["cap"]))
        total_dd = sum(dept_dist.values())
        dept_rows = [[TH("Department"), TH("Requests"), TH("Share"), TH("Activity Bar")]]
        for dept, cnt in sorted(dept_dist.items(), key=lambda x: -x[1]):
            pct = round(cnt / total_dd * 100) if total_dd else 0
            dept_rows.append([
                TC(dept), TCC(str(cnt)), TCC("{}%".format(pct)),
                Paragraph(_bar(cnt, total_dd),
                          ParagraphStyle("db", parent=ST["tcs"], textColor=BRAND_MID, fontName="Helvetica")),
            ])
        dept_t = Table(dept_rows, colWidths=[6.0 * cm, 2.4 * cm, 2.4 * cm, None])
        dept_t.setStyle(_base_ts(BRAND_DARK))
        story.append(dept_t)

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 3 — ALL DOMAIN REQUESTS
    # ══════════════════════════════════════════════════════════════════════════
    story.append(_banner(
        ST, "3", "All Domain Requests",
        "Complete audit listing of every nomination and course request - sorted by date, newest first",
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph(
        "This section is the complete audit trail of all training activity under your domain. "
        "<b>Nominations (NOM)</b> are requests where a manager selects employees for an existing training "
        "(workflow: Manager -> L&amp;D validates -> Participants confirmed -> Enrolled). "
        "<b>Course Requests (CRQ)</b> are proposals for new training programmes "
        "(workflow: Manager -> <b>FH approves</b> -> L&amp;D reviews -> Training arranged -> Enrolled). "
        "Requests tagged <b>(FH)</b> in the Type column were raised directly by you as Functional Head.",
        ST["body"]))
    story.append(Spacer(1, 3 * mm))

    shown = min(total, 60)
    story.append(Paragraph(
        "Showing <b>{}</b> of <b>{}</b> request(s).{}".format(
            shown, total,
            "  For the complete list, use the Status Tracker in the portal." if total > 60 else ""),
        ST["cap"]))

    if all_items:
        # colWidths: fixed = 2.0+1.8+3.0+3.4+1.8 = 12.0cm. None = 17.4-12.0 = 5.4cm for course name
        req_rows = [[TH("ID"), TH("Course / Training Title"), TH("Type"),
                     TH("Submitted By"), TH("Status"), TH("Date")]]
        for item in sorted(all_items, key=lambda x: x.get("submitted_date") or "", reverse=True)[:60]:
            rid    = str(item.get("nomination_id") or item.get("request_id") or "-")
            course = str(item.get("course_name") or "-")
            kind   = item.get("kind", "Nomination")
            by     = str(item.get("manager_name") or item.get("fh_name") or "-")
            date_s = str(item.get("submitted_date") or "")[:10]
            kind_disp = "CRQ" if kind == "Course Request" else "NOM"
            if item.get("fh_id") == fh_id:
                kind_disp += " (FH)"
            req_rows.append([
                TCS(rid), TC(course), TCS(kind_disp),
                TCS(by), _status_p(ST, item.get("status", "-")),
                TCS(date_s),
            ])
        req_t = Table(req_rows, colWidths=[2.0*cm, None, 1.8*cm, 3.0*cm, 3.4*cm, 1.8*cm])
        req_t.setStyle(_base_ts(S700))
        story.append(req_t)
    else:
        story.append(Paragraph("No requests found for your domain.", ST["body"]))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # SECTION 4 — UPCOMING TRAININGS
    # ══════════════════════════════════════════════════════════════════════════
    story.append(_banner(
        ST, "4", "Upcoming Trainings",
        "Next 3 active scheduled trainings sorted by earliest date - check for open nominations",
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph(
        "The trainings below are currently active in the LMS catalog with upcoming dates. "
        "If any align with your domain's training plans and you have requests at 'Awaiting Nomination' "
        "status, ensure managers nominate their employees promptly - seats are limited and first-come first-served. "
        "Contact the L&amp;D team or use the portal's Approval Queue to trigger nomination requests.",
        ST["body"]))
    story.append(Spacer(1, 3 * mm))

    if awaiting_nom > 0:
        story.append(_callout(
            ST, "Action Required - Participant Nomination Pending",
            [
                "{} request(s) are at 'Participants Requested' status - training is confirmed but managers have not yet submitted employee nominations.".format(awaiting_nom),
                "Go to the portal Approval Queue and click 'Request Nominations' to prompt managers to submit participant lists.",
                "Do this before the training date - seats are allocated on a first-come, first-served basis.",
            ],
            bar_color=AMBER, bg=AMBER_LIGHT,
        ))
        story.append(Spacer(1, 4 * mm))

    today = datetime.now().date()
    if upcoming:
        story.append(Paragraph("Scheduled Trainings", ST["sub"]))
        # fixed = 1.8+1.8+2.8+1.6+2.2+2.0 = 12.2cm. None = 17.4-12.2 = 5.2cm for course name
        trn_rows = [[TH("Training ID"), TH("Course / Programme Name"), TH("Mode"),
                     TH("Trainer"), TH("Seats"), TH("Date"), TH("Days Away")]]
        for t in upcoming:
            td_str   = t.get("training_date", "")
            days_txt = "-"
            days_urg = False
            if td_str:
                try:
                    td   = datetime.strptime(td_str[:10], "%Y-%m-%d").date()
                    diff = (td - today).days
                    if   diff == 0: days_txt = "Today";    days_urg = True
                    elif diff == 1: days_txt = "Tomorrow"; days_urg = True
                    elif diff  > 0: days_txt = "In {} days".format(diff); days_urg = diff <= 7
                    else:           days_txt = "Past"
                except Exception:
                    pass
            seats = t.get("seats_available", "-")
            if isinstance(seats, int):
                seat_col = RED if seats <= 5 else AMBER if seats <= 14 else EMERALD
            else:
                seat_col = S600
            trn_rows.append([
                TCS(t.get("training_id", "-")),
                TCB(t.get("course_name", "-")),
                TC(t.get("mode", "-")),
                TC(t.get("trainer_name", "-")),
                Paragraph('<font color="{}"><b>{}</b></font>'.format(_hex(seat_col), str(seats)),
                          ParagraphStyle("sc", parent=ST["tcc"], textColor=seat_col, alignment=TA_CENTER)),
                TCB(td_str[:10] if td_str else "-"),
                Paragraph('<font color="{}"><b>{}</b></font>'.format(
                    _hex(RED if days_urg else EMERALD), days_txt),
                    ParagraphStyle("da", parent=ST["tcc"], alignment=TA_CENTER)),
            ])
        trn_t = Table(trn_rows, colWidths=[1.8*cm, None, 1.8*cm, 2.8*cm, 1.6*cm, 2.2*cm, 2.0*cm])
        trn_t.setStyle(_base_ts(TEAL))
        story.append(trn_t)
        story.append(Spacer(1, 4 * mm))
        story.append(Paragraph(
            "<b>Delivery Modes:</b>  Online = virtual/remote  |  Offline = in-person classroom  |  "
            "Hybrid = both formats combined.  "
            "<b>Seats:</b> Green (15+ available), Amber (6-14), Red (5 or fewer - act immediately).",
            ST["body_sm"]))
    else:
        story.append(Paragraph("No upcoming trainings are currently scheduled in the system.", ST["body"]))
        story.append(Spacer(1, 3 * mm))
        story.append(Paragraph(
            "Trainings are created by the L&amp;D team after a course request is approved and a trainer is assigned. "
            "Once a training date is set and the training is marked Active, it will appear here "
            "and managers will be able to submit participant nominations.", ST["body_sm"]))

    story.append(Spacer(1, 10 * mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=S200))
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph(
        "This report was automatically generated by the <b>LevelShift AI-Powered Learning Management System</b> "
        "on <b>{}</b> at <b>{}</b> for <b>{}</b> ({}). "
        "All data reflects the system state at the time of export. "
        "For real-time information, log in to the LMS portal.".format(
            rdate, rtime, _esc(fh_name), _esc(fh_email)), ST["dis"]))

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    buf.seek(0)
    return buf, re.sub(r"[^a-zA-Z0-9_-]", "_", fh_name)
