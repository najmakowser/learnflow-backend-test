import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Activity, Search, CheckCircle2, XCircle, Upload, Users,
  FileText, BookOpen, Plus, Filter, ChevronDown, ChevronUp, Clock
} from 'lucide-react';

// ── Action config ─────────────────────────────────────────────────────────────
const ACTION_META = {
  'Self Registration Submitted':    { icon: FileText,     chip: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500',     category: 'Submission'  },
  'Manager Nomination Submitted':   { icon: Users,        chip: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500',   category: 'Submission'  },
  'New Course Request Raised':      { icon: Plus,         chip: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500',    category: 'Submission'  },
  'L&D Validation Completed':       { icon: CheckCircle2, chip: 'bg-teal-100 text-teal-700',     dot: 'bg-teal-500',     category: 'Validation'  },
  'L&D Nomination Validated':       { icon: CheckCircle2, chip: 'bg-teal-100 text-teal-700',     dot: 'bg-teal-500',     category: 'Validation'  },
  'Course Request Acknowledged':    { icon: CheckCircle2, chip: 'bg-teal-100 text-teal-700',     dot: 'bg-teal-500',     category: 'Validation'  },
  'Course Request Approved by FH':  { icon: CheckCircle2, chip: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', category: 'Approval'   },
  'Course Request Sent for Participant Nomination': { icon: Users, chip: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500', category: 'Participant' },
  'Manager Approval Granted':       { icon: CheckCircle2, chip: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', category: 'Approval'   },
  'Manager Approved Nomination':    { icon: CheckCircle2, chip: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', category: 'Approval'   },
  'Request Rejected':               { icon: XCircle,      chip: 'bg-red-100 text-red-700',       dot: 'bg-red-500',      category: 'Rejection'   },
  'Nomination Rejected':            { icon: XCircle,      chip: 'bg-red-100 text-red-700',       dot: 'bg-red-500',      category: 'Rejection'   },
  'Course Request Rejected':        { icon: XCircle,      chip: 'bg-red-100 text-red-700',       dot: 'bg-red-500',      category: 'Rejection'   },
  'Curriculum Uploaded':            { icon: Upload,       chip: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500',   category: 'Curriculum'  },
  'Curriculum Approved':            { icon: CheckCircle2, chip: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', category: 'Curriculum' },
  'Curriculum Rejected':            { icon: XCircle,      chip: 'bg-red-100 text-red-700',       dot: 'bg-red-500',      category: 'Curriculum'  },
  'Participants Confirmed':         { icon: Users,        chip: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', category: 'Finalized'  },
  'Enrollment Finalized':           { icon: CheckCircle2, chip: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', category: 'Finalized'  },
  'Course Added':                   { icon: BookOpen,     chip: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500',    category: 'Other'       },
  'Course Updated':                 { icon: BookOpen,     chip: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500',    category: 'Other'       },
};
const DEFAULT_META = { icon: Activity, chip: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400', category: 'Other' };

const ROLE_STYLE = {
  'Employee':        'bg-blue-50 text-blue-700 border-blue-200',
  'Manager':         'bg-purple-50 text-purple-700 border-purple-200',
  'L&D Admin':       'bg-emerald-50 text-emerald-700 border-emerald-200',
  'L&D Team':        'bg-teal-50 text-teal-700 border-teal-200',
  'Functional Head': 'bg-orange-50 text-orange-700 border-orange-200',
};

const ENTITY_STYLE = {
  'Registration':   'bg-blue-50 text-blue-700',
  'Nomination':     'bg-purple-50 text-purple-700',
  'Training':       'bg-amber-50 text-amber-700',
  'Course Request': 'bg-orange-50 text-orange-700',
};

const AVATAR_COLOR = [
  'bg-blue-500','bg-purple-500','bg-emerald-500','bg-orange-500','bg-teal-500','bg-rose-500','bg-amber-500'
];
function avatarColor(name = '') {
  let h = 0;
  for (let c of name) h = (h * 31 + c.charCodeAt(0)) % AVATAR_COLOR.length;
  return AVATAR_COLOR[h];
}

function fmt(ts) {
  if (!ts) return { date: '—', time: '—', full: '—' };
  const d = new Date(ts);
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  let date;
  if (d.toDateString() === today.toDateString()) date = 'Today';
  else if (d.toDateString() === yest.toDateString()) date = 'Yesterday';
  else date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  return { date, time, full: `${date} at ${time}` };
}

// ── Expanded detail row ───────────────────────────────────────────────────────
function ExpandedRow({ log, meta }) {
  const Icon = meta.icon;
  const roleStyle = ROLE_STYLE[log.role] || 'bg-slate-50 text-slate-600 border-slate-200';
  const entityStyle = ENTITY_STYLE[log.entity_type] || 'bg-slate-50 text-slate-600';
  const { full } = fmt(log.timestamp);
  const av = avatarColor(log.performed_by);

  return (
    <tr className="bg-slate-50 border-b border-slate-100">
      <td colSpan={6} className="px-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Action block */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-2">Action</p>
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${meta.chip}`}>
                <Icon size={15} />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-sm">{log.action}</p>
                <p className="text-xs text-slate-400">{meta.category}</p>
              </div>
            </div>
          </div>

          {/* Performer block */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-2">Performed By</p>
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-full ${av} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                {log.performed_by?.charAt(0) || '?'}
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-sm">{log.performed_by}</p>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${roleStyle}`}>{log.role}</span>
              </div>
            </div>
          </div>

          {/* Affected entity + time */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-2">Entity & Time</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${entityStyle}`}>{log.entity_id}</span>
                <span className="text-xs text-slate-500">{log.entity_type}</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <Clock size={11} /> {full}
              </div>
            </div>
          </div>

          {/* Remarks — full width if present */}
          {log.remarks && (
            <div className="md:col-span-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <p className="text-xs text-amber-600 font-semibold uppercase tracking-wide mb-1">Remarks / Comments</p>
              <p className="text-sm text-slate-700">{log.remarks}</p>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [roleFilter, setRoleFilter] = useState('All');
  const [expanded, setExpanded] = useState(null);

  useEffect(() => { axios.get('/api/audit-logs').then(r => setLogs(r.data)); }, []);

  const categories = ['All', ...Array.from(new Set(logs.map(l => (ACTION_META[l.action] || DEFAULT_META).category)))];
  const roles = ['All', ...Array.from(new Set(logs.map(l => l.role).filter(Boolean)))];

  const filtered = logs.filter(log => {
    const meta = ACTION_META[log.action] || DEFAULT_META;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      log.action?.toLowerCase().includes(q) ||
      log.performed_by?.toLowerCase().includes(q) ||
      log.entity_id?.toLowerCase().includes(q) ||
      log.remarks?.toLowerCase().includes(q) ||
      log.role?.toLowerCase().includes(q);
    const matchCat = category === 'All' || meta.category === category;
    const matchRole = roleFilter === 'All' || log.role === roleFilter;
    return matchSearch && matchCat && matchRole;
  });

  const counts = {
    total:      logs.length,
    approvals:  logs.filter(l => ['Approval','Validation','Finalized'].includes((ACTION_META[l.action]||DEFAULT_META).category)).length,
    rejections: logs.filter(l => (ACTION_META[l.action]||DEFAULT_META).category === 'Rejection').length,
    withRemarks:logs.filter(l => l.remarks).length,
  };

  const toggle = id => setExpanded(e => e === id ? null : id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Audit Logs</h1>
        <p className="text-slate-500 text-sm mt-1">Every action recorded — who did what, on which request, and when</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Actions',  value: counts.total,      bg: 'bg-slate-100',    text: 'text-slate-700'    },
          { label: 'Approvals',      value: counts.approvals,  bg: 'bg-emerald-50',   text: 'text-emerald-700'  },
          { label: 'Rejections',     value: counts.rejections, bg: 'bg-red-50',       text: 'text-red-700'      },
          { label: 'With Remarks',   value: counts.withRemarks,bg: 'bg-amber-50',     text: 'text-amber-700'    },
        ].map(c => (
          <div key={c.label} className={`rounded-xl p-4 text-center ${c.bg}`}>
            <p className={`text-3xl font-bold ${c.text}`}>{c.value}</p>
            <p className={`text-xs font-medium mt-1 ${c.text} opacity-80`}>{c.label}</p>
          </div>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="card !p-4 space-y-3">
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          <Search size={15} className="text-slate-400 flex-shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by action, name, entity ID or remarks..."
            className="flex-1 bg-transparent text-sm outline-none text-slate-700 placeholder-slate-400" />
          {search && <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600 text-xs font-bold">✕</button>}
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Filter size={12} className="text-slate-400" />
            <span className="text-xs text-slate-500 font-medium">Category:</span>
            <div className="flex gap-1 flex-wrap">
              {categories.map(c => (
                <button key={c} onClick={() => setCategory(c)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    category === c ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}>{c}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Role:</span>
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 outline-none">
              {roles.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <span className="text-xs text-slate-400 ml-auto">{filtered.length} of {logs.length} entries</span>
        </div>
      </div>

      {/* Table */}
      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="table-th w-8"></th>
              <th className="table-th">#</th>
              <th className="table-th">Action</th>
              <th className="table-th">Performed By</th>
              <th className="table-th">Entity</th>
              <th className="table-th">When</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="py-16 text-center text-slate-400">
                <Activity size={36} className="mx-auto mb-2 opacity-30" />
                <p className="font-medium">No logs found</p>
              </td></tr>
            )}
            {filtered.map(log => {
              const meta = ACTION_META[log.action] || DEFAULT_META;
              const Icon = meta.icon;
              const { date, time } = fmt(log.timestamp);
              const roleStyle = ROLE_STYLE[log.role] || 'bg-slate-50 text-slate-600 border-slate-200';
              const entityStyle = ENTITY_STYLE[log.entity_type] || 'bg-slate-50 text-slate-600';
              const av = avatarColor(log.performed_by);
              const isOpen = expanded === log.log_id;

              return [
                <tr key={`row-${log.log_id}`}
                  onClick={() => toggle(log.log_id)}
                  className={`border-b border-slate-100 cursor-pointer transition-colors ${isOpen ? 'bg-blue-50/40' : 'hover:bg-slate-50'}`}>

                  {/* Expand toggle */}
                  <td className="pl-4 pr-2 py-3">
                    <div className="text-slate-400">
                      {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                  </td>

                  {/* Log ID */}
                  <td className="table-td">
                    <span className="text-xs font-mono text-slate-400">#{log.log_id}</span>
                  </td>

                  {/* Action */}
                  <td className="table-td">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${meta.chip}`}>
                        <Icon size={12} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 leading-tight">{log.action}</p>
                        <p className="text-xs text-slate-400">{meta.category}</p>
                      </div>
                      {log.remarks && (
                        <span className="ml-1 text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">note</span>
                      )}
                    </div>
                  </td>

                  {/* Performed By */}
                  <td className="table-td">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full ${av} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                        {log.performed_by?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700 leading-tight">{log.performed_by}</p>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${roleStyle}`}>{log.role}</span>
                      </div>
                    </div>
                  </td>

                  {/* Entity */}
                  <td className="table-td">
                    <div className="space-y-0.5">
                      <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${entityStyle}`}>{log.entity_id}</span>
                      <p className="text-[10px] text-slate-400">{log.entity_type}</p>
                    </div>
                  </td>

                  {/* When */}
                  <td className="table-td">
                    <p className="text-xs font-medium text-slate-700">{time}</p>
                    <p className="text-[10px] text-slate-400">{date}</p>
                  </td>
                </tr>,

                isOpen && <ExpandedRow key={`exp-${log.log_id}`} log={log} meta={meta} />
              ];
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
