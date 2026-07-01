import { useEffect, useState, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
  LayoutDashboard, BookOpen, Users,
  CheckSquare, Award, GitBranch, ChevronRight, LogOut,
  UserCheck, User, ShieldCheck, Bell
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ALL_NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['ld_team', 'reporting_manager', 'functional_head'] },
  { to: '/catalog', label: 'Training Catalog', icon: BookOpen, roles: ['ld_team', 'reporting_manager', 'functional_head'] },
  { to: '/manager-approval', label: 'Approval Queue', icon: CheckSquare, roles: ['ld_team', 'reporting_manager', 'functional_head'], badge: 'approval' },
  { to: '/participants', label: 'Finalized Participants', icon: Award, roles: ['ld_team', 'reporting_manager', 'functional_head'] },
  { to: '/workflow', label: 'Status', icon: GitBranch, roles: ['ld_team', 'reporting_manager', 'functional_head'], badge: 'fh_notifications' },
  { to: '/notifications', label: 'Notifications', icon: Bell, roles: ['reporting_manager', 'functional_head'], badge: 'release_notifications' },
];

const ROLE_ICON = {
  ld_team: UserCheck,
  reporting_manager: Users,
  functional_head: ShieldCheck,
};
const ROLE_LABEL = {
  ld_team: 'L&D Team',
  reporting_manager: 'Reporting Manager',
  functional_head: 'Functional Head',
};
const ROLE_BADGE_STYLE = {
  ld_team: 'bg-emerald-500/20 text-emerald-300',
  reporting_manager: 'bg-sky-500/20 text-sky-300',
  functional_head: 'bg-violet-500/20 text-violet-300',
};

