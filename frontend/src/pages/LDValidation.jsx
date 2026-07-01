import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Search, Eye, CheckCircle, XCircle, ClipboardCheck, BookPlus } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import ActionModal from '../components/ActionModal';
import { SkeletonTable } from '../components/Skeleton';
import Toast from '../components/Toast';
import { useAuth } from '../context/AuthContext';

export default function LDValidation() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const performedBy = user?.display_name || user?.name || 'L&D Admin';
  const [regs, setRegs] = useState([]);
  const [noms, setNoms] = useState([]);
  const [courseReqs, setCourseReqs] = useState([]);
  const [filter, setFilter] = useState('');
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    Promise.all([
      axios.get('/api/registrations'),
      axios.get('/api/nominations'),
      axios.get('/api/course-requests'),
    ]).then(([r, n, c]) => {
      setRegs(r.data); setNoms(n.data); setCourseReqs(c.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  if (loading) return <SkeletonTable rows={5} cols={8} />;

  const allItems = [
    ...regs.filter(r => r.status === 'Pending L&D Validation').map(r => ({
      id: r.request_id, type: 'Self Registration', course: r.course_name,
      submittedBy: r.employee_name, department: r.department,
      participants: 1, status: r.status, raw: r, kind: 'reg'
    })),
    ...noms.filter(n => n.status === 'Pending L&D Validation').map(n => ({
      id: n.nomination_id, type: 'Team Nomination', course: n.course_name,
      submittedBy: n.manager_name, department: n.department,
      participants: n.participant_count || 0, status: n.status, raw: n, kind: 'nom'
    })),
    ...courseReqs.filter(c => c.status === 'Pending L&D Validation').map(c => ({
      id: c.request_id, type: 'New Course Request', course: c.course_name,
      submittedBy: c.manager_name, department: c.department,
      participants: c.expected_participants || 0, status: c.status, raw: c, kind: 'course'
    })),
  ].filter(i =>
    i.id.toLowerCase().includes(filter.toLowerCase()) ||
    i.course.toLowerCase().includes(filter.toLowerCase()) ||
    i.submittedBy.toLowerCase().includes(filter.toLowerCase())
  );

  const doValidate = async (item, remarks) => {
    if (item.kind === 'reg') {
      await axios.put(`/api/registrations/${item.id}/validate`, { performed_by: performedBy, role: 'L&D Admin', remarks });
      setModal(null);
      setDetail(null);
      load();
      setToast({ msg: `${item.id} validated — Employee enrollment confirmed`, type: 'success' });
    } else if (item.kind === 'nom') {
      await axios.put(`/api/nominations/${item.id}/validate`, { performed_by: performedBy, role: 'L&D Admin', remarks });
      setModal(null);
      setDetail(null);
      load();
      setToast({ msg: `${item.id} validated — Manager prompted to confirm participants`, type: 'success' });
    } else {
      await axios.put(`/api/course-requests/${item.id}/validate`, { performed_by: performedBy, role: 'L&D Admin', remarks });
      setModal(null);
      setDetail(null);
      load();
      setToast({ msg: `Course request ${item.id} acknowledged — Under Review`, type: 'success' });
    }
  };

  const doReject = async (item, remarks) => {
    if (item.kind === 'reg') {
      await axios.put(`/api/registrations/${item.id}/reject`, { performed_by: performedBy, role: 'L&D Admin', remarks });
    } else if (item.kind === 'nom') {
      await axios.put(`/api/nominations/${item.id}/reject`, { performed_by: performedBy, role: 'L&D Admin', remarks });
    } else {
      await axios.put(`/api/course-requests/${item.id}/reject`, { performed_by: performedBy, role: 'L&D Admin', remarks });
    }
    setToast({ msg: `${item.id} rejected`, type: 'error' });
    setModal(null);
    setDetail(null);
    load();
  };

  const kindBadge = {
    reg: 'bg-blue-100 text-blue-700',
    nom: 'bg-purple-100 text-purple-700',
    course: 'bg-amber-100 text-amber-700',
  };

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {modal && (
        <ActionModal
          title={modal.title}
          description={modal.description}
          onConfirm={modal.onConfirm}
          onClose={() => setModal(null)}
        />
      )}

      <div>
        <h1 className="text-2xl font-bold text-slate-800">L&D Validation</h1>
        <p className="text-slate-500 text-sm mt-1">Review and validate training requests</p>
      </div>

      {/* Summary counts */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Self Registrations', count: regs.filter(r => r.status === 'Pending L&D Validation').length, color: 'bg-blue-50 border-blue-200 text-blue-700' },
          { label: 'Team Nominations', count: noms.filter(n => n.status === 'Pending L&D Validation').length, color: 'bg-purple-50 border-purple-200 text-purple-700' },
          { label: 'New Course Requests', count: courseReqs.filter(c => c.status === 'Pending L&D Validation').length, color: 'bg-amber-50 border-amber-200 text-amber-700' },
        ].map(({ label, count, color }) => (
          <div key={label} className={`card border ${color} !py-3`}>
            <p className="text-xs font-medium opacity-70">{label}</p>
            <p className="text-2xl font-bold mt-0.5">{count}</p>
            <p className="text-xs opacity-60">pending</p>
          </div>
        ))}
      </div>

      <div className="card !p-4 flex items-center gap-3">
        <Search size={16} className="text-slate-400 flex-shrink-0" />
        <input value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="Search by ID, course or submitted by..." className="form-input flex-1 !border-0 !ring-0 !p-0 text-sm" />
        <span className="text-xs text-slate-400 whitespace-nowrap">{allItems.length} pending</span>
      </div>

      {/* Detail Panel */}
      {detail && (
        <div className={`card border-l-4 ${detail.kind === 'course' ? 'border-amber-500' : detail.kind === 'nom' ? 'border-purple-500' : 'border-blue-500'}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-800">
              {detail.kind === 'course' && <BookPlus size={16} className="inline mr-2 text-amber-600" />}
              Request Details — {detail.id}
            </h3>
            <button onClick={() => setDetail(null)} className="text-xs text-slate-400 hover:text-slate-600">Close ✕</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><p className="text-xs text-slate-400">Type</p><p className="font-medium">{detail.type}</p></div>
            <div><p className="text-xs text-slate-400">{detail.kind === 'course' ? 'Requested Course' : 'Course'}</p><p className="font-medium">{detail.course}</p></div>
            <div><p className="text-xs text-slate-400">Submitted By</p><p className="font-medium">{detail.submittedBy}</p></div>
            <div><p className="text-xs text-slate-400">Department</p><p className="font-medium">{detail.department}</p></div>
            {(detail.raw?.training_date || detail.raw?.target_completion_date) && (
              <div className="md:col-span-4 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <span className="text-xs font-semibold text-blue-600">Requested Training Date:</span>
                <span className="text-sm font-bold text-blue-800">{new Date(detail.raw.training_date || detail.raw.target_completion_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
            )}

            {detail.kind === 'course' ? (
              <>
                <div><p className="text-xs text-slate-400">Category</p><p className="font-medium">{detail.raw.category || '—'}</p></div>
                <div><p className="text-xs text-slate-400">Mode</p><p className="font-medium">{detail.raw.mode || '—'}</p></div>
                <div><p className="text-xs text-slate-400">Duration</p><p className="font-medium">{detail.raw.duration || '—'}</p></div>
                <div><p className="text-xs text-slate-400">Expected Participants</p><p className="font-medium">{detail.raw.expected_participants || '—'}</p></div>
                <div><p className="text-xs text-slate-400">Priority</p><p className="font-medium">{detail.raw.priority}</p></div>
                <div><p className="text-xs text-slate-400">Expected Start Date</p><p className="font-medium">{detail.raw.expected_start_date || '—'}</p></div>
                {detail.raw.business_need && <div className="md:col-span-4"><p className="text-xs text-slate-400">Business Need</p><p className="font-medium text-sm">{detail.raw.business_need}</p></div>}
                {detail.raw.skill_gap && <div className="md:col-span-4"><p className="text-xs text-slate-400">Skill Gap</p><p className="font-medium text-sm">{detail.raw.skill_gap}</p></div>}
                {detail.raw.additional_notes && <div className="md:col-span-4"><p className="text-xs text-slate-400">Additional Notes</p><p className="font-medium text-sm">{detail.raw.additional_notes}</p></div>}
              </>
            ) : (
              <>
                <div><p className="text-xs text-slate-400">Participants</p><p className="font-medium">{detail.participants}</p></div>
                <div><p className="text-xs text-slate-400">Status</p><StatusBadge status={detail.status} /></div>
                {detail.raw.reason && <div className="md:col-span-4"><p className="text-xs text-slate-400">Reason</p><p className="font-medium text-sm">{detail.raw.reason}</p></div>}
                {detail.raw.business_need && <div className="md:col-span-4"><p className="text-xs text-slate-400">Business Need</p><p className="font-medium text-sm">{detail.raw.business_need}</p></div>}
              </>
            )}
          </div>

          {detail.raw.participants?.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-slate-500 font-semibold uppercase mb-2">Nominated Participants</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-slate-50">
                    <th className="table-th">Employee</th><th className="table-th">Email</th>
                    <th className="table-th">Current Level</th><th className="table-th">Required Level</th>
                    <th className="table-th">Reason</th>
                  </tr></thead>
                  <tbody>
                    {detail.raw.participants.map(p => (
                      <tr key={p.employee_id} className="table-row">
                        <td className="table-td">{p.employee_name}</td>
                        <td className="table-td">{p.email}</td>
                        <td className="table-td">{p.current_skill_level}</td>
                        <td className="table-td">{p.required_skill_level}</td>
                        <td className="table-td">{p.nomination_reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
            <button onClick={() => setModal({
              title: detail.kind === 'course' ? 'Acknowledge Course Request' : 'Validate Request',
              description: detail.kind === 'course'
                ? `Acknowledge course request ${detail.id} for "${detail.course}"? This will move it to Under Review.`
                : `Validate request ${detail.id} for "${detail.course}"? This will send it for Manager Approval.`,
              onConfirm: (r) => doValidate(detail, r)
            })} className="btn-success flex items-center gap-1">
              <CheckCircle size={13} /> {detail.kind === 'course' ? 'Acknowledge' : 'Validate'}
            </button>
            <button onClick={() => setModal({
              title: 'Reject Request',
              description: `Reject request ${detail.id}? Please provide a reason.`,
              onConfirm: (r) => doReject(detail, r)
            })} className="btn-danger flex items-center gap-1">
              <XCircle size={13} /> Reject
            </button>
          </div>
        </div>
      )}

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="table-th">Request ID</th>
              <th className="table-th">Type</th>
              <th className="table-th">Course Name</th>
              <th className="table-th">Submitted By</th>
              <th className="table-th">Department</th>
              <th className="table-th">Training Date</th>
              <th className="table-th">Participants</th>
              <th className="table-th">Status</th>
              <th className="table-th">Actions</th>
            </tr>
          </thead>
          <tbody>
            {allItems.map(item => (
              <tr key={item.id} className="table-row">
                <td className="table-td font-mono text-xs font-medium text-blue-600">{item.id}</td>
                <td className="table-td">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${kindBadge[item.kind]}`}>
                    {item.type}
                  </span>
                </td>
                <td className="table-td font-medium">
                  {item.kind === 'course' && <BookPlus size={12} className="inline mr-1 text-amber-500" />}
                  {item.course}
                </td>
                <td className="table-td">{item.submittedBy}</td>
                <td className="table-td">{item.department}</td>
                <td className="table-td text-xs font-medium text-blue-700">
                  {(item.raw?.training_date || item.raw?.target_completion_date)
                    ? new Date(item.raw.training_date || item.raw.target_completion_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                    : <span className="text-slate-400">—</span>}
                </td>
                <td className="table-td text-center">{item.participants}</td>
                <td className="table-td"><StatusBadge status={item.status} /></td>
                <td className="table-td">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button onClick={() => setDetail(item)} className="btn-info flex items-center gap-1">
                      <Eye size={12} /> View
                    </button>
                    <button onClick={() => setModal({
                      title: item.kind === 'course' ? 'Acknowledge Course Request' : 'Validate Request',
                      description: item.kind === 'course'
                        ? `Acknowledge course request ${item.id} for "${item.course}"?`
                        : `Validate request ${item.id} for "${item.course}"? This will send it for Manager Approval.`,
                      onConfirm: (r) => doValidate(item, r)
                    })} className="btn-success flex items-center gap-1">
                      <CheckCircle size={12} /> {item.kind === 'course' ? 'Ack.' : 'Validate'}
                    </button>
                    <button onClick={() => setModal({
                      title: 'Reject Request',
                      description: `Reject request ${item.id}? Please provide a reason.`,
                      onConfirm: (r) => doReject(item, r)
                    })} className="btn-danger flex items-center gap-1">
                      <XCircle size={12} /> Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {allItems.length === 0 && (
              <tr><td colSpan={8} className="py-16 text-center text-slate-400">
                <ClipboardCheck size={36} className="mx-auto mb-2 opacity-30" />
                <p className="font-medium">No pending validation requests</p>
              </td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
