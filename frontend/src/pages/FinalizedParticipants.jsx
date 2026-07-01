import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { Search, Award, CheckCircle, ChevronDown, ChevronUp, Users, Download, Filter } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function FinalizedParticipants() {
  const { user } = useAuth();
  const isLDTeam = user?.role === 'ld_team';
  const [participants, setParticipants] = useState([]);
  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState('All');
  const [courseFilter, setCourseFilter] = useState('All');
  const [collapsed, setCollapsed] = useState({});

  const load = () => axios.get('/api/participants').then(r => setParticipants(r.data));
  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  // Deduplicate by employee_id per course
  const dedupedList = useMemo(() => {
    const map = {};
    participants.forEach(p => {
      const key = `${p.course_name}||${p.employee_id}`;
      if (!map[key]) map[key] = p;
    });
    return Object.values(map);
  }, [participants]);

  // Unique domain and course options
  const domains = useMemo(() => {
    const set = new Set(dedupedList.map(p => p.department).filter(Boolean));
    return ['All', ...Array.from(set).sort()];
  }, [dedupedList]);

  const courses = useMemo(() => {
    const set = new Set(dedupedList.map(p => p.course_name).filter(Boolean));
    return ['All', ...Array.from(set).sort()];
  }, [dedupedList]);

  const filtered = useMemo(() => dedupedList.filter(p => {
    const matchDomain = domainFilter === 'All' || p.department === domainFilter;
    const matchCourse = courseFilter === 'All' || p.course_name === courseFilter;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      p.employee_name?.toLowerCase().includes(q) ||
      p.course_name?.toLowerCase().includes(q) ||
      p.department?.toLowerCase().includes(q) ||
      p.designation?.toLowerCase().includes(q) ||
      p.manager_name?.toLowerCase().includes(q);
    return matchDomain && matchCourse && matchSearch;
  }), [dedupedList, domainFilter, courseFilter, search]);

  const grouped = useMemo(() => filtered.reduce((acc, p) => {
    if (!acc[p.course_name]) acc[p.course_name] = [];
    acc[p.course_name].push(p);
    return acc;
  }, {}), [filtered]);

  const toggleCollapse = (course) => setCollapsed(c => ({ ...c, [course]: !c[course] }));

  const fmtDate = ts => {
    if (!ts) return '—';
    const dt = new Date(ts);
    const IST = { timeZone: 'Asia/Kolkata' };
    return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', ...IST });
  };

  const exportCSV = () => {
    const label = [
      domainFilter !== 'All' ? `Domain_${domainFilter}` : '',
      courseFilter !== 'All' ? `Course_${courseFilter}` : '',
    ].filter(Boolean).join('_') || 'all';

    const rows = [
      ['Course', 'Employee ID', 'Employee Name', 'Designation', 'Reporting Manager', 'Department', 'Source', 'Finalized On'],
      ...filtered.map(p => [
        `"${p.course_name}"`,
        p.employee_id,
        `"${p.employee_name}"`,
        `"${p.designation || '—'}"`,
        `"${p.manager_name || '—'}"`,
        `"${p.department}"`,
        p.source || '—',
        fmtDate(p.approval_date),
      ])
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `finalized_participants_${label}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Finalized Participants</h1>
          <p className="text-slate-500 text-sm mt-1">
            {filtered.length} participant{filtered.length !== 1 ? 's' : ''} across {Object.keys(grouped).length} course{Object.keys(grouped).length !== 1 ? 's' : ''}
            {(domainFilter !== 'All' || courseFilter !== 'All') && (
              <span className="ml-1 text-blue-600 font-medium">(filtered)</span>
            )}
          </p>
        </div>
        {isLDTeam && filtered.length > 0 && (
          <button onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-medium transition-colors">
            <Download size={15} /> Export CSV
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card !p-4 bg-emerald-50 text-center">
          <p className="text-2xl font-bold text-emerald-700">{dedupedList.length}</p>
          <p className="text-xs text-emerald-600 font-medium mt-1">Total Finalized</p>
        </div>
        <div className="card !p-4 bg-blue-50 text-center">
          <p className="text-2xl font-bold text-blue-700">{Object.keys(courses).length - 1}</p>
          <p className="text-xs text-blue-600 font-medium mt-1">Courses</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card !p-4 space-y-3">
        {/* Search */}
        <div className="flex items-center gap-3">
          <Search size={16} className="text-slate-400 flex-shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, course, department, designation or manager..."
            className="form-input flex-1 !border-0 !ring-0 !p-0 text-sm" />
          <span className="text-xs text-slate-400 whitespace-nowrap">{filtered.length} results</span>
        </div>

        {/* Domain + Course dropdowns */}
        <div className="flex items-center gap-3 flex-wrap">
          <Filter size={14} className="text-slate-400 flex-shrink-0" />
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500 whitespace-nowrap">Domain:</label>
            <select
              value={domainFilter}
              onChange={e => { setDomainFilter(e.target.value); setCourseFilter('All'); }}
              className="form-select text-sm py-1.5 pr-8"
            >
              {domains.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500 whitespace-nowrap">Course:</label>
            <select
              value={courseFilter}
              onChange={e => setCourseFilter(e.target.value)}
              className="form-select text-sm py-1.5 pr-8"
            >
              {courses.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          {(domainFilter !== 'All' || courseFilter !== 'All') && (
            <button
              onClick={() => { setDomainFilter('All'); setCourseFilter('All'); }}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Course groups */}
      {Object.keys(grouped).length === 0 ? (
        <div className="card py-16 text-center text-slate-400">
          <Award size={36} className="mx-auto mb-2 opacity-30" />
          <p className="font-medium">No finalized participants found</p>
          <p className="text-xs mt-1">
            {(domainFilter !== 'All' || courseFilter !== 'All' || search)
              ? 'Try adjusting the filters'
              : 'Approve requests from the Approval Queue page'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([courseName, parts]) => {
            const isOpen = !collapsed[courseName];
            const mode = parts[0]?.training_mode || '—';
            const trainingDateRaw = parts[0]?.training_date;
            const trainingDateLabel = trainingDateRaw
              ? new Date(trainingDateRaw).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
              : 'Date TBD';

            return (
              <div key={courseName} className="card !p-0 overflow-hidden">
                {/* Course header */}
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => toggleCollapse(courseName)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-emerald-100">
                      <CheckCircle size={16} className="text-emerald-600" />
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
                    {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                  </div>
                </div>

                {/* Participants table */}
                {isOpen && (
                  <div className="border-t border-slate-100 overflow-x-auto">
                    <table className="w-full min-w-[860px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="table-th">Employee ID</th>
                          <th className="table-th">Employee Name</th>
                          <th className="table-th">Designation</th>
                          <th className="table-th">Reporting Manager</th>
                          <th className="table-th">Domain</th>
                          <th className="table-th">Source</th>
                          <th className="table-th">Finalized On</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parts.map(p => (
                          <tr key={p.id} className="table-row">
                            <td className="table-td font-mono text-xs font-medium text-slate-500">{p.employee_id}</td>
                            <td className="table-td font-semibold text-slate-800">{p.employee_name}</td>
                            <td className="table-td text-slate-600">{p.designation || '—'}</td>
                            <td className="table-td text-slate-600">{p.manager_name || '—'}</td>
                            <td className="table-td">{p.department}</td>
                            <td className="table-td text-sm text-slate-700">{p.source || '—'}</td>
                            <td className="table-td">
                              {p.approval_date ? (
                                <p className="text-xs text-slate-700 font-medium">
                                  {new Date(p.approval_date).toLocaleDateString('en-IN', {
                                    day: 'numeric', month: 'short', year: 'numeric',
                                    timeZone: 'Asia/Kolkata'
                                  })}
                                </p>
                              ) : <span className="text-slate-400 text-xs">—</span>}
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
