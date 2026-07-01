import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, ListChecks, BookOpen, Users, User, Sparkles } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import AgentRunHistory from '../components/AgentRunHistory';

// ── Pipeline for self-registrations ──────────────────────────────────────────
const REG_STAGES = ['Submitted', 'Manager Approval', 'L&D Approval', 'Enrolled'];

function getRegStageIndex(status) {
  if (status === 'Pending Manager Approval') return 1;
  if (status === 'Pending L&D Manager Review') return 2;
  if (status === 'Pending L&D Validation') return 2;
  if (status === 'Approved') return 3;       // L&D approved → L&D Approval turns green, Enrolled active
  if (status === 'Finalized') return 4;      // all stages green
  if (status === 'Enrolled') return 4;       // email sent → all stages green
  if (status === 'Rejected') return -1;
  return 0;
}

// ── Pipeline for nominations ──────────────────────────────────────────────────
const NOM_STAGES = ['Nominated', 'L&D Validation', 'Manager Approval', 'Curriculum', 'Enrolled'];

function getNomStageIndex(status) {
  if (status === 'Pending L&D Validation') return 1;
  if (status === 'Pending Manager Approval') return 2;
  if (status === 'Approved' || status === 'Curriculum Shared' || status === 'Curriculum Approved' || status === 'Curriculum Rejected') return 3;
  if (status === 'Finalized') return 4;
  if (status === 'Enrolled') return 5;       // email sent → all stages green
  if (status === 'Rejected') return -1;
  return 0;
}

