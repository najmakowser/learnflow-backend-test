import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, Activity, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/catalog': 'Training Catalog',
  '/register': 'Self Registration',
  '/nominate': 'Nominate for Training',
  '/rm-course-request': 'New Course Request',
  '/ld-validation': 'L&D Validation',
  '/manager-approval': 'Approval Queue',
  '/participants': 'Finalized Participants',
  '/enrollment': 'Enrollment',
  '/workflow': 'Status',
  '/audit': 'Audit Logs',
  '/my-requests': 'My Status',
};

const ACTION_COLOR = {
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
  'Curriculum Rejected': 'bg-orange-500',
  'Participants Confirmed': 'bg-purple-500',
  'Course Added': 'bg-sky-500',
  'Course Updated': 'bg-sky-400',
  'New Course Request Raised': 'bg-sky-500',
  'Course Request Approved by FH': 'bg-indigo-500',
  'Course Request Sent for Participant Nomination': 'bg-violet-500',
  'Course Request Acknowledged': 'bg-amber-500',
};

// Which audit actions are relevant per role
const ROLE_ACTIONS = {
  ld_team: Object.keys(ACTION_COLOR),
  reporting_manager: [
    'Manager Nomination Submitted',
    'L&D Validation Completed', 'L&D Nomination Validated',
    'Manager Approval Granted', 'Manager Approved Nomination',
    'Request Rejected', 'Nomination Rejected',
    'Curriculum Uploaded', 'Curriculum Approved', 'Curriculum Rejected',
    'Participants Confirmed', 'Enrollment Finalized',
    'New Course Request Raised', 'Course Request Approved by FH', 'Course Request Sent for Participant Nomination',
  ],
  functional_head: [
    'Manager Nomination Submitted',
    'L&D Validation Completed', 'L&D Nomination Validated',
    'Manager Approval Granted', 'Manager Approved Nomination',
    'Request Rejected', 'Nomination Rejected',
    'Curriculum Uploaded', 'Curriculum Approved', 'Curriculum Rejected',
    'Participants Confirmed', 'Enrollment Finalized',
    'New Course Request Raised', 'Course Request Approved by FH', 'Course Request Sent for Participant Nomination',
  ],
  employee: [
    'Self Registration Submitted',
    'L&D Validation Completed',
    'Manager Approval Granted',
    'Request Rejected',
    'Curriculum Uploaded', 'Curriculum Approved', 'Curriculum Rejected',
    'Enrollment Finalized',
  ],
};

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function Header() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [pendingActions, setPendingActions] = useState([]);
  const [showDrop, setShowDrop] = useState(false);
  const [lastSeen, setLastSeen] = useState(() => {
    const stored = sessionStorage.getItem(`notif_seen_${user?.employee_id}`);
    if (stored) return stored;
    // Default: show activity from last 24 hours as "unread" on fresh login
    return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  });
  const [seenActionIds, setSeenActionIds] = useState(() => new Set());
  const dropRef = useRef();

  const pageTitle = PAGE_TITLES[location.pathname] || '';

  const fetchAll = async () => {
    if (!user) return;
    const actions = [];
    let entityIds = null;

    try {
      if (user.role === 'ld_team') {
        const [regs, noms, courseReqs] = await Promise.all([
          axios.get('/api/registrations').catch(() => ({ data: [] })),
          axios.get('/api/nominations').catch(() => ({ data: [] })),
          axios.get('/api/course-requests').catch(() => ({ data: [] })),
        ]);

        const pendingValidation = [
          ...regs.data.filter(r => r.status === 'Pending L&D Validation'),
          ...noms.data.filter(n => n.status === 'Pending L&D Validation'),
          ...courseReqs.data.filter(c => c.status === 'Pending L&D Validation'),
        ].length;

        // Only regs and course requests need curriculum upload — nominations skip this step
        const pendingUploads = [
          ...regs.data.filter(r => r.status === 'Approved'),
          ...courseReqs.data.filter(c => c.status === 'Approved'),
        ].length;

        if (pendingValidation > 0) actions.push({
          id: 'ld-validate',
          label: `${pendingValidation} request${pendingValidation > 1 ? 's' : ''} awaiting your validation`,
          sub: 'Registrations & nominations pending L&D review',
          path: '/ld-validation',
          urgent: true,
        });

        if (pendingUploads > 0) actions.push({
          id: 'ld-upload',
          label: `${pendingUploads} curriculum${pendingUploads > 1 ? 's' : ''} to upload`,
          sub: 'Approved requests awaiting curriculum',
          path: '/manager-approval',
          tab: 'curriculum',
          urgent: pendingUploads > 0,
        });

        // Check for participants with pending enrollment emails
        const participantsRes = await axios.get('/api/participants').catch(() => ({ data: [] }));
        const pendingEmails = participantsRes.data.filter(p => !p.confirmation_sent).length;
        if (pendingEmails > 0) actions.push({
          id: 'ld-emails',
          label: `${pendingEmails} enrollment email${pendingEmails > 1 ? 's' : ''} pending`,
          sub: 'Participants nominated — send enrollment confirmations',
          path: '/enrollment',
          urgent: true,
        });

        // L&D sees activity on ALL items (show all entity IDs)
        entityIds = new Set([
          ...regs.data.map(r => r.request_id),
          ...noms.data.map(n => n.nomination_id),
          ...courseReqs.data.map(c => c.request_id),
        ]);

      } else if (user.role === 'reporting_manager') {
        const [regs, noms, courseReqs] = await Promise.all([
          axios.get('/api/registrations').catch(() => ({ data: [] })),
          axios.get('/api/nominations').catch(() => ({ data: [] })),
          axios.get('/api/course-requests').catch(() => ({ data: [] })),
        ]);

        const myRegs = regs.data.filter(r =>
          r.manager_id ? r.manager_id === user.employee_id : r.reporting_manager === user.name
        );
        const myNoms = noms.data.filter(n => n.manager_id === user.employee_id);
        const myCourseReqs = courseReqs.data.filter(c => c.manager_id === user.employee_id);

        entityIds = new Set([
          ...myRegs.map(r => r.request_id),
          ...myNoms.map(n => n.nomination_id),
          ...myCourseReqs.map(c => c.request_id),
        ]);

        const pendingApproval = [
          ...myRegs.filter(r => r.status === 'Pending Manager Approval'),
          ...myNoms.filter(n => n.status === 'Pending Manager Approval'),
          ...myCourseReqs.filter(c => c.status === 'Pending FH Approval'),
        ].length;

        const pendingReview = [
          ...myRegs.filter(r => r.status === 'Curriculum Shared'),
          ...myNoms.filter(n => n.status === 'Curriculum Shared'),
        ].length;

        const pendingParticipants = [
          ...myRegs.filter(r => r.status === 'Curriculum Approved'),
          ...myNoms.filter(n => n.status === 'Curriculum Approved'),
          ...myCourseReqs.filter(c => c.status === 'Under Review'),
        ].length;

        if (pendingApproval > 0) actions.push({
          id: 'fh-approve',
          label: `${pendingApproval} request${pendingApproval > 1 ? 's' : ''} awaiting your approval`,
          sub: 'Training requests from your team',
          path: '/manager-approval',
          tab: 'pending',
          urgent: true,
        });

        if (pendingReview > 0) actions.push({
          id: 'fh-review',
          label: `${pendingReview} curriculum${pendingReview > 1 ? 's' : ''} ready for review`,
          sub: 'L&D has shared curriculum — your approval needed',
          path: '/manager-approval',
          tab: 'review',
          urgent: true,
        });

        if (pendingParticipants > 0) actions.push({
          id: 'fh-participants',
          label: `${pendingParticipants} training${pendingParticipants > 1 ? 's' : ''} ready for nomination`,
          sub: 'Curriculum approved — nominate participants',
          path: '/manager-approval',
          tab: 'participants',
          urgent: false,
        });
      } else if (user.role === 'employee') {
        const regs = await axios.get('/api/registrations').catch(() => ({ data: [] }));
        const myRegs = regs.data.filter(r => r.employee_id === user.employee_id);
        entityIds = new Set(myRegs.map(r => r.request_id));
      }
    } catch (_) {}

    try {
      const logsRes = await axios.get('/api/audit-logs');
      const allowedActions = ROLE_ACTIONS[user.role] || [];
      const relevant = logsRes.data.filter(n => {
        if (!allowedActions.includes(n.action)) return false;
        // Always show actions performed BY the logged-in user
        if (n.performed_by === user.name) return true;
        // For other roles show actions on their own entity IDs
        if (entityIds === null) return false;
        return entityIds.has(n.entity_id);
      }).slice(0, 10);
      setLogs(relevant);
    } catch (_) {}

    setPendingActions(actions);
  };

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 8000);

    const onVisible = () => { if (document.visibilityState === 'visible') fetchAll(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user]);

  const unreadLogs = logs.filter(n => (n.timestamp || '') > lastSeen).length;
  const unseenActions = pendingActions.filter(a => !seenActionIds.has(a.id)).length;
  const badgeCount = unreadLogs + unseenActions;

  const markRead = () => {
    const now = new Date().toISOString();
    setLastSeen(now);
    sessionStorage.setItem(`notif_seen_${user?.employee_id}`, now);
    // Mark all currently visible pending actions as seen
    setSeenActionIds(new Set(pendingActions.map(a => a.id)));
  };

  const handleAction = (path, tab) => {
    setShowDrop(false);
    navigate(path, tab ? { state: { tab } } : undefined);
  };

  useEffect(() => {
    const handler = e => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setShowDrop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!user) return null;

  return (
    <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0 z-30">
      <div className="flex items-center gap-2">
        <span className="text-slate-400 text-sm">/</span>
        <span className="text-sm font-semibold text-slate-700">{pageTitle}</span>
      </div>

      <div className="flex items-center gap-2">
        {/* Notification Bell */}
        <div className="relative" ref={dropRef}>
          <button
            onClick={() => { setShowDrop(v => !v); if (!showDrop) markRead(); }}
            className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
          >
            <Bell size={17} className="text-slate-500" />
            {badgeCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 rounded-full ring-2 ring-white flex items-center justify-center">
                <span className="text-[9px] font-bold text-white px-0.5">{badgeCount > 9 ? '9+' : badgeCount}</span>
              </span>
            )}
          </button>

          {showDrop && (
            <div className="absolute right-0 top-11 w-88 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden" style={{ width: 340 }}>
              {/* Header */}
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell size={14} className="text-slate-600" />
                  <span className="font-bold text-slate-800 text-sm">Notifications</span>
                  {badgeCount > 0 && (
                    <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                      {badgeCount} new
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400">Live · every 8s</span>
              </div>

              <div className="max-h-[440px] overflow-y-auto">

                {/* Pending Actions — role-specific */}
                {pendingActions.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 pt-3 pb-1">
                      Action Required
                    </p>
                    {pendingActions.map(action => (
                      <button
                        key={action.id}
                        onClick={() => handleAction(action.path, action.tab)}
                        className="w-full flex items-start gap-3 px-4 py-3 hover:bg-orange-50 border-b border-slate-50 text-left transition-colors group"
                      >
                        <div className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${action.urgent ? 'bg-orange-100' : 'bg-blue-100'}`}>
                          <AlertCircle size={13} className={action.urgent ? 'text-orange-500' : 'text-blue-500'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold leading-tight ${action.urgent ? 'text-orange-700' : 'text-blue-700'}`}>
                            {action.label}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">{action.sub}</p>
                        </div>
                        <ArrowRight size={13} className="text-slate-300 group-hover:text-slate-500 mt-1 flex-shrink-0 transition-colors" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Recent Activity */}
                {logs.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 pt-3 pb-1">
                      Recent Activity
                    </p>
                    {logs.map(n => {
                      const isNew = (n.timestamp || '') > lastSeen;
                      return (
                        <div key={n.log_id}
                          className={`flex gap-3 px-4 py-2.5 border-b border-slate-50 last:border-0 ${isNew ? 'bg-blue-50/40' : 'hover:bg-slate-50'}`}>
                          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${ACTION_COLOR[n.action] || 'bg-slate-400'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-800 leading-tight">{n.action}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                              {n.performed_by} · <span className="font-mono">{n.entity_id}</span>
                            </p>
                            {n.remarks && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{n.remarks}</p>}
                          </div>
                          <span className="text-[10px] text-slate-400 whitespace-nowrap mt-0.5">{timeAgo(n.timestamp)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {pendingActions.length === 0 && logs.length === 0 && (
                  <div className="py-12 text-center text-slate-400">
                    <CheckCircle2 size={28} className="mx-auto mb-2 opacity-30" />
                    <p className="text-xs font-medium">All caught up!</p>
                    <p className="text-[11px] mt-0.5">No pending actions</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
