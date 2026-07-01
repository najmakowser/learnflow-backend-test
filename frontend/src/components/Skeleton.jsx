export function SkeletonBox({ className = '' }) {
  return <div className={`animate-pulse bg-slate-200 rounded-lg ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="card !p-4 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <SkeletonBox className="w-10 h-10 rounded-xl" />
      </div>
      <SkeletonBox className="h-7 w-12 mb-2" />
      <SkeletonBox className="h-3 w-24" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {[...Array(6)].map((_, i) => (
        <td key={i} className="table-td">
          <SkeletonBox className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonTable({ rows = 4, cols = 6 }) {
  return (
    <div className="card !p-0 overflow-hidden animate-pulse">
      <div className="h-10 bg-slate-100 border-b border-slate-200" />
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3 border-b border-slate-100 last:border-0">
          {[...Array(cols)].map((_, j) => (
            <SkeletonBox key={j} className={`h-4 flex-1 ${j === 0 ? 'max-w-[80px]' : ''}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <SkeletonBox className="h-7 w-48 mb-2" />
        <SkeletonBox className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card h-64">
            <SkeletonBox className="h-5 w-40 mb-4" />
            <SkeletonBox className="h-full w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