function Pipeline({ stages, stageIndex, rejected }) {
  return (
    <div className="flex items-center gap-1 flex-wrap mt-3">
      {stages.map((s, i) => {
        const done = !rejected && i < stageIndex;
        const active = !rejected && i === stageIndex;
        return (
          <div key={s} className="flex items-center gap-1">
            <div className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap border
              ${done ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                : active ? 'bg-amber-100 text-amber-700 border-amber-200 ring-2 ring-amber-300'
                : rejected && i === stageIndex ? 'bg-red-100 text-red-700 border-red-200'
                : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
              {s}
            </div>
            {i < stages.length - 1 && (
              <ArrowRight size={11} className={done ? 'text-emerald-400' : 'text-slate-300'} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function MyRequests() {
  const { user } = useAuth();
  const [regs, setRegs] = useState([]);
  const [noms, setNoms] = useState([]);
  const [tab, setTab] = useState('self');
  const [loading, setLoading] = useState(true);
  const [agentHistory, setAgentHistory] = useState({});

  useEffect(() => {
    const fetchRegs = axios.get('/api/registrations')
      .then(r => setRegs(r.data.filter(req => req.employee_id === user.employee_id)))
      .catch(() => setRegs([]));

    const fetchNoms = axios.get(`/api/employees/${user.employee_id}/my-nominations`)
      .then(r => setNoms(r.data))
      .catch(() => setNoms([]));

    Promise.all([fetchRegs, fetchNoms]).finally(() => setLoading(false));
  }, [user.employee_id]);

  const toggleAgentHistory = async (entityId, entityType) => {
    const key = `${entityType}:${entityId}`;
    const current = agentHistory[key];
    if (current?.open && !current.loading) {
      setAgentHistory((history) => ({
        ...history,
        [key]: { ...history[key], open: false },
      }));
      return;
    }

    if (current?.runs) {
      setAgentHistory((history) => ({
        ...history,
        [key]: { ...history[key], open: true },
      }));
      return;
    }

    setAgentHistory((history) => ({
      ...history,
      [key]: { open: true, loading: true, runs: [] },
    }));

    try {
      const { data } = await axios.get('/api/ai/agent-runs', { params: { entity_id: entityId, entity_type: entityType, limit: 10 } });
      setAgentHistory((history) => ({
        ...history,
        [key]: { open: true, loading: false, runs: data },
      }));
    } catch {
      setAgentHistory((history) => ({
        ...history,
        [key]: { open: true, loading: false, runs: [] },
      }));
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
    </div>
  );

  const totalPending = regs.filter(r => r.status === 'Pending L&D Validation' || r.status === 'Pending Manager Approval' || r.status === 'Pending L&D Manager Review').length
    + noms.filter(n => n.nomination_status === 'Pending L&D Validation' || n.nomination_status === 'Pending Manager Approval').length;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">My Training Status</h1>
        <p className="text-slate-500 text-sm mt-1">Track your self-registrations and team nominations</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Self Registrations', value: regs.length, bg: 'bg-blue-50', text: 'text-blue-700' },
          { label: 'Nominated by FH', value: noms.length, bg: 'bg-purple-50', text: 'text-purple-700' },
          { label: 'In Progress', value: totalPending, bg: 'bg-amber-50', text: 'text-amber-700' },
          { label: 'Enrolled', value: regs.filter(r => r.status === 'Finalized' || r.status === 'Enrolled').length + noms.filter(n => n.nomination_status === 'Enrolled' || n.nomination_status === 'Finalized').length, bg: 'bg-emerald-50', text: 'text-emerald-700' },
        ].map(s => (
          <div key={s.label} className={`card !p-4 ${s.bg}`}>
            <p className={`text-2xl font-bold ${s.text}`}>{s.value}</p>
            <p className="text-xs text-slate-600 font-medium mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {[
          { key: 'self', label: 'Self Registrations', icon: User, count: regs.length },
          { key: 'nominated', label: 'Nominated by Functional Head', icon: Users, count: noms.length },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              tab === t.key ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* Self Registrations */}
      {tab === 'self' && (
        <div className="space-y-4">
          {regs.length === 0 ? (
            <div className="card text-center py-16 text-slate-400">
              <ListChecks size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-semibold text-slate-500">No self-registrations yet</p>
              <p className="text-sm mt-1">Go to Training Catalog to browse and register for courses.</p>
            </div>
          ) : regs.map(r => {
            const stageIdx = getRegStageIndex(r.status);
            const rejected = r.status === 'Rejected';
            return (
              <div key={r.request_id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-slate-400 font-medium">{r.request_id}</span>
                      <StatusBadge status={r.status} />
                    </div>
                    <h3 className="font-bold text-slate-800">{r.course_name}</h3>
                    <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><BookOpen size={12} /> {r.training_mode}</span>
                      <span>Batch: {r.preferred_batch}</span>
                      <span>Submitted: {r.submitted_date?.slice(0, 10)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleAgentHistory(r.request_id, 'Registration')}
                    className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-100"
                  >
                    <Sparkles size={13} /> View AI History
                  </button>
                </div>

                <Pipeline stages={REG_STAGES} stageIndex={stageIdx} rejected={rejected} />

                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {r.reason && <div><p className="text-xs text-slate-400 font-medium mb-0.5">Reason for Enrollment</p><p className="text-slate-700 text-xs">{r.reason}</p></div>}
                  {r.expected_outcome && <div><p className="text-xs text-slate-400 font-medium mb-0.5">Expected Learning Outcome</p><p className="text-slate-700 text-xs">{r.expected_outcome}</p></div>}
                  {r.ld_remarks && <div><p className="text-xs text-slate-400 font-medium mb-0.5">L&D Remarks</p><p className="text-slate-700 text-xs">{r.ld_remarks}</p></div>}
                  {r.manager_remarks && <div><p className="text-xs text-slate-400 font-medium mb-0.5">Manager Remarks</p><p className="text-slate-700 text-xs">{r.manager_remarks}</p></div>}
                  <div><p className="text-xs text-slate-400 font-medium mb-0.5">Reporting Manager</p><p className="text-slate-700 text-xs">{r.reporting_manager}</p></div>
                </div>

                {(r.status === 'Approved' || r.status === 'Finalized') && (
                  <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 font-medium">
                    You are enrolled! {r.confirmation_sent ? 'Confirmation email has been sent.' : 'Confirmation email will be sent shortly.'}
                  </div>
                )}
                {rejected && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
                    This request was not approved. Please contact your manager or L&D team for more information.
                  </div>
                )}
                {agentHistory[`Registration:${r.request_id}`]?.open && (
                  <AgentRunHistory
                    runs={agentHistory[`Registration:${r.request_id}`]?.runs || []}
                    loading={agentHistory[`Registration:${r.request_id}`]?.loading}
                    emptyMessage="No persisted AI output for this registration yet."
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Nominations by FH */}
      {tab === 'nominated' && (
        <div className="space-y-4">
          {noms.length === 0 ? (
            <div className="card text-center py-16 text-slate-400">
              <Users size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-semibold text-slate-500">You haven't been nominated for any training yet</p>
              <p className="text-sm mt-1">Your Functional Head will nominate you for upcoming programs.</p>
            </div>
          ) : noms.map(n => {
            const stageIdx = getNomStageIndex(n.nomination_status);
            const rejected = n.nomination_status === 'Rejected';
            return (
              <div key={n.id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-slate-400 font-medium">{n.nomination_id}</span>
                      <StatusBadge status={n.nomination_status} />
                    </div>
                    <h3 className="font-bold text-slate-800">{n.course_name}</h3>
                    <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Users size={12} /> Nominated by {n.manager_name}</span>
                      <span>Submitted: {n.submitted_date?.slice(0, 10)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleAgentHistory(n.nomination_id, 'Nomination')}
                    className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-100"
                  >
                    <Sparkles size={13} /> View AI History
                  </button>
                </div>

                <Pipeline stages={NOM_STAGES} stageIndex={stageIdx} rejected={rejected} />

                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {n.nomination_reason && <div><p className="text-xs text-slate-400 font-medium mb-0.5">Nomination Reason</p><p className="text-slate-700 text-xs">{n.nomination_reason}</p></div>}
                  {n.business_need && <div><p className="text-xs text-slate-400 font-medium mb-0.5">Business Need</p><p className="text-slate-700 text-xs">{n.business_need}</p></div>}
                  {n.current_skill_level && <div><p className="text-xs text-slate-400 font-medium mb-0.5">Current Skill Level</p><p className="text-slate-700 text-xs">{n.current_skill_level}</p></div>}
                  {n.required_skill_level && <div><p className="text-xs text-slate-400 font-medium mb-0.5">Required Skill Level</p><p className="text-slate-700 text-xs">{n.required_skill_level}</p></div>}
                  {n.ld_remarks && <div><p className="text-xs text-slate-400 font-medium mb-0.5">L&D Remarks</p><p className="text-slate-700 text-xs">{n.ld_remarks}</p></div>}
                  {n.manager_remarks && <div><p className="text-xs text-slate-400 font-medium mb-0.5">Manager Remarks</p><p className="text-slate-700 text-xs">{n.manager_remarks}</p></div>}
                </div>

                {n.status === 'Enrolled' && (
                  <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 font-medium">
                    You are enrolled in this training!
                  </div>
                )}
                {rejected && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
                    This nomination was not approved.
                  </div>
                )}
                {agentHistory[`Nomination:${n.nomination_id}`]?.open && (
                  <AgentRunHistory
                    runs={agentHistory[`Nomination:${n.nomination_id}`]?.runs || []}
                    loading={agentHistory[`Nomination:${n.nomination_id}`]?.loading}
                    emptyMessage="No persisted AI output for this nomination yet."
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
