import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { ArrowRight, GitBranch, CheckCircle2, Clock, XCircle, Circle, AlertCircle } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';

// Self Registration pipeline
const REG_STAGES = [
  { label: 'Submitted', key: 'submitted' },
  { label: 'L&D Review', key: 'ld' },
  { label: 'Manager Approval', key: 'mgr' },
  { label: 'Finalized', key: 'finalized' },
];

// Manager Nomination pipeline (Process A — existing course, no curriculum)
// [0] Submitted  [1] L&D Review  [2] Participants Requested  [3] Finalized
const NOM_STAGES = [
  { label: 'Submitted', key: 'submitted' },
  { label: 'L&D Review', key: 'ld' },
  { label: 'Participants Requested', key: 'participants' },
  { label: 'Finalized', key: 'confirmed' },
];

// Course Request pipeline — submitted by Manager (needs FH Approval first)
// [0] Submitted  [1] FH Approval  [2] L&D Review  [3] Participants Requested  [4] Finalized
const CRQ_STAGES = [
  { label: 'Submitted', key: 'submitted' },
  { label: 'FH Approval', key: 'fh_approval' },
  { label: 'L&D Review', key: 'ld_review' },
  { label: 'Participants Requested', key: 'participants' },
  { label: 'Finalized', key: 'confirmed' },
];

// Course Request pipeline — submitted directly by FH (no FH Approval step)
// [0] Submitted  [1] L&D Review  [2] Participants Requested  [3] Finalized
const CRQ_FH_STAGES = [
  { label: 'Submitted', key: 'submitted' },
  { label: 'L&D Review', key: 'ld_review' },
  { label: 'Participants Requested', key: 'participants' },
  { label: 'Finalized', key: 'confirmed' },
];

const STATUS_MAP = {
  //                                                              fh_crq = CRQ_FH_STAGES index
  'Pending FH Approval':      { reg: 1, nom: 1, crq: 1, fh_crq: 1, sub: 'Request submitted — awaiting Functional Head approval' },
  'Pending L&D Validation':   { reg: 1, nom: 1, crq: 2, fh_crq: 1, sub: 'L&D team is reviewing the request' },
  'Pending Manager Approval': { reg: 2, nom: 1, crq: 1, fh_crq: 1, sub: 'Waiting for manager to approve' },
  Approved:                   { reg: 2, nom: 1, crq: 2, fh_crq: 1, sub: 'L&D is finalising curriculum, trainer and date' },
  'Curriculum Shared':        { reg: 2, nom: 1, crq: 2, fh_crq: 1, sub: 'Curriculum shared — awaiting your review and approval' },
  'Curriculum Approved':      { reg: 3, nom: 1, crq: 2, fh_crq: 1, sub: 'Curriculum approved — L&D is confirming trainer and training date' },
  'Curriculum Rejected':      { reg: 2, nom: 1, crq: 2, fh_crq: 1, sub: 'Curriculum rejected — L&D is revising and will re-share', rejected: true },
  'Participants Requested':   { reg: 3, nom: 2, crq: 3, fh_crq: 2, sub: 'Training details confirmed — please log in and nominate participants' },
  Finalized:                  { reg: 99, nom: 99, crq: 99, fh_crq: 99, sub: 'Participants finalized — training is confirmed' },
  Enrolled:                   { reg: 99, nom: 99, crq: 99, fh_crq: 99, sub: 'Participants finalized — training is confirmed' },
  Rejected:                   { reg: null, nom: null, crq: null, fh_crq: null, sub: 'Request was rejected — see rejection reason below', rejected: true },
};

