import { Sparkles } from 'lucide-react';

export default function AIInsightBox({ insights }) {
  if (!insights || insights.length === 0) return null;
  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center">
          <Sparkles size={13} className="text-white" />
        </div>
        <span className="text-sm font-bold text-blue-800">AI Insights & Recommendations</span>
      </div>
      <div className="space-y-2">
        {insights.map((insight, i) => (
          <div key={i} className="flex items-start gap-2 text-sm text-blue-700">
            <span className="mt-0.5 flex-shrink-0 w-4 h-4 bg-blue-200 rounded-full flex items-center justify-center text-xs font-bold text-blue-700">{i + 1}</span>
            <p>{insight}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
