import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Users, BookOpen, Plus, Trash2, Sparkles, RefreshCw } from 'lucide-react';
import AIInsightBox from '../components/AIInsightBox';
import Toast from '../components/Toast';
import { useAuth } from '../context/AuthContext';

const EMPTY_FORM = {
  manager_id: '', manager_name: '', manager_email: '', department: '', business_unit: '',
  training_id: '', course_name: '', business_need: '', skill_gap: '', priority: 'Medium',
  training_date: '', target_completion_date: '',
};
const EMPTY_PARTICIPANT = { employee_id: '', employee_name: '', email: '', department: '', current_skill_level: '', required_skill_level: '', nomination_reason: '' };
const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];

// Returns null if valid, or an error string if invalid
function validateText(text, { label = 'This field', minLen = 15, requireSpace = true } = {}) {
  const t = (text || '').trim();
  if (!t) return `${label} is required.`;
  if (t.length < minLen) return `${label} must be at least ${minLen} characters.`;
  if (requireSpace && !t.includes(' ')) return `${label} must be a meaningful phrase (at least 2 words).`;
  const letters = t.replace(/[^a-zA-Z]/g, '');
  const vowels  = t.replace(/[^aeiouAEIOU]/g, '');
  if (letters.length >= 6 && vowels.length / letters.length < 0.15)
    return `${label} appears to contain invalid text. Please describe it clearly.`;
  return null;
}

