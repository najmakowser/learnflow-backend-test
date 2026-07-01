import { useEffect, useState } from 'react';
import axios from 'axios';
import { Bell, BookOpen, Calendar, Clock, User, Users, ExternalLink, FileText, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ReleaseNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user?.employee_id) return;
    try {
      const { data } = await axios.get(`/api/release-notifications?employee_id=${user.employee_id}`);
      setNotifications(Array.isArray(data) ? data : []);
    } catch (_) {}
    setLoading(false);
  };

  useEffect(() => {
    load();
    // Mark all as seen when page opens
    if (user?.employee_id) {
      axios.put('/api/release-notifications/mark-seen', { employee_id: user.employee_id }).catch(() => {});
    }
  }, [user?.employee_id]);

  const fmtDate = (ts) => {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
  };

  const fmtTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  };

  const getDomains = (domainsStr) => {
    try { return JSON.parse(domainsStr || '[]'); } catch (_) { return []; }
  };

  const unseenCount = notifications.filter(n => !n.seen).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Bell size={22} className="text-blue-600" /> Notifications
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            New training releases from L&D Team
            {unseenCount > 0 && (
              <span className="ml-2 bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {unseenCount} new
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="card py-16 text-center text-slate-400">
          <Bell size={32} className="mx-auto mb-2 opacity-30 animate-pulse" />
          <p className="text-sm">Loading notifications...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="card py-16 text-center text-slate-400">
          <Bell size={36} className="mx-auto mb-2 opacity-30" />
          <p className="font-medium">No notifications yet</p>
          <p className="text-xs mt-1">You'll be notified when L&D releases a new course for your domain.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map(n => {
            const domains = getDomains(n.released_to_domains);
            const isNew = !n.seen;
            return (
              <div key={n.id}
                className={`card border-l-4 transition-all ${isNew ? 'border-l-blue-500 bg-blue-50/30' : 'border-l-slate-200'}`}>
                {/* Top bar */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isNew && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 animate-pulse">
                        🔔 New
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                      🎯 New Release
                    </span>
                    <span className="text-xs text-slate-400 font-mono">{n.training_id}</span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-medium text-slate-600">{fmtDate(n.released_at)}</p>
                    <p className="text-[11px] text-slate-400">{fmtTime(n.released_at)}</p>
                  </div>
                </div>

                {/* Course title */}
                <h3 className="text-base font-bold text-slate-800 mb-1">{n.course_name}</h3>

                {/* Released by */}
                <p className="text-xs text-slate-500 mb-3 flex items-center gap-1">
                  <User size={12} className="text-slate-400" />
                  Released by <span className="font-semibold text-slate-700 ml-1">{n.released_by}</span>
                  <span className="mx-1 text-slate-300">·</span>
                  <span className="text-slate-400">L&D Team</span>
                </p>

                {/* Course details grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                  {n.category && (
                    <div className="bg-slate-50 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Category</p>
                      <p className="text-xs font-semibold text-slate-700 mt-0.5">{n.category}</p>
                    </div>
                  )}
                  {n.mode && (
                    <div className="bg-slate-50 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Mode</p>
                      <p className="text-xs font-semibold text-slate-700 mt-0.5">{n.mode}</p>
                    </div>
                  )}
                  {n.trainer_name && (
                    <div className="bg-slate-50 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Trainer</p>
                      <p className="text-xs font-semibold text-slate-700 mt-0.5">{n.trainer_name}</p>
                    </div>
                  )}
                  {n.training_date && (
                    <div className="bg-slate-50 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Date</p>
                      <p className="text-xs font-semibold text-slate-700 mt-0.5">{fmtDate(n.training_date)}</p>
                    </div>
                  )}
                </div>

                {/* Curriculum summary */}
                {n.curriculum_summary && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-3">
                    <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-1">Curriculum Summary</p>
                    <p className="text-xs text-amber-900 leading-relaxed">{n.curriculum_summary}</p>
                  </div>
                )}

                {/* Curriculum file */}
                {n.curriculum_file_url && (
                  <a href={n.curriculum_file_url} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-2 text-xs text-blue-700 hover:text-blue-900 font-medium px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors mb-3">
                    <FileText size={13} /> View Curriculum — {n.curriculum_file_name || 'PDF'}
                    <ExternalLink size={11} />
                  </a>
                )}

                {/* Target domains */}
                {domains.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap mb-4">
                    <span className="text-[10px] text-slate-400 font-medium uppercase">For:</span>
                    {domains.map(d => (
                      <span key={d} className="text-[11px] bg-violet-100 text-violet-700 font-medium px-2 py-0.5 rounded-full">{d}</span>
                    ))}
                  </div>
                )}

                {/* CTA */}
                <div className="border-t border-slate-100 pt-3 mt-1">
                  <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                    <CheckCircle size={15} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-emerald-800">Action Required</p>
                      <p className="text-xs text-emerald-700 mt-0.5">
                        {user?.role === 'reporting_manager'
                          ? 'Review this course and nominate eligible team members via the Training Catalog → Request for Team.'
                          : 'Review this course and coordinate with your Reporting Managers to nominate participants from your domains.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
