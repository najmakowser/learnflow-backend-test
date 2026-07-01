import { useEffect, useState, useRef, Fragment } from 'react';
import axios from 'axios';
import { Search, UserCheck, X, ClipboardList, Users, CheckCircle, Clock, ChevronDown, ChevronRight, Calendar, Briefcase, Target, AlertCircle, ChevronUp } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import Toast from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { SkeletonTable } from '../components/Skeleton';

// ── Assign Modal ──────────────────────────────────────────────────────────────
function AssignModal({ item, ldTeam, onClose, onAssign }) {
  const [selectedId, setSelectedId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedMember = ldTeam.find(m => m.employee_id === selectedId);

  const handleSubmit = async () => {
    if (!selectedMember) return;
    setSubmitting(true);
    await onAssign(item, selectedMember);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <UserCheck size={16} className="text-violet-600" /> Assign to L&D Team Member
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{item.course} — {item.id}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Request summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Type</span>
              <span className="font-medium text-slate-700">{item.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Submitted by</span>
              <span className="font-medium text-slate-700">{item.submittedBy}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Department</span>
              <span className="font-medium text-slate-700">{item.department}</span>
            </div>
          </div>

          {/* Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wider">
              Assign to L&D Team Member *
            </label>
            {ldTeam.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-xl">
                No L&D team members found.
              </p>
            ) : (
              <select
                value={selectedId}
                onChange={e => setSelectedId(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400 cursor-pointer"
              >
                <option value="">— Select a team member —</option>
                {ldTeam.map(member => (
                  <option key={member.employee_id} value={member.employee_id}>
                    {member.name} ({member.employee_id})
                  </option>
                ))}
              </select>
            )}

            {/* Selected member detail card */}
            {selectedMember && (
              <div className="mt-3 flex items-center gap-3 p-3 bg-violet-50 border border-violet-200 rounded-xl">
                <div className="w-9 h-9 rounded-full bg-violet-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {selectedMember.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-violet-900">{selectedMember.name}</p>
                  <p className="text-xs text-violet-600">{selectedMember.designation} · {selectedMember.employee_id}</p>
                </div>
                <CheckCircle size={16} className="text-violet-600 ml-auto flex-shrink-0" />
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedId}
            className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <UserCheck size={15} /> {submitting ? 'Assigning…' : 'Assign Task'}
          </button>
          <button onClick={onClose} className="btn-secondary px-6">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Inline Detail Row ─────────────────────────────────────────────────────────
function InlineDetail({ item, colSpan, onAssign, onClose }) {
  const raw = item.raw;
  const targetDate = raw.training_date || raw.target_completion_date || raw.expected_start_date;
  return (
    <tr className="bg-violet-50/60 border-b border-violet-100">
      <td colSpan={colSpan} className="px-4 py-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {/* Row 1: core fields */}
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1"><Briefcase size={10}/> Request Type</p>
            <p className="font-medium text-slate-800">{item.type}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Course Name</p>
            <p className="font-medium text-slate-800">{item.course}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Submitted By</p>
            <p className="font-medium text-slate-800">{item.submittedBy}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Department</p>
            <p className="font-medium text-slate-800">{item.department}</p>
          </div>

          {/* Row 2: optional fields */}
          {raw.priority && (
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1"><AlertCircle size={10}/> Priority</p>
              <p className="font-medium text-slate-800">{raw.priority}</p>
            </div>
          )}
          {raw.expected_participants && (
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1"><Users size={10}/> Participants</p>
              <p className="font-medium text-slate-800">{raw.expected_participants}</p>
            </div>
          )}
          {targetDate && (
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1"><Calendar size={10}/> Target Date</p>
              <p className="font-medium text-blue-700">{new Date(targetDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            </div>
          )}

          {/* Full-width fields */}
          {raw.business_need && (
            <div className="col-span-2 md:col-span-4 space-y-0.5">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1"><Target size={10}/> Business Need</p>
              <p className="text-slate-700">{raw.business_need}</p>
            </div>
          )}
          {raw.skill_gap && (
            <div className="col-span-2 md:col-span-4 space-y-0.5">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Skill Gap</p>
              <p className="text-slate-700">{raw.skill_gap}</p>
            </div>
          )}
          {raw.assigned_to_name && (
            <div className="col-span-2 md:col-span-4">
              <div className="flex items-center gap-2 px-3 py-2 bg-violet-100 border border-violet-200 rounded-lg">
                <UserCheck size={13} className="text-violet-600 flex-shrink-0" />
                <span className="text-xs font-semibold text-violet-800">Assigned to: {raw.assigned_to_name}</span>
              </div>
            </div>
          )}
        </div>

        {/* Action buttons inside expanded row */}
        <div className="mt-4 flex items-center gap-2">
          <button onClick={() => onAssign(item)} className="flex items-center gap-1.5 text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-lg transition-colors">
            <UserCheck size={12} /> {raw.assigned_to_name ? 'Reassign' : 'Assign to L&D'}
          </button>
          <button onClick={onClose} className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-lg transition-colors">
            <X size={12} /> Collapse
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LDManagerQueue() {
  const { user } = useAuth();
  const actorName = user?.display_name || user?.name || '';

  const [noms, setNoms] = useState([]);
  const [courseReqs, setCourseReqs] = useState([]);
  const [regs, setRegs] = useState([]);
  const [ldTeam, setLdTeam] = useState([]);
  const [filter, setFilter] = useState('');
  const [tab, setTab] = useState('incoming');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [assignModal, setAssignModal] = useState(null);
  const [showTeam, setShowTeam] = useState(false);
  const tableRef = useRef(null);

  const load = () =>
    Promise.all([
      axios.get('/api/nominations').catch(() => ({ data: [] })),
      axios.get('/api/course-requests').catch(() => ({ data: [] })),
      axios.get('/api/registrations').catch(() => ({ data: [] })),
    ]).then(([n, c, r]) => {
      setNoms(n.data);
      setCourseReqs(c.data);
      setRegs(r.data);
    }).finally(() => setLoading(false));

  useEffect(() => {
    load();
    axios.get('/api/employees/ld-team').then(r => setLdTeam(r.data)).catch(() => {});

    const interval = setInterval(load, 15000);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const toggleExpand = (id) => setExpandedId(prev => prev === id ? null : id);

  const mapNom = n => ({
    id: n.nomination_id,
    type: 'Manager Nomination',
    course: n.course_name,
    submittedBy: n.manager_name,
    department: n.department,
    submittedDate: n.submitted_date ? n.submitted_date.slice(0, 10) : '—',
    raw: n,
    kind: 'nom',
  });

  const mapCourse = c => ({
    id: c.request_id,
    type: 'Course Request',
    course: c.course_name,
    submittedBy: c.manager_name,
    department: c.department,
    submittedDate: c.submitted_date ? c.submitted_date.slice(0, 10) : '—',
    raw: c,
    kind: 'course',
  });

  const mapReg = r => ({
    id: r.request_id,
    type: 'Self Registration',
    course: r.course_name,
    submittedBy: r.employee_name,
    department: r.department,
    submittedDate: r.submitted_date ? r.submitted_date.slice(0, 10) : '—',
    raw: r,
    kind: 'reg',
  });

  // Incoming: waiting for L&D Manager to assign
  const incomingItems = [
    ...noms.filter(n => n.status === 'Pending L&D Manager Review').map(mapNom),
    ...courseReqs.filter(c => c.status === 'Pending L&D Manager Review').map(mapCourse),
    ...regs.filter(r => r.status === 'Pending L&D Manager Review').map(mapReg),
  ];

  // In Progress: already assigned, currently being handled by L&D team
  const inProgressItems = [
    ...noms
      .filter(n => n.assigned_to_id && n.status !== 'Pending L&D Manager Review')
      .map(mapNom),
    ...courseReqs
      .filter(c => c.assigned_to_id && c.status !== 'Pending L&D Manager Review')
      .map(mapCourse),
    ...regs
      .filter(r => r.assigned_to_id && r.status !== 'Pending L&D Manager Review')
      .map(mapReg),
  ];

  const applySearch = items =>
    items.filter(
      i =>
        i.id.toLowerCase().includes(filter.toLowerCase()) ||
        i.course.toLowerCase().includes(filter.toLowerCase()) ||
        i.submittedBy.toLowerCase().includes(filter.toLowerCase())
    );

  const tabs = [
    { key: 'incoming', label: 'Incoming Requests', count: incomingItems.length },
    { key: 'inprogress', label: 'In Progress', count: inProgressItems.length },
  ];

  const currentItems = applySearch(tab === 'incoming' ? incomingItems : inProgressItems);
  const colCount = tab === 'inprogress' ? 8 : 7;

  const doAssign = async (item, member) => {
    const url =
      item.kind === 'nom'
        ? `/api/nominations/${item.id}/assign`
        : item.kind === 'reg'
        ? `/api/registrations/${item.id}/assign`
        : `/api/course-requests/${item.id}/assign`;
    await axios.put(url, {
      performed_by: actorName,
      role: 'L&D Manager',
      assigned_to_id: member.employee_id,
      assigned_to_name: member.name,
    });
    setAssignModal(null);
    setExpandedId(null);
    await load();
    setToast({ msg: `${item.id} assigned to ${member.name}`, type: 'success' });
  };

  if (loading) return <SkeletonTable rows={5} cols={6} />;

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {assignModal && (
        <AssignModal
          item={assignModal}
          ldTeam={ldTeam}
          onClose={() => setAssignModal(null)}
          onAssign={doAssign}
        />
      )}

      <div>
        <h1 className="text-2xl font-bold text-slate-800">Assignment Queue</h1>
        <p className="text-slate-500 text-sm mt-1">
          Review incoming requests from domain managers and assign them to your L&D team.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          onClick={() => { setTab('incoming'); setExpandedId(null); setTimeout(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }}
          className="card !p-4 bg-violet-50 border border-violet-100 cursor-pointer hover:shadow-md hover:border-violet-300 transition-all text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-violet-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Clock size={16} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-2xl font-bold text-slate-800">{incomingItems.length}</p>
              <p className="text-xs text-slate-500 font-medium">Awaiting Assignment</p>
            </div>
            <ChevronRight size={14} className="text-violet-400" />
          </div>
        </button>
        <button
          onClick={() => { setTab('inprogress'); setExpandedId(null); setTimeout(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }}
          className="card !p-4 bg-sky-50 border border-sky-100 cursor-pointer hover:shadow-md hover:border-sky-300 transition-all text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-sky-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <ClipboardList size={16} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-2xl font-bold text-slate-800">{inProgressItems.length}</p>
              <p className="text-xs text-slate-500 font-medium">In Progress</p>
            </div>
            <ChevronRight size={14} className="text-sky-400" />
          </div>
        </button>
        <button
          onClick={() => setShowTeam(s => !s)}
          className="card !p-4 bg-emerald-50 border border-emerald-100 cursor-pointer hover:shadow-md hover:border-emerald-300 transition-all text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Users size={16} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-2xl font-bold text-slate-800">{ldTeam.length}</p>
              <p className="text-xs text-slate-500 font-medium">L&amp;D Team Members</p>
            </div>
            {showTeam ? <ChevronUp size={14} className="text-emerald-500" /> : <ChevronDown size={14} className="text-emerald-400" />}
          </div>
        </button>
        <button
          onClick={() => { setTab('incoming'); setExpandedId(null); setTimeout(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }}
          className="card !p-4 bg-slate-50 border border-slate-100 cursor-pointer hover:shadow-md hover:border-slate-300 transition-all text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-slate-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <CheckCircle size={16} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-2xl font-bold text-slate-800">{incomingItems.length + inProgressItems.length}</p>
              <p className="text-xs text-slate-500 font-medium">Total Active</p>
            </div>
            <ChevronRight size={14} className="text-slate-400" />
          </div>
        </button>
      </div>

      {/* L&D Team roster panel */}
      {showTeam && (
        <div className="card !p-0 overflow-hidden border border-emerald-200">
          <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-emerald-800 flex items-center gap-2"><Users size={15} /> L&amp;D Team Members</p>
            <button onClick={() => setShowTeam(false)} className="text-emerald-400 hover:text-emerald-700"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
            {ldTeam.length === 0 ? (
              <p className="col-span-3 text-center text-sm text-slate-400 py-8">No L&amp;D team members found.</p>
            ) : (
              ldTeam.map(member => (
                <div key={member.employee_id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {member.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{member.name}</p>
                    <p className="text-xs text-slate-500 truncate">{member.designation || member.role || 'L&D Team'} &bull; {member.employee_id}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div ref={tableRef} className="flex gap-1 border-b border-slate-200">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setExpandedId(null); }}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors flex items-center gap-2 ${
              tab === t.key
                ? 'border-violet-600 text-violet-600 bg-violet-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                tab === t.key ? 'bg-violet-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      <p className="text-xs text-slate-500 -mt-2">
        {tab === 'incoming'
          ? 'New requests from domain managers waiting to be assigned to an L&D team member.'
          : 'Requests already assigned — track progress handled by your team.'}
      </p>

      {/* Search */}
      <div className="card !p-4 flex items-center gap-3">
        <Search size={16} className="text-slate-400 flex-shrink-0" />
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Search by ID, course or manager…"
          className="form-input flex-1 !border-0 !ring-0 !p-0 text-sm"
        />
        <span className="text-xs text-slate-400 whitespace-nowrap">{currentItems.length} items</span>
      </div>

      {/* Table */}
      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="table-th w-8"></th>
                <th className="table-th">Request ID</th>
                <th className="table-th">Type</th>
                <th className="table-th">Course Name</th>
                <th className="table-th">Submitted By</th>
                <th className="table-th">Department</th>
                <th className="table-th">Status</th>
                {tab === 'inprogress' && <th className="table-th">Assigned To</th>}
                <th className="table-th">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.length === 0 && (
                <tr>
                  <td colSpan={colCount} className="table-td text-center text-slate-400 py-10">
                    <ClipboardList size={28} className="mx-auto mb-2 opacity-30" />
                    <p className="font-medium">
                      {tab === 'incoming' ? 'No incoming requests to assign' : 'No in-progress requests'}
                    </p>
                  </td>
                </tr>
              )}
              {currentItems.map(item => (
                <Fragment key={item.id}>
                <tr className={`table-row cursor-pointer ${expandedId === item.id ? 'bg-violet-50' : ''}`} onClick={() => toggleExpand(item.id)}>
                  <td className="table-td w-8">
                    {expandedId === item.id
                      ? <ChevronDown size={14} className="text-violet-600" />
                      : <ChevronRight size={14} className="text-slate-400" />}
                  </td>
                  <td className="table-td font-mono text-xs font-medium text-sky-600">{item.id}</td>
                  <td className="table-td">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      item.kind === 'nom' ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700'
                    }`}>
                      {item.type}
                    </span>
                  </td>
                  <td className="table-td font-medium">{item.course}</td>
                  <td className="table-td">{item.submittedBy}</td>
                  <td className="table-td">{item.department}</td>
                  <td className="table-td"><StatusBadge status={item.raw.status} /></td>
                  {tab === 'inprogress' && (
                    <td className="table-td">
                      {item.raw.assigned_to_name
                        ? <span className="text-xs font-medium text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">{item.raw.assigned_to_name}</span>
                        : <span className="text-xs text-slate-400">—</span>}
                    </td>
                  )}
                  <td className="table-td" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => setAssignModal(item)}
                      className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${
                        tab === 'incoming'
                          ? 'bg-violet-600 hover:bg-violet-700 text-white'
                          : 'bg-amber-500 hover:bg-amber-600 text-white'
                      }`}
                    >
                      <UserCheck size={12} /> {tab === 'incoming' ? 'Assign' : 'Reassign'}
                    </button>
                  </td>
                </tr>
                {expandedId === item.id && (
                  <InlineDetail
                    key={`detail-${item.id}`}
                    item={item}
                    colSpan={colCount}
                    onAssign={(i) => setAssignModal(i)}
                    onClose={() => setExpandedId(null)}
                  />
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
