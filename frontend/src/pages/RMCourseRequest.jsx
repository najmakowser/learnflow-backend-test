import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { BookOpen, Users, Sparkles, RefreshCw, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import Toast from '../components/Toast';
import { useAuth } from '../context/AuthContext';

const EMPTY_FORM = {
  course_name: '',
  category: '',
  mode: 'Online',
  duration: '',
  business_need: '',
  skill_gap: '',
  expected_participants: '',
  priority: 'Medium',
  expected_start_date: '',
  additional_notes: '',
  fh_id: '',
  fh_name: '',
};

const MODES = ['Online', 'Offline', 'Hybrid'];
const CATEGORIES = ['Technical', 'Leadership', 'Compliance', 'Soft Skills', 'Domain Knowledge', 'Tools & Technology', 'Other'];

// Returns true only if value has at least minWords real words OR at least minChars characters
// A "real word" is 2+ characters — filters out single-char noise
function isMeaningful(value, minChars = 15, minWords = 2) {
  const trimmed = (value || '').trim();
  const realWords = trimmed.split(/\s+/).filter(w => w.length > 1);
  return realWords.length >= minWords || trimmed.length >= minChars;
}

export default function RMCourseRequest() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [functionalHeads, setFunctionalHeads] = useState([]);
  const [recommendation, setRecommendation] = useState(null);
  const [toast, setToast] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [gettingRec, setGettingRec] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  useEffect(() => {
    axios.get('/api/employees').then(r => {
      const allFhs = r.data.filter(e => e.role === 'functional_head');
      setFunctionalHeads(allFhs);
      const myFH = allFhs.find(fh => fh.employee_id === user?.manager_id);
      if (myFH) setForm(f => ({ ...f, fh_id: myFH.employee_id, fh_name: myFH.name }));
    });
  }, [user?.manager_id]);

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    if (validationErrors[k]) setValidationErrors(e => ({ ...e, [k]: null }));
    // Clear stale recommendation when key inputs change
    if (['course_name', 'business_need', 'skill_gap'].includes(k)) setRecommendation(null);
  };

  const handleFHChange = (fhId) => {
    const fh = functionalHeads.find(f => f.employee_id === fhId);
    if (fh) setForm(f => ({ ...f, fh_id: fhId, fh_name: fh.name }));
    else setForm(f => ({ ...f, fh_id: fhId, fh_name: '' }));
  };

  const validateRecommendationInputs = () => {
    const errors = {};
    // course_name: needs at least 2 real words OR 10 chars
    if (!form.course_name.trim()) {
      errors.course_name = 'Course name is required before getting a recommendation.';
    } else if (!isMeaningful(form.course_name, 10, 2)) {
      errors.course_name = 'Please enter a meaningful course name — at least 2 words (e.g. "Python for Data Science").';
    }
    // business_need: needs at least 3 real words OR 15 chars
    if (!form.business_need.trim()) {
      errors.business_need = 'Business need is required before getting a recommendation.';
    } else if (!isMeaningful(form.business_need, 15, 3)) {
      errors.business_need = 'Please describe the business need properly — at least 3 words explaining the requirement.';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const getCourseRecommendation = async () => {
    if (!validateRecommendationInputs()) return;

    setGettingRec(true);
    setRecommendation(null);
    try {
      const res = await axios.post('/api/ai/recommend-course-path', {
        course_name: form.course_name.trim(),
        business_need: form.business_need.trim(),
        skill_gap: form.skill_gap.trim(),
      });
      setRecommendation(res.data);
      // Auto-update priority from recommendation
      if (res.data.priority_assessment) {
        setForm(f => ({ ...f, priority: res.data.priority_assessment }));
      }
    } catch {
      setToast({ msg: 'Recommendation failed. Please try again.', type: 'error' });
    } finally {
      setGettingRec(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.course_name || !form.business_need || !form.fh_id) {
      setToast({ msg: 'Please fill Course Name, Business Need, and select a Functional Head.', type: 'error' });
      return;
    }
    if (!isMeaningful(form.course_name, 10, 2)) {
      setToast({ msg: 'Please enter a meaningful course name (at least 2 words).', type: 'error' });
      return;
    }
    if (!isMeaningful(form.business_need, 15, 3)) {
      setToast({ msg: 'Please describe the business need in more detail (at least 3 words).', type: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      await axios.post('/api/course-requests', {
        manager_id: user.employee_id,
        manager_name: user.name,
        manager_email: user.email || '',
        department: user.department || '',
        business_unit: user.business_unit || '',
        ...form,
        expected_participants: parseInt(form.expected_participants) || 1,
        requested_by_rm: true,
        requested_by_fh: false,
      });
      setToast({ msg: `New course request submitted to ${form.fh_name} (FH) for approval.`, type: 'success' });
      setForm({ ...EMPTY_FORM });
      setRecommendation(null);
      setValidationErrors({});
      setTimeout(() => navigate('/workflow'), 2000);
    } catch {
      setToast({ msg: 'Submission failed. Please try again.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setForm({ ...EMPTY_FORM });
    setRecommendation(null);
    setValidationErrors({});
  };

  const isReuseExisting = recommendation?.decision === 'reuse_existing';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div>
        <h1 className="text-2xl font-bold text-slate-800">New Course Request</h1>
        <p className="text-slate-500 text-sm mt-1">
          Submit a request for a new training course — it will go to your Functional Head for approval before reaching L&D.
        </p>
      </div>

      {/* Flow hint */}
      <div className="flex items-center gap-2 flex-wrap text-xs font-medium text-slate-500">
        {['You (RM)', 'FH Approval', 'L&D Validation', 'Participants Requested', 'Enrolled'].map((step, i, arr) => (
          <div key={step} className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full ${i === 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{step}</span>
            {i < arr.length - 1 && <span className="text-slate-300">→</span>}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Submitter info */}
        <div className="card">
          <div className="section-header">
            <Users size={18} className="text-blue-600" />
            <span>Your Details</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="form-label">Name</label>
              <input value={user?.name || ''} readOnly className="form-input bg-slate-50" />
            </div>
            <div>
              <label className="form-label">Department</label>
              <input value={user?.department || ''} readOnly className="form-input bg-slate-50" />
            </div>
            <div>
              <label className="form-label">Functional Head</label>
              {form.fh_id && user?.manager_id ? (
                <input value={form.fh_name} readOnly className="form-input bg-slate-50" />
              ) : (
                <select
                  value={form.fh_id}
                  onChange={e => handleFHChange(e.target.value)}
                  className="form-select"
                  required
                >
                  <option value="">Select Functional Head</option>
                  {functionalHeads.map(fh => (
                    <option key={fh.employee_id} value={fh.employee_id}>
                      {fh.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Course Details */}
        <div className="card">
          <div className="section-header">
            <BookOpen size={18} className="text-blue-600" />
            <span>Course Details</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="form-label">Course Name *</label>
              <input
                value={form.course_name}
                onChange={e => set('course_name', e.target.value)}
                className={`form-input ${validationErrors.course_name ? 'border-red-400 ring-1 ring-red-300' : ''}`}
                placeholder="e.g. Advanced Python for Data Engineering"
                required
              />
              {validationErrors.course_name && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> {validationErrors.course_name}
                </p>
              )}
            </div>
            <div>
              <label className="form-label">Category</label>
              <select value={form.category} onChange={e => set('category', e.target.value)} className="form-select">
                <option value="">Select category</option>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Mode</label>
              <select value={form.mode} onChange={e => set('mode', e.target.value)} className="form-select">
                {MODES.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Duration</label>
              <input
                value={form.duration}
                onChange={e => set('duration', e.target.value)}
                className="form-input"
                placeholder="e.g. 2 days / 16 hours"
              />
            </div>
            <div>
              <label className="form-label">Expected No. of Participants</label>
              <input
                type="number"
                min="1"
                value={form.expected_participants}
                onChange={e => set('expected_participants', e.target.value)}
                className="form-input"
                placeholder="e.g. 10"
              />
            </div>
            <div>
              <label className="form-label">Expected Start Date</label>
              <input
                type="date"
                value={form.expected_start_date}
                onChange={e => set('expected_start_date', e.target.value)}
                className="form-input"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div>
              <label className="form-label">Priority</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)} className="form-select">
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Business Need / Justification *</label>
              <textarea
                value={form.business_need}
                onChange={e => set('business_need', e.target.value)}
                rows={3}
                className={`form-input resize-none ${validationErrors.business_need ? 'border-red-400 ring-1 ring-red-300' : ''}`}
                placeholder="Describe why this course is needed and what business problem it solves…"
                required
              />
              {validationErrors.business_need && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> {validationErrors.business_need}
                </p>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Skill Gap Identified</label>
              <textarea
                value={form.skill_gap}
                onChange={e => set('skill_gap', e.target.value)}
                rows={2}
                className="form-input resize-none"
                placeholder="What skills are currently lacking in the team?"
              />
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Additional Notes</label>
              <textarea
                value={form.additional_notes}
                onChange={e => set('additional_notes', e.target.value)}
                rows={2}
                className="form-input resize-none"
                placeholder="Any other details or preferences for the course…"
              />
            </div>
          </div>
        </div>

        {/* Course Recommendation Card */}
        <div className="card border border-indigo-100 bg-indigo-50/40">
          <div className="section-header text-indigo-700">
            <Sparkles size={18} className="text-indigo-600" />
            <span>Course Recommendation</span>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            Checks the existing training catalog and suggests whether to reuse an available course or create a new one.
            Requires a valid <strong>Course Name</strong> and <strong>Business Need</strong> before running.
          </p>
          <button
            type="button"
            onClick={getCourseRecommendation}
            disabled={gettingRec}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
          >
            <Sparkles size={14} />
            {gettingRec ? 'Analysing catalog…' : 'Get Recommendation'}
          </button>
        </div>

        {/* Recommendation Result */}
        {recommendation && (
          <div className={`card border-l-4 ${isReuseExisting ? 'border-amber-400 bg-amber-50/30' : 'border-green-400 bg-green-50/30'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-indigo-500" />
                <span className="font-semibold text-slate-800 text-sm">Course Recommendation Result</span>
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 ${isReuseExisting ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                {isReuseExisting ? <CheckCircle size={12} /> : <ArrowRight size={12} />}
                {isReuseExisting ? 'Reuse Existing Course' : 'Create New Course'}
              </span>
            </div>

            {recommendation.reason && (
              <div className="mb-4">
                <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Assessment</p>
                <p className="text-sm text-slate-700">{recommendation.reason}</p>
              </div>
            )}

            {recommendation.top_matches?.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-slate-500 font-semibold uppercase mb-2">Catalog Comparison</p>
                <div className="space-y-2">
                  {recommendation.top_matches.map((m, i) => {
                    const pct = Math.round((m.similarity || 0) * 100);
                    const colorClass = pct >= 60
                      ? 'bg-amber-100 text-amber-700'
                      : pct >= 40
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-slate-100 text-slate-500';
                    return (
                      <div key={i} className="flex items-start justify-between gap-3 bg-white rounded-lg px-3 py-2.5 border border-slate-100">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800">{m.course_name}</p>
                          {m.skill_tags && <p className="text-xs text-slate-400 mt-0.5">{m.skill_tags}</p>}
                        </div>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${colorClass}`}>
                          {pct}% match
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {recommendation.suggested_objectives?.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Suggested Learning Objectives</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {recommendation.suggested_objectives.map((o, i) => (
                    <li key={i} className="text-sm text-slate-700">{o}</li>
                  ))}
                </ul>
              </div>
            )}

            {recommendation.next_steps?.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Recommended Next Steps</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {recommendation.next_steps.map((s, i) => (
                    <li key={i} className="text-sm text-slate-700">{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={submitting} className="btn-primary px-8">
            {submitting ? 'Submitting…' : `Submit to ${form.fh_name || 'Functional Head'} for Approval`}
          </button>
          <button type="button" onClick={handleReset} className="btn-secondary flex items-center gap-2">
            <RefreshCw size={15} /> Reset
          </button>
        </div>
      </form>
    </div>
  );
}
