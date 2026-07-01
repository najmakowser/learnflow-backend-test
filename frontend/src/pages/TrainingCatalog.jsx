import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Search, BookOpen, Clock, User, Layers, Wifi, Monitor, Users, Plus, Send, X, Pencil, Sparkles, Upload, Trash2, FileText, ExternalLink } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import Toast from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import AIInsightBox from '../components/AIInsightBox';

const modeIcon = { Online: Wifi, Offline: Monitor, Hybrid: Layers };
const modeColor = {
  Online: 'text-emerald-600 bg-emerald-50',
  Offline: 'text-purple-600 bg-purple-50',
  Hybrid: 'text-blue-600 bg-blue-50',
};

const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
const CATEGORIES = ['Technical', 'Soft Skills', 'Analytics', 'Security', 'Project Management', 'Leadership', 'Compliance', 'Other'];
const MODES = ['Online', 'Offline', 'Hybrid'];

// ── Input validation helper ───────────────────────────────────────────────────
// Returns null if valid, or an error string if invalid.
function validateText(text, { label = 'This field', minLen = 15, requireSpace = true } = {}) {
  const t = (text || '').trim();
  if (!t) return `${label} is required.`;
  if (t.length < minLen) return `${label} must be at least ${minLen} characters.`;
  if (requireSpace && !t.includes(' ')) return `${label} must be a meaningful phrase (at least 2 words).`;
  // Gibberish check: vowel ratio among letters must be ≥ 15%
  const letters = t.replace(/[^a-zA-Z]/g, '');
  const vowels  = t.replace(/[^aeiouAEIOU]/g, '');
  if (letters.length >= 6 && vowels.length / letters.length < 0.15)
    return `${label} appears to contain invalid text. Please describe it clearly.`;
  return null;
}

// ── Add / Edit Course Modal (L&D only) ───────────────────────────────────────
const EMPTY_COURSE = { course_name: '', category: '', mode: 'Online', duration: '', trainer_name: '', training_date: '', seats_available: '', skill_tags: '', status: 'Active', curriculum_summary: '' };

