import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { User, BookOpen, CheckSquare, Sparkles, RefreshCw } from 'lucide-react';
import AIInsightBox from '../components/AIInsightBox';
import Toast from '../components/Toast';
import { useAuth } from '../context/AuthContext';

const EMPTY = {
  employee_id: '', employee_name: '', email: '', department: '',
  reporting_manager: '',
  training_id: '', course_name: '', training_mode: '',
  training_date: '', reason: '',
};

function isMeaningful(value, minChars = 15, minWords = 3) {
  const trimmed = (value || '').trim();
  const letters = trimmed.replace(/[^a-zA-Z]/g, '');
  const vowels = trimmed.replace(/[^aeiouAEIOU]/g, '');
  if (letters.length >= 6 && vowels.length / letters.length < 0.15) return false;
  const realWords = trimmed.split(/\s+/).filter(w => w.length > 1);
  return realWords.length >= minWords || trimmed.length >= minChars;
}

export default function SelfRegistration() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const prefilled = location.state?.training;
  const isEmployee = user?.role === 'employee';

  const [form, setForm] = useState({
    ...EMPTY,
    training_id: prefilled?.training_id || '',
    course_name: prefilled?.course_name || '',
    training_mode: prefilled?.mode || '',
  });
  const [employees, setEmployees] = useState([]);
  const [trainings, setTrainings] = useState([]);
  const [aiInsights, setAiInsights] = useState([]);
  const [toast, setToast] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      axios.get('/api/employees'),
      axios.get('/api/trainings'),
    ]).then(([empRes, trnRes]) => {
      setEmployees(empRes.data);
      setTrainings(trnRes.data);
      // Auto-fill for logged-in employee
      if (isEmployee && user.employee_id) {
        const emp = empRes.data.find(e => e.employee_id === user.employee_id);
        if (emp) {
          setForm(f => ({
            ...f,
            employee_id: emp.employee_id,
            employee_name: emp.name,
            email: emp.email,
            department: emp.department,
            reporting_manager: empRes.data.find(e => e.employee_id === emp.manager_id)?.name || '',
          }));
          axios.post('/api/ai/suggest-course', {
            designation: emp.designation,
            department: emp.department,
            current_skills: emp.current_skills,
          }).then(res => setAiInsights([`Suggested Course: "${res.data.course}" — ${res.data.reason}`]));
        }
      }
    });
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleEmployeeChange = async (empId) => {
    set('employee_id', empId);
    const emp = employees.find(e => e.employee_id === empId);
    if (emp) {
      setForm(f => ({
        ...f,
        employee_id: empId,
        employee_name: emp.name,
        email: emp.email,
        department: emp.department,
        reporting_manager: employees.find(e => e.employee_id === emp.manager_id)?.name || '',
      }));
      if (emp.designation || emp.department) {
        const res = await axios.post('/api/ai/suggest-course', {
          designation: emp.designation,
          department: emp.department,
          current_skills: emp.current_skills,
        });
        setAiInsights(prev => {
          const filtered = prev.filter(i => !i.startsWith('Suggested Course'));
          return [...filtered, `Suggested Course: "${res.data.course}" — ${res.data.reason}`];
        });
      }
    }
  };

  const handleTrainingChange = async (tId) => {
    set('training_id', tId);
    const t = trainings.find(tr => tr.training_id === tId);
    if (t) {
      setForm(f => ({ ...f, training_id: tId, course_name: t.course_name, training_mode: t.mode }));
      if (form.employee_id) {
        const [dupRes, eligRes] = await Promise.all([
          axios.post('/api/ai/check-duplicate', { employee_id: form.employee_id, training_id: tId }),
          axios.post('/api/ai/validate-eligibility', { employee_id: form.employee_id, training_id: tId }),
        ]);
        const insights = [];
        if (dupRes.data.duplicate) insights.push('⚠️ Duplicate Detected: ' + dupRes.data.message);
        else insights.push('✓ No duplicate request found for this employee and course.');
        insights.push(eligRes.data.eligible ? '✓ ' + eligRes.data.message : '⚠️ ' + eligRes.data.message);
        setAiInsights(insights);
      }
    }
  };

  const selectedTraining = trainings.find(t => t.training_id === form.training_id);
  const batches = selectedTraining?.batches?.split('|').map(b => b.trim()) || [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.employee_id || !form.training_id || !form.training_date || !form.reason) {
      setToast({ msg: 'Please fill all required fields including Training Date.', type: 'error' });
      return;
    }
    if (!isMeaningful(form.reason, 15, 3)) {
      setToast({ msg: 'Please provide a meaningful reason for enrollment (at least 3 words explaining your need).', type: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      await axios.post('/api/registrations', form);
      setToast({ msg: 'Request submitted successfully to your assigned domain manager.', type: 'success' });
      setForm({ ...EMPTY });
      setAiInsights([]);
      setTimeout(() => navigate('/my-requests'), 2000);
    } catch (err) {
      setToast({ msg: 'Submission failed. Please try again.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => { setForm({ ...EMPTY }); setAiInsights([]); };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div>
        <h1 className="text-2xl font-bold text-slate-800">Self Registration Form</h1>
        <p className="text-slate-500 text-sm mt-1">Register yourself for a training program</p>

      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Employee Details */}
        <div className="card">
          <div className="section-header">
            <User size={18} className="text-blue-600" />
            <span>Employee Details</span>
            <span className="ml-auto text-xs text-slate-400 font-normal">* Required</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Employee ID *</label>
              {isEmployee ? (
                <input value={form.employee_id} readOnly className="form-input bg-slate-50" />
              ) : (
                <select value={form.employee_id} onChange={e => handleEmployeeChange(e.target.value)} className="form-select" required>
                  <option value="">Select Employee</option>
                  {employees.filter(e => e.role === 'employee').map(e => (
                    <option key={e.employee_id} value={e.employee_id}>{e.employee_id} — {e.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="form-label">Employee Name *</label>
              <input value={form.employee_name} readOnly className="form-input bg-slate-50" placeholder="Auto-populated" />
            </div>
            <div>
              <label className="form-label">Email *</label>
              <input value={form.email} readOnly className="form-input bg-slate-50" placeholder="Auto-populated" />
            </div>
            <div>
              <label className="form-label">Department *</label>
              <input value={form.department} readOnly className="form-input bg-slate-50" placeholder="Auto-populated" />
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Reporting Manager</label>
              <input value={form.reporting_manager} readOnly className="form-input bg-slate-50" placeholder="Auto-populated" />
            </div>
          </div>
        </div>

        {/* Training Details */}
        <div className="card">
          <div className="section-header">
            <BookOpen size={18} className="text-blue-600" />
            <span>Training Details</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Training ID *</label>
              <select value={form.training_id} onChange={e => handleTrainingChange(e.target.value)} className="form-select" required>
                <option value="">Select Training</option>
                {trainings.map(t => (
                  <option key={t.training_id} value={t.training_id}>{t.training_id} — {t.course_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Course Name</label>
              <input value={form.course_name} readOnly className="form-input bg-slate-50" placeholder="Auto-populated" />
            </div>
            <div>
              <label className="form-label">Training Mode</label>
              <input value={form.training_mode} readOnly className="form-input bg-slate-50" placeholder="Auto-populated" />
            </div>
            <div>
              <label className="form-label">Training Date *</label>
              <input type="date" value={form.training_date} onChange={e => set('training_date', e.target.value)}
                className="form-input" required min={(() => { const d = new Date(); d.setDate(d.getDate() + 15); return d.toISOString().split('T')[0]; })()} />
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Reason for Enrollment *</label>
              <textarea value={form.reason} onChange={e => set('reason', e.target.value)}
                rows={3} className="form-input resize-none" placeholder="Explain why you want to attend this training (min. 3 words)..." required />
              {form.reason && !isMeaningful(form.reason, 15, 3) && (
                <p className="text-xs text-amber-600 mt-1">Please describe your reason in more detail (at least 3 meaningful words).</p>
              )}
            </div>

          </div>
        </div>


        {/* Actions */}
        <div className="flex gap-3">
          <button type="submit" disabled={submitting} className="btn-primary px-8">
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </form>
    </div>
  );
}
