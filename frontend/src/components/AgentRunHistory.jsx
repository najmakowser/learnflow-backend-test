export default function AgentRunHistory({ title = 'Persisted Agent Outputs', runs = [], loading = false, emptyMessage = 'No persisted AI output yet.' }) {
  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <h4 className="text-sm font-bold text-slate-800">{title}</h4>
      {loading ? (
        <p className="mt-2 text-xs text-slate-500">Loading agent history...</p>
      ) : runs.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">{emptyMessage}</p>
      ) : (
        <div className="mt-3 space-y-3">
          {runs.map((run) => (
            <div key={run.run_id} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-800">{run.agent_label}</p>
                <span className="text-[11px] text-slate-400">{run.created_at}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">Trigger: {run.trigger_event || 'manual_run'}</p>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-[11px] text-slate-700">{JSON.stringify(run.output_payload, null, 2)}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}