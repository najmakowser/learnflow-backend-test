import { useEffect, useState } from 'react';
import axios from 'axios';
import { Search, Mail, Award, CheckCircle, ChevronDown, ChevronUp, Users, Download, Sparkles, Bell, X } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import Toast from '../components/Toast';
import { useAuth } from '../context/AuthContext';

export default function Enrollment() {
  const { user } = useAuth();
  const [participants, setParticipants] = useState([]);
  const [filter, setFilter] = useState('');
  const [toast, setToast] = useState(null);
  const [collapsed, setCollapsed] = useState({});
  const [emailBannerDismissed, setEmailBannerDismissed] = useState(false);
  const [sending, setSending] = useState({});

  const load = () => axios.get('/api/participants').then(r => setParticipants(r.data));
  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  const sendEmail = async (p) => {
    setSending(s => ({ ...s, [p.id]: true }));
    try {
      let endpoint;
      if (p.request_type === 'Registration') {
        endpoint = `/api/registrations/${p.request_id}/send-email`;
      } else if (p.request_type === 'Course Request') {
        endpoint = `/api/course-requests/${p.request_id}/send-email`;
      } else {
        endpoint = `/api/nominations/${p.request_id}/send-email`;
      }
      await axios.put(endpoint);
      setToast({ msg: `Enrollment email sent to ${p.employee_name}`, type: 'success' });
      await load();
    } finally {
      setSending(s => ({ ...s, [p.id]: false }));
    }
  };

  const sendCourseEmails = async (courseParts) => {
    const unsent = courseParts.filter(p => !p.confirmation_sent);
    await Promise.all(unsent.map(p => sendEmail(p)));
    setToast({ msg: `Emails sent to ${unsent.length} participant(s)`, type: 'success' });
  };

  const sendAllPendingEmails = async () => {
    await Promise.all(pendingOnly.map(p => sendEmail(p)));
    setEmailBannerDismissed(true);
    setToast({ msg: `Enrollment emails sent to all ${pendingOnly.length} pending participant(s)`, type: 'success' });
  };

  const exportCSV = () => {
    const rows = [
      ['Course', 'Employee ID', 'Employee Name', 'Department', 'Source', 'Enrolled On', 'Enrollment', 'Email Status'],
      ...filtered.map(p => {
        const enrolledOn = p.approval_date
          ? new Date(p.approval_date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
          : '—';
        return [
          `"${p.course_name}"`, p.employee_id, `"${p.employee_name}"`, p.department,
          p.source || '—', enrolledOn, p.enrollment_status, p.confirmation_sent ? 'Sent' : 'Pending'
        ];
      })
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'enrollment_emails.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // Deduplicate
  const deduped = participants.reduce((acc, p) => {
    const key = `${p.course_name}||${p.employee_id}`;
    if (!acc[key] || (p.confirmation_sent && !acc[key].confirmation_sent)) acc[key] = p;
    return acc;
  }, {});
  const dedupedList = Object.values(deduped);

  // Enrollment page: only show participants whose email hasn't been sent yet
  const pendingOnly = dedupedList.filter(p => !p.confirmation_sent);

  const filtered = pendingOnly.filter(p =>
    p.employee_name?.toLowerCase().includes(filter.toLowerCase()) ||
    p.course_name?.toLowerCase().includes(filter.toLowerCase()) ||
    p.department?.toLowerCase().includes(filter.toLowerCase())
  );

  const grouped = filtered.reduce((acc, p) => {
    if (!acc[p.course_name]) acc[p.course_name] = [];
    acc[p.course_name].push(p);
    return acc;
  }, {});

  const toggleCollapse = (course) => setCollapsed(c => ({ ...c, [course]: !c[course] }));
  const pendingEmailCount = pendingOnly.length;
  const sentCount = dedupedList.filter(p => p.confirmation_sent).length;

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Pending email banner */}
      {pendingEmailCount > 0 && !emailBannerDismissed && (
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 bg-amber-50 border border-amber-200 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-400 rounded-xl flex items-center justify-center flex-shrink-0">
              <Bell size={17} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-800">
                {pendingEmailCount} participant{pendingEmailCount > 1 ? 's' : ''} awaiting enrollment email
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                Participants have been nominated — send enrollment confirmation emails now
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={sendAllPendingEmails}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              <Mail size={13} /> Send All ({pendingEmailCount})
            </button>
            <button
              onClick={() => setEmailBannerDismissed(true)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-amber-100 text-amber-500 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Enrollment</h1>
          <p className="text-slate-500 text-sm mt-1">
            {pendingEmailCount} participant{pendingEmailCount !== 1 ? 's' : ''} across {Object.keys(grouped).length} course{Object.keys(grouped).length !== 1 ? 's' : ''} awaiting enrollment email
          </p>
        </div>
        {filtered.length > 0 && (
          <button onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-medium transition-colors">
            <Download size={15} /> Export CSV
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card !p-4 bg-amber-50 text-center">
          <p className="text-2xl font-bold text-amber-700">{pendingEmailCount}</p>
          <p className="text-xs text-amber-600 font-medium mt-1">Awaiting Email</p>
        </div>
        <div className="card !p-4 bg-blue-50 text-center">
          <p className="text-2xl font-bold text-blue-700">{Object.keys(grouped).length}</p>
          <p className="text-xs text-blue-600 font-medium mt-1">Courses</p>
        </div>
        <div className="card !p-4 bg-emerald-50 text-center">
          <p className="text-2xl font-bold text-emerald-700">{sentCount}</p>
          <p className="text-xs text-emerald-600 font-medium mt-1">Emails Sent (Total)</p>
        </div>
      </div>

      {/* Search */}
      <div className="card !p-4 flex items-center gap-3">
        <Search size={16} className="text-slate-400 flex-shrink-0" />
        <input value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="Search by employee, course or department..."
          className="form-input flex-1 !border-0 !ring-0 !p-0 text-sm" />
        <span className="text-xs text-slate-400 whitespace-nowrap">{filtered.length} results</span>
      </div>

      {/* Course groups */}
      {Object.keys(grouped).length === 0 ? (
        <div className="card py-16 text-center text-slate-400">
          <CheckCircle size={36} className="mx-auto mb-2 opacity-30" />
          <p className="font-medium">All enrollment emails have been sent!</p>
          <p className="text-xs mt-1">View sent records in Finalized Participants</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([courseName, parts]) => {
            const isOpen = !collapsed[courseName];
            const trainingDateRaw = parts[0]?.training_date;
            const trainingDateLabel = trainingDateRaw
              ? new Date(trainingDateRaw).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
              : 'Date TBD';
            const mode = parts[0]?.training_mode || 'Classroom';

            return (
              <div key={courseName} className="card !p-0 overflow-hidden">
                {/* Course header */}
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => toggleCollapse(courseName)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-amber-100">
                      <Mail size={16} className="text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">{courseName}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{mode} &bull; Training: {trainingDateLabel}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                      <Users size={12} /> {parts.length} participant{parts.length !== 1 ? 's' : ''}
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); sendCourseEmails(parts); }}
                      className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
                    >
                      <Mail size={12} /> Send {parts.length} Email{parts.length !== 1 ? 's' : ''}
                    </button>
                    {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                  </div>
                </div>

                {/* Participants table */}
                {isOpen && (
                  <div className="border-t border-slate-100 overflow-x-auto">
                    <table className="w-full min-w-[640px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="table-th">Employee ID</th>
                          <th className="table-th">Employee Name</th>
                          <th className="table-th">Department</th>
                          <th className="table-th">Source</th>
                          <th className="table-th">Enrolled On</th>
                          <th className="table-th">Enrollment</th>
                          <th className="table-th">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parts.map(p => (
                          <tr key={p.id} className="table-row">
                            <td className="table-td font-mono text-xs font-medium text-slate-500">{p.employee_id}</td>
                            <td className="table-td font-semibold text-slate-800">{p.employee_name}</td>
                            <td className="table-td">{p.department}</td>
                            <td className="table-td text-sm text-slate-700">{p.source || '—'}</td>
                            <td className="table-td">
                              {p.approval_date ? (() => {
                                const IST = { timeZone: 'Asia/Kolkata' };
                                const dt = new Date(p.approval_date);
                                return (
                                  <>
                                    <p className="text-xs text-slate-700 font-medium">
                                      {dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', ...IST })}
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                      {dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, ...IST })}
                                    </p>
                                  </>
                                );
                              })() : <span className="text-slate-400 text-xs">—</span>}
                            </td>
                            <td className="table-td"><StatusBadge status={p.enrollment_status} /></td>
                            <td className="table-td">
                              <button
                                onClick={() => sendEmail(p)}
                                disabled={sending[p.id]}
                                className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-60 ${
                                  p.confirmation_sent
                                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                                }`}
                              >
                                <Mail size={12} />
                                {sending[p.id] ? 'Sending…' : p.confirmation_sent ? 'Resend' : 'Send Email'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
