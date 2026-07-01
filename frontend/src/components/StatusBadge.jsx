export default function StatusBadge({ status }) {
  const map = {
    'Pending L&D Validation': 'bg-amber-100 text-amber-800 border border-amber-200',
    'Pending FH Approval': 'bg-sky-100 text-sky-800 border border-sky-200',
    'Pending Manager Approval': 'bg-sky-100 text-sky-800 border border-sky-200',
    'Approved': 'bg-emerald-100 text-emerald-800 border border-emerald-200',
    'Curriculum Shared': 'bg-indigo-100 text-indigo-800 border border-indigo-200',
    'Curriculum Approved': 'bg-teal-100 text-teal-800 border border-teal-200',
    'Curriculum Rejected': 'bg-red-100 text-red-700 border border-red-200',
    'Under Review': 'bg-violet-100 text-violet-800 border border-violet-200',
    'Finalized': 'bg-teal-100 text-teal-800 border border-teal-200',
    'Rejected': 'bg-red-100 text-red-800 border border-red-200',
    'Enrolled': 'bg-purple-100 text-purple-800 border border-purple-200',
    'Nominated': 'bg-blue-100 text-blue-800 border border-blue-200',
    'Pending Participant Nomination': 'bg-teal-100 text-teal-800 border border-teal-200',
    'Active': 'bg-emerald-100 text-emerald-800 border border-emerald-200',
    'Draft': 'bg-slate-100 text-slate-600 border border-slate-200',
    'High': 'bg-red-100 text-red-700 border border-red-200',
    'Medium': 'bg-amber-100 text-amber-700 border border-amber-200',
    'Low': 'bg-slate-100 text-slate-600 border border-slate-200',
  };
  const cls = map[status] || 'bg-slate-100 text-slate-600 border border-slate-200';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}