// Pure function - receives all data as parameters, no closure over component state
function computeBadges(role, employeeId, name, regs, noms, courseReqs) {
  const out = { approval: 0, fh_notifications: 0 };
  if (!role) return out;

  if (role === 'ld_team') {
    out.approval =
      regs.filter(r => r.status === 'Pending L&D Validation').length +
      noms.filter(n => n.status === 'Pending L&D Validation').length +
      courseReqs.filter(c => c.status === 'Pending L&D Validation').length +
      courseReqs.filter(c => c.status === 'Approved').length +
      courseReqs.filter(c => c.status === 'Curriculum Approved').length;

    return out;
  }

  if (role === 'reporting_manager') {
    const myRegs = regs.filter(r =>
      r.manager_id ? r.manager_id === employeeId : r.reporting_manager === name
    );
    const myNoms = noms.filter(n => n.manager_id === employeeId);
    const myCrqs = courseReqs.filter(c => c.manager_id === employeeId);

    out.approval =
      myRegs.filter(r => ['Pending Manager Approval', 'Curriculum Approved'].includes(r.status)).length +
      myNoms.filter(n => n.status === 'Participants Requested').length +
      myCrqs.filter(c => c.status === 'Participants Requested').length;

    // Unseen FH-raised requests for this manager's domain
    out.fh_notifications =
      myNoms.filter(n => n.requested_by_fh && !n.seen_by_manager).length +
      myCrqs.filter(c => c.requested_by_fh && !c.seen_by_manager).length;

    return out;
  }

  if (role === 'functional_head') {
    out.approval = courseReqs.filter(c => c.status === 'Pending FH Approval').length;
    return out;
  }

  return out;
}

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [badges, setBadges] = useState({ approval: 0, fh_notifications: 0, release_notifications: 0 });
  // seenCounts: the raw badge count at the moment the user last visited that page.
  // Display = max(0, raw - seen). -1 = never visited (show full count).
  const [seenCounts, setSeenCounts] = useState({ approval: -1 });
  const badgesRef = useRef({ approval: 0, fh_notifications: 0, release_notifications: 0 });

  // Ref holds latest fetch function - prevents stale closure in setInterval
  const fetchRef = useRef(null);

  fetchRef.current = async () => {
    if (!user || user.role === 'employee') return;
    try {
      const fetchArr = [
        axios.get('/api/registrations').catch(() => ({ data: [] })),
        axios.get('/api/nominations').catch(() => ({ data: [] })),
        axios.get('/api/course-requests').catch(() => ({ data: [] })),
      ];
      // Fetch release notification count for FH/RM
      const isRMorFH = user.role === 'reporting_manager' || user.role === 'functional_head';
      if (isRMorFH && user.employee_id) {
        fetchArr.push(
          axios.get(`/api/release-notifications/count?employee_id=${user.employee_id}`)
            .catch(() => ({ data: { count: 0 } }))
        );
      }
      const results = await Promise.all(fetchArr);
      const [regsRes, nomsRes, crqsRes] = results;
      const newBadges = computeBadges(
        user.role,
        user.employee_id,
        user.name,
        regsRes.data,
        nomsRes.data,
        crqsRes.data,
      );
      if (isRMorFH && results[3]) {
        newBadges.release_notifications = results[3].data?.count || 0;
      }
      badgesRef.current = newBadges;
      setBadges(newBadges);
      // If the user is currently ON a badge page while polling, keep seen in sync
      // so the badge doesn't flash while they're actively viewing.
      const activePath = location.pathname;
      ALL_NAV.forEach(n => {
        if (!n.badge || n.badge === 'fh_notifications') return;
        if (activePath === n.to || (n.to !== '/' && activePath.startsWith(n.to))) {
          setSeenCounts(prev => ({ ...prev, [n.badge]: newBadges[n.badge] || 0 }));
        }
      });
    } catch (_) {}
  };

  // Poll every 8s; also re-fetch when tab becomes visible
  useEffect(() => {
    if (!user || user.role === 'employee') return;
    fetchRef.current();
    const interval = setInterval(() => fetchRef.current(), 8000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchRef.current();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user]);

  // When user navigates to a badge page, mark it as seen → badge clears
  useEffect(() => {
    if (!user || user.role === 'employee') return;
    ALL_NAV.forEach(n => {
      if (!n.badge || n.badge === 'fh_notifications') return;
      if (location.pathname === n.to || (n.to !== '/' && location.pathname.startsWith(n.to))) {
        setSeenCounts(prev => ({ ...prev, [n.badge]: badgesRef.current[n.badge] || 0 }));
      }
    });
    // Also instant re-fetch on navigation
    fetchRef.current();
  }, [location.pathname]);

  if (!user) return null;

  const displayName = user.display_name || user.name;
  const displayDesignation = user.designation || '';
  const visibleNav = ALL_NAV.filter(n => n.roles.includes(user.role));
  const RoleIcon = ROLE_ICON[user.role] || UserCheck;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="w-64 min-h-screen bg-slate-900 flex flex-col flex-shrink-0">

      {/* Brand */}
      <div className="px-5 py-5 border-b border-slate-700/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <BookOpen size={18} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">AI-Powered LMS</p>
            <p className="text-slate-400 text-xs">Registration Portal</p>
          </div>
        </div>
      </div>

      {/* Role chip */}
      <div className="px-4 py-3 border-b border-slate-700/60">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${ROLE_BADGE_STYLE[user.role]}`}>
          <RoleIcon size={14} className="shrink-0" />
          <p className="text-xs font-semibold leading-tight truncate">
            {ROLE_LABEL[user.role] || user.role}
          </p>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {visibleNav.map(({ to, label, icon: Icon, badge }) => {
          const raw = badge ? (badges[badge] || 0) : 0;
          const seen = badge && seenCounts[badge] !== undefined ? seenCounts[badge] : -1;
          const count = badge === 'fh_notifications'
            ? raw
            : (seen === -1 ? raw : Math.max(0, raw - seen));
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
            >
              <Icon size={16} className="flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {count > 0 ? (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-tight animate-pulse">
                  {count > 99 ? '99+' : count}
                </span>
              ) : (
                <ChevronRight size={13} className="opacity-30" />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-4 py-4 border-t border-slate-700/60">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate">{displayName}</p>
            {displayDesignation && (
              <p className="text-slate-400 text-[11px] truncate">{displayDesignation}</p>
            )}
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-red-900/40 border border-slate-700 hover:border-red-700/50 text-slate-400 hover:text-red-400 rounded-lg text-xs font-medium transition-all"
        >
          <LogOut size={14} />
          Sign Out
        </button>
      </div>

    </aside>
  );
}