function CourseFormModal({ course, onClose, onSubmit }) {
  const isEdit = !!course?.training_id;
  const [form, setForm] = useState(isEdit ? {
    course_name: course.course_name || '',
    category: course.category || '',
    mode: course.mode || 'Online',
    duration: course.duration || '',
    trainer_name: course.trainer_name || '',
    training_date: course.training_date || '',
    seats_available: course.seats_available ?? '',
    skill_tags: course.skill_tags || '',
    status: course.status || 'Active',
    curriculum_file_name: course.curriculum_file_name || '',
    curriculum_file_url: course.curriculum_file_url || '',
    curriculum_summary: course.curriculum_summary || '',
  } : { ...EMPTY_COURSE, curriculum_file_name: '', curriculum_file_url: '' });
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  // Domain targeting (Release mode only)
  const [availableDomains, setAvailableDomains] = useState([]);
  const [selectedDomains, setSelectedDomains] = useState([]);
  const [releaseToAll, setReleaseToAll] = useState(false);

  useEffect(() => {
    if (!isEdit) {
      axios.get('/api/departments').then(r => setAvailableDomains(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    }
  }, [isEdit]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleDomain = (d) => setSelectedDomains(prev =>
    prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
  );

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await axios.post('/api/curriculum-upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setForm(f => ({ ...f, curriculum_file_name: data.original_name, curriculum_file_url: data.url }));
    } catch (err) {
      setUploadError(err.response?.data?.detail || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveCurriculum = () => {
    setForm(f => ({ ...f, curriculum_file_name: '', curriculum_file_url: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!form.course_name || !form.category) return;
    // For Release mode, require at least one domain or "All"
    if (!isEdit && !releaseToAll && selectedDomains.length === 0) {
      setUploadError('Please select at least one target domain, or choose "All Domains".');
      return;
    }
    setSubmitting(true);
    try {
      const domains = releaseToAll ? availableDomains : selectedDomains;
      const released_to_domains = !isEdit ? JSON.stringify(domains) : undefined;
      await onSubmit({
        ...form,
        seats_available: parseInt(form.seats_available) || 0,
        released_to_domains,
        curriculum_summary: form.curriculum_summary || '',
      }, course?.training_id);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-6">
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800 text-base">{isEdit ? 'Edit Course' : 'Release New Course'}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{isEdit ? `Editing ${course.training_id}` : 'Release a course to the training catalog'}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="form-label">Course Name *</label>
            <input value={form.course_name} onChange={e => set('course_name', e.target.value)} className="form-input" placeholder="e.g. Advanced Python for Data Science" />
          </div>
          <div>
            <label className="form-label">Category *</label>
            <select value={form.category} onChange={e => set('category', e.target.value)} className="form-select">
              <option value="">Select Category</option>
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
            <input value={form.duration} onChange={e => set('duration', e.target.value)} className="form-input" placeholder="e.g. 3 Days" />
          </div>
          <div>
            <label className="form-label">Trainer Name</label>
            <input value={form.trainer_name} onChange={e => set('trainer_name', e.target.value)} className="form-input" placeholder="e.g. Dr. Anil Gupta" />
          </div>
          <div>
            <label className="form-label">Training Date (Tentative)</label>
            <input type="date" value={form.training_date} onChange={e => set('training_date', e.target.value)} className="form-input" />
          </div>
          <div>
            <label className="form-label">Seats Available</label>
            <input type="number" min="0" value={form.seats_available} onChange={e => set('seats_available', e.target.value)} className="form-input" placeholder="20" />
          </div>
          <div>
            <label className="form-label">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} className="form-select">
              <option>Active</option>
              <option>Draft</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="form-label">Skill Tags</label>
            <input value={form.skill_tags} onChange={e => set('skill_tags', e.target.value)} className="form-input" placeholder="Python, ML, Data Science (comma-separated)" />
          </div>

          {/* ── Curriculum Summary ── */}
          <div className="col-span-2">
            <label className="form-label">Curriculum Summary</label>
            <textarea
              value={form.curriculum_summary}
              onChange={e => set('curriculum_summary', e.target.value)}
              rows={3}
              className="form-input resize-none"
              placeholder="Brief outline of what this training covers — topics, objectives, expected outcomes..."
            />
          </div>

          {/* ── Curriculum File ── */}
          <div className="col-span-2">
            <label className="form-label">Curriculum File (optional)</label>
            {form.curriculum_file_url ? (
              <div className="flex items-center justify-between gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={16} className="text-emerald-600 flex-shrink-0" />
                  <span className="text-sm font-medium text-emerald-800 truncate">
                    {form.curriculum_file_name || 'Curriculum File'}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <a href={form.curriculum_file_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 font-medium px-2 py-1 rounded-lg hover:bg-emerald-100 transition-colors">
                    <ExternalLink size={13} /> View
                  </a>
                  <label className="flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 font-medium px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer">
                    <Upload size={13} /> Replace
                    <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                  </label>
                  <button onClick={handleRemoveCurriculum}
                    className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">
                    <Trash2 size={13} /> Remove
                  </button>
                </div>
              </div>
            ) : (
              <label className={`flex flex-col items-center justify-center gap-2 px-4 py-5 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${uploading ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'}`}>
                <Upload size={20} className={uploading ? 'text-blue-500 animate-bounce' : 'text-slate-400'} />
                <span className="text-sm font-medium text-slate-600">{uploading ? 'Uploading...' : 'Click to upload curriculum'}</span>
                <span className="text-xs text-slate-400">PDF, Word, or PowerPoint</span>
                <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx" className="hidden" onChange={handleFileUpload} disabled={uploading} />
              </label>
            )}
            {uploadError && <p className="text-xs text-red-600 mt-1">{uploadError}</p>}
          </div>

          {/* ── Target Domains (Release mode only) ── */}
          {!isEdit && (
            <div className="col-span-2">
              <label className="form-label">Notify Domains *</label>
              <p className="text-xs text-slate-400 mb-2">Functional Heads and Reporting Managers of selected domains will be notified.</p>
              <div className="border border-slate-200 rounded-xl p-3 space-y-2 max-h-44 overflow-y-auto">
                {/* All Domains toggle */}
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={releaseToAll}
                    onChange={e => { setReleaseToAll(e.target.checked); if (e.target.checked) setSelectedDomains([]); }}
                    className="accent-emerald-600 w-4 h-4" />
                  <span className="text-sm font-semibold text-slate-700">All Domains</span>
                </label>
                {!releaseToAll && availableDomains.map(d => (
                  <label key={d} className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={selectedDomains.includes(d)}
                      onChange={() => toggleDomain(d)}
                      className="accent-emerald-600 w-4 h-4" />
                    <span className="text-sm text-slate-700">{d}</span>
                  </label>
                ))}
                {availableDomains.length === 0 && !releaseToAll && (
                  <p className="text-xs text-slate-400 py-2">Loading domains...</p>
                )}
              </div>
              {!releaseToAll && selectedDomains.length > 0 && (
                <p className="text-xs text-emerald-600 mt-1 font-medium">{selectedDomains.length} domain{selectedDomains.length !== 1 ? 's' : ''} selected</p>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={handleSubmit} disabled={submitting || !form.course_name || !form.category}
            className="btn-primary flex-1 flex items-center justify-center gap-2">
            {isEdit ? <Pencil size={15} /> : <Plus size={15} />}
            {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Release Course'}
          </button>
          <button onClick={onClose} className="btn-secondary px-6">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── FH Request Modal (existing catalog course — with domain selector) ─────────
function FHCatalogRequestModal({ training, fhUser, onClose, onSubmit }) {
  const [domains, setDomains] = useState([]);
  const [selectedDomains, setSelectedDomains] = useState([]); // array of { department, manager_id, ... }
  const [businessNeed, setBusinessNeed] = useState('');
  const [skillGap, setSkillGap] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get(`/api/employees/${fhUser.employee_id}/managed-domains`)
      .then(r => {
        const list = Array.isArray(r.data) ? r.data : [];
        setDomains(list);
        // Auto-select if only one domain
        if (list.length === 1) setSelectedDomains([list[0]]);
      })
      .catch(() => setDomains([]));
  }, [fhUser.employee_id]);

  const toggleDomain = (domain) => {
    setSelectedDomains(prev => {
      const exists = prev.some(d => d.department === domain.department);
      return exists ? prev.filter(d => d.department !== domain.department) : [...prev, domain];
    });
  };

  const handleSubmit = async () => {
    if (selectedDomains.length === 0 || !businessNeed.trim() || !skillGap.trim()) {
      setError('Please select at least one domain and fill in all required fields.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      for (const domain of selectedDomains) {
        await onSubmit({
          manager_id: domain.manager_id,
          manager_name: domain.manager_name,
          manager_email: domain.manager_email,
          department: domain.department,
          business_unit: domain.department,
          training_id: training.training_id,
          course_name: training.course_name,
          business_need: businessNeed,
          skill_gap: skillGap,
          priority,
          participants: [],
          fh_id: fhUser.employee_id,
          fh_name: fhUser.name,
          requested_by_fh: true,
        });
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(Array.isArray(detail) ? detail.map(d => d.msg).join(' | ') : detail || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-6">
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800 text-base">Request Training for Domain</h3>
            <p className="text-xs text-slate-500 mt-0.5">{training.course_name} • {training.mode} • {training.duration}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}

          {/* Domain multi-select (checkboxes) */}
          <div>
            <label className="form-label">Domains <span className="text-red-500">*</span>
              <span className="text-slate-400 font-normal ml-1">(select one or more)</span>
            </label>
            {domains.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Loading domains…</p>
            ) : (
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                {domains.map(d => {
                  const checked = selectedDomains.some(s => s.department === d.department);
                  return (
                    <label key={d.department}
                      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${checked ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleDomain(d)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 accent-blue-600"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-800">{d.department}</p>
                        <p className="text-xs text-slate-500">Manager: {d.manager_name}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="form-label">Business Need / Purpose <span className="text-red-500">*</span></label>
            <textarea value={businessNeed} onChange={e => { setBusinessNeed(e.target.value); setError(''); }}
              rows={2} className="form-input resize-none" placeholder="Why do these domains need this training?" />
          </div>
          <div>
            <label className="form-label">Skill Gap Identified <span className="text-red-500">*</span></label>
            <input value={skillGap} onChange={e => { setSkillGap(e.target.value); setError(''); }}
              className="form-input" placeholder="Current vs required skill level" />
          </div>
          <div>
            <label className="form-label">Priority <span className="text-red-500">*</span></label>
            <select value={priority} onChange={e => setPriority(e.target.value)} className="form-select">
              {['High', 'Medium', 'Low'].map(p => <option key={p}>{p}</option>)}
            </select>
          </div>

          {selectedDomains.length > 0 && (
            <div className="flex items-start gap-2 bg-sky-50 border border-sky-100 rounded-xl px-4 py-3 text-xs text-sky-700">
              <Users size={13} className="flex-shrink-0 mt-0.5" />
              <span>
                Acknowledgement will be sent to {selectedDomains.map(d => <strong key={d.department}>{d.manager_name}</strong>).reduce((acc, el, i) => i === 0 ? [el] : [...acc, ', ', el], [])} and the L&D team.
                {selectedDomains.length > 1 && ` (${selectedDomains.length} separate requests will be created)`}
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={handleSubmit} disabled={submitting || selectedDomains.length === 0 || !businessNeed.trim() || !skillGap.trim()}
            className="btn-primary flex-1 flex items-center justify-center gap-2">
            <Send size={15} /> {submitting ? 'Submitting…' : `Submit to L&D${selectedDomains.length > 1 ? ` (${selectedDomains.length} domains)` : ''}`}
          </button>
          <button onClick={onClose} className="btn-secondary px-6">Cancel</button>
        </div>
      </div>
    </div>
  );
}


// ── Request Training Modal (for existing catalog course) ──────────────────────
function RequestModal({ training, onClose, onSubmit }) {
  const { user } = useAuth();
  const [teamName, setTeamName] = useState(user?.department || '');
  const [businessNeed, setBusinessNeed] = useState('');
  const [skillGap, setSkillGap] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [aiInsights, setAiInsights] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const validateFields = () => {
    const errs = {};
    const bnErr = validateText(businessNeed, { label: 'Business Need', minLen: 15 });
    if (bnErr) errs.businessNeed = bnErr;
    if (skillGap.trim()) {
      const sgErr = validateText(skillGap, { label: 'Skill Gap', minLen: 10 });
      if (sgErr) errs.skillGap = sgErr;
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAnalyzeNeed = async () => {
    if (!validateFields()) return;
    setAnalyzing(true);
    setError('');
    try {
      const { data } = await axios.post('/api/ai/analyze-learning-need', {
        team_domain: teamName,
        business_need: businessNeed,
        skill_gap: skillGap,
        course_name: training.course_name,
        user_priority: priority,
      });
      // Don't override user-set priority; only update if user left it at default
      if ((!skillGap || skillGap.trim().length < 3) && data.skill_gaps?.length) {
        setSkillGap(data.skill_gaps.join(', '));
      }
      setAiInsights([
        `Learning Need Analysis Agent: priority ${data.priority} (${data.priority_score}/100) — ${data.priority_reason}`,
        `Key objectives: ${(data.key_objectives || []).join('; ')}`,
        `Skill gaps: ${(data.skill_gaps || []).join(', ')}`,
      ]);
    } catch (err) {
      setError(err.response?.data?.detail || 'Learning Need Analysis Agent could not evaluate this request.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateFields()) return;
    setSubmitting(true);
    setError('');
    try {
      await onSubmit({
        manager_id: user.employee_id,
        manager_name: user.name,
        manager_email: user.email,
        department: teamName,
        business_unit: teamName,
        training_id: training.training_id,
        course_name: training.course_name,
        business_need: businessNeed,
        skill_gap: skillGap,
        priority,
        participants: [],
      });
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map(d => `${d.loc?.slice(-1)[0]}: ${d.msg}`).join(' | ')
        : detail || `Request failed (${err.response?.status || 'network error'})`;
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-6">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800 text-base">Request Training</h3>
            <p className="text-xs text-slate-500 mt-0.5">{training.course_name} • {training.mode} • {training.duration}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 mt-0.5"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl font-medium">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Team / Domain</label>
              <input value={teamName} readOnly
                className="form-input bg-slate-50 text-slate-700 cursor-default"
                title="Auto-filled from your profile" />
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Business Need / Purpose *</label>
              <textarea value={businessNeed}
                onChange={e => { setBusinessNeed(e.target.value); setFieldErrors(fe => ({ ...fe, businessNeed: undefined })); }}
                rows={2} className={`form-input resize-none ${fieldErrors.businessNeed ? 'border-red-400 bg-red-50' : ''}`}
                placeholder="Why does your team need this training? (e.g., Team needs advanced Python skills to build BI dashboards)" />
              {fieldErrors.businessNeed && <p className="text-xs text-red-600 mt-1">{fieldErrors.businessNeed}</p>}
            </div>
            <div>
              <label className="form-label">Skill Gap Identified</label>
              <input value={skillGap}
                onChange={e => { setSkillGap(e.target.value); setFieldErrors(fe => ({ ...fe, skillGap: undefined })); }}
                className={`form-input ${fieldErrors.skillGap ? 'border-red-400 bg-red-50' : ''}`}
                placeholder="e.g., Gap between current beginner and required intermediate Python level" />
              {fieldErrors.skillGap && <p className="text-xs text-red-600 mt-1">{fieldErrors.skillGap}</p>}
            </div>
            <div>
              <label className="form-label">Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value)} className="form-select">
                {['High', 'Medium', 'Low'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-violet-800">Learning Need Analysis</p>
              <p className="text-xs text-violet-600 mt-0.5">Scores urgency, refines objectives, and highlights the core skill gaps before submission.</p>
            </div>
            <button
              onClick={handleAnalyzeNeed}
              disabled={analyzing || !!validateText(businessNeed, { label: 'Business Need', minLen: 15 })}
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
              title={validateText(businessNeed, { label: 'Business Need', minLen: 15 }) || 'Run Learning Need Analysis'}
            >
              <Sparkles size={13} /> {analyzing ? 'Analyzing...' : ''}
            </button>
          </div>

          <AIInsightBox insights={aiInsights} />

        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button onClick={handleSubmit} disabled={submitting || !businessNeed || !teamName}
            className="btn-primary flex-1 flex items-center justify-center gap-2">
            <Send size={15} /> {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
          <button onClick={onClose} className="btn-secondary px-6">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── New Course Request Modal ───────────────────────────────────────────────────
function NewCourseModal({ onClose, onSubmit, user, isFHMode = false }) {
  const [form, setForm] = useState({
    course_name: '', category: '', mode: 'Online', duration: '',
    business_need: '', skill_gap: '', expected_participants: '',
    priority: 'Medium', additional_notes: '',
  });
  const [aiInsights, setAiInsights] = useState([]);
  const [recommendationResult, setRecommendationResult] = useState(null);
  const [courseSuggestionResult, setCourseSuggestionResult] = useState(null);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [recommendationBusy, setRecommendationBusy] = useState(false);
  const [suggestionBusy, setSuggestionBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const setF = (k, v) => { setForm(f => ({ ...f, [k]: v })); setFieldErrors(fe => ({ ...fe, [k]: undefined })); };
  const set = (k, v) => setF(k, v);

  const validateNewCourse = () => {
    const errs = {};
    if (!form.course_name.trim() || form.course_name.trim().length < 5)
      errs.course_name = 'Course name must be at least 5 characters.';
    const bnErr = validateText(form.business_need, { label: 'Business Need', minLen: 15 });
    if (bnErr) errs.business_need = bnErr;
    if (form.skill_gap.trim()) {
      const sgErr = validateText(form.skill_gap, { label: 'Skill Gap', minLen: 10 });
      if (sgErr) errs.skill_gap = sgErr;
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // FH mode: domain multi-selection
  const [domains, setDomains] = useState([]);
  const [selectedDomains, setSelectedDomains] = useState([]);
  useEffect(() => {
    if (!isFHMode) return;
    axios.get(`/api/employees/${user.employee_id}/managed-domains`)
      .then(r => {
        const list = Array.isArray(r.data) ? r.data : [];
        setDomains(list);
        if (list.length === 1) setSelectedDomains([list[0]]);
      })
      .catch(() => {});
  }, [isFHMode, user.employee_id]);

  const toggleDomainFH = (domain) => {
    setSelectedDomains(prev => {
      const exists = prev.some(d => d.department === domain.department);
      return exists ? prev.filter(d => d.department !== domain.department) : [...prev, domain];
    });
  };

  // RM mode: FH selection — auto-select the RM's direct FH via manager_id
  const [functionalHeads, setFunctionalHeads] = useState([]);
  const [selectedFH, setSelectedFH] = useState(null);
  useEffect(() => {
    if (isFHMode) return;
    axios.get('/api/employees')
      .then(r => {
        const allFhs = r.data.filter(e => e.role === 'functional_head');
        setFunctionalHeads(allFhs);
        // Auto-select the FH that is the RM's direct manager
        const myFH = allFhs.find(fh => fh.employee_id === user.manager_id);
        if (myFH) setSelectedFH(myFH);
      })
      .catch(() => {});
  }, [isFHMode, user.manager_id]);

  const runNeedAnalysis = async () => {
    if (!validateNewCourse()) return;
    setAnalysisBusy(true);
    try {
      const { data } = await axios.post('/api/ai/analyze-learning-need', {
        team_domain: user.department,
        business_need: form.business_need,
        skill_gap: form.skill_gap,
        course_name: form.course_name,
        user_priority: form.priority,
      });
      setForm(current => ({
        ...current,
        priority: data.priority || current.priority,
        skill_gap: current.skill_gap || (data.skill_gaps || []).join(', '),
      }));
      setAiInsights([
        `Learning Need Analysis Agent: priority ${data.priority} (${data.priority_score}/100) — ${data.priority_reason}`,
        `Objectives: ${(data.key_objectives || []).join('; ')}`,
        `Skill gaps: ${(data.skill_gaps || []).join(', ')}`,
      ]);
    } finally {
      setAnalysisBusy(false);
    }
  };

  const runCourseRecommendation = async () => {
    if (!validateNewCourse()) return;
    setRecommendationBusy(true);
    setRecommendationResult(null);
    try {
      const { data } = await axios.post('/api/ai/recommend-course-path', {
        course_name: form.course_name,
        business_need: form.business_need,
        skill_gap: form.skill_gap,
        category: form.category,
        mode: form.mode,
        duration: form.duration,
        expected_participants: parseInt(form.expected_participants) || 0,
        priority: form.priority,
        additional_notes: form.additional_notes,
      });
      setRecommendationResult(data);
    } finally {
      setRecommendationBusy(false);
    }
  };

  const runCourseSuggestion = async () => {
    if (!validateNewCourse()) return;
    setSuggestionBusy(true);
    setCourseSuggestionResult(null);
    try {
      const { data } = await axios.post('/api/ai/suggest-new-course', {
        course_name: form.course_name,
        business_need: form.business_need,
        skill_gap: form.skill_gap,
        mode: form.mode,
        duration: form.duration,
        priority: form.priority,
        additional_notes: form.additional_notes,
      });
      setCourseSuggestionResult(data);
    } finally {
      setSuggestionBusy(false);
    }
  };

  const applyRecommendationSuggestions = () => {
    if (!recommendationResult) return;
    const r = recommendationResult;
    setForm(f => ({
      ...f,
      ...(r.suggested_course_name ? { course_name: r.suggested_course_name } : {}),
      ...(r.suggested_duration ? { duration: r.suggested_duration } : {}),
      ...(r.priority_assessment ? { priority: r.priority_assessment } : {}),
    }));
  };

  const handleSubmit = async () => {
    if (!validateNewCourse()) return;
    if (isFHMode && selectedDomains.length === 0) return;
    if (!isFHMode && !selectedFH) return;
    setSubmitting(true);
    try {
      if (isFHMode) {
        // Submit one course request per selected domain
        for (const domain of selectedDomains) {
          await onSubmit({
            manager_id: domain.manager_id,
            manager_name: domain.manager_name,
            manager_email: domain.manager_email,
            department: domain.department,
            business_unit: domain.department,
            fh_id: user.employee_id,
            fh_name: user.name,
            ...form,
            expected_participants: parseInt(form.expected_participants) || 1,
            requested_by_rm: false,
            requested_by_fh: true,
          });
        }
      } else {
        await onSubmit({
          manager_id: user.employee_id,
          manager_name: user.name,
          manager_email: user.email,
          department: user.department,
          business_unit: user.business_unit || user.department,
          fh_id: selectedFH?.employee_id || '',
          fh_name: selectedFH?.name || '',
          ...form,
          expected_participants: parseInt(form.expected_participants) || 1,
          requested_by_rm: true,
          requested_by_fh: false,
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-6">
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800 text-base">{isFHMode ? 'Request New Course for Domain' : 'Request New Course'}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{isFHMode ? 'Raise a new course request on behalf of a domain' : 'Request a training course not in the current catalog'}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        <div className="p-6">
          {/* FH domain multi-select checkboxes (FH mode) */}
          {isFHMode && (
            <div className="mb-5">
              <label className="form-label">Domains <span className="text-red-500">*</span>
                <span className="text-slate-400 font-normal ml-1">(select one or more)</span>
              </label>
              {domains.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Loading domains…</p>
              ) : (
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                  {domains.map(d => {
                    const checked = selectedDomains.some(s => s.department === d.department);
                    return (
                      <label key={d.department}
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${checked ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleDomainFH(d)}
                          className="w-4 h-4 rounded border-slate-300 accent-blue-600"
                        />
                        <div>
                          <p className="text-sm font-medium text-slate-800">{d.department}</p>
                          <p className="text-xs text-slate-500">Manager: {d.manager_name}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
              {selectedDomains.length > 1 && (
                <p className="text-xs text-blue-600 mt-1.5 font-medium">
                  {selectedDomains.length} separate requests will be created, one per domain.
                </p>
              )}
            </div>
          )}

          {/* FH info (RM mode) — shows auto-resolved FH or dropdown if ambiguous */}
          {!isFHMode && (
            <div className="mb-5 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
              <p className="text-xs font-semibold text-indigo-700 mb-1">Submitting to Functional Head</p>
              {selectedFH && user.manager_id ? (
                <p className="text-sm font-medium text-indigo-900">{selectedFH.name}</p>
              ) : (
                <select
                  className="form-select"
                  value={selectedFH?.employee_id || ''}
                  onChange={e => setSelectedFH(functionalHeads.find(f => f.employee_id === e.target.value) || null)}
                >
                  <option value="">Select Functional Head…</option>
                  {functionalHeads.map(fh => (
                    <option key={fh.employee_id} value={fh.employee_id}>
                      {fh.name}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-xs text-indigo-600 mt-1.5">This request will go to the FH for approval before reaching L&D.</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="form-label">Course Name *</label>
              <input value={form.course_name} onChange={e => set('course_name', e.target.value)}
                className={`form-input ${fieldErrors.course_name ? 'border-red-400 bg-red-50' : ''}`}
                placeholder="e.g. Advanced Power Platform Development" required />
              {fieldErrors.course_name && <p className="text-xs text-red-600 mt-1">{fieldErrors.course_name}</p>}
            </div>
            <div>
              <label className="form-label">Category *</label>
              <select value={form.category} onChange={e => set('category', e.target.value)} className="form-select">
                <option value="">Select Category</option>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Preferred Mode</label>
              <select value={form.mode} onChange={e => set('mode', e.target.value)} className="form-select">
                {MODES.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Expected Duration</label>
              <input value={form.duration} onChange={e => set('duration', e.target.value)}
                className="form-input" placeholder="e.g. 2 Days" />
            </div>
            <div>
              <label className="form-label">Expected Participants</label>
              <input type="number" min="1" value={form.expected_participants} onChange={e => set('expected_participants', e.target.value)}
                className="form-input" placeholder="Number of employees" />
            </div>
            <div>
              <label className="form-label">Priority</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)} className="form-select">
                {['High', 'Medium', 'Low'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Business Need / Justification *</label>
              <textarea value={form.business_need} onChange={e => set('business_need', e.target.value)}
                rows={2} className={`form-input resize-none ${fieldErrors.business_need ? 'border-red-400 bg-red-50' : ''}`}
                placeholder="e.g. Team requires Power Platform skills to automate internal workflows and reduce manual effort" required />
              {fieldErrors.business_need && <p className="text-xs text-red-600 mt-1">{fieldErrors.business_need}</p>}
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Skill Gap Identified</label>
              <textarea value={form.skill_gap} onChange={e => set('skill_gap', e.target.value)}
                rows={2} className={`form-input resize-none ${fieldErrors.skill_gap ? 'border-red-400 bg-red-50' : ''}`}
                placeholder="e.g. Current skill level is beginner; need intermediate Power Apps and Power Automate proficiency" />
              {fieldErrors.skill_gap && <p className="text-xs text-red-600 mt-1">{fieldErrors.skill_gap}</p>}
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Additional Notes</label>
              <textarea value={form.additional_notes} onChange={e => set('additional_notes', e.target.value)}
                rows={2} className="form-input resize-none" placeholder="Any specific requirements, preferred trainers, etc." />
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
<div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
              <p className="text-sm font-semibold text-indigo-800">Course Recommendation</p>
              <p className="mt-1 text-xs text-indigo-600">Checks catalog matches and suggests whether to reuse an existing course or build a new one.</p>
              <button
                onClick={runCourseRecommendation}
                disabled={recommendationBusy || !!validateText(form.business_need, { label: 'Business Need', minLen: 15 }) || form.course_name.trim().length < 5}
                className="mt-3 flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                title="Fill in valid Course Name and Business Need to run this agent"
              >
                <Sparkles size={13} /> {recommendationBusy ? 'Evaluating…' : 'Get Recommendation'}
              </button>
            </div>
          </div>

          <AIInsightBox insights={aiInsights} />


          {recommendationResult && (
            <div className="mt-4 rounded-xl border border-indigo-200 bg-white shadow-sm overflow-hidden">
              {/* Header */}
              <div className={`flex items-center justify-between px-4 py-3 ${recommendationResult.decision === 'reuse_existing' ? 'bg-amber-50 border-b border-amber-200' : 'bg-green-50 border-b border-green-200'}`}>
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className={recommendationResult.decision === 'reuse_existing' ? 'text-amber-600' : 'text-green-600'} />
                  <span className="text-xs font-bold text-slate-700">Course Recommendation Result</span>
                </div>
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${recommendationResult.decision === 'reuse_existing' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                  {recommendationResult.decision === 'reuse_existing' ? '♻ Reuse Existing Course' : '✦ Create New Course'}
                </span>
              </div>

              <div className="p-4 space-y-4">
                {/* Assessment */}
                {(recommendationResult.reason || recommendationResult.guidance) && (
                  <div>
                    <p className="text-xs font-semibold text-slate-600 mb-1">Assessment</p>
                    <p className="text-xs text-slate-700 leading-relaxed">{recommendationResult.reason}</p>
                    {recommendationResult.guidance && (
                      <p className="text-xs text-slate-500 leading-relaxed mt-1">{recommendationResult.guidance}</p>
                    )}
                  </div>
                )}

                {/* Catalog match section — only show if there's a genuinely good match */}
                {recommendationResult.catalog_has_good_match && (recommendationResult.top_matches || []).length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-xs font-semibold text-slate-600">Catalog Comparison</p>
                      {!recommendationResult.catalog_has_good_match && (
                        <span className="text-[10px] bg-red-100 text-red-600 font-semibold px-2 py-0.5 rounded-full">No suitable match found</span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {(recommendationResult.top_matches || []).map((m, i) => {
                        const pct = Math.round((m.similarity || 0) * 100);
                        const isWeak = pct < 50;
                        return (
                          <div key={i} className={`flex items-center justify-between rounded-lg px-3 py-2 border ${isWeak ? 'bg-slate-50 border-slate-100' : 'bg-amber-50 border-amber-100'}`}>
                            <div>
                              <span className="text-xs text-slate-700 font-medium">{m.course_name}</span>
                              {m.skill_tags && <p className="text-[10px] text-slate-400 mt-0.5">{m.skill_tags}</p>}
                            </div>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${isWeak ? 'bg-slate-200 text-slate-500' : 'bg-amber-100 text-amber-700'}`}>
                              {pct}% match
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}


                {/* Learning objectives (shown for both decisions) */}
                {(recommendationResult.suggested_objectives || []).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-600 mb-1">Learning Objectives</p>
                    <ul className="space-y-0.5">
                      {recommendationResult.suggested_objectives.map((o, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-indigo-400 mt-0.5">•</span>
                          <span className="text-xs text-slate-700">{o}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Priority + Next steps */}
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-slate-600">Suggested Priority:</p>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    (recommendationResult.priority_assessment || '').includes('High') ? 'bg-red-100 text-red-700' :
                    (recommendationResult.priority_assessment || '').includes('Medium') ? 'bg-yellow-100 text-yellow-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>{recommendationResult.priority_assessment}</span>
                </div>

                {(recommendationResult.next_steps || []).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-600 mb-1.5">Next Steps</p>
                    <ol className="space-y-1">
                      {recommendationResult.next_steps.map((s, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="flex-shrink-0 w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                          <span className="text-xs text-slate-700">{s}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button onClick={handleSubmit} disabled={submitting || (isFHMode && selectedDomains.length === 0) || (!isFHMode && !selectedFH)}
            className="btn-primary flex-1 flex items-center justify-center gap-2">
            <Send size={15} /> {submitting ? 'Submitting...' : isFHMode
              ? `Submit to L&D${selectedDomains.length > 1 ? ` (${selectedDomains.length} domains)` : ''}`
              : `Submit to ${selectedFH?.name || 'FH'} for Approval`}
          </button>
          <button onClick={onClose} className="btn-secondary px-6">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Catalog Page ─────────────────────────────────────────────────────────
export default function TrainingCatalog() {
  const { user } = useAuth();
  const isFH = user?.role === 'functional_head';
  const isManager = user?.role === 'reporting_manager';
  const isEmployee = user?.role === 'employee';

  const isLD = user?.role === 'ld_team';
  const [trainings, setTrainings] = useState([]);
  const [nominationCounts, setNominationCounts] = useState({});
  const [filter, setFilter] = useState('');
  const [modeFilter, setModeFilter] = useState('All');
  const [requestModal, setRequestModal] = useState(null);
  const [fhRequestModal, setFhRequestModal] = useState(null); // existing course, FH flow
  const [showNewCourse, setShowNewCourse] = useState(false);
  const [showFHNewCourse, setShowFHNewCourse] = useState(false); // new course, FH flow
  const [courseFormModal, setCourseFormModal] = useState(null);
  const [toast, setToast] = useState(null);

  const loadData = () => {
    axios.get('/api/trainings')
      .then(r => setTrainings(Array.isArray(r.data) ? r.data : []))
      .catch(() => setTrainings([]));
    axios.get('/api/trainings/seat-counts')
      .then(r => setNominationCounts(typeof r.data === 'object' ? r.data : {}))
      .catch(() => setNominationCounts({}));
  };

  useEffect(() => { loadData(); }, []);

  const filtered = trainings.filter(t => {
    const q = filter.toLowerCase();
    const matchesSearch = !q ||
      (t.course_name || '').toLowerCase().includes(q) ||
      (t.category || '').toLowerCase().includes(q) ||
      (t.trainer_name || '').toLowerCase().includes(q);
    const matchesMode = modeFilter === 'All' || t.mode === modeFilter;
    return matchesSearch && matchesMode;
  });

  const handleRequestSubmit = async (payload) => {
    try {
      await axios.post('/api/nominations', payload);
      setRequestModal(null);
      loadData();
      setToast({ msg: `Training request submitted for "${payload.course_name}" — sent to L&D for validation`, type: 'success' });
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map(d => d.msg).join(', ')
        : detail || 'Failed to submit. Please try again.';
      setToast({ msg, type: 'error' });
      throw err;
    }
  };

  const handleNewCourseSubmit = async (payload) => {
    // Called once per domain from NewCourseModal loop (FH mode) or once (RM mode)
    await axios.post('/api/course-requests', payload);
    setShowNewCourse(false);
    setShowFHNewCourse(false);
    const successMsg = payload.requested_by_rm
      ? `New course request for "${payload.course_name}" sent to ${payload.fh_name || 'Functional Head'} for approval.`
      : `New course request for "${payload.course_name}" sent to L&D — acknowledgement sent to ${payload.manager_name} (${payload.department})`;
    setToast({ msg: successMsg, type: 'success' });
  };

  const handleFHCatalogSubmit = async (payload) => {
    // Called once per domain from FHCatalogRequestModal loop
    await axios.post('/api/nominations', payload);
    // Close modal + reload on the final call (modal handles the loop so this fires per domain)
    setFhRequestModal(null);
    loadData();
    setToast({ msg: `Training request for "${payload.course_name}" submitted to L&D — acknowledgement sent to ${payload.manager_name} (${payload.department})`, type: 'success' });
  };

  const handleCourseFormSubmit = async (payload, trainingId) => {
    const body = { ...payload, performed_by: user.name, role: user.role };
    try {
      if (trainingId) {
        await axios.put(`/api/trainings/${trainingId}`, body);
        setToast({ msg: `Course "${payload.course_name}" updated`, type: 'success' });
      } else {
        await axios.post('/api/trainings', body);
        let domains = [];
        try { domains = JSON.parse(payload.released_to_domains || '[]'); } catch (_) {}
        const domainMsg = domains.length > 0
          ? ` Notifications sent to FH & RM of ${domains.length} domain${domains.length !== 1 ? 's' : ''}.`
          : '';
        setToast({ msg: `Course "${payload.course_name}" released to Training Catalog.${domainMsg}`, type: 'success' });
      }
      setCourseFormModal(null);
      axios.get('/api/trainings').then(r => setTrainings(r.data));
    } catch (err) {
      setToast({ msg: err.response?.data?.detail || 'Failed to save course. Please try again.', type: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {requestModal && (
        <RequestModal
          training={requestModal}
          onClose={() => setRequestModal(null)}
          onSubmit={handleRequestSubmit}
        />
      )}
      {fhRequestModal && (
        <FHCatalogRequestModal
          training={fhRequestModal}
          fhUser={user}
          onClose={() => setFhRequestModal(null)}
          onSubmit={handleFHCatalogSubmit}
        />
      )}
      {showNewCourse && (
        <NewCourseModal
          user={user}
          onClose={() => setShowNewCourse(false)}
          onSubmit={handleNewCourseSubmit}
        />
      )}
      {showFHNewCourse && (
        <NewCourseModal
          user={user}
          isFHMode={true}
          onClose={() => setShowFHNewCourse(false)}
          onSubmit={handleNewCourseSubmit}
        />
      )}
      {courseFormModal !== null && (
        <CourseFormModal
          course={courseFormModal === 'new' ? null : courseFormModal}
          onClose={() => setCourseFormModal(null)}
          onSubmit={handleCourseFormSubmit}
        />
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Training Catalog</h1>
          <p className="text-slate-500 text-sm mt-1">{trainings.length} courses available</p>
        </div>
        <div className="flex gap-2">
          {isLD && (
            <button onClick={() => setCourseFormModal('new')}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm">
              <Plus size={17} /> Release Course
            </button>
          )}
          {isManager && (
            <button onClick={() => setShowNewCourse(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm">
              <Plus size={17} /> Request New Course
            </button>
          )}
          {isFH && (
            <button onClick={() => setShowFHNewCourse(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm">
              <Plus size={17} /> Request New Course for Domain
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card !p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={filter} onChange={e => setFilter(e.target.value)}
            placeholder="Search by course, category or trainer..."
            className="form-input pl-9" />
        </div>
        <select value={modeFilter} onChange={e => setModeFilter(e.target.value)} className="form-select sm:w-40">
          <option value="All">All Modes</option>
          <option value="Online">Online</option>
          <option value="Offline">Offline</option>
          <option value="Hybrid">Hybrid</option>
        </select>
      </div>

      {/* Course Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtered.map(t => {
          const ModeIcon = modeIcon[t.mode] || Monitor;
          return (
            <div key={t.training_id} className="card hover:shadow-md transition-shadow flex flex-col">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0 pr-2">
                  {(() => {
                    // "New Release" badge: course released by L&D within last 7 days, targeting user's domain
                    let showNewRelease = false;
                    try {
                      if (t.released_to_domains && t.release_date) {
                        const releasedDomains = JSON.parse(t.released_to_domains || '[]');
                        const daysOld = (Date.now() - new Date(t.release_date).getTime()) / (1000 * 60 * 60 * 24);
                        if (daysOld <= 7 && releasedDomains.length > 0) {
                          showNewRelease = isLD || releasedDomains.includes(user?.department);
                        }
                      }
                    } catch (_) {}
                    return (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-slate-400 font-mono">{t.training_id}</span>
                        {t.source_request_id && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                            ✦ New Course
                          </span>
                        )}
                        {showNewRelease && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 animate-pulse">
                            🎯 New Release
                          </span>
                        )}
                      </div>
                    );
                  })()}
                  <h3 className="text-base font-bold text-slate-800 mt-0.5 leading-snug">{t.course_name}</h3>
                </div>
                <StatusBadge status={t.status} />
              </div>

              {/* Meta row: category · duration · mode */}
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <BookOpen size={12} className="text-slate-400" /> {t.category}
                </span>
                <span className="text-slate-300 text-xs">|</span>
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Clock size={12} className="text-slate-400" /> {t.duration}
                </span>
                <span className="text-slate-300 text-xs">|</span>
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${modeColor[t.mode] || 'text-slate-600 bg-slate-100'}`}>
                  <ModeIcon size={11} /> {t.mode}
                </span>
              </div>

              {/* Trainer + Date */}
              {(t.trainer_name || t.training_date) && (
                <p className="text-xs text-slate-500 mb-2">
                  <span className="font-medium">{t.trainer_name || 'Trainer TBD'}</span>
                  {t.training_date ? ` · ${new Date(t.training_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                </p>
              )}

              {/* Seats */}
              {(() => {
                const totalSeats = 30;
                const enrolled = nominationCounts[t.training_id] || 0;
                const available = Math.max(0, totalSeats - enrolled);
                const pct = Math.round((enrolled / totalSeats) * 100);
                return (
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Users size={12} className="text-slate-400" />
                        <span className={available === 0 ? 'text-red-500 font-semibold' : available <= 5 ? 'text-amber-600 font-semibold' : ''}>
                          {available} of {totalSeats} seats available
                        </span>
                      </span>
                      <span className="text-[11px] text-slate-400">{enrolled} enrolled</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-red-400' : pct >= 70 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Skill tags */}
              <div className="flex flex-wrap gap-1 mb-4">
                {(t.skill_tags || '').split(',')
                  .map(tag => tag.replace(/^(and|or|also)\s+/i, '').trim())
                  .filter(tag => tag.length >= 2 && tag.split(' ').length <= 6)
                  .map(tag => (
                    <span key={tag} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{tag}</span>
                  ))
                }
              </div>

              {/* Role-specific action buttons */}
              <div className="mt-auto pt-3 border-t border-slate-100 flex flex-col gap-2">
                {isManager && (() => {
                  const curriculumUrl = t.curriculum_file_url || t.curriculum_link || (t.curriculum_file_name ? `/api/curriculum-files/${t.curriculum_file_name}` : '');
                  return (
                    <>
                      {curriculumUrl ? (
                        <a
                          href={curriculumUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg font-semibold text-sm transition-colors"
                        >
                          <BookOpen size={15} /> View Curriculum
                        </a>
                      ) : (
                        <span className="w-full flex items-center justify-center gap-2 bg-slate-50 text-slate-400 py-2 rounded-lg text-sm border border-dashed border-slate-200 cursor-not-allowed">
                          <BookOpen size={15} /> Curriculum Not Uploaded
                        </span>
                      )}
                      <button
                        onClick={() => setRequestModal(t)}
                        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold text-sm transition-colors"
                      >
                        <Send size={15} /> Request for Team
                      </button>
                    </>
                  );
                })()}
                {isFH && (() => {
                  const curriculumUrl = t.curriculum_file_url || t.curriculum_link || (t.curriculum_file_name ? `/api/curriculum-files/${t.curriculum_file_name}` : '');
                  return (
                    <>
                      {curriculumUrl ? (
                        <a
                          href={curriculumUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg font-semibold text-sm transition-colors"
                        >
                          <BookOpen size={15} /> View Curriculum
                        </a>
                      ) : (
                        <span className="w-full flex items-center justify-center gap-2 bg-slate-50 text-slate-400 py-2 rounded-lg text-sm border border-dashed border-slate-200 cursor-not-allowed">
                          <BookOpen size={15} /> Curriculum Not Uploaded
                        </span>
                      )}
                      <button
                        onClick={() => setFhRequestModal(t)}
                        className="w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white py-2 rounded-lg font-semibold text-sm transition-colors"
                      >
                        <Send size={15} /> Request for Domain
                      </button>
                    </>
                  );
                })()}
                {isLD && (
                  <button onClick={() => setCourseFormModal(t)}
                    className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg font-semibold text-sm transition-colors">
                    <Pencil size={14} /> Edit Course
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No trainings found</p>
        </div>
      )}
    </div>
  );
}