export default function ManagerNomination() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const prefilled = location.state?.training;
  const isRM = user?.role === 'reporting_manager';
  const isFunctionalHead = user?.role === 'functional_head';
  const autoFill = isRM || isFunctionalHead;

  const [form, setForm] = useState({
    ...EMPTY_FORM,
    training_id: prefilled?.training_id || '',
    course_name: prefilled?.course_name || '',
    training_date: prefilled?.training_date || '',
  });
  const [participants, setParticipants] = useState([{ ...EMPTY_PARTICIPANT }]);
  const [employees, setEmployees] = useState([]);
  const [trainings, setTrainings] = useState([]);
  const [managers, setManagers] = useState([]);
  const [aiInsights, setAiInsights] = useState([]);
  const [toast, setToast] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    axios.get('/api/employees').then(r => {
      const allEmps = r.data;
      setEmployees(allEmps.filter(e => e.role === 'employee'));
      setManagers(allEmps.filter(e => ['reporting_manager', 'manager', 'functional_head'].includes(e.role)));
      // Auto-fill manager details from logged-in user for RM and FH
      if (autoFill && user) {
        setForm(f => ({
          ...f,
          manager_id: user.employee_id || '',
          manager_name: user.name || '',
          manager_email: user.email || '',
          department: user.department || '',
          business_unit: user.business_unit || '',
        }));
      }
    });
    axios.get('/api/trainings').then(r => setTrainings(r.data));
  }, []);

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setFieldErrors(fe => ({ ...fe, [k]: undefined })); };

  const validateNominationFields = () => {
    const errs = {};
    const bnErr = validateText(form.business_need, { label: 'Business Need', minLen: 15 });
    if (bnErr) errs.business_need = bnErr;
    const sgErr = validateText(form.skill_gap, { label: 'Skill Gap', minLen: 10 });
    if (sgErr) errs.skill_gap = sgErr;
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleManagerChange = (mgrId) => {
    const mgr = managers.find(m => m.employee_id === mgrId);
    if (mgr) {
      setForm(f => ({
        ...f,
        manager_id: mgrId,
        manager_name: mgr.name,
        manager_email: mgr.email,
        department: mgr.department,
        business_unit: mgr.business_unit,
      }));
    }
  };

  const handleTrainingChange = (tId) => {
    const t = trainings.find(tr => tr.training_id === tId);
    if (t) setForm(f => ({
      ...f,
      training_id: tId,
      course_name: t.course_name,
      training_date: t.training_date ? t.training_date.slice(0, 10) : f.training_date,
    }));
  };

  const runAI = async () => {
    if (!validateNominationFields()) return;
    const res = await axios.post('/api/ai/suggest-priority', { skill_gap: form.skill_gap, business_need: form.business_need });
    setForm(f => ({ ...f, priority: res.data.suggested_priority }));
    setAiInsights(prev => {
      const filtered = prev.filter(i => !i.startsWith('Priority'));
      return [...filtered, `Priority Suggestion: "${res.data.suggested_priority}" — ${res.data.reason}`];
    });
  };

  const setParticipant = (i, k, v) => setParticipants(ps => ps.map((p, idx) => idx === i ? { ...p, [k]: v } : p));

  const handleParticipantEmployee = async (i, empId) => {
    const emp = employees.find(e => e.employee_id === empId);
    if (emp) {
      setParticipants(ps => ps.map((p, idx) => idx === i ? {
        ...p, employee_id: empId, employee_name: emp.name, email: emp.email, department: emp.department
      } : p));
      if (form.training_id) {
        const dup = await axios.post('/api/ai/check-duplicate', { employee_id: empId, training_id: form.training_id });
        if (dup.data.duplicate) {
          setAiInsights(prev => [...prev.filter(x => !x.includes(emp.name)), `⚠️ ${emp.name}: ${dup.data.message}`]);
        }
      }
    }
  };

  const addParticipant = () => setParticipants(ps => [...ps, { ...EMPTY_PARTICIPANT }]);
  const removeParticipant = (i) => setParticipants(ps => ps.filter((_, idx) => idx !== i));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.manager_id || !form.training_id || !form.training_date || participants.some(p => !p.employee_id)) {
      setToast({ msg: 'Please fill all required fields including Training Date.', type: 'error' });
      return;
    }
    if (!validateNominationFields()) {
      setToast({ msg: 'Please fix the highlighted field errors before submitting.', type: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      await axios.post('/api/nominations', { ...form, participants });
      setToast({ msg: 'Nomination submitted! Status: Pending L&D Validation', type: 'success' });
      setForm({ ...EMPTY_FORM });
      setParticipants([{ ...EMPTY_PARTICIPANT }]);
      setAiInsights([]);
      setTimeout(() => navigate('/workflow'), 2000);
    } catch {
      setToast({ msg: 'Submission failed. Please try again.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => { setForm({ ...EMPTY_FORM }); setParticipants([{ ...EMPTY_PARTICIPANT }]); setAiInsights([]); };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div>
        <h1 className="text-2xl font-bold text-slate-800">Manager Nomination Form</h1>
        <p className="text-slate-500 text-sm mt-1">Nominate employees for training programs</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Manager Details */}
        <div className="card">
          <div className="section-header">
            <Users size={18} className="text-blue-600" />
            <span>Manager Details</span>
            <span className="ml-auto text-xs text-slate-400 font-normal">* Required</span>
          </div>
          {autoFill && (
            <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 bg-sky-50 border border-sky-200 rounded-lg text-xs text-sky-700 font-medium">
              <Users size={13} /> Your details have been auto-filled as the nominating {isRM ? 'Reporting Manager' : 'Functional Head'}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Manager / Functional Head *</label>
              {autoFill ? (
                <input value={`${form.manager_id} — ${form.manager_name}`} readOnly className="form-input bg-slate-50" />
              ) : (
                <select value={form.manager_id} onChange={e => handleManagerChange(e.target.value)} className="form-select" required>
                  <option value="">Select Manager</option>
                  {managers.map(m => (
                    <option key={m.employee_id} value={m.employee_id}>{m.employee_id} — {m.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="form-label">Manager Name</label>
              <input value={form.manager_name} readOnly className="form-input bg-slate-50" />
            </div>
            <div>
              <label className="form-label">Email</label>
              <input value={form.manager_email} readOnly className="form-input bg-slate-50" />
            </div>
            <div>
              <label className="form-label">Department</label>
              <input value={form.department} readOnly className="form-input bg-slate-50" />
            </div>
            <div>
              <label className="form-label">Business Unit</label>
              <input value={form.business_unit} readOnly className="form-input bg-slate-50" />
            </div>
          </div>
        </div>

        {/* Training Requirement */}
        <div className="card">
          <div className="section-header">
            <BookOpen size={18} className="text-blue-600" />
            <span>Training Requirement</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Training *</label>
              <select value={form.training_id} onChange={e => handleTrainingChange(e.target.value)} className="form-select" required>
                <option value="">Select Training</option>
                {trainings.map(t => (
                  <option key={t.training_id} value={t.training_id}>{t.training_id} — {t.course_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Course Name</label>
              <input value={form.course_name} readOnly className="form-input bg-slate-50" />
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Business Need *</label>
              <textarea value={form.business_need} onChange={e => set('business_need', e.target.value)}
                rows={2} className={`form-input resize-none ${fieldErrors.business_need ? 'border-red-400 bg-red-50' : ''}`}
                placeholder="e.g. Team requires advanced Python skills to build BI dashboards and automate reports" required />
              {fieldErrors.business_need && <p className="text-xs text-red-600 mt-1">{fieldErrors.business_need}</p>}
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Skill Gap Identified *</label>
              <textarea value={form.skill_gap} onChange={e => set('skill_gap', e.target.value)}
                rows={2} className={`form-input resize-none ${fieldErrors.skill_gap ? 'border-red-400 bg-red-50' : ''}`}
                placeholder="e.g. Current skill is beginner level; need intermediate Python and data visualization skills" required />
              {fieldErrors.skill_gap && <p className="text-xs text-red-600 mt-1">{fieldErrors.skill_gap}</p>}
            </div>
            <div>
              <label className="form-label">Priority *</label>
              <div className="flex items-center gap-2">
                <select value={form.priority} onChange={e => set('priority', e.target.value)} className="form-select flex-1" required>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
                <button type="button" onClick={runAI}
                  disabled={!!validateText(form.business_need, { label: 'Business Need', minLen: 15 }) || !!validateText(form.skill_gap, { label: 'Skill Gap', minLen: 10 })}
                  title="Fill in valid Business Need and Skill Gap to get AI priority suggestion"
                  className="flex items-center gap-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed">
                  <Sparkles size={13} /> AI Suggest
                </button>
              </div>
            </div>
            <div>
              <label className="form-label">Training Date *</label>
              <input type="date" value={form.training_date} onChange={e => set('training_date', e.target.value)}
                className="form-input" required min={new Date().toISOString().split('T')[0]} />
            </div>
            <div>
              <label className="form-label">Target Completion Date *</label>
              <input type="date" value={form.target_completion_date} onChange={e => set('target_completion_date', e.target.value)}
                className="form-input" required min={new Date().toISOString().split('T')[0]} />
            </div>
          </div>
        </div>

        {/* Participant Nomination */}
        <div className="card">
          <div className="section-header">
            <Users size={18} className="text-blue-600" />
            <span>Participant Nomination</span>
            <button type="button" onClick={addParticipant}
              className="ml-auto flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors">
              <Plus size={13} /> Add Participant
            </button>
          </div>

          <div className="space-y-4">
            {participants.map((p, i) => (
              <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-100 relative">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Participant {i + 1}</span>
                  {participants.length > 1 && (
                    <button type="button" onClick={() => removeParticipant(i)} className="text-red-500 hover:text-red-700">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="form-label">Employee *</label>
                    <select value={p.employee_id} onChange={e => handleParticipantEmployee(i, e.target.value)} className="form-select" required>
                      <option value="">Select</option>
                      {employees.map(e => (
                        <option key={e.employee_id} value={e.employee_id}>{e.employee_id} — {e.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Email</label>
                    <input value={p.email} readOnly className="form-input bg-white text-xs" />
                  </div>
                  <div>
                    <label className="form-label">Department</label>
                    <input value={p.department} readOnly className="form-input bg-white text-xs" />
                  </div>
                  <div>
                    <label className="form-label">Current Skill Level *</label>
                    <select value={p.current_skill_level} onChange={e => setParticipant(i, 'current_skill_level', e.target.value)} className="form-select" required>
                      <option value="">Select</option>
                      {SKILL_LEVELS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Required Skill Level *</label>
                    <select value={p.required_skill_level} onChange={e => setParticipant(i, 'required_skill_level', e.target.value)} className="form-select" required>
                      <option value="">Select</option>
                      {SKILL_LEVELS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Nomination Reason *</label>
                    <input value={p.nomination_reason} onChange={e => setParticipant(i, 'nomination_reason', e.target.value)}
                      className="form-input" placeholder="Why nominated?" required />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Insights */}
        <AIInsightBox insights={aiInsights} />

        {/* Actions */}
        <div className="flex gap-3">
          <button type="submit" disabled={submitting} className="btn-primary px-8">
            {submitting ? 'Submitting...' : 'Submit to L&D'}
          </button>
          <button type="button" onClick={handleReset} className="btn-secondary flex items-center gap-2">
            <RefreshCw size={15} /> Reset
          </button>
        </div>
      </form>
    </div>
  );
}
