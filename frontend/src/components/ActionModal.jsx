import { useState } from 'react';
import { X } from 'lucide-react';

export default function ActionModal({ title, description, onConfirm, onClose, requireRemarks = true }) {
  const [remarks, setRemarks] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <div className="p-6">
          {requireRemarks && (
            <textarea
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              rows={3}
              className="form-input resize-none w-full"
              placeholder="Add your comments here..."
            />
          )}
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={() => onConfirm(remarks)} className="btn-primary flex-1">Confirm</button>
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
        </div>
      </div>
    </div>
  );
}
