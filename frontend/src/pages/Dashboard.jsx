import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  FileText, Clock, CheckCircle, XCircle, Users, BookOpen,
  ClipboardCheck, CheckSquare, Activity, TrendingUp, AlertCircle,
  CalendarDays, UserCheck, Award, Send, Building2, GitMerge,
  ArrowRight, Layers, Filter, RefreshCw, Download, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SkeletonDashboard } from '../components/Skeleton';
import StatusBadge from '../components/StatusBadge';

const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4'];

function StatCard({ label, value, icon: Icon, bg, iconBg, sub, onClick }) {
  return (
    <div
      className={`card !p-4 ${bg} hover:shadow-md transition-shadow ${onClick ? 'cursor-pointer hover:ring-2 hover:ring-blue-300' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-800">{value ?? '—'}</p>
      <p className="text-xs text-slate-600 mt-1 font-medium leading-tight">{label}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function ActivityFeed({ logs }) {
  const DOT = {
    'Self Registration Submitted': 'bg-blue-500',
    'L&D Validation Completed': 'bg-emerald-500',
    'L&D Nomination Validated': 'bg-emerald-500',
    'Manager Nomination Submitted': 'bg-purple-500',
    'Manager Approval Granted': 'bg-indigo-500',
    'Manager Approved Nomination': 'bg-indigo-500',
    'Request Rejected': 'bg-red-500',
    'Nomination Rejected': 'bg-red-500',
    'Curriculum Uploaded': 'bg-teal-500',
    'Curriculum Approved': 'bg-teal-600',
    'Participants Confirmed': 'bg-purple-500',
    'Course Request Submitted': 'bg-orange-500',
  };
  function ago(ts) {
    const s = Math.floor((Date.now() - new Date(ts)) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  }
  return (
    <div className="card h-full">
      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm">
        <Activity size={15} className="text-blue-600" /> Recent Activity
      </h3>
      <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
        {logs.length === 0 && <p className="text-xs text-slate-400 text-center py-6">No activity yet</p>}
        {logs.map(n => (
          <div key={n.log_id} className="flex gap-3 items-start">
            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${DOT[n.action] || 'bg-slate-300'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-700 leading-snug">{n.action}</p>
              <p className="text-[11px] text-slate-400 truncate">
                {n.performed_by} · <span className="font-mono">{n.entity_id}</span>
              </p>
            </div>
            <span className="text-[10px] text-slate-400 whitespace-nowrap">{ago(n.timestamp)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function UpcomingTrainings({ trainings }) {
  if (!trainings?.length) return null;
  return (
    <div className="card">
      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm">
        <CalendarDays size={15} className="text-blue-600" /> Upcoming Trainings
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {trainings.map(t => (
          <div key={t.training_id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 leading-tight truncate">{t.course_name}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate">{t.trainer_name}</p>
              {t.training_date && (
                <p className="text-[11px] text-blue-600 font-medium mt-0.5">
                  {new Date(t.training_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 ml-2">
              <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                {t.seats_available} seats
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                t.mode === 'Online' ? 'bg-green-100 text-green-700' :
                t.mode === 'Offline' ? 'bg-violet-100 text-violet-700' :
                'bg-sky-100 text-sky-700'
              }`}>{t.mode}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── KPI Detail Modal ──────────────────────────────────────────────────────────
function KpiDetailModal({ modal, onClose, navigate }) {
  if (!modal) return null;
  const Icon = modal.icon;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden"
        style={{ maxHeight: '82vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className={`px-5 py-4 ${modal.headerBg} flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 ${modal.iconBg} rounded-xl flex items-center justify-center shadow-sm`}>
              <Icon size={19} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">{modal.title}</p>
              <p className="text-[11px] text-white/70 mt-0.5">
                {modal.count} {modal.count === 1 ? 'item' : 'items'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors p-1">
            <X size={16} />
          </button>
        </div>

        {/* ── Description ── */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
          <p className="text-xs text-slate-600 leading-relaxed">{modal.description}</p>
        </div>

        {/* ── Items ── */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {(!modal.items || modal.items.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <CheckCircle size={28} className="text-emerald-400" />
              <p className="text-sm font-semibold text-slate-500">All clear!</p>
              <p className="text-xs text-slate-400 text-center">{modal.emptyText || 'Nothing in this category right now.'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {modal.items.map((item, i) => (
                <div key={i} className="flex items-start justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 leading-snug truncate">{item.title}</p>
                    {item.sub && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{item.sub}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {item.badge && <StatusBadge status={item.badge} />}
                    {item.right && (
                      <span className={`text-[10px] font-bold whitespace-nowrap ${item.rightColor || 'text-slate-400'}`}>
                        {item.right}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between bg-white">
          <button onClick={onClose} className="text-xs text-slate-500 hover:text-slate-700 transition-colors font-medium">
            Close
          </button>
          {modal.navPath && (
            <button
              onClick={() => { navigate(modal.navPath, modal.navState || undefined); onClose(); }}
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded-lg transition-colors shadow-sm"
            >
              {modal.navLabel || 'View All'} <ArrowRight size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── L&D Team Dashboard ────────────────────────────────────────────────────────
function LDDashboard({ data, logs, navigate }) {
  const [pipelineTab, setPipelineTab] = useState('stages');
  const [modal, setModal]             = useState(null);

  const totalActions = (data.pending_ld_validation || 0) + (data.pending_curriculum_upload || 0) + (data.participants_requested || 0);

  function daysSince(ts) {
    const d = Math.floor((Date.now() - new Date(ts)) / 86400000);
    return d === 0 ? 'Today' : `${d}d ago`;
  }
  function daysColor(ts) {
    const d = Math.floor((Date.now() - new Date(ts)) / 86400000);
    return d >= 5 ? 'text-red-600' : d >= 2 ? 'text-amber-600' : 'text-slate-400';
  }

  function openModal(key) {
    const M = {
      validation: {
        title: 'Pending L&D Validation',
        description: 'These requests have been submitted by employees or managers and are waiting for the L&D team to review and validate them. Validating a request moves it into the curriculum preparation stage.',
        icon: ClipboardCheck, iconBg: 'bg-amber-500', headerBg: 'bg-gradient-to-r from-amber-500 to-orange-500',
        count: data.pending_ld_validation || 0,
        emptyText: 'Great work — no requests waiting for validation.',
        items: (data.pending_queue || []).map(r => ({
          title: r.course_name,
          sub: `${r.id} · Submitted by ${r.name}`,
          badge: r.status,
          right: daysSince(r.submitted_date),
          rightColor: daysColor(r.submitted_date),
        })),
        navPath: '/manager-approval', navLabel: 'Open Approval Queue',
      },
      fh_approval: {
        title: 'Pending FH Approval',
        description: 'New course requests raised by Reporting Managers that have been validated by L&D and forwarded to the Functional Head for business approval before curriculum preparation begins.',
        icon: Clock, iconBg: 'bg-sky-500', headerBg: 'bg-gradient-to-r from-sky-500 to-cyan-500',
        count: data.pending_fh_approval || 0,
        emptyText: 'No course requests are waiting for FH sign-off.',
        items: (data.ld_fh_items || []).map(r => ({
          title: r.course_name,
          sub: `${r.id} · Raised by ${r.name} · ${r.department || ''}`,
          badge: r.status,
          right: daysSince(r.submitted_date),
          rightColor: daysColor(r.submitted_date),
        })),
        navPath: '/workflow', navLabel: 'View in Workflow Tracker',
      },
      curriculum: {
        title: 'Curriculum Upload',
        description: 'Requests that have been approved (by L&D and/or FH) and are now awaiting L&D to prepare and upload the training curriculum. The manager will review the curriculum before confirming nominees.',
        icon: FileText, iconBg: 'bg-indigo-500', headerBg: 'bg-gradient-to-r from-indigo-500 to-violet-500',
        count: data.pending_curriculum_upload || 0,
        emptyText: 'No curricula are pending upload.',
        items: (data.ld_curriculum_items || []).map(r => ({
          title: r.course_name,
          sub: `${r.id} · ${r.name} · ${r.department || ''}`,
          badge: r.status,
        })),
        navPath: '/manager-approval', navLabel: 'Go to Curriculum Queue',
      },
      participants: {
        title: 'Participants Requested',
        description: 'The training curriculum has been reviewed and approved by the manager. L&D has asked the manager to nominate specific participants from their team for final enrollment confirmation.',
        icon: Users, iconBg: 'bg-violet-500', headerBg: 'bg-gradient-to-r from-violet-500 to-purple-600',
        count: data.participants_requested || 0,
        emptyText: 'No participant nominations are pending.',
        items: (data.ld_participants_items || []).map(r => ({
          title: r.course_name,
          sub: `${r.id} · ${r.name} · ${r.department || ''}`,
          badge: r.status,
        })),
        navPath: '/manager-approval', navLabel: 'View Nominations',
      },
      enrolled: {
        title: 'Enrolled',
        description: 'Employees who have completed the full approval workflow and have been confirmed as enrolled in a training program. Enrollment confirmation emails have been sent to all participants.',
        icon: CheckCircle, iconBg: 'bg-emerald-600', headerBg: 'bg-gradient-to-r from-emerald-500 to-teal-500',
        count: data.enrolled || 0,
        emptyText: 'No enrollments yet.',
        items: (data.ld_enrolled_items || []).map(r => ({
          title: r.course_name,
          sub: `${r.id} · ${r.name}`,
          badge: r.status,
        })),
        navPath: '/participants', navLabel: 'View Finalized Participants',
      },
      total: {
        title: 'Total Pipeline',
        description: 'A complete view of all training requests in the system — including self-registrations, manager nominations, and new course requests — across every stage of the approval workflow.',
        icon: TrendingUp, iconBg: 'bg-blue-600', headerBg: 'bg-gradient-to-r from-blue-600 to-indigo-600',
        count: data.total_requests || 0,
        emptyText: 'No requests in the system yet.',
        items: Object.entries(data.status_distribution || {})
          .sort((a, b) => b[1] - a[1])
          .map(([status, cnt]) => ({
            title: status,
            sub: `${cnt} request${cnt !== 1 ? 's' : ''}`,
            right: `${Math.round(cnt / (data.total_requests || 1) * 100)}%`,
            rightColor: 'text-blue-600',
          })),
        navPath: '/workflow', navLabel: 'Open Workflow Tracker',
      },
    };
    setModal(M[key] || null);
  }

  const stats = [
    { label: 'Pending Validation',   value: data.pending_ld_validation,    icon: ClipboardCheck, bg: 'bg-amber-50',   iconBg: 'bg-amber-500',   sub: 'Need your review now',  onClick: () => openModal('validation') },
    { label: 'Pending FH Approval',  value: data.pending_fh_approval,      icon: Clock,          bg: 'bg-sky-50',     iconBg: 'bg-sky-500',     sub: 'Awaiting FH sign-off',  onClick: () => openModal('fh_approval') },
    { label: 'Curriculum Upload',    value: data.pending_curriculum_upload, icon: FileText,       bg: 'bg-indigo-50',  iconBg: 'bg-indigo-500',  sub: 'Curricula to prepare',  onClick: () => openModal('curriculum') },
    { label: 'Participants Requested', value: data.participants_requested,  icon: Users,          bg: 'bg-violet-50',  iconBg: 'bg-violet-500',  sub: 'Awaiting nominations',  onClick: () => openModal('participants') },
    { label: 'Enrolled',             value: data.enrolled,                  icon: CheckCircle,    bg: 'bg-emerald-50', iconBg: 'bg-emerald-600', sub: 'Successfully enrolled', onClick: () => openModal('enrolled') },
    { label: 'Total Pipeline',       value: data.total_requests,            icon: TrendingUp,     bg: 'bg-blue-50',    iconBg: 'bg-blue-600',    sub: 'All requests',           onClick: () => openModal('total') },
  ];

  const pipelineStages = [
    { label: 'Pending L&D Validation', count: data.pending_ld_validation || 0,   color: 'bg-amber-500',   textColor: 'text-amber-700',   bg: 'bg-amber-50',   nav: '/manager-approval' },
    { label: 'Pending FH Approval',    count: data.pending_fh_approval || 0,      color: 'bg-sky-500',     textColor: 'text-sky-700',     bg: 'bg-sky-50',     nav: '/workflow' },
    { label: 'Curriculum Upload',      count: data.pending_curriculum_upload || 0, color: 'bg-indigo-500', textColor: 'text-indigo-700',  bg: 'bg-indigo-50',  nav: '/manager-approval' },
    { label: 'Participants Requested', count: data.participants_requested || 0,    color: 'bg-violet-500',  textColor: 'text-violet-700',  bg: 'bg-violet-50',  nav: '/manager-approval' },
    { label: 'Enrolled',               count: data.enrolled || 0,                 color: 'bg-emerald-500', textColor: 'text-emerald-700', bg: 'bg-emerald-50', nav: '/participants' },
  ];
  const pipelineTotal = pipelineStages.reduce((s, x) => s + x.count, 0) || 1;

  const pendingQueue = data.pending_queue || [];
  const topCourses   = data.top_courses   || [];
  const typeBreakdown = [
    { label: 'Self Registrations',   value: data.ld_self_reg_count || 0, color: '#3b82f6' },
    { label: 'Manager Nominations',  value: data.ld_nom_count       || 0, color: '#8b5cf6' },
    { label: 'New Course Requests',  value: data.ld_crq_count       || 0, color: '#f59e0b' },
  ];
  const pieData  = Object.entries(data.status_distribution || {}).filter(([,v]) => v > 0).map(([name, value]) => ({ name, value }));
  const deptData = Object.entries(data.department_nominations || {}).filter(([,v]) => v > 0)
    .map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);

  function daysAgo(ts) {
    return Math.floor((Date.now() - new Date(ts)) / 86400000);
  }

  return (
    <div className="space-y-6">

      {/* ── Attention Banner ── */}
      {totalActions > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertCircle size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900">
                {totalActions} action{totalActions !== 1 ? 's' : ''} need your attention
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                {data.pending_ld_validation > 0 && <span className="mr-3">· {data.pending_ld_validation} pending validation</span>}
                {data.pending_curriculum_upload > 0 && <span className="mr-3">· {data.pending_curriculum_upload} curricula to upload</span>}
                {data.participants_requested > 0 && <span>· {data.participants_requested} participants to nominate</span>}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/manager-approval')}
            className="text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap flex-shrink-0"
          >
            Review All <ArrowRight size={12} />
          </button>
        </div>
      )}

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      {/* ── Pipeline + Activity ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Pipeline Card — 2 cols */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <GitMerge size={15} className="text-blue-600" /> Approval Pipeline
            </h3>
            <div className="flex gap-1.5">
              {[
                { key: 'stages', label: 'Stages' },
                { key: 'queue',  label: `Queue${pendingQueue.length ? ` (${pendingQueue.length})` : ''}` },
                { key: 'types',  label: 'By Type' },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setPipelineTab(t.key)}
                  className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                    pipelineTab === t.key
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* STAGES TAB */}
          {pipelineTab === 'stages' && (
            <div className="space-y-2.5">
              {pipelineStages.map(stage => {
                const pct = Math.round(stage.count / pipelineTotal * 100);
                return (
                  <div
                    key={stage.label}
                    className={`flex items-center gap-4 p-3 ${stage.bg} rounded-xl cursor-pointer hover:opacity-80 transition-opacity group`}
                    onClick={() => navigate(stage.nav)}
                    title={`Go to ${stage.label}`}
                  >
                    <div className="w-40 flex-shrink-0">
                      <p className="text-xs font-semibold text-slate-700 leading-tight">{stage.label}</p>
                    </div>
                    <div className="flex-1">
                      <div className="h-2 bg-white/60 rounded-full overflow-hidden">
                        <div className={`h-full ${stage.color} rounded-full transition-all`} style={{ width: `${Math.max(pct, stage.count > 0 ? 4 : 0)}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-lg font-bold ${stage.textColor}`}>{stage.count}</span>
                      <span className="text-[10px] text-slate-400 w-8">{pct}%</span>
                      <ArrowRight size={12} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                    </div>
                  </div>
                );
              })}
              {/* Summary row */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 px-1">
                <span className="text-xs text-slate-500">Total active requests</span>
                <span className="text-sm font-bold text-slate-700">{data.total_requests ?? 0}</span>
              </div>
            </div>
          )}

          {/* QUEUE TAB */}
          {pipelineTab === 'queue' && (
            <div>
              {pendingQueue.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <CheckCircle size={28} className="text-emerald-400" />
                  <p className="text-sm font-semibold text-slate-500">All clear! No pending items</p>
                  <p className="text-xs text-slate-400">Nothing waiting for L&D action</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left pb-2 font-semibold text-slate-500">ID</th>
                        <th className="text-left pb-2 font-semibold text-slate-500">Course</th>
                        <th className="text-left pb-2 font-semibold text-slate-500">Submitted by</th>
                        <th className="text-left pb-2 font-semibold text-slate-500">Status</th>
                        <th className="text-right pb-2 font-semibold text-slate-500">Waiting</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {pendingQueue.map(item => {
                        const days = daysAgo(item.submitted_date);
                        return (
                          <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2 pr-2 font-mono text-slate-400 whitespace-nowrap">{item.id}</td>
                            <td className="py-2 pr-3 text-slate-700 font-medium max-w-[180px] truncate">{item.course_name}</td>
                            <td className="py-2 pr-3 text-slate-500 whitespace-nowrap">{item.name}</td>
                            <td className="py-2 pr-3"><StatusBadge status={item.status} /></td>
                            <td className={`py-2 text-right font-semibold whitespace-nowrap ${days >= 5 ? 'text-red-600' : days >= 2 ? 'text-amber-600' : 'text-slate-500'}`}>
                              {days === 0 ? 'Today' : `${days}d`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TYPES TAB */}
          {pipelineTab === 'types' && (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-3">
                {typeBreakdown.map(t => (
                  <div key={t.label} className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100">
                    <p className="text-2xl font-bold text-slate-800">{t.value}</p>
                    <p className="text-xs text-slate-500 mt-1 leading-tight">{t.label}</p>
                    <div className="mt-2 h-1.5 rounded-full mx-4" style={{ backgroundColor: t.color, opacity: 0.7 }} />
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart
                  data={[{
                    name: 'Requests',
                    'Self Reg':   data.ld_self_reg_count || 0,
                    'Noms':       data.ld_nom_count       || 0,
                    'New Course': data.ld_crq_count       || 0,
                  }]}
                  margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend iconSize={9} wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="Self Reg"   fill="#3b82f6" radius={[4,4,0,0]} />
                  <Bar dataKey="Noms"       fill="#8b5cf6" radius={[4,4,0,0]} />
                  <Bar dataKey="New Course" fill="#f59e0b" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <ActivityFeed logs={logs} />
      </div>

      {/* ── Charts Row: Status pie + Dept bar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-bold text-slate-800 mb-4 text-sm flex items-center gap-2">
            <Layers size={15} className="text-blue-600" /> Request Status Distribution
          </h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={58} outerRadius={88} dataKey="value" paddingAngle={3}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend iconSize={9} wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-slate-400 text-center py-12">No data yet</p>}
        </div>

        <div className="card">
          <h3 className="font-bold text-slate-800 mb-4 text-sm flex items-center gap-2">
            <Building2 size={15} className="text-blue-600" /> Nominations by Department
          </h3>
          {deptData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={deptData} layout="vertical" margin={{ top: 0, right: 16, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={96} />
                <Tooltip />
                <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-slate-400 text-center py-12">No data yet</p>}
        </div>
      </div>

      {/* ── Top Requested Courses ── */}
      {topCourses.length > 0 && (
        <div className="card">
          <h3 className="font-bold text-slate-800 mb-5 text-sm flex items-center gap-2">
            <BookOpen size={15} className="text-blue-600" /> Top Requested Courses
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
            {topCourses.map(([course, count], i) => {
              const pct = Math.round(count / topCourses[0][1] * 100);
              return (
                <div key={course} className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-slate-400 w-4 text-right flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-medium text-slate-700 truncate">{course}</span>
                      <span className="text-xs font-bold text-slate-500 ml-2 flex-shrink-0">{count}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <UpcomingTrainings trainings={data.upcoming_trainings} />
      <KpiDetailModal modal={modal} onClose={() => setModal(null)} navigate={navigate} />
    </div>
  );
}

// ── Reporting Manager Dashboard ───────────────────────────────────────────────
function ReportingManagerDashboard({ data, logs, navigate }) {
  const [tab, setTab] = useState('pipeline');
  const [modal, setModal] = useState(null);

  const pendingActions = data.my_pending_actions || 0;

  const allReqs = data.rm_all_requests || [];

  function rmDaysSince(ts) {
    if (!ts) return '';
    const d = Math.floor((Date.now() - new Date(ts)) / 86400000);
    return d === 0 ? 'Today' : `${d}d ago`;
  }
  function rmDaysColor(ts) {
    if (!ts) return 'text-slate-400';
    const d = Math.floor((Date.now() - new Date(ts)) / 86400000);
    return d >= 5 ? 'text-red-600' : d >= 2 ? 'text-amber-600' : 'text-slate-400';
  }
  function toModalItem(r) {
    return {
      title: r.course_name,
      sub: `${r.id} · ${r.type}`,
      badge: r.status,
      right: rmDaysSince(r.submitted_date),
      rightColor: rmDaysColor(r.submitted_date),
    };
  }

  function openModal(key) {
    const configs = {
      team_requests: {
        title: 'All Team Requests',
        description: 'Every training request raised by your team — nominations, self-registrations, and new course requests. Track their progress through the approval pipeline here.',
        icon: Users, iconBg: 'bg-blue-600', headerBg: 'bg-gradient-to-r from-blue-600 to-indigo-600',
        count: allReqs.length,
        emptyText: 'No requests have been raised by your team yet.',
        items: allReqs.map(toModalItem),
        navPath: '/workflow', navLabel: 'View All in Status',
      },
      pending_actions: {
        title: 'Pending Actions',
        description: 'These requests need your direct action — approval, curriculum review, or participant nomination. Addressing these promptly keeps the training pipeline moving.',
        icon: AlertCircle, iconBg: 'bg-amber-500', headerBg: 'bg-gradient-to-r from-amber-500 to-orange-500',
        count: allReqs.filter(r => ['Pending Manager Approval', 'Curriculum Shared', 'Participants Requested'].includes(r.status)).length,
        emptyText: 'No pending actions right now — you\'re all caught up!',
        items: allReqs
          .filter(r => ['Pending Manager Approval', 'Curriculum Shared', 'Participants Requested'].includes(r.status))
          .map(r => ({
            title: r.course_name,
            sub: `${r.id} · ${r.status === 'Pending Manager Approval' ? 'Approve this request' : r.status === 'Curriculum Shared' ? 'Review the curriculum' : 'Nominate participants'}`,
            badge: r.status,
            right: rmDaysSince(r.submitted_date),
            rightColor: rmDaysColor(r.submitted_date),
          })),
        navPath: '/manager-approval', navLabel: 'Go to Approval Queue',
      },
      in_review: {
        title: 'In L&D / FH Review',
        description: 'Requests currently being processed by the L&D team or awaiting Functional Head approval. No action needed from you — these are progressing through the workflow.',
        icon: Clock, iconBg: 'bg-sky-500', headerBg: 'bg-gradient-to-r from-sky-500 to-cyan-500',
        count: allReqs.filter(r => ['Pending L&D Validation', 'Pending FH Approval', 'Approved'].includes(r.status)).length,
        emptyText: 'No requests are currently under L&D or FH review.',
        items: allReqs
          .filter(r => ['Pending L&D Validation', 'Pending FH Approval', 'Approved'].includes(r.status))
          .map(toModalItem),
        navPath: '/workflow', navLabel: 'View in Status Tracker',
      },
      participants_needed: {
        title: 'Participants Needed',
        description: 'The curriculum for these requests has been approved. L&D is waiting for you to nominate specific team members who will participate in the training.',
        icon: UserCheck, iconBg: 'bg-violet-500', headerBg: 'bg-gradient-to-r from-violet-500 to-purple-600',
        count: allReqs.filter(r => r.status === 'Participants Requested').length,
        emptyText: 'No participant nominations are pending right now.',
        items: allReqs
          .filter(r => r.status === 'Participants Requested')
          .map(r => ({
            title: r.course_name,
            sub: `${r.id} · Waiting for your nominee list`,
            badge: r.status,
            right: rmDaysSince(r.submitted_date),
            rightColor: rmDaysColor(r.submitted_date),
          })),
        navPath: '/manager-approval', navLabel: 'Nominate Participants',
        navState: { tab: 'participants' },
      },
      enrolled: {
        title: 'Enrolled',
        description: 'Team members who have successfully completed the full approval workflow and are confirmed for training. Enrollment confirmation emails have been sent.',
        icon: Award, iconBg: 'bg-emerald-600', headerBg: 'bg-gradient-to-r from-emerald-500 to-teal-500',
        count: allReqs.filter(r => ['Enrolled', 'Finalized'].includes(r.status)).length,
        emptyText: 'No team members are enrolled in training yet.',
        items: allReqs
          .filter(r => ['Enrolled', 'Finalized'].includes(r.status))
          .map(r => ({
            title: r.course_name,
            sub: `${r.id} · ${r.type}`,
            badge: r.status,
            right: rmDaysSince(r.submitted_date),
            rightColor: 'text-emerald-600',
          })),
        navPath: '/participants', navLabel: 'View Finalized Participants',
      },
      rejected: {
        title: 'Rejected Requests',
        description: 'Requests that were not approved by L&D or the Functional Head. Review the rejection reasons to understand what happened and whether to re-raise the request.',
        icon: XCircle, iconBg: 'bg-red-600', headerBg: 'bg-gradient-to-r from-red-500 to-rose-600',
        count: allReqs.filter(r => r.status === 'Rejected').length,
        emptyText: 'No rejected requests — great going!',
        items: allReqs
          .filter(r => r.status === 'Rejected')
          .map(r => ({
            title: r.course_name,
            sub: `${r.id} · ${r.type}`,
            badge: r.status,
            right: rmDaysSince(r.submitted_date),
            rightColor: 'text-red-500',
          })),
        navPath: '/workflow', navLabel: 'View in Status Tracker',
      },
    };
    setModal(configs[key] || null);
  }

  const stats = [
    { label: 'Team Requests',        value: data.my_nominations,           icon: Users,       bg: 'bg-blue-50',    iconBg: 'bg-blue-600',    sub: 'Nominations + course requests', onClick: () => openModal('team_requests') },
    { label: 'Pending Actions',      value: pendingActions,                icon: AlertCircle, bg: 'bg-amber-50',   iconBg: 'bg-amber-500',   sub: 'Needs your attention',          onClick: () => openModal('pending_actions') },
    { label: 'In L&D Review',        value: data.my_in_review,             icon: Clock,       bg: 'bg-sky-50',     iconBg: 'bg-sky-500',     sub: 'Being processed by L&D',        onClick: () => openModal('in_review') },
    { label: 'Participants Needed',  value: data.my_participants_requested, icon: UserCheck,   bg: 'bg-violet-50',  iconBg: 'bg-violet-500',  sub: 'Ready to nominate',             onClick: () => openModal('participants_needed') },
    { label: 'Enrolled',             value: data.my_enrolled,              icon: Award,       bg: 'bg-emerald-50', iconBg: 'bg-emerald-600', sub: 'Team members enrolled',         onClick: () => openModal('enrolled') },
    { label: 'Rejected',             value: data.my_rejected,              icon: XCircle,     bg: 'bg-red-50',     iconBg: 'bg-red-600',     sub: 'Not approved',                  onClick: () => openModal('rejected') },
  ];

  const pipelineStages = [
    { label: 'Pending My Approval',    count: data.rm_pending_approval   || 0, color: 'bg-amber-500',   textColor: 'text-amber-700',   bg: 'bg-amber-50',   nav: '/manager-approval' },
    { label: 'Curriculum to Review',   count: data.rm_curriculum_review  || 0, color: 'bg-indigo-500',  textColor: 'text-indigo-700',  bg: 'bg-indigo-50',  nav: '/manager-approval' },
    { label: 'In L&D / FH Review',     count: data.my_in_review          || 0, color: 'bg-sky-500',     textColor: 'text-sky-700',     bg: 'bg-sky-50',     nav: '/workflow' },
    { label: 'Nominate Participants',  count: data.my_participants_requested || 0, color: 'bg-violet-500', textColor: 'text-violet-700', bg: 'bg-violet-50', nav: '/manager-approval' },
    { label: 'Enrolled',               count: data.my_enrolled           || 0, color: 'bg-emerald-500', textColor: 'text-emerald-700', bg: 'bg-emerald-50', nav: '/participants' },
  ];
  const pipelineTotal = pipelineStages.reduce((s, x) => s + x.count, 0) || 1;

  const allRequests   = data.rm_all_requests   || [];
  const teamMembers   = data.rm_team_members   || [];
  const topCourses    = data.rm_top_courses    || [];
  const statusData    = Object.entries(data.my_status_dist || {}).filter(([,v]) => v > 0).map(([name, value]) => ({ name, value }));

  // Action items needing RM attention
  const actionItems = allRequests.filter(r =>
    ['Pending Manager Approval', 'Curriculum Shared', 'Participants Requested'].includes(r.status)
  );

  function daysAgo(ts) {
    return Math.floor((Date.now() - new Date(ts)) / 86400000);
  }

  const TYPE_CHIP = {
    'Nomination':        'bg-purple-100 text-purple-700',
    'RM Course Request': 'bg-orange-100 text-orange-700',
    'FH Course Request': 'bg-amber-100 text-amber-700',
    'Course Request':    'bg-orange-100 text-orange-700',
    'Registration':      'bg-blue-100 text-blue-700',
  };

  return (
    <div className="space-y-6">

      {/* ── Attention Banner ── */}
      {pendingActions > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertCircle size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900">
                {pendingActions} action{pendingActions !== 1 ? 's' : ''} need your attention
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                {(data.rm_pending_approval || 0) > 0 && <span className="mr-3">· {data.rm_pending_approval} awaiting approval</span>}
                {(data.rm_curriculum_review || 0) > 0 && <span className="mr-3">· {data.rm_curriculum_review} curriculum to review</span>}
                {(data.my_participants_requested || 0) > 0 && <span>· {data.my_participants_requested} participants to nominate</span>}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/manager-approval')}
            className="text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap flex-shrink-0"
          >
            Take Action <ArrowRight size={12} />
          </button>
        </div>
      )}

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      {/* ── Pipeline + Activity ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Main Tabbed Card — 2 cols */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <GitMerge size={15} className="text-blue-600" /> Team Request Overview
            </h3>
            <div className="flex gap-1.5">
              {[
                { key: 'pipeline', label: 'Pipeline' },
                { key: 'requests', label: `All Requests${allRequests.length ? ` (${allRequests.length})` : ''}` },
                { key: 'actions',  label: `Action Items${actionItems.length ? ` (${actionItems.length})` : ''}` },
                { key: 'team',     label: 'My Team' },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                    tab === t.key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* PIPELINE TAB */}
          {tab === 'pipeline' && (
            <div className="space-y-2.5">
              {pipelineStages.map(stage => {
                const pct = Math.round(stage.count / pipelineTotal * 100);
                return (
                  <div
                    key={stage.label}
                    className={`flex items-center gap-4 p-3 ${stage.bg} rounded-xl cursor-pointer hover:opacity-80 transition-opacity group`}
                    onClick={() => navigate(stage.nav)}
                  >
                    <div className="w-40 flex-shrink-0">
                      <p className="text-xs font-semibold text-slate-700 leading-tight">{stage.label}</p>
                    </div>
                    <div className="flex-1">
                      <div className="h-2 bg-white/60 rounded-full overflow-hidden">
                        <div className={`h-full ${stage.color} rounded-full`} style={{ width: `${Math.max(pct, stage.count > 0 ? 5 : 0)}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-lg font-bold ${stage.textColor}`}>{stage.count}</span>
                      <span className="text-[10px] text-slate-400 w-7">{pct}%</span>
                      <ArrowRight size={12} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 px-1">
                <span className="text-xs text-slate-500">Total team requests</span>
                <span className="text-sm font-bold text-slate-700">{data.my_nominations ?? 0}</span>
              </div>
            </div>
          )}

          {/* ALL REQUESTS TAB */}
          {tab === 'requests' && (
            <div>
              {allRequests.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-10">No requests yet</p>
              ) : (
                <div className="overflow-x-auto max-h-72 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b border-slate-100">
                        <th className="text-left pb-2 font-semibold text-slate-500">ID</th>
                        <th className="text-left pb-2 font-semibold text-slate-500">Course</th>
                        <th className="text-left pb-2 font-semibold text-slate-500">Type</th>
                        <th className="text-left pb-2 font-semibold text-slate-500">Status</th>
                        <th className="text-right pb-2 font-semibold text-slate-500">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {allRequests.map(r => (
                        <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 pr-2 font-mono text-[10px] text-slate-400">{r.id}</td>
                          <td className="py-2 pr-3 text-slate-700 font-medium max-w-[160px] truncate">{r.course_name}</td>
                          <td className="py-2 pr-3">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_CHIP[r.type] || 'bg-slate-100 text-slate-600'}`}>{r.type}</span>
                          </td>
                          <td className="py-2 pr-3"><StatusBadge status={r.status} /></td>
                          <td className="py-2 text-right text-slate-400 whitespace-nowrap">{r.submitted_date?.slice(0,10)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ACTION ITEMS TAB */}
          {tab === 'actions' && (
            <div>
              {actionItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <CheckCircle size={28} className="text-emerald-400" />
                  <p className="text-sm font-semibold text-slate-500">No pending actions</p>
                  <p className="text-xs text-slate-400">You're all caught up!</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {actionItems.map(r => {
                    const days = daysAgo(r.submitted_date);
                    const actionMap = {
                      'Pending Manager Approval': { label: 'Approve request', color: 'bg-amber-500', nav: '/manager-approval' },
                      'Curriculum Shared':        { label: 'Review curriculum', color: 'bg-indigo-500', nav: '/manager-approval' },
                      'Participants Requested':   { label: 'Nominate participants', color: 'bg-violet-500', nav: '/manager-approval' },
                    };
                    const action = actionMap[r.status] || { label: 'View', color: 'bg-slate-400', nav: '/workflow' };
                    return (
                      <div key={r.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className={`w-2 h-10 ${action.color} rounded-full flex-shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">{r.course_name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_CHIP[r.type] || 'bg-slate-100 text-slate-600'}`}>{r.type}</span>
                            <span className="text-[10px] text-slate-400">{r.id}</span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-[10px] font-semibold ${days >= 3 ? 'text-red-600' : days >= 1 ? 'text-amber-600' : 'text-slate-400'}`}>
                            {days === 0 ? 'Today' : `${days}d ago`}
                          </p>
                          <button
                            onClick={() => navigate(action.nav)}
                            className="text-[10px] text-blue-600 font-semibold hover:underline mt-0.5"
                          >
                            {action.label} →
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TEAM TAB */}
          {tab === 'team' && (
            <div>
              {teamMembers.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-10">No team members found</p>
              ) : (
                <div className="overflow-x-auto max-h-72 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b border-slate-100">
                        <th className="text-left pb-2 font-semibold text-slate-500">Employee</th>
                        <th className="text-left pb-2 font-semibold text-slate-500">ID</th>
                        <th className="text-center pb-2 font-semibold text-slate-500">Requests</th>
                        <th className="text-center pb-2 font-semibold text-slate-500">Enrolled</th>
                        <th className="text-center pb-2 font-semibold text-slate-500">Pending</th>
                        <th className="text-center pb-2 font-semibold text-slate-500">Rejected</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {teamMembers.map(m => (
                        <tr key={m.employee_id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 pr-3 font-semibold text-slate-700">{m.name}</td>
                          <td className="py-2 pr-3 font-mono text-[10px] text-slate-400">{m.employee_id}</td>
                          <td className="py-2 text-center text-slate-600 font-medium">{m.total}</td>
                          <td className="py-2 text-center">
                            <span className={`font-semibold ${m.enrolled > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>{m.enrolled}</span>
                          </td>
                          <td className="py-2 text-center">
                            <span className={`font-semibold ${m.pending > 0 ? 'text-amber-600' : 'text-slate-300'}`}>{m.pending}</span>
                          </td>
                          <td className="py-2 text-center">
                            <span className={`font-semibold ${m.rejected > 0 ? 'text-red-600' : 'text-slate-300'}`}>{m.rejected}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <ActivityFeed logs={logs} />
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="card">
          <h3 className="font-bold text-slate-800 mb-4 text-sm flex items-center gap-2">
            <Layers size={15} className="text-blue-600" /> My Requests by Status
          </h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3}>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend iconSize={9} wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-slate-400 text-center py-12">No data yet</p>}
        </div>

        {/* Top Requested Courses */}
        <div className="card">
          <h3 className="font-bold text-slate-800 mb-4 text-sm flex items-center gap-2">
            <BookOpen size={15} className="text-blue-600" /> Top Courses Requested
          </h3>
          {topCourses.length > 0 ? (
            <div className="space-y-3">
              {topCourses.map(([course, count], i) => {
                const pct = Math.round(count / topCourses[0][1] * 100);
                return (
                  <div key={course} className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-slate-400 w-4 text-right flex-shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-medium text-slate-700 truncate">{course}</span>
                        <span className="text-xs font-bold text-slate-500 ml-2 flex-shrink-0">{count}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <p className="text-xs text-slate-400 text-center py-12">No data yet</p>}
        </div>
      </div>

      <UpcomingTrainings trainings={data.upcoming_trainings} />

      <KpiDetailModal modal={modal} onClose={() => setModal(null)} navigate={navigate} />
    </div>
  );
}

// ── FH Detail Modal ───────────────────────────────────────────────────────────
function FHDetailModal({ modal, fhEmployeeId, onClose, navigate }) {
  if (!modal) return null;

  const HEADER_COLORS = {
    amber:   'bg-amber-500',  sky:    'bg-sky-500',
    blue:    'bg-blue-600',   violet: 'bg-violet-500',
    emerald: 'bg-emerald-500',red:   'bg-red-500',
    indigo:  'bg-indigo-600', teal:   'bg-teal-600',
  };
  const BORDER_COLORS = {
    amber: 'border-amber-200 bg-amber-50', sky: 'border-sky-200 bg-sky-50',
    blue: 'border-blue-200 bg-blue-50',    violet: 'border-violet-200 bg-violet-50',
    emerald: 'border-emerald-200 bg-emerald-50', red: 'border-red-200 bg-red-50',
    indigo: 'border-indigo-200 bg-indigo-50', teal: 'border-teal-200 bg-teal-50',
  };
  const headerCls  = HEADER_COLORS[modal.color] || 'bg-blue-600';
  const borderCls  = BORDER_COLORS[modal.color]  || 'border-blue-200 bg-blue-50';

  function statusChip(s) {
    const m = {
      'Pending FH Approval':    'bg-amber-100 text-amber-700',
      'Pending L&D Validation': 'bg-blue-100 text-blue-700',
      Approved:                 'bg-emerald-100 text-emerald-700',
      'Curriculum Shared':      'bg-violet-100 text-violet-700',
      'Curriculum Approved':    'bg-teal-100 text-teal-700',
      'Participants Requested': 'bg-purple-100 text-purple-700',
      Finalized:                'bg-teal-100 text-teal-700',
      Enrolled:                 'bg-teal-100 text-teal-700',
      Rejected:                 'bg-red-100 text-red-700',
    };
    return m[s] || 'bg-slate-100 text-slate-600';
  }

  const items = modal.items || [];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* Modal Header */}
        <div className={`${headerCls} text-white px-6 py-5 rounded-t-2xl`}>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-bold text-lg leading-snug">{modal.title}</h2>
              <p className="text-sm opacity-80 mt-0.5">{modal.subtitle}</p>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <span className="bg-white/25 text-white text-sm font-bold px-3 py-1 rounded-full whitespace-nowrap">
                {items.length} request{items.length !== 1 ? 's' : ''}
              </span>
              <button onClick={onClose}
                className="w-8 h-8 bg-white/20 hover:bg-white/35 rounded-full flex items-center justify-center text-white font-bold text-sm transition-colors">
                ✕
              </button>
            </div>
          </div>

          {/* Manager summary strip */}
          {modal.manager && (
            <div className="mt-4 flex gap-4 flex-wrap">
              {[
                { label: 'Total',      value: modal.manager.total,       dim: 'text-white' },
                { label: 'Pending',    value: modal.manager.pending,     dim: 'text-amber-200' },
                { label: 'In Progress',value: modal.manager.in_progress, dim: 'text-sky-200' },
                { label: 'Enrolled',   value: modal.manager.enrolled,    dim: 'text-emerald-200' },
                { label: 'Rejected',   value: modal.manager.rejected,    dim: 'text-red-200' },
              ].map(s => (
                <div key={s.label} className="text-center bg-white/15 rounded-lg px-4 py-2">
                  <p className={`text-xl font-bold ${s.dim}`}>{s.value}</p>
                  <p className="text-xs text-white/70">{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {items.length === 0 ? (
            <div className="text-center py-14">
              <CheckCircle size={40} className="mx-auto mb-3 text-slate-200" />
              <p className="text-sm font-medium text-slate-400">No requests in this category</p>
              <p className="text-xs text-slate-300 mt-1">Check back when new requests are submitted</p>
            </div>
          ) : items.map(r => (
            <div key={r.id}
              className={`flex items-center justify-between p-4 rounded-xl border ${borderCls} hover:shadow-sm transition-all`}>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${r.kind === 'crq' ? 'bg-sky-100' : 'bg-purple-100'}`}>
                  {r.kind === 'crq'
                    ? <BookOpen size={14} className="text-sky-600" />
                    : <ClipboardCheck size={14} className="text-purple-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-800 leading-snug truncate max-w-sm">{r.course_name}</p>
                    {r.fh_id === fhEmployeeId && (
                      <span className="text-[10px] bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-bold flex-shrink-0">By You</span>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${r.kind === 'crq' ? (r.requested_by_fh ? 'bg-amber-50 text-amber-600' : 'bg-orange-50 text-orange-600') : 'bg-purple-50 text-purple-600'}`}>
                      {r.kind === 'crq' ? (r.requested_by_fh ? 'FH Course Request' : 'RM Course Request') : 'Nomination'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px] text-slate-400">
                    <span className="font-mono">{r.id}</span>
                    {r.manager_name && <><span>·</span><span>{r.manager_name}</span></>}
                    {r.department && <><span>·</span><span>{r.department}</span></>}
                    {r.training_date && (
                      <><span>·</span>
                      <span className="text-blue-500 font-medium">
                        {new Date(r.training_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span></>
                    )}
                  </div>
                </div>
              </div>
              <div className="ml-3 flex-shrink-0">
                <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${statusChip(r.status)}`}>
                  {r.status}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center rounded-b-2xl bg-slate-50">
          <p className="text-xs text-slate-400">Showing all {items.length} result{items.length !== 1 ? 's' : ''}</p>
          <div className="flex gap-2">
            <button onClick={() => { onClose(); navigate('/workflow'); }}
              className="text-xs px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors font-medium">
              View in Status Tracker
            </button>
            <button onClick={onClose}
              className="text-xs px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Functional Head Dashboard ─────────────────────────────────────────────────
function FunctionalHeadDashboard({ data, logs, navigate }) {
  const [modal, setModal] = useState(null);

  const allRequests  = data.fh_all_requests || [];
  const managers     = data.fh_managers || [];

  // Helper: open a modal with filtered request list
  function open(title, subtitle, color, filter, manager = null) {
    setModal({ title, subtitle, color, items: allRequests.filter(filter), manager });
  }

  // ── KPI definitions (click → modal) ──────────────────────────────────────
  const KPI_CARDS = [
    {
      label: 'Pending My Approval', value: data.my_pending_fh_approval,
      icon: CheckSquare, bg: 'bg-amber-50', iconBg: 'bg-amber-500',
      sub: 'Course requests awaiting your decision',
      onClick: () => open('Pending My Approval', 'Course requests waiting for your approval or rejection', 'amber',
        r => r.status === 'Pending FH Approval'),
    },
    {
      label: 'Raised by Me', value: data.my_fh_raised ?? 0,
      icon: Send, bg: 'bg-sky-50', iconBg: 'bg-sky-500',
      sub: 'Requests you initiated for domains',
      onClick: () => open('Raised by Me', 'Requests you initiated directly as Functional Head', 'sky',
        r => r.fh_id === data.fh_employee_id),
    },
    {
      label: 'Total Domain Requests', value: data.my_nominations ?? 0,
      icon: Layers, bg: 'bg-blue-50', iconBg: 'bg-blue-600',
      sub: 'All nominations & course requests',
      onClick: () => open('All Domain Requests', 'Every nomination and course request across all your domains', 'blue',
        () => true),
    },
    {
      label: 'Awaiting Nomination', value: data.my_participants_requested ?? 0,
      icon: UserCheck, bg: 'bg-violet-50', iconBg: 'bg-violet-500',
      sub: 'Training confirmed — nominate participants',
      onClick: () => open('Awaiting Participant Nomination', 'Training approved and ready — managers need to nominate participants', 'violet',
        r => r.status === 'Participants Requested'),
    },
    {
      label: 'Enrolled', value: data.my_enrolled ?? 0,
      icon: Award, bg: 'bg-emerald-50', iconBg: 'bg-emerald-600',
      sub: 'Team members enrolled in training',
      onClick: () => open('Enrolled Requests', 'Requests that have been fully confirmed and enrolled', 'emerald',
        r => ['Finalized', 'Enrolled'].includes(r.status)),
    },
    {
      label: 'Rejected', value: data.my_rejected ?? 0,
      icon: XCircle, bg: 'bg-red-50', iconBg: 'bg-red-500',
      sub: 'Requests that were not approved',
      onClick: () => open('Rejected Requests', 'Requests that were declined at some stage', 'red',
        r => r.status === 'Rejected'),
    },
  ];

  // ── Pipeline stages ────────────────────────────────────────────────────────
  const PIPELINE = [
    { label: 'Pending FH Approval',    short: 'Pending Approval',  color: '#f59e0b', chip: 'bg-amber-100 text-amber-700',   modalColor: 'amber',   multi: false },
    { label: 'Pending L&D Validation', short: 'L&D Review',        color: '#3b82f6', chip: 'bg-blue-100 text-blue-700',     modalColor: 'blue',    multi: false },
    { label: 'Approved',               short: 'Approved by L&D',   color: '#10b981', chip: 'bg-emerald-100 text-emerald-700', modalColor: 'emerald', multi: false },
    { label: 'Participants Requested', short: 'Awaiting Nomination',color: '#8b5cf6', chip: 'bg-violet-100 text-violet-700', modalColor: 'violet',  multi: false },
    { label: 'Enrolled',               short: 'Enrolled',          color: '#14b8a6', chip: 'bg-teal-100 text-teal-700',    modalColor: 'teal',    multi: true  },
  ];
  const pipelineCounts = PIPELINE.map(s => ({
    ...s,
    count: s.multi
      ? allRequests.filter(r => ['Finalized', 'Enrolled'].includes(r.status)).length
      : allRequests.filter(r => r.status === s.label).length,
  }));
  const maxCount = Math.max(...pipelineCounts.map(s => s.count), 1);

  // ── Charts ─────────────────────────────────────────────────────────────────
  const pieData = Object.entries(data.fh_status_dist || {})
    .filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));

  const deptDist = allRequests.reduce((a, r) => {
    const d = r.department || '—'; a[d] = (a[d] || 0) + 1; return a;
  }, {});
  const deptData = Object.entries(deptDist).filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name: name.length > 13 ? name.slice(0, 13) + '…' : name, value }));

  return (
    <div className="space-y-10">

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 1 — FH ACTIVITIES & REQUEST STATUS
      ════════════════════════════════════════════════════════════════ */}
      <section>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-1 h-7 bg-blue-600 rounded-full flex-shrink-0" />
          <div>
            <h2 className="font-bold text-slate-800 text-base leading-tight">My Activities & Request Status</h2>
            <p className="text-xs text-slate-400 mt-0.5">Click any card or pipeline stage to view detailed request information</p>
          </div>
        </div>

        {/* KPI Cards — all clickable */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          {KPI_CARDS.map(c => (
            <div key={c.label}
              className={`card !p-4 ${c.bg} hover:shadow-md cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-blue-300 transition-all`}
              onClick={c.onClick}>
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 ${c.iconBg} rounded-xl flex items-center justify-center`}>
                  <c.icon size={20} className="text-white" />
                </div>
                <ArrowRight size={13} className="text-slate-300 mt-1" />
              </div>
              <p className="text-2xl font-bold text-slate-800">{c.value ?? '—'}</p>
              <p className="text-xs text-slate-700 mt-1 font-semibold leading-tight">{c.label}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{c.sub}</p>
            </div>
          ))}
        </div>

        {/* Request Pipeline + Status Pie + Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Request Pipeline — each row clickable */}
          <div className="card">
            <h3 className="font-bold text-slate-800 mb-1 text-sm flex items-center gap-2">
              <GitMerge size={15} className="text-blue-600" /> Request Pipeline
            </h3>
            <p className="text-[11px] text-slate-400 mb-4">Click a stage to see matching requests</p>
            <div className="space-y-3">
              {pipelineCounts.map((s, i) => {
                const filterFn = s.multi
                  ? r => ['Finalized', 'Enrolled'].includes(r.status)
                  : r => r.status === s.label;
                return (
                  <div key={i}
                    className="flex items-center gap-2 cursor-pointer group rounded-lg p-1 -mx-1 hover:bg-slate-50 transition-colors"
                    onClick={() => open(s.short, `Requests currently at the "${s.short}" stage`, s.modalColor, filterFn)}>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap w-36 text-center flex-shrink-0 ${s.chip}`}>
                      {s.short}
                    </span>
                    <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                      <div className="h-full rounded-full flex items-center justify-end pr-2 transition-all duration-700"
                        style={{
                          width: `${s.count > 0 ? Math.max(18, (s.count / maxCount) * 100) : 0}%`,
                          backgroundColor: s.color,
                        }}>
                        {s.count > 0 && <span className="text-[10px] font-bold text-white">{s.count}</span>}
                      </div>
                    </div>
                    {s.count === 0 && <span className="text-[11px] text-slate-300 w-4">0</span>}
                    <ArrowRight size={11} className="text-slate-300 group-hover:text-slate-500 flex-shrink-0 transition-colors" />
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
              <span className="text-[11px] text-slate-400">Total across all stages</span>
              <span className="text-sm font-bold text-slate-700">{allRequests.length}</span>
            </div>
          </div>

          {/* Status Breakdown Donut */}
          <div className="card">
            <h3 className="font-bold text-slate-800 mb-1 text-sm flex items-center gap-2">
              <TrendingUp size={15} className="text-blue-600" /> Status Breakdown
            </h3>
            <p className="text-[11px] text-slate-400 mb-2">Distribution of all domain requests</p>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="48%" innerRadius={50} outerRadius={78} dataKey="value" paddingAngle={3}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 9 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-xs text-slate-400 text-center py-12">No requests yet</p>}
          </div>

          {/* Recent Activity */}
          <ActivityFeed logs={logs} />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 2 — DOMAIN & MANAGER OVERVIEW
      ════════════════════════════════════════════════════════════════ */}
      <section>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-1 h-7 bg-indigo-600 rounded-full flex-shrink-0" />
          <div>
            <h2 className="font-bold text-slate-800 text-base leading-tight">Domain & Manager Overview</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {managers.length} reporting manager{managers.length !== 1 ? 's' : ''} across your domains · Click a manager card for full details
            </p>
          </div>
        </div>

        {managers.length === 0 ? (
          <div className="card text-center py-10">
            <Users size={32} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm text-slate-400">No reporting managers found under your profile</p>
          </div>
        ) : (
          <>
            {/* Manager Domain Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {managers.map(m => {
                const healthPct = m.total > 0 ? Math.round((m.enrolled / m.total) * 100) : 0;
                return (
                  <div key={m.manager_id}
                    onClick={() => open(
                      m.manager_name,
                      `${m.department} — All training requests managed by ${m.manager_name}`,
                      'indigo',
                      r => r.manager_id === m.manager_id,
                      m
                    )}
                    className="card cursor-pointer transition-all hover:shadow-lg hover:ring-2 hover:ring-indigo-300 !p-5 group">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-9 h-9 bg-indigo-100 group-hover:bg-indigo-200 rounded-xl flex items-center justify-center transition-colors">
                        <Users size={15} className="text-indigo-600" />
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {m.pending > 0 && (
                          <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold animate-pulse">
                            {m.pending} pending
                          </span>
                        )}
                        <ArrowRight size={12} className="text-slate-300 group-hover:text-indigo-400 transition-colors" />
                      </div>
                    </div>

                    <p className="text-sm font-bold text-slate-800 leading-tight truncate">{m.manager_name}</p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{m.department}</p>

                    {/* Enrollment progress */}
                    <div className="mt-3 mb-3">
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-slate-400">Enrollment rate</span>
                        <span className={`font-bold ${healthPct >= 70 ? 'text-emerald-600' : healthPct >= 40 ? 'text-amber-600' : 'text-slate-500'}`}>
                          {healthPct}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div className={`h-2 rounded-full transition-all duration-700 ${healthPct >= 70 ? 'bg-emerald-400' : healthPct >= 40 ? 'bg-amber-400' : 'bg-slate-300'}`}
                          style={{ width: `${healthPct}%` }} />
                      </div>
                    </div>

                    {/* Mini stats */}
                    <div className="grid grid-cols-4 gap-1 text-[10px] text-center">
                      <div className="bg-slate-50 rounded-lg py-1.5">
                        <p className="font-bold text-slate-700 text-xs">{m.total}</p>
                        <p className="text-slate-400">Total</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg py-1.5">
                        <p className="font-bold text-blue-600 text-xs">{m.in_progress}</p>
                        <p className="text-blue-400">Active</p>
                      </div>
                      <div className="bg-emerald-50 rounded-lg py-1.5">
                        <p className="font-bold text-emerald-600 text-xs">{m.enrolled}</p>
                        <p className="text-emerald-400">Done</p>
                      </div>
                      <div className="bg-red-50 rounded-lg py-1.5">
                        <p className="font-bold text-red-500 text-xs">{m.rejected}</p>
                        <p className="text-red-400">Rej.</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Department bar chart */}
            {deptData.length > 0 && (
              <div className="card">
                <h3 className="font-bold text-slate-800 mb-1 text-sm flex items-center gap-2">
                  <Building2 size={15} className="text-indigo-600" /> Requests by Department
                </h3>
                <p className="text-[11px] text-slate-400 mb-4">Total training requests per department</p>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={deptData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 3 — UPCOMING TRAININGS
      ════════════════════════════════════════════════════════════════ */}
      <section>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-1 h-7 bg-teal-600 rounded-full flex-shrink-0" />
          <div>
            <h2 className="font-bold text-slate-800 text-base leading-tight">Upcoming Trainings</h2>
            <p className="text-xs text-slate-400 mt-0.5">Next scheduled trainings from the catalog — sorted by date</p>
          </div>
        </div>
        {data.upcoming_trainings?.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.upcoming_trainings.map(t => (
              <div key={t.training_id} className="card !p-5 hover:shadow-md transition-shadow border-l-4 border-teal-400">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 bg-teal-100 rounded-xl flex items-center justify-center">
                    <CalendarDays size={15} className="text-teal-600" />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                      {t.seats_available} seats
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      t.mode === 'Online' ? 'bg-green-100 text-green-700' :
                      t.mode === 'Offline' ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700'
                    }`}>{t.mode}</span>
                  </div>
                </div>
                <p className="text-sm font-bold text-slate-800 leading-snug">{t.course_name}</p>
                <p className="text-xs text-slate-500 mt-1">{t.trainer_name}</p>
                {t.training_date && (
                  <p className="text-xs text-teal-600 font-semibold mt-2">
                    {new Date(t.training_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="card text-center py-10">
            <CalendarDays size={32} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm text-slate-400">No upcoming trainings scheduled</p>
            <p className="text-xs text-slate-300 mt-1">Trainings with future dates will appear here</p>
          </div>
        )}
      </section>

      {/* ── Detail Pop-up Modal ── */}
      <FHDetailModal modal={modal} fhEmployeeId={data.fh_employee_id} onClose={() => setModal(null)} navigate={navigate} />
    </div>
  );
}

// ── Employee Dashboard ────────────────────────────────────────────────────────
function EmployeeDashboard({ data, logs, navigate }) {
  const stats = [
    { label: 'My Requests', value: data.my_total, icon: FileText, bg: 'bg-blue-50', iconBg: 'bg-blue-600', sub: 'Total submitted', onClick: () => navigate('/my-requests') },
    { label: 'Pending Review', value: data.my_pending, icon: Clock, bg: 'bg-amber-50', iconBg: 'bg-amber-500', sub: 'Awaiting action', onClick: () => navigate('/my-requests') },
    { label: 'Approved', value: data.my_approved, icon: CheckCircle, bg: 'bg-emerald-50', iconBg: 'bg-emerald-600', sub: 'Approved trainings', onClick: () => navigate('/my-requests') },
    { label: 'Enrolled', value: data.my_enrolled, icon: Award, bg: 'bg-violet-50', iconBg: 'bg-violet-500', sub: 'Currently enrolled', onClick: () => navigate('/my-requests') },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => <StatCard key={s.label} {...s} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <h3 className="font-bold text-slate-800 mb-4 text-sm">My Training Requests</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {(data.my_requests || []).length === 0 && (
              <div className="text-center py-10">
                <BookOpen size={32} className="mx-auto mb-2 text-slate-300" />
                <p className="text-xs text-slate-400">No requests yet. Visit Training Catalog to register.</p>
              </div>
            )}
            {(data.my_requests || []).map(r => (
              <div key={r.request_id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">{r.course_name}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{r.request_id} · {r.submitted_date?.slice(0, 10)}</p>
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        </div>
        <ActivityFeed logs={logs} />
      </div>
      <UpcomingTrainings trainings={data.upcoming_trainings} />
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const isLD = user?.role === 'ld_team';
  const isManager = user?.role === 'reporting_manager';
  const isFH = user?.role === 'functional_head';
  const isEmployee = user?.role === 'employee';

  const roleGreeting = {
    ld_team: 'L&D Operations Overview',
    functional_head: 'Functional Head Overview',
    reporting_manager: 'My Team Overview',
    employee: 'My Learning Dashboard',
  };

  const load = async () => {
    try {
      const [dashRes, logsRes] = await Promise.all([
        axios.get('/api/dashboard'),
        axios.get('/api/audit-logs'),
      ]);
      const global = dashRes.data;
      const allLogs = logsRes.data;

      if (isEmployee) {
        const regsRes = await axios.get('/api/registrations');
        const myRegs = regsRes.data.filter(r =>
          r.employee_id === user.employee_id || r.employee_name === user.name
        );
        const statusDist = myRegs.reduce((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, {});
        setData({
          ...global,
          my_total: myRegs.length,
          my_pending: myRegs.filter(r => ['Pending L&D Validation', 'Pending Manager Approval'].includes(r.status)).length,
          my_approved: myRegs.filter(r => ['Approved', 'Curriculum Shared', 'Curriculum Approved', 'Participants Requested'].includes(r.status)).length,
          my_enrolled: myRegs.filter(r => ['Finalized', 'Enrolled'].includes(r.status)).length,
          my_status_dist: statusDist,
          my_requests: myRegs.slice(0, 10),
        });

      } else if (isManager) {
        // Reporting Manager — comprehensive data load
        const [regsRes, nomsRes, crqRes, empsRes] = await Promise.all([
          axios.get('/api/registrations'),
          axios.get('/api/nominations'),
          axios.get('/api/course-requests'),
          axios.get('/api/employees'),
        ]);

        const myRegs = regsRes.data.filter(r =>
          r.manager_id ? r.manager_id === user.employee_id : r.reporting_manager === user.name
        );
        const myNoms = nomsRes.data.filter(n => n.manager_id === user.employee_id);
        const myCrqs = crqRes.data.filter(c => c.manager_id === user.employee_id);
        const allMyItems = [...myRegs, ...myNoms, ...myCrqs];

        // Pending actions breakdown
        const rmPendingApproval   = myRegs.filter(r => r.status === 'Pending Manager Approval').length;
        const rmCurriculumReview  = [...myRegs, ...myCrqs, ...myNoms].filter(x => x.status === 'Curriculum Shared').length;
        const rmParticipantsNeed  = [...myNoms, ...myRegs, ...myCrqs].filter(x => x.status === 'Participants Requested').length;
        const pendingActions = rmPendingApproval + rmCurriculumReview + rmParticipantsNeed;

        const allStatuses = allMyItems.reduce((a, x) => { a[x.status] = (a[x.status] || 0) + 1; return a; }, {});

        // Unified request list for the "All Requests" table (sorted newest first)
        const rmAllRequests = [
          ...myRegs.map(r => ({ id: r.request_id,  course_name: r.course_name, type: 'Registration',   status: r.status, submitted_date: r.submitted_date })),
          ...myNoms.map(n => ({ id: n.nomination_id, course_name: n.course_name, type: 'Nomination',   status: n.status, submitted_date: n.submitted_date })),
          ...myCrqs.map(c => ({ id: c.request_id,  course_name: c.course_name, type: c.requested_by_fh ? 'FH Course Request' : 'RM Course Request', status: c.status, submitted_date: c.submitted_date })),
        ].sort((a, b) => new Date(b.submitted_date) - new Date(a.submitted_date));

        // Team member stats (employees reporting to this manager)
        const teamEmployees = empsRes.data.filter(e => e.manager_id === user.employee_id);
        const enrolledIds = new Set(
          [...myNoms, ...myCrqs, ...myRegs]
            .filter(x => ['Enrolled', 'Finalized'].includes(x.status))
            .flatMap(x => {
              // For regs, employee_id is on the item; for noms/crqs use participant data if available
              return x.employee_id ? [x.employee_id] : [];
            })
        );
        const pendingIds = new Set(
          [...myNoms, ...myCrqs, ...myRegs]
            .filter(x => ['Pending Manager Approval', 'Curriculum Shared', 'Participants Requested', 'Pending L&D Validation', 'Pending FH Approval', 'Approved'].includes(x.status))
            .map(x => x.employee_id).filter(Boolean)
        );
        const rejectedIds = new Set(
          [...myNoms, ...myCrqs, ...myRegs]
            .filter(x => x.status === 'Rejected')
            .map(x => x.employee_id).filter(Boolean)
        );
        const rmTeamMembers = teamEmployees.map(e => ({
          employee_id: e.employee_id,
          name:        e.name,
          total:       allMyItems.filter(x => x.employee_id === e.employee_id).length,
          enrolled:    enrolledIds.has(e.employee_id) ? 1 : 0,
          pending:     pendingIds.has(e.employee_id)  ? 1 : 0,
          rejected:    rejectedIds.has(e.employee_id) ? 1 : 0,
        }));

        // Top requested courses
        const courseCount = {};
        allMyItems.forEach(x => { if (x.course_name) courseCount[x.course_name] = (courseCount[x.course_name] || 0) + 1; });
        const rmTopCourses = Object.entries(courseCount).sort((a, b) => b[1] - a[1]).slice(0, 6);

        setData({
          ...global,
          my_nominations:            allMyItems.length,
          my_pending_actions:        pendingActions,
          rm_pending_approval:       rmPendingApproval,
          rm_curriculum_review:      rmCurriculumReview,
          my_in_review:              allMyItems.filter(x =>
            ['Pending L&D Validation', 'Approved', 'Curriculum Approved', 'Pending FH Approval'].includes(x.status)
          ).length,
          my_participants_requested: rmParticipantsNeed,
          my_enrolled:               allMyItems.filter(x => ['Finalized', 'Enrolled'].includes(x.status)).length,
          my_rejected:               allMyItems.filter(x => x.status === 'Rejected').length,
          my_status_dist:            allStatuses,
          rm_all_requests:           rmAllRequests,
          rm_team_members:           rmTeamMembers,
          rm_top_courses:            rmTopCourses,
        });

      } else if (isFH) {
        const [nomsRes, crqRes, empsRes] = await Promise.all([
          axios.get('/api/nominations'),
          axios.get('/api/course-requests'),
          axios.get('/api/employees'),
        ]);

        // Managers reporting directly to this FH
        const myManagers = empsRes.data.filter(e => e.manager_id === user.employee_id);
        const myManagerIds = new Set(myManagers.map(e => e.employee_id));

        // All requests from team + ones FH raised directly
        const teamNoms = nomsRes.data.filter(n =>
          myManagerIds.has(n.manager_id) || n.fh_id === user.employee_id
        );
        const teamCrqs = crqRes.data.filter(c =>
          myManagerIds.has(c.manager_id) || c.fh_id === user.employee_id
        );
        const allTeamItems = [
          ...teamNoms.map(n => ({ ...n, id: n.nomination_id, kind: 'nom' })),
          ...teamCrqs.map(c => ({ ...c, id: c.request_id, kind: 'crq' })),
        ];

        // Pending FH approval
        const pendingFHApproval = teamCrqs.filter(c =>
          c.status === 'Pending FH Approval' &&
          (c.assigned_to_id === user.employee_id || c.assigned_to_name === user.name)
        ).length;

        // Per-manager breakdown for domain health cards
        const managerMap = {};
        myManagers.forEach(m => {
          managerMap[m.employee_id] = {
            manager_id: m.employee_id,
            manager_name: m.name,
            department: m.department || m.business_unit || '—',
            total: 0, pending: 0, enrolled: 0, rejected: 0, in_progress: 0,
          };
        });
        allTeamItems.forEach(item => {
          const mgr = managerMap[item.manager_id];
          if (!mgr) return;
          mgr.total++;
          if (['Pending FH Approval', 'Pending L&D Validation', 'Participants Requested'].includes(item.status)) mgr.pending++;
          if (['Finalized', 'Enrolled'].includes(item.status)) mgr.enrolled++;
          if (item.status === 'Rejected') mgr.rejected++;
          if (['Approved', 'Curriculum Shared', 'Curriculum Approved'].includes(item.status)) mgr.in_progress++;
        });

        const statusDist = allTeamItems.reduce((a, x) => {
          a[x.status] = (a[x.status] || 0) + 1; return a;
        }, {});

        const courseRegDist = allTeamItems.reduce((a, x) => {
          if (x.course_name) a[x.course_name] = (a[x.course_name] || 0) + 1;
          return a;
        }, {});

        setData({
          ...global,
          my_pending_fh_approval: pendingFHApproval,
          my_fh_approved: teamCrqs.filter(c => !['Pending FH Approval', 'Rejected'].includes(c.status)).length,
          my_fh_raised: allTeamItems.filter(x => x.fh_id === user.employee_id).length,
          my_nominations: allTeamItems.length,
          my_participants_requested: allTeamItems.filter(x => x.status === 'Participants Requested').length,
          my_enrolled: allTeamItems.filter(x => ['Finalized', 'Enrolled'].includes(x.status)).length,
          my_rejected: allTeamItems.filter(x => x.status === 'Rejected').length,
          total_requests: allTeamItems.length,
          course_registrations: courseRegDist,
          fh_managers: Object.values(managerMap),
          fh_all_requests: allTeamItems.sort((a, b) => new Date(b.submitted_date) - new Date(a.submitted_date)),
          fh_status_dist: statusDist,
          fh_employee_id: user.employee_id,
        });

      } else {
        // L&D team — comprehensive data load
        const [nomsRes, crqRes, regsRes] = await Promise.all([
          axios.get('/api/nominations'),
          axios.get('/api/course-requests'),
          axios.get('/api/registrations'),
        ]);
        const noms = nomsRes.data;
        const crqs = crqRes.data;
        const regs = regsRes.data;
        const allItems = [...regs, ...noms, ...crqs];

        // Status distribution across all request types
        const statusDist = allItems.reduce((a, x) => { a[x.status] = (a[x.status] || 0) + 1; return a; }, {});

        // Department breakdown (registrations + nominations)
        const deptDist = [...noms, ...regs].reduce((a, x) => {
          const dept = x.department || x.business_unit || 'Unknown';
          a[dept] = (a[dept] || 0) + 1; return a;
        }, {});

        // Pending queue — items needing L&D action, oldest first
        const PENDING_LD_STATUSES = ['Pending L&D Validation', 'Pending L&D Manager Review'];
        const pendingQueue = [
          ...regs.filter(r => PENDING_LD_STATUSES.includes(r.status)).map(r => ({
            id: r.request_id, course_name: r.course_name, name: r.employee_name,
            status: r.status, submitted_date: r.submitted_date,
          })),
          ...noms.filter(n => PENDING_LD_STATUSES.includes(n.status)).map(n => ({
            id: n.nomination_id, course_name: n.course_name, name: n.employee_name,
            status: n.status, submitted_date: n.submitted_date,
          })),
          ...crqs.filter(c => PENDING_LD_STATUSES.includes(c.status)).map(c => ({
            id: c.request_id, course_name: c.course_name, name: c.manager_name,
            status: c.status, submitted_date: c.submitted_date,
          })),
        ].sort((a, b) => new Date(a.submitted_date) - new Date(b.submitted_date));

        // Top requested courses across all types
        const courseCount = {};
        allItems.forEach(x => { if (x.course_name) courseCount[x.course_name] = (courseCount[x.course_name] || 0) + 1; });
        const topCourses = Object.entries(courseCount).sort((a, b) => b[1] - a[1]).slice(0, 10);

        setData({
          ...global,
          pending_ld_validation: allItems.filter(x => x.status === 'Pending L&D Validation').length,
          pending_fh_approval:   crqs.filter(c => c.status === 'Pending FH Approval').length,
          pending_curriculum_upload: [...crqs, ...noms, ...regs].filter(x => ['Approved', 'Curriculum Rejected'].includes(x.status)).length,
          participants_requested: allItems.filter(x => x.status === 'Participants Requested').length,
          enrolled: allItems.filter(x => ['Finalized', 'Enrolled'].includes(x.status)).length,
          total_requests: allItems.length,
          ld_self_reg_count: regs.length,
          ld_nom_count:      noms.length,
          ld_crq_count:      crqs.length,
          status_distribution: statusDist,
          department_nominations: deptDist,
          pending_queue: pendingQueue,
          top_courses: topCourses,
          ld_fh_items: crqs.filter(c => c.status === 'Pending FH Approval').map(c => ({
            id: c.request_id, course_name: c.course_name, name: c.manager_name,
            department: c.department, status: c.status, submitted_date: c.submitted_date,
          })),
          ld_curriculum_items: [...crqs, ...noms, ...regs]
            .filter(x => ['Approved', 'Curriculum Rejected'].includes(x.status))
            .map(x => ({
              id: x.request_id || x.nomination_id, course_name: x.course_name,
              name: x.manager_name || x.employee_name, department: x.department,
              status: x.status, submitted_date: x.submitted_date,
            })),
          ld_participants_items: allItems.filter(x => x.status === 'Participants Requested').map(x => ({
            id: x.request_id || x.nomination_id, course_name: x.course_name,
            name: x.manager_name || x.employee_name, department: x.department,
            status: x.status, submitted_date: x.submitted_date,
          })),
          ld_enrolled_items: allItems.filter(x => ['Enrolled', 'Finalized'].includes(x.status)).slice(0, 15).map(x => ({
            id: x.request_id || x.nomination_id, course_name: x.course_name,
            name: x.manager_name || x.employee_name,
            status: x.status, submitted_date: x.submitted_date,
          })),
        });
      }

      setLogs(
        isEmployee
          ? allLogs.filter(l => l.performed_by === user.name).slice(0, 10)
          : isManager
          ? allLogs.filter(l => l.performed_by === user.name || l.entity_id?.startsWith('NOM') || l.entity_id?.startsWith('CRQ')).slice(0, 10)
          : isFH
          ? allLogs.filter(l =>
              l.performed_by === user.name ||
              l.entity_id?.startsWith('CRQ') ||
              l.entity_id?.startsWith('NOM') ||
              l.action?.includes('FH') ||
              l.action?.includes('Course') ||
              l.action?.includes('Nomination')
            ).slice(0, 15)
          : allLogs.slice(0, 10)
      );
      setLoading(false);
    } catch {
      setError('Unable to reach the backend. Make sure the server is running on port 8000.');
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <SkeletonDashboard />;

  if (error) return (
    <div className="flex items-center justify-center h-64 flex-col gap-3">
      <p className="text-red-600 font-semibold text-sm">{error}</p>
      <button onClick={() => { setLoading(true); setError(null); load(); }} className="btn-primary text-xs">
        Retry
      </button>
    </div>
  );

  async function downloadFHSummary() {
    setPdfLoading(true);
    try {
      const res = await axios.get('/api/fh-summary-pdf', {
        params: { employee_id: user.employee_id },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `FH_Dashboard_Summary_${user.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">
            Welcome back, <span className="font-semibold text-slate-700">{user.name}</span>{' '}
            <span className="text-slate-400">— {roleGreeting[user.role] || 'Overview'}</span>
          </p>
        </div>
        {isFH && (
          <button
            onClick={downloadFHSummary}
            disabled={pdfLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold rounded-xl shadow-sm transition-all flex-shrink-0">
            {pdfLoading
              ? <><RefreshCw size={14} className="animate-spin" /> Generating…</>
              : <><Download size={14} /> Download Summary</>}
          </button>
        )}
      </div>

      {isLD       && <LDDashboard data={data} logs={logs} navigate={navigate} />}
      {isFH       && <FunctionalHeadDashboard data={data} logs={logs} navigate={navigate} />}
      {isManager  && <ReportingManagerDashboard data={data} logs={logs} navigate={navigate} />}
      {isEmployee && <EmployeeDashboard data={data} logs={logs} navigate={navigate} />}
    </div>
  );
}