function getStageInfo(status, kind, raw) {
  const isFHCrq = kind === 'crq' && raw?.requested_by_fh;
  const stages = kind === 'reg' ? REG_STAGES
    : isFHCrq ? CRQ_FH_STAGES
    : kind === 'crq' ? CRQ_STAGES
    : NOM_STAGES;
  const info = STATUS_MAP[status] || { reg: 0, nom: 0, crq: 0, fh_crq: 0, sub: status };

  let stageIdx = kind === 'reg' ? info.reg
    : isFHCrq ? info.fh_crq
    : kind === 'crq' ? info.crq
    : info.nom;
  const isRejected = !!info.rejected;
  const isPending  = !!info.pending; // Finalized — last stage active but awaiting L&D email

  if (status === 'Rejected') {
    if (kind === 'reg') stageIdx = raw?.ld_validated_date ? 2 : 1;
    else if (kind === 'crq') stageIdx = raw?.manager_approved_date ? 2 : 1;
    else stageIdx = raw?.manager_approved_date ? 2 : 1;
  }

  const isDone = stageIdx >= stages.length;
  return { stageIdx, sub: info.sub, isRejected, isDone, isPending: false, stages };
}

function StageNode({ label, state }) {
  const styles = {
    done:     'bg-emerald-100 text-emerald-700 border border-emerald-200',
    active:   'bg-amber-50 text-amber-700 border border-amber-300 ring-1 ring-amber-300',
    pending:  'bg-orange-100 text-orange-700 border border-orange-300 ring-1 ring-orange-300 animate-pulse',
    rejected: 'bg-red-100 text-red-700 border border-red-200',
    future:   'bg-slate-50 text-slate-400 border border-slate-200',
  };
  const icons = {
    done:     <CheckCircle2 size={10} className="flex-shrink-0" />,
    active:   <Clock size={10} className="flex-shrink-0" />,
    pending:  <Clock size={10} className="flex-shrink-0" />,
    rejected: <XCircle size={10} className="flex-shrink-0" />,
    future:   <Circle size={10} className="flex-shrink-0 opacity-30" />,
  };
  return (
    <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${styles[state] || styles.future}`}>
      {icons[state] || icons.future}
      {label}
    </div>
  );
}

function Pipeline({ status, kind, raw }) {
  const { stageIdx, sub, isRejected, isDone, isPending, stages } = getStageInfo(status, kind, raw);
  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-1 flex-wrap">
        {stages.map((s, i) => {
          let state;
          if (isDone) state = 'done';
          else if (i < stageIdx) state = 'done';
          else if (i === stageIdx) {
            if (isRejected) state = 'rejected';
            else if (isPending) state = 'pending';
            else state = 'active';
          }
          else state = 'future';
          return (
            <div key={s.key} className="flex items-center gap-1">
              <StageNode label={s.label} state={state} />
              {i < stages.length - 1 && (
                <ArrowRight size={11} className={i < stageIdx || isDone ? 'text-emerald-400' : 'text-slate-200'} />
              )}
            </div>
          );
        })}
      </div>
      <p className={`text-xs font-medium ${
        isRejected ? 'text-red-500' :
        isDone ? 'text-emerald-600' :
        isPending ? 'text-orange-600' :
        'text-amber-600'
      }`}>
        {sub}
      </p>
    </div>
  );
}

// Filter pills per role
const LD_FILTERS    = ['All', 'Pending L&D Validation', 'Pending FH Approval', 'Approved', 'Curriculum Approved', 'Participants Requested', 'Finalized', 'Enrolled', 'Rejected'];
const FH_FILTERS    = ['All', 'Pending FH Approval', 'Pending L&D Validation', 'Approved', 'Curriculum Approved', 'Participants Requested', 'Finalized', 'Enrolled'];
const MGR_FILTERS   = ['All', 'Pending FH Approval', 'Pending L&D Validation', 'Curriculum Approved', 'Participants Requested', 'Finalized', 'Enrolled', 'Rejected'];

// Summary cards per role
const LD_CARDS    = ['Pending L&D Validation', 'Approved', 'Curriculum Shared', 'Participants Requested', 'Enrolled'];
const FH_CARDS    = ['Pending FH Approval', 'Pending L&D Validation', 'Curriculum Shared', 'Participants Requested', 'Enrolled'];
const MGR_CARDS   = ['Pending FH Approval', 'Pending L&D Validation', 'Participants Requested', 'Curriculum Shared', 'Finalized', 'Enrolled'];

const CARD_COLORS = {
  'Pending L&D Validation':   'text-amber-600',
  'Pending FH Approval':      'text-orange-600',
  'Approved':                 'text-emerald-600',
  'Curriculum Shared':        'text-violet-600',
  'Curriculum Approved':      'text-teal-600',
  'Participants Requested':   'text-blue-600',
  'Finalized':                'text-purple-600',
  'Enrolled':                 'text-green-600',
};

const typeColor = {
  'Self Registration':  'bg-blue-100 text-blue-700',
  'Manager Nomination': 'bg-purple-100 text-purple-700',
  'RM Course Request':  'bg-orange-100 text-orange-700',
  'Course Request':     'bg-orange-100 text-orange-700',
  'FH Nomination':      'bg-amber-100 text-amber-700',
  'FH Course Request':  'bg-amber-100 text-amber-700',
};

const IST = { timeZone: 'Asia/Kolkata' };

function fmtIST(ts) {
  if (!ts) return null;
  const dt = new Date(ts);
  if (isNaN(dt)) return null;
  return {
    date: dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', ...IST }),
    time: dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, ...IST }),
  };
}

function getLatestTimestamp(status, raw) {
  switch (status) {
    case 'Rejected':              return raw.ld_validated_date || raw.submitted_date;
    case 'Approved':
    case 'Pending Manager Approval':
    case 'Pending L&D Validation': return raw.ld_validated_date || raw.submitted_date;
    case 'Curriculum Shared':     return raw.curriculum_uploaded_date || raw.ld_validated_date || raw.submitted_date;
    case 'Curriculum Approved':
    case 'Curriculum Rejected':   return raw.curriculum_approved_date || raw.submitted_date;
    case 'Participants Requested': return raw.curriculum_approved_date || raw.ld_validated_date || raw.submitted_date;
    case 'Finalized':
    case 'Enrolled':              return raw.manager_approved_date || raw.submitted_date;
    default:                      return raw.submitted_date;
  }
}

export default function WorkflowTracker() {
  const { user } = useAuth();
  const isLD      = user?.role === 'ld_team';
  const isManager = user?.role === 'reporting_manager';
  const isFH      = user?.role === 'functional_head';

  const [regs, setRegs] = useState([]);
  const [noms, setNoms] = useState([]);
  const [crqs, setCrqs] = useState([]);
  const [filter, setFilter] = useState('All');
  const [enrolledParticipantCount, setEnrolledParticipantCount] = useState(0);
  const [unseenFHNoms, setUnseenFHNoms] = useState([]);
  const [unseenFHCrqs, setUnseenFHCrqs] = useState([]);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const markSeenTimer = useRef(null);
  const markedRef = useRef(false);

  const fetchData = () => {
    if (isLD) {
      axios.get('/api/registrations').then(r => setRegs(r.data));
    }
    axios.get('/api/nominations').then(r => {
      setNoms(r.data);
      if (isManager && user?.employee_id) {
        setUnseenFHNoms(r.data.filter(n =>
          n.manager_id === user.employee_id && n.requested_by_fh && !n.seen_by_manager
        ));
      }
    });
    axios.get('/api/course-requests').then(r => {
      setCrqs(r.data);
      if (isManager && user?.employee_id) {
        setUnseenFHCrqs(r.data.filter(c =>
          c.manager_id === user.employee_id && c.requested_by_fh && !c.seen_by_manager
        ));
      }
    });
    // Fetch actual enrolled participant count (unique people, deduplicated)
    axios.get('/api/participants').then(r => {
      const deduped = new Map();
      r.data.forEach(p => {
        const key = `${p.course_name}||${p.employee_id}`;
        if (!deduped.has(key) || (p.confirmation_sent && !deduped.get(key).confirmation_sent)) {
          deduped.set(key, p);
        }
      });
      setEnrolledParticipantCount(deduped.size);
    });
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    const onVisible = () => { if (document.visibilityState === 'visible') fetchData(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      if (markSeenTimer.current) clearTimeout(markSeenTimer.current);
    };
  }, []);

  // After manager sees the page, mark all unseen FH items as seen after 1.5s
  useEffect(() => {
    if (!isManager || markedRef.current) return;
    const allUnseen = [
      ...unseenFHNoms.map(n => ({ type: 'nom', id: n.nomination_id })),
      ...unseenFHCrqs.map(c => ({ type: 'crq', id: c.request_id })),
    ];
    if (allUnseen.length === 0) return;
    markedRef.current = true;
    markSeenTimer.current = setTimeout(async () => {
      await Promise.all(allUnseen.map(({ type, id }) =>
        type === 'nom'
          ? axios.put(`/api/nominations/${id}/mark-seen`).catch(() => {})
          : axios.put(`/api/course-requests/${id}/mark-seen`).catch(() => {})
      ));
      // Refresh so badge clears from sidebar too
      fetchData();
    }, 1500);
  }, [unseenFHNoms, unseenFHCrqs]);

  // Build items filtered by what each role should see
  const allItems = [
    // Registrations — L&D sees all
    ...(isLD ? regs.map(r => ({
      id: r.request_id, type: 'Self Registration',
      course: r.course_name, by: r.employee_name,
      submitted: r.submitted_date?.slice(0, 10),
      status: r.status, kind: 'reg', raw: r,
    })) : []),

    // Nominations — L&D sees all; FH sees their team's + ones they raised; manager sees their own
    ...noms
      .filter(n => {
        if (isLD) return true;
        if (isFH) return n.fh_id === user?.employee_id || n.manager_id === user?.employee_id;
        return n.manager_id === user?.employee_id;
      })
      .map(n => {
        const nomBy = n.requested_by_fh ? n.fh_name : n.manager_name;
        const nomById = n.requested_by_fh ? n.fh_id : n.manager_id;
        return {
          id: n.nomination_id, type: n.requested_by_fh ? 'FH Nomination' : 'Manager Nomination',
          course: n.course_name,
          by: nomById === user?.employee_id ? 'You' : nomBy,
          submitted: n.submitted_date?.slice(0, 10),
          status: n.status, kind: 'nom', raw: n,
        };
      }),

    // Course requests — L&D sees all; FH sees theirs raised + pending FH approval + ones they raised; manager sees own
    ...crqs
      .filter(c => {
        if (isLD) return true;
        if (isFH) return c.fh_id === user?.employee_id || c.status === 'Pending FH Approval' || c.assigned_to_id === user?.employee_id;
        return c.manager_id === user?.employee_id;
      })
      .map(c => {
        const crqBy = c.requested_by_fh ? (c.fh_name || c.manager_name) : c.manager_name;
        const crqById = c.requested_by_fh ? c.fh_id : c.manager_id;
        return {
          id: c.request_id, type: c.requested_by_fh ? 'FH Course Request' : 'RM Course Request',
          course: c.course_name,
          by: crqById === user?.employee_id ? 'You' : crqBy,
          submitted: c.submitted_date?.slice(0, 10),
          status: c.status, kind: 'crq', raw: c,
        };
      }),
  ];

  // Sort by most recent activity first so newly updated items rise to the top
  allItems.sort((a, b) => {
    const tsA = getLatestTimestamp(a.status, a.raw) || a.raw.submitted_date || '';
    const tsB = getLatestTimestamp(b.status, b.raw) || b.raw.submitted_date || '';
    return tsB.localeCompare(tsA);
  });

  const filtered = filter === 'All' ? allItems : allItems.filter(i => i.status === filter);

  const statusCounts = allItems.reduce((acc, i) => {
    acc[i.status] = (acc[i.status] || 0) + 1;
    return acc;
  }, {});

  // "Finalized" and "Enrolled" are both completed states — merge them for the Enrolled card
  statusCounts['Enrolled'] = (statusCounts['Enrolled'] || 0) + (statusCounts['Finalized'] || 0);

  const FILTERS   = isLD ? LD_FILTERS : isFH ? FH_FILTERS : MGR_FILTERS;
  const CARDS     = isLD ? LD_CARDS   : isFH ? FH_CARDS   : MGR_CARDS;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Workflow Tracker</h1>
        <p className="text-slate-500 text-sm mt-1">
          {isLD ? 'Visual pipeline of all training requests' :
           isFH ? 'Training requests you raised and those pending your approval' :
           'Status of your team\'s nominations and course requests'}
        </p>
      </div>

      {/* FH notification banner — shown to manager when there are unseen FH requests */}
      {isManager && !bannerDismissed && (unseenFHNoms.length + unseenFHCrqs.length) > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 shadow-sm">
          <AlertCircle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">
              {unseenFHNoms.length + unseenFHCrqs.length} new request{(unseenFHNoms.length + unseenFHCrqs.length) > 1 ? 's' : ''} from Functional Head
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Your Functional Head has submitted a training request for your domain. Review the details below.
            </p>
          </div>
          <button
            onClick={() => setBannerDismissed(true)}
            className="text-amber-400 hover:text-amber-600 text-lg leading-none font-bold flex-shrink-0"
            aria-label="Dismiss"
          >×</button>
        </div>
      )}

      {/* Summary cards */}
      <div className="card !p-4 grid grid-cols-3 md:grid-cols-6 gap-3">
        {CARDS.map(label => (
          <div key={label} className="rounded-xl p-3 text-center bg-slate-50 border border-slate-100">
            <p className={`text-2xl font-bold ${CARD_COLORS[label] || 'text-slate-700'}`}>
              {label === 'Enrolled' ? enrolledParticipantCount : (statusCounts[label] || 0)}
            </p>
            <p className="text-[10px] font-medium mt-0.5 leading-tight text-slate-500">
              {label === 'Enrolled' ? 'Enrolled Participants' : label}
            </p>
          </div>
        ))}
        <div className="rounded-xl p-3 text-center bg-slate-100 text-slate-700">
          <p className="text-2xl font-bold">{allItems.length}</p>
          <p className="text-[10px] font-medium mt-0.5">Total</p>
        </div>
      </div>

      {/* Filter pills — only show statuses that have items */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.filter(s => s === 'All' || (statusCounts[s] || 0) > 0).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === s
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {s}
            {s !== 'All' && statusCounts[s] > 0 && (
              <span className="ml-1 bg-white/30 text-inherit px-1 rounded-full">{statusCounts[s]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Request cards */}
      <div className="space-y-3">
        {filtered.map(item => {
          const isNewFH = isManager &&
            item.raw.requested_by_fh &&
            !item.raw.seen_by_manager &&
            item.raw.manager_id === user?.employee_id;
          return (
          <div key={item.id} className={`card hover:shadow-md transition-shadow ${isNewFH ? 'border-amber-300 ring-1 ring-amber-200' : ''}`}>
            <div className="flex items-start justify-between flex-wrap gap-3 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold text-slate-400">{item.id}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColor[item.type]}`}>
                  {item.type}
                </span>
                <StatusBadge status={item.status} />
                {isNewFH && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700 border border-amber-300 animate-pulse">
                    New from FH
                  </span>
                )}
              </div>
              {(() => {
                const ts = fmtIST(getLatestTimestamp(item.status, item.raw));
                return ts ? (
                  <div className="text-right">
                    <p className="text-xs text-slate-500 font-medium">{ts.date}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{ts.time}</p>
                  </div>
                ) : null;
              })()}
            </div>
            <p className="font-semibold text-slate-800 text-sm">{item.course}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {isLD ? `Submitted by: ${item.by}` : `By: ${item.by}`}
            </p>
            <Pipeline status={item.status} kind={item.kind} raw={item.raw} />
            {item.status === 'Rejected' && item.raw.ld_remarks && (
              <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-red-700">Rejection Reason</p>
                  <p className="text-xs text-red-600 mt-0.5">{item.raw.ld_remarks}</p>
                </div>
              </div>
            )}
          </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <GitBranch size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No requests found</p>
            <p className="text-xs mt-1">
              {filter !== 'All' ? `No items with status "${filter}"` : 'No requests yet'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
