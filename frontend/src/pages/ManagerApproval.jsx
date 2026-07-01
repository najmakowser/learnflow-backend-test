import { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Search, CheckCircle, XCircle, Eye, CheckSquare, Upload, Users, Plus, X, BookOpen, AlertCircle, FileText, Download, ArrowRight, Sparkles, Loader2 } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import Toast from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { SkeletonTable } from '../components/Skeleton';

const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];

const FILE_ICON_COLOR = {
  pdf: 'text-red-500', doc: 'text-blue-600', docx: 'text-blue-600',
  ppt: 'text-orange-500', pptx: 'text-orange-500',
  xls: 'text-green-600', xlsx: 'text-green-600',
  zip: 'text-yellow-600', mp4: 'text-purple-500', default: 'text-slate-500'
};
const fileExt = name => (name?.split('.').pop()?.toLowerCase()) || 'default';
const fileSize = bytes => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes/1024).toFixed(1)} KB` : `${(bytes/1048576).toFixed(1)} MB`;

const escapeHtml = value => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const formatList = items => (items?.length ? items.join(', ') : 'None');
const sanitizeFileName = value => (value || 'curriculum')
  .replace(/[\\/:*?"<>|]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

function buildCurriculumDocumentHtml({ item, title, outline, data }) {
  const modules = data?.modules?.length
    ? data.modules.map((module, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(module.module_name)}</td>
        <td>${escapeHtml(module.description)}</td>
        <td>${escapeHtml(module.duration)}</td>
      </tr>`).join('')
    : '<tr><td>1</td><td colspan="3">Module details not available</td></tr>';

  const topics = data?.recommended_topics?.length
    ? data.recommended_topics.map(topic => `<li>${escapeHtml(topic)}</li>`).join('')
    : '<li>Topics to be finalized by L&D</li>';

  const outcomes = data?.expected_outcomes?.length
    ? data.expected_outcomes.map(outcome => `<li>${escapeHtml(outcome)}</li>`).join('')
    : '<li>Expected outcomes to be finalized by L&D</li>';

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: Calibri, Arial, sans-serif; color: #1f2937; margin: 32px; line-height: 1.45; }
      h1 { font-size: 22px; margin-bottom: 8px; color: #1e3a8a; }
      h2 { font-size: 14px; margin: 24px 0 8px; color: #4338ca; text-transform: uppercase; letter-spacing: 0.06em; }
      p { margin: 6px 0; }
      .meta { width: 100%; border-collapse: collapse; margin-top: 16px; }
      .meta td { border: 1px solid #cbd5e1; padding: 8px 10px; vertical-align: top; }
      .meta td:first-child { width: 180px; font-weight: 700; background: #eff6ff; }
      .modules { width: 100%; border-collapse: collapse; margin-top: 8px; }
      .modules th, .modules td { border: 1px solid #cbd5e1; padding: 8px 10px; vertical-align: top; }
      .modules th { background: #eef2ff; text-align: left; }
      ul { margin: 8px 0 0 18px; }
      .outline { white-space: pre-wrap; border: 1px solid #cbd5e1; background: #f8fafc; padding: 12px; border-radius: 8px; }
      .footnote { margin-top: 28px; font-size: 11px; color: #64748b; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <p><strong>Standard Curriculum Format</strong></p>
    <table class="meta">
      <tr><td>Request ID</td><td>${escapeHtml(item.id)}</td></tr>
      <tr><td>Course</td><td>${escapeHtml(item.course)}</td></tr>
      <tr><td>Request Type</td><td>${escapeHtml(item.type)}</td></tr>
      <tr><td>Department</td><td>${escapeHtml(item.department || data?.team_domain || '')}</td></tr>
      <tr><td>Target Audience</td><td>${escapeHtml(data?.target_audience || 'To be confirmed')}</td></tr>
      <tr><td>Learning Objective</td><td>${escapeHtml(data?.learning_objective || '')}</td></tr>
      <tr><td>Training Mode</td><td>${escapeHtml(data?.training_mode || 'To be confirmed')}</td></tr>
      <tr><td>Priority</td><td>${escapeHtml(data?.priority || 'To be confirmed')}</td></tr>
      <tr><td>Prerequisites</td><td>${escapeHtml(formatList(data?.prerequisites))}</td></tr>
      <tr><td>Assessment Method</td><td>${escapeHtml(data?.assessment_method || 'To be confirmed')}</td></tr>
      <tr><td>Certification</td><td>${escapeHtml(data?.certification_recommendation || 'To be confirmed')}</td></tr>
      <tr><td>Business Impact</td><td>${escapeHtml(data?.business_impact || 'To be confirmed')}</td></tr>
    </table>

    <h2>Topics Covered</h2>
    <ul>${topics}</ul>

    <h2>Modules</h2>
    <table class="modules">
      <thead>
        <tr>
          <th style="width: 48px;">#</th>
          <th style="width: 220px;">Module</th>
          <th>Description</th>
          <th style="width: 120px;">Duration</th>
        </tr>
      </thead>
      <tbody>${modules}</tbody>
    </table>

    <h2>Expected Outcomes</h2>
    <ul>${outcomes}</ul>

    <h2>Detailed Outline</h2>
    <div class="outline">${escapeHtml(outline)}</div>

    <p class="footnote">Generated from the LMS curriculum template on ${new Date().toLocaleDateString()}.</p>
  </body>
</html>`;
}

function createCurriculumDocumentFile({ item, title, outline, data }) {
  const html = buildCurriculumDocumentHtml({ item, title, outline, data });
  const blob = new Blob([html], { type: 'application/msword' });
  const fileName = `${sanitizeFileName(title || item.course || 'curriculum')} Standard Curriculum.doc`;
  return new File([blob], fileName, { type: 'application/msword' });
}

function triggerFileDownload(file) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ── Curriculum Upload Modal (L&D) ─────────────────────────────────────────────
function buildOutline(data) {
  return [
    `Learning Objective: ${data.learning_objective || ''}`,
    '',
    `Target Audience: ${data.target_audience || ''}`,
    `Training Mode: ${data.training_mode || ''} | Priority: ${data.priority || ''}`,
    '',
    '--- MODULES ---',
    ...(data.modules || []).map((m, i) => `${i + 1}. ${m.module_name} (${m.duration})\n   ${m.description}`),
    '',
    `Prerequisites: ${(data.prerequisites || []).join(', ') || 'None'}`,
    '',
    '--- EXPECTED OUTCOMES ---',
    ...(data.expected_outcomes || []).map(o => `• ${o}`),
    '',
    `Assessment: ${data.assessment_method || ''}`,
    `Certification: ${data.certification_recommendation || ''}`,
    '',
    `Business Impact: ${data.business_impact || ''}`,
  ].join('\n');
}

function CurriculumModal({ item, onClose, onSubmit }) {
  const [form, setForm] = useState({ curriculum_title: '', curriculum_outline: '', curriculum_link: '' });
  const [attachedFile, setAttachedFile] = useState(null);
  const [autoGeneratedAttachment, setAutoGeneratedAttachment] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState(null);         // raw AI JSON
  const [generatedCurriculumData, setGeneratedCurriculumData] = useState(null);
  const [previewTitle, setPreviewTitle] = useState(''); // editable in preview
  const [previewOutline, setPreviewOutline] = useState(''); // editable in preview
  const [trainerRecommendations, setTrainerRecommendations] = useState([]);
  const [trainerBusy, setTrainerBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef();
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleGenerate = async () => {
    setGenerating(true);
    setPreview(null);
    setAiError('');
    try {
      const { data } = await axios.post('/api/ai/generate-curriculum', {
        team_domain: [item.raw?.department, item.raw?.business_unit].filter(Boolean).join(' — '),
        business_need: item.raw?.business_need || item.raw?.reason || item.course || '',
        skill_gap: item.raw?.skill_gap || item.raw?.expected_outcome || '',
        course_name: item.course || '',
        entity_id: item.id,
        entity_type: item.kind === 'reg' ? 'Registration' : item.kind === 'nom' ? 'Nomination' : 'Course Request',
      });
      setPreview(data);
      setGeneratedCurriculumData(data);
      setPreviewTitle(data.curriculum_title || '');
      setPreviewOutline(buildOutline(data));
    } catch (err) {
      setAiError(err.response?.data?.detail || 'Generation failed. You can still fill in the fields manually.');
    } finally {
      setGenerating(false);
    }
  };

  const attachGeneratedFile = ({ title, outline, shouldDownload = false }) => {
    const generatedFile = createCurriculumDocumentFile({
      item,
      title,
      outline,
      data: generatedCurriculumData || preview,
    });
    setAttachedFile(generatedFile);
    setAutoGeneratedAttachment(true);
    if (shouldDownload) triggerFileDownload(generatedFile);
  };

  const applyPreview = () => {
    set('curriculum_title', previewTitle);
    set('curriculum_outline', previewOutline);
    attachGeneratedFile({ title: previewTitle, outline: previewOutline });
    setPreview(null);
  };

  const handleFile = file => {
    if (!file) return;
    setAttachedFile(file);
    setAutoGeneratedAttachment(false);
    if (!form.curriculum_title) set('curriculum_title', file.name.replace(/\.[^.]+$/, ''));
  };

  const onDrop = e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); };

  const handleTrainerRecommendation = async () => {
    setTrainerBusy(true);
    try {
      const { data } = await axios.post('/api/ai/recommend-trainers', {
        course_name: item.course,
        category: item.raw?.category || '',
        skill_gap: item.raw?.skill_gap || item.raw?.business_need || item.raw?.reason || '',
        entity_id: item.id,
        entity_type: item.kind === 'reg' ? 'Registration' : item.kind === 'nom' ? 'Nomination' : 'Course Request',
      });
      setTrainerRecommendations(data.recommendations || []);
    } catch (err) {
      setAiError(err.response?.data?.detail || 'Trainer Recommendation Agent could not rank trainers right now.');
    } finally {
      setTrainerBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.curriculum_title) return;
    setSubmitting(true);
    setError('');
    try {
      let fileData = null;
      const fileToUpload = autoGeneratedAttachment
        ? createCurriculumDocumentFile({
            item,
            title: form.curriculum_title,
            outline: form.curriculum_outline,
            data: generatedCurriculumData,
          })
        : attachedFile;

      if (fileToUpload) {
        fileData = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = e => resolve({ name: fileToUpload.name, data: e.target.result.split(',')[1], mime: fileToUpload.type });
          reader.onerror = reject;
          reader.readAsDataURL(fileToUpload);
        });
      }
      await onSubmit(item, { ...form, curriculum_link: '', file_data: fileData });
    } catch (err) {
      setError(err.response?.data?.detail || `Upload failed (${err.response?.status || 'network error'}). Please try again.`);
    } finally {
      setSubmitting(false);
    }
  };

  const ext = fileExt(attachedFile?.name);
  const iconColor = FILE_ICON_COLOR[ext] || FILE_ICON_COLOR.default;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-6">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800">Upload Curriculum</h3>
            <p className="text-xs text-slate-500 mt-0.5">{item.course} — {item.id}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              {generating
                ? <><Loader2 size={12} className="animate-spin" /> Generating...</>
                : <><Sparkles size={12} /> Generate Curriculum</>}
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 ml-1"><X size={20} /></button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Manager rejection notice */}
          {item.raw?.status === 'Curriculum Rejected' && (item.raw?.curriculum_rejection_comment || item.raw?.curriculum_rejection_reason) && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-red-700">Manager rejected the previous curriculum</p>
                <p className="text-xs text-red-600 mt-0.5">{item.raw.curriculum_rejection_comment || item.raw.curriculum_rejection_reason}</p>
                <p className="text-[11px] text-red-400 mt-1">Please address this feedback before re-uploading.</p>
              </div>
            </div>
          )}
          {/* Errors */}
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl font-medium">{error}</div>}
          {aiError && <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2.5 rounded-xl">{aiError}</div>}

          {/* ── AI Preview Panel ── */}
          {preview && (
            <div className="border-2 border-violet-300 rounded-2xl overflow-hidden">
              {/* Preview header */}
              <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white">
                  <Sparkles size={15} />
                  <span className="font-bold text-sm">AI-Generated Curriculum Preview</span>
                  <span className="text-violet-200 text-xs">— review &amp; edit before applying</span>
                </div>
                <button onClick={() => setPreview(null)} className="text-violet-200 hover:text-white"><X size={16} /></button>
              </div>

              <div className="bg-violet-50 p-5 space-y-4">
                {/* Editable Title */}
                <div>
                  <label className="text-[11px] font-bold text-violet-500 uppercase tracking-wider">Curriculum Title</label>
                  <input
                    value={previewTitle}
                    onChange={e => setPreviewTitle(e.target.value)}
                    className="mt-1 w-full text-sm font-semibold text-slate-800 bg-white border border-violet-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>

                {/* Topics */}
                {preview.recommended_topics?.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold text-violet-500 uppercase tracking-wider mb-1.5">Topics Covered</p>
                    <div className="flex flex-wrap gap-1.5">
                      {preview.recommended_topics.map((t, i) => (
                        <span key={i} className="bg-violet-100 text-violet-700 border border-violet-200 px-2.5 py-0.5 rounded-full text-[11px] font-medium">{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Modules */}
                {preview.modules?.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold text-violet-500 uppercase tracking-wider mb-1.5">Modules ({preview.modules.length})</p>
                    <div className="space-y-1.5">
                      {preview.modules.map((m, i) => (
                        <div key={i} className="flex items-start gap-2.5 bg-white border border-violet-100 rounded-lg px-3 py-2">
                          <span className="w-5 h-5 bg-violet-600 text-white rounded text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-800">{m.module_name} <span className="text-violet-500 font-normal">({m.duration})</span></p>
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{m.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Outcomes */}
                {preview.expected_outcomes?.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold text-violet-500 uppercase tracking-wider mb-1.5">Expected Outcomes</p>
                    <ul className="space-y-1">
                      {preview.expected_outcomes.map((o, i) => (
                        <li key={i} className="flex items-start gap-2 text-[11px] text-slate-700">
                          <span className="text-violet-500 font-bold flex-shrink-0 mt-0.5">•</span>{o}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Editable Outline */}
                <div>
                  <label className="text-[11px] font-bold text-violet-500 uppercase tracking-wider">Full Outline <span className="text-violet-400 font-normal normal-case">(editable)</span></label>
                  <textarea
                    value={previewOutline}
                    onChange={e => setPreviewOutline(e.target.value)}
                    rows={8}
                    className="mt-1 w-full text-xs text-slate-700 bg-white border border-violet-200 rounded-lg px-3 py-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-violet-400 resize-y"
                  />
                </div>

                {/* Apply button */}
                <div className="flex items-center justify-between pt-1">
                  <p className="text-[11px] text-violet-500">Edit anything above, then apply or download the standard curriculum file</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => attachGeneratedFile({ title: previewTitle, outline: previewOutline, shouldDownload: true })}
                      className="flex items-center gap-1.5 bg-white hover:bg-violet-100 text-violet-700 border border-violet-200 text-xs font-bold px-3.5 py-2 rounded-lg transition-colors"
                    >
                      <Download size={13} /> Download Standard File
                    </button>
                    <button
                      onClick={applyPreview}
                      className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
                    >
                      <CheckCircle size={13} /> Apply to Form ↓
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-amber-800">Trainer Recommendation</p>
                <p className="mt-0.5 text-xs text-amber-700">Ranks the top trainer fits once the curriculum direction is clear.</p>
              </div>
              <button
                onClick={handleTrainerRecommendation}
                disabled={trainerBusy}
                className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Sparkles size={12} /> {trainerBusy ? 'Ranking...' : ''}
              </button>
            </div>
            {trainerRecommendations.length > 0 && (
              <div className="mt-3 space-y-2">
                {trainerRecommendations.map((trainer, index) => {
                  const isInternal = trainer.source === 'internal_sme';
                  return (
                    <div key={`${trainer.trainer_name}-${index}`} className={`rounded-xl border px-3 py-2 bg-white ${isInternal ? 'border-violet-200' : 'border-amber-200'}`}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-800">{index + 1}. {trainer.trainer_name}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isInternal ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700'}`}>
                            {isInternal ? (trainer.role_label || 'Internal SME') : 'Catalog Trainer'}
                          </span>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${isInternal ? 'bg-violet-100 text-violet-700' : 'bg-amber-100 text-amber-700'}`}>
                          {trainer.fit_score}/100 fit
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">{trainer.reason}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* File Drop Zone */}
          <div>
            <label className="form-label">Curriculum Document <span className="text-red-500">*</span>
              <span className="text-slate-400 font-normal ml-1">(required — manager must be able to download before approving)</span>
            </label>
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current.click()}
              className={`relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
                dragging ? 'border-blue-400 bg-blue-50'
                : attachedFile ? 'border-emerald-400 bg-emerald-50'
                : 'border-red-200 hover:border-blue-300 hover:bg-slate-50'
              }`}
            >
              <input ref={fileRef} type="file" accept="*/*" className="hidden"
                onChange={e => handleFile(e.target.files[0])} />

              {attachedFile ? (
                <div className="flex items-center gap-3 justify-center">
                  <div className={`p-2 rounded-lg bg-white ${iconColor}`}>
                    <FileText size={22} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-slate-800 truncate max-w-xs">{attachedFile.name}</p>
                    <p className="text-xs text-slate-400">{fileSize(attachedFile.size)} • {ext.toUpperCase()}{autoGeneratedAttachment ? ' • Standard template generated from AI preview' : ''}</p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); setAttachedFile(null); setAutoGeneratedAttachment(false); }}
                    className="ml-auto text-slate-300 hover:text-red-400 flex-shrink-0">
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="py-2">
                  <Upload size={24} className="mx-auto text-red-300 mb-2" />
                  <p className="text-sm font-medium text-slate-600">Drop a file here or <span className="text-blue-600">browse</span></p>
                  <p className="text-xs text-slate-400 mt-1">PDF, Word, PowerPoint, Excel, ZIP — the manager needs this to review</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="form-label">Curriculum Title *</label>
            <input value={form.curriculum_title} onChange={e => set('curriculum_title', e.target.value)}
              className="form-input" placeholder="e.g. Python for Data Science — Module Outline" />
          </div>
          <div>
            <label className="form-label">Course Outline / Description</label>
            <textarea value={form.curriculum_outline} onChange={e => set('curriculum_outline', e.target.value)}
              rows={3} className="form-input resize-none"
              placeholder="Topics covered, learning objectives, prerequisites, session plan..." />
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={handleSubmit} disabled={submitting || !form.curriculum_title || !attachedFile}
            className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            <Upload size={15} /> {submitting ? 'Sharing...' : 'Share Curriculum'}
          </button>
          <button onClick={onClose} className="btn-secondary px-6">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Request Rejection Modal (L&D / Manager / FH) ─────────────────────────────
function RejectRequestModal({ item, onClose, onSubmit }) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    await onSubmit(item, reason.trim());
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-red-500" />
            <div>
              <h3 className="font-bold text-slate-800">Reject Request</h3>
              <p className="text-xs text-slate-500 mt-0.5">{item.id} — {item.course}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <div className="p-6">
          <p className="text-sm text-slate-600 mb-4">
            Provide a reason for rejecting this request. The submitter will be notified by email.
          </p>
          <label className="form-label">Rejection Reason <span className="text-red-500">*</span></label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={4}
            className="form-input resize-none"
            placeholder="e.g. This training is not aligned with current business priorities. Please resubmit with revised justification..."
            autoFocus
          />
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={handleSubmit}
            disabled={submitting || !reason.trim()}
            className="btn-danger flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <XCircle size={15} /> {submitting ? 'Rejecting...' : 'Reject & Notify'}
          </button>
          <button onClick={onClose} className="btn-secondary px-6">Cancel</button>
        </div>
      </div>
    </div>
  );
}


const EMPTY_P = (dept = '') => ({ employee_id: '', employee_name: '', email: '', department: dept, designation: '', business_unit: '', current_skill_level: '', required_skill_level: '', nomination_reason: '', _emp: null });

const normalizeOrgValue = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// ── Add Participants Modal (Manager, after curriculum approved) ────────────────
function AddParticipantsModal({ item, employees, onClose, onSubmit }) {
  const requestDept = item.department || '';
  const requestManagerId = item.raw?.manager_id || '';
  const requestBusinessUnit = item.raw?.business_unit || '';
  const normalizedRequestDept = normalizeOrgValue(requestDept);
  const normalizedRequestBusinessUnit = normalizeOrgValue(requestBusinessUnit);

  // Filter by manager_id first (most reliable), fall back to dept/BU match
  const deptEmployees = requestManagerId
    ? employees.filter(e => e.manager_id === requestManagerId)
    : employees.filter(e => {
        const nd = normalizeOrgValue(e.department);
        const nb = normalizeOrgValue(e.business_unit);
        return (
          (normalizedRequestDept && nd === normalizedRequestDept)
          || (normalizedRequestBusinessUnit && nb === normalizedRequestBusinessUnit)
        );
      });
  const [participants, setParticipants] = useState([EMPTY_P(requestDept)]);
  const [recommendationBusy, setRecommendationBusy] = useState(false);
  const [recommendedEmployees, setRecommendedEmployees] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);

  // Pre-populate with existing nominees for nominations (RM submitted them at nomination time)
  useEffect(() => {
    if (item.kind !== 'nom') return;
    setLoadingExisting(true);
    axios.get(`/api/nominations/${item.id}/participants`)
      .then(r => {
        const existing = r.data;
        if (existing && existing.length > 0) {
          setParticipants(existing.map(p => ({
            employee_id: p.employee_id,
            employee_name: p.employee_name,
            email: p.email,
            department: p.department || requestDept,
            designation: '',
            business_unit: '',
            current_skill_level: p.current_skill_level || 'Beginner',
            required_skill_level: p.required_skill_level || 'Intermediate',
            nomination_reason: p.nomination_reason || '',
            _emp: employees.find(e => e.employee_id === p.employee_id) || null,
          })));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingExisting(false));
  }, [item.id, item.kind]);

  const setP = (i, k, v) => setParticipants(ps => ps.map((p, idx) => idx === i ? { ...p, [k]: v } : p));

  const handleEmpChange = (i, empId) => {
    // Look up in deptEmployees first, fall back to full employees list
    const emp = deptEmployees.find(e => e.employee_id === empId)
             || employees.find(e => e.employee_id === empId)
             || null;
    setParticipants(ps => ps.map((p, idx) => idx === i
      ? { ...p, employee_id: empId, employee_name: emp?.name || '', email: emp?.email || '',
          department: emp?.department || requestDept, designation: emp?.designation || '',
          business_unit: emp?.business_unit || '', _emp: emp }
      : p));
  };

  const valid = participants.every(p => p.employee_id && p.current_skill_level && p.required_skill_level);

  const handleRecommendParticipants = async () => {
    if (item.kind === 'reg') return;
    setRecommendationBusy(true);
    try {
      const { data } = await axios.post('/api/ai/recommend-participants', {
        request_kind: item.kind === 'nom' ? 'nomination' : 'course_request',
        request_id: item.id,
        limit: 5,
      });
      const recommendations = data.recommendations || [];
      setRecommendedEmployees(recommendations);
      if (recommendations.length > 0) {
        setParticipants(recommendations.slice(0, Math.max(1, Math.min(3, recommendations.length))).map((rec) => {
          // Cross-reference with local employee list for accurate, up-to-date details
          const emp = employees.find(e => e.employee_id === rec.employee_id) || null;
          return {
            employee_id: rec.employee_id,
            employee_name: emp?.name || rec.employee_name,
            email: emp?.email || rec.email,
            department: emp?.department || rec.department || requestDept,
            designation: emp?.designation || rec.designation || '',
            business_unit: emp?.business_unit || rec.business_unit || '',
            current_skill_level: 'Beginner',
            required_skill_level: 'Intermediate',
            nomination_reason: rec.reason || `Recommended by AI for ${item.course}`,
            _emp: emp || rec,
          };
        }));
      }
    } finally {
      setRecommendationBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (!valid) return;
    setSubmitting(true);
    await onSubmit(item, participants);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-6">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800">{item.course}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{item.id} — Participant Nomination</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        {/* Curriculum banner */}
        {item.raw.curriculum_title && (
          <div className="mx-6 mt-4 p-3 bg-teal-50 border border-teal-200 rounded-xl flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-teal-700 flex items-center gap-1">
                <BookOpen size={12} /> {item.raw.curriculum_title}
              </p>
              {item.raw.curriculum_uploaded_by && (
                <p className="text-xs text-teal-500 mt-0.5">Shared by {item.raw.curriculum_uploaded_by}</p>
              )}
            </div>
            {item.raw.curriculum_link ? (
              <a href={item.raw.curriculum_link} download={item.raw.curriculum_title || 'curriculum'}
                className="flex items-center gap-1 text-xs bg-teal-600 hover:bg-teal-700 text-white px-2.5 py-1 rounded-lg font-medium flex-shrink-0">
                <Download size={11} /> Download
              </a>
            ) : (
              <span className="text-xs text-teal-400 italic">No file attached</span>
            )}
          </div>
        )}

        {/* Participant Nomination section */}
        <div className="mx-6 mt-4 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2 font-semibold text-slate-800 text-sm">
              <Users size={16} className="text-blue-600" /> Participant Nomination
            </div>
            <div className="flex items-center gap-2">
              {item.kind !== 'reg' && (
                <button onClick={handleRecommendParticipants}
                  disabled={recommendationBusy}
                  className="flex items-center gap-1.5 text-xs bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-lg font-medium disabled:cursor-not-allowed disabled:opacity-60">
                  <Sparkles size={13} /> {recommendationBusy ? 'Recommending...' : 'Auto Nominate'}
                </button>
              )}
              <button onClick={() => setParticipants(ps => [...ps, EMPTY_P(requestDept)])}
                className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium">
                <Plus size={13} /> Add Participant
              </button>
            </div>
          </div>

          {recommendedEmployees.length > 0 && item.kind !== 'reg' && (
            <div className="border-b border-slate-100 bg-violet-50 px-5 py-3">
              <p className="text-xs font-semibold text-violet-700">AI Agent 5 recommendations</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {recommendedEmployees.map((employee) => (
                  <div key={employee.employee_id} className="rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs text-violet-700">
                    {employee.employee_name} · {employee.fit_score}/100 fit
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="divide-y divide-slate-100">
            {participants.map((p, i) => (
              <div key={i} className="px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-400 tracking-widest uppercase">Participant {i + 1}</span>
                  {participants.length > 1 && (
                    <button onClick={() => setParticipants(ps => ps.filter((_, idx) => idx !== i))}
                      className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1">
                      <X size={13} /> Remove
                    </button>
                  )}
                </div>

                {/* Row 1: Employee | Employee ID | Email | Department */}
                <div className="grid grid-cols-4 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Employee *</label>
                    <select value={p.employee_id} onChange={e => handleEmpChange(i, e.target.value)} className="form-select text-sm">
                      <option value="">Select</option>
                      {deptEmployees.map(e => <option key={e.employee_id} value={e.employee_id}>{e.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Employee ID *</label>
                    <input value={p.employee_id} readOnly className="form-input text-sm bg-slate-50 text-slate-500" placeholder="Auto-filled" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                    <input value={p.email} readOnly className="form-input text-sm bg-slate-50 text-slate-500" placeholder="Auto-filled" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Department</label>
                    <input value={p.department} readOnly className="form-input text-sm bg-slate-50 text-slate-500" placeholder="Auto-filled" />
                  </div>
                </div>

                {/* Row 2: Current Skill | Required Skill | Nomination Reason */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Current Skill Level *</label>
                    <select value={p.current_skill_level} onChange={e => setP(i, 'current_skill_level', e.target.value)} className="form-select text-sm">
                      <option value="">Select</option>
                      {SKILL_LEVELS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Required Skill Level *</label>
                    <select value={p.required_skill_level} onChange={e => setP(i, 'required_skill_level', e.target.value)} className="form-select text-sm">
                      <option value="">Select</option>
                      {SKILL_LEVELS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Nomination Reason *</label>
                    <input value={p.nomination_reason} onChange={e => setP(i, 'nomination_reason', e.target.value)}
                      className="form-input text-sm" placeholder="Why nominated?" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-5">
          <button onClick={handleSubmit} disabled={submitting || !valid}
            className="btn-primary flex items-center gap-2 px-6">
            <Users size={15} /> {submitting ? 'Submitting...' : 'Submit to L&D'}
          </button>
          <button onClick={() => setParticipants([EMPTY_P(requestDept)])}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 font-medium">
            ↺ Reset
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Request Nomination Modal (L&D sets trainer/date before requesting nominations) ──
function RequestNominationModal({ item, onClose, onSubmit }) {
  const [trainerName, setTrainerName] = useState('');
  const [trainingDate, setTrainingDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    await onSubmit(item, trainerName, trainingDate);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800">Set Trainer & Request Nominations</h3>
            <p className="text-xs text-slate-500 mt-0.5">{item.course} — {item.id}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600">
            Set the trainer and training date for <span className="font-semibold">{item.course}</span>.
            The manager will be notified by email to nominate participants.
          </p>
          <div>
            <label className="form-label">Trainer Name</label>
            <input
              value={trainerName}
              onChange={e => setTrainerName(e.target.value)}
              className="form-input"
              placeholder="e.g. Rajesh Kumar"
            />
          </div>
          <div>
            <label className="form-label">Training Date</label>
            <input
              type="date"
              value={trainingDate}
              onChange={e => setTrainingDate(e.target.value)}
              className="form-input"
            />
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Users size={15} /> {submitting ? 'Sending...' : 'Request Nominations'}
          </button>
          <button onClick={onClose} className="btn-secondary px-6">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ManagerApproval() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isLD = user?.role === 'ld_team';
  const isFH = user?.role === 'functional_head';
  const isManager = user?.role === 'reporting_manager';

  const [regs, setRegs] = useState([]);
  const [noms, setNoms] = useState([]);
  const [courseReqs, setCourseReqs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [filter, setFilter] = useState('');
  const [tab, setTab] = useState(location.state?.tab || 'pending');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [detail, setDetail] = useState(null);
  const [nextAction, setNextAction] = useState(location.state?.nextAction || null);
  const [curriculumModal, setCurriculumModal] = useState(null);
  const [rejectRequestModal, setRejectRequestModal] = useState(null);
  const [participantsModal, setParticipantsModal] = useState(null);
  const [requestNominationModal, setRequestNominationModal] = useState(null);
  const [agentRuns, setAgentRuns] = useState([]);

  const load = () => Promise.all([
    axios.get('/api/registrations').catch(() => ({ data: [] })),
    axios.get('/api/nominations').catch(() => ({ data: [] })),
    axios.get('/api/course-requests').catch(() => ({ data: [] })),
  ]).then(([r, n, c]) => {
    setRegs(r.data);
    setNoms(n.data);
    setCourseReqs(c.data);
  }).finally(() => setLoading(false));

  useEffect(() => {
    load();
    if (isFH || isManager) axios.get('/api/employees').then(r => setEmployees(r.data.filter(e => e.role === 'employee')));

    const refresh = () => Promise.all([
      axios.get('/api/registrations').catch(() => ({ data: [] })),
      axios.get('/api/nominations').catch(() => ({ data: [] })),
      axios.get('/api/course-requests').catch(() => ({ data: [] })),
    ]).then(([r, n, c]) => { setRegs(r.data); setNoms(n.data); setCourseReqs(c.data); });
    const interval = setInterval(refresh, 15000);

    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isFH]);

  useEffect(() => {
    if (!detail) {
      setAgentRuns([]);
      return;
    }
    const entityType = detail.kind === 'reg' ? 'Registration' : detail.kind === 'nom' ? 'Nomination' : 'Course Request';
    axios.get('/api/ai/agent-runs', { params: { entity_id: detail.id, entity_type: entityType, limit: 10 } })
      .then(r => setAgentRuns(r.data))
      .catch(() => setAgentRuns([]));
  }, [detail]);

  const fmtDate = d => {
    if (!d) return { date: '—', time: '' };
    const dt = new Date(d);
    const IST = { timeZone: 'Asia/Kolkata' };
    return {
      date: dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', ...IST }),
      time: dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, ...IST }),
    };
  };

  const mapReg = r => ({
    id: r.request_id, type: 'Self Registration', course: r.course_name,
    employee: r.employee_name, department: r.department,
    submittedDate: fmtDate(r.submitted_date),
    ldDate: r.ld_validated_date ? r.ld_validated_date.slice(0, 10) : '—',
    ldRemarks: r.ld_remarks || '', participants: 1, raw: r, kind: 'reg'
  });
  const mapNom = n => ({
    id: n.nomination_id,
    type: n.requested_by_fh ? 'Functional Head' : 'Manager',
    course: n.course_name,
    employee: n.requested_by_fh && n.fh_name ? n.fh_name : n.manager_name, department: n.department,
    submittedDate: fmtDate(n.submitted_date),
    ldDate: n.ld_validated_date ? n.ld_validated_date.slice(0, 10) : '—',
    ldRemarks: n.ld_remarks || '', participants: n.participant_count || 0, raw: n, kind: 'nom'
  });
  const mapCourse = c => ({
    id: c.request_id,
    type: c.requested_by_rm ? 'Reporting Manager' : c.requested_by_fh ? 'Functional Head' : 'Manager',
    course: c.course_name,
    employee: c.requested_by_fh && c.fh_name ? c.fh_name : c.manager_name, department: c.department,
    fhApprovedNote: c.fh_approved_note || null,
    submittedDate: fmtDate(c.submitted_date),
    ldDate: c.ld_validated_date ? c.ld_validated_date.slice(0, 10) : '—',
    ldRemarks: c.ld_remarks || '', participants: c.expected_participants || 0, raw: c, kind: 'course'
  });

  // Tab 1 — Pending Approval
  // L&D: items assigned to this team member awaiting validation
  // FH: items awaiting manager approval
  const pendingItems = isLD
    ? [
        ...regs.filter(r => r.status === 'Pending L&D Validation').map(mapReg),
        ...noms.filter(n => n.status === 'Pending L&D Validation').map(mapNom),
        ...courseReqs.filter(c => c.status === 'Pending L&D Validation').map(mapCourse),
      ]
    : isFH
    ? [
        // FH approves new course requests
        ...courseReqs.filter(c =>
          c.status === 'Pending FH Approval' &&
          (!c.fh_id || c.fh_id === user.employee_id)
        ).map(mapCourse),
      ]
    : [
        // Reporting manager approves self-reg and nomination requests
        ...regs.filter(r => {
          if (r.status !== 'Pending Manager Approval') return false;
          return r.manager_id ? r.manager_id === user.employee_id : r.reporting_manager === user.name;
        }).map(mapReg),
        ...noms.filter(n => {
          if (n.status !== 'Pending Manager Approval') return false;
          return n.manager_id === user.employee_id;
        }).map(mapNom),
      ];

  // ── PROCESS A (Nominations — existing course) ───────────────────────────────
  // Flow: Pending L&D Validation → Participants Requested → Finalized → Enrolled
  // NO curriculum step for nominations.

  // ── PROCESS B (Course Requests — new course) ────────────────────────────────
  // Flow: Pending FH Approval → Pending L&D Validation → Approved →
  //       (L&D coordinates curriculum/trainer/date with FH offline) →
  //       L&D sets trainer → Participants Requested → RM nominates → Finalized → Enrolled

  // Tab 2 — Upload Curriculum (L&D only — self-registration requests only)
  // Process B (course requests) no longer use this step — L&D coordinates with FH offline.
  const approvedItems = [
    ...regs.filter(r => r.status === 'Approved').map(mapReg),
    // Course requests excluded: they go directly to Set Trainer after L&D approval
  ];


  // Tab 4 — Nominate Participants (both processes)
  // Process A nominations: "Participants Requested" (after L&D approval)
  // Process B course requests: "Participants Requested" (after L&D sets trainer/date)
  const participantsRequestedItems = [
    ...noms.filter(n => {
      if (n.status !== 'Participants Requested') return false;
      if (isManager) return n.manager_id === user.employee_id;
      if (isFH) return false; // RM nominates, not FH
      return true;
    }).map(mapNom),
    ...regs.filter(r => {
      if (r.status !== 'Curriculum Approved') return false;
      if (isManager) return r.manager_id ? r.manager_id === user.employee_id : r.reporting_manager === user.name;
      if (isFH) return r.manager_id ? r.manager_id === user.employee_id : r.reporting_manager === user.name;
      return true;
    }).map(mapReg),
    ...courseReqs.filter(c => {
      if (c.status !== 'Participants Requested') return false;
      if (isManager) return c.manager_id === user.employee_id;
      if (isFH) return false; // RM nominates, not FH
      return true;
    }).map(mapCourse),
  ];

  // Tab 5 (L&D only) — Set Trainer & Request Nominations
  // Process B: course requests move here after L&D approves (status: Approved).
  // L&D has already finalised curriculum/trainer/date with FH offline before this step.
  const ldRequestNominationItems = isLD ? [
    ...courseReqs.filter(c => c.status === 'Approved').map(mapCourse),
    // NOTE: nominations excluded — Process A has no trainer/date step
  ] : [];

  // Sort by most recent activity first (latest status-change date, fallback to submitted_date)
  const sortByLatest = items => [...items].sort((a, b) => {
    const tsA = a.raw.ld_validated_date || a.raw.curriculum_uploaded_date ||
                a.raw.curriculum_approved_date || a.raw.manager_approved_date ||
                a.raw.submitted_date || '';
    const tsB = b.raw.ld_validated_date || b.raw.curriculum_uploaded_date ||
                b.raw.curriculum_approved_date || b.raw.manager_approved_date ||
                b.raw.submitted_date || '';
    return tsB.localeCompare(tsA);
  });

  const applySearch = items => sortByLatest(items).filter(i =>
    i.id.toLowerCase().includes(filter.toLowerCase()) ||
    i.course.toLowerCase().includes(filter.toLowerCase()) ||
    i.employee.toLowerCase().includes(filter.toLowerCase())
  );

  const tabs = [
    { key: 'pending', label: 'Pending Approval', count: pendingItems.length, roles: ['ld_team', 'functional_head', 'reporting_manager'] },
    { key: 'nominations', label: 'Set Trainer & Request Nominations', count: ldRequestNominationItems.length, roles: ['ld_team'] },
    { key: 'participants', label: 'Nominate Participants', count: participantsRequestedItems.length, roles: ['reporting_manager'] },
  ].filter(t => t.roles.includes(user?.role));

  const currentItems = applySearch(
    tab === 'pending' ? pendingItems :
    tab === 'nominations' ? ldRequestNominationItems :
    participantsRequestedItems
  );

  const doApprove = async item => {
    const role = isLD ? 'L&D Team' : isFH ? 'Functional Head' : 'Reporting Manager';
    if (isLD) {
      if (item.kind === 'reg') {
        await axios.put(`/api/registrations/${item.id}/validate`, { performed_by: user.name, role, remarks: '' });
      } else if (item.kind === 'nom') {
        await axios.put(`/api/nominations/${item.id}/validate`, { performed_by: user.name, role, remarks: '' });
      } else {
        await axios.put(`/api/course-requests/${item.id}/validate`, { performed_by: user.name, role, remarks: '' });
      }
    } else if (item.kind === 'reg') {
      await axios.put(`/api/registrations/${item.id}/approve`, { performed_by: user.name, role, remarks: '' });
    } else if (item.kind === 'nom') {
      await axios.put(`/api/nominations/${item.id}/approve`, { performed_by: user.name, role, remarks: '' });
    } else {
      await axios.put(`/api/course-requests/${item.id}/approve`, { performed_by: user.name, role, remarks: '' });
    }
    setDetail(null);
    await load();
    if (isLD) {
      if (item.kind === 'nom') {
        // Process A: L&D validated → status is now Participants Requested → RM sees it in their queue
        setNextAction({
          title: `${item.id} validated — Manager notified`,
          body: `"${item.course}" validated. The requesting manager has been prompted to confirm participants.`,
          hint: 'Once the manager nominates participants, the request will be finalized.',
          cta: null,
        });
      } else if (item.kind === 'course') {
        // Process B: new course approved → L&D handles curriculum offline
        setNextAction({
          title: `${item.id} approved`,
          body: `"${item.course}" has been approved. L&D will coordinate the curriculum and trainer assignment offline.`,
          hint: 'Once ready, set the trainer and training date in the Set Trainer & Request Nominations tab.',
          cta: null,
        });
      } else {
        setNextAction(null);
        setToast({ msg: `${item.id} validated — sent for manager approval`, type: 'success' });
      }
    } else {
      setNextAction(null);
      setToast({ msg: `${item.id} approved!`, type: 'success' });
    }
  };

  const doReject = async (item, reason) => {
    const role = isLD ? 'L&D Team' : isFH ? 'Functional Head' : 'Reporting Manager';
    if (item.kind === 'reg') await axios.put(`/api/registrations/${item.id}/reject`, { performed_by: user.name, role, remarks: reason });
    else if (item.kind === 'nom') await axios.put(`/api/nominations/${item.id}/reject`, { performed_by: user.name, role, remarks: reason });
    else await axios.put(`/api/course-requests/${item.id}/reject`, { performed_by: user.name, role, remarks: reason });
    setToast({ msg: `${item.id} rejected — submitter notified`, type: 'error' });
    setRejectRequestModal(null);
    setDetail(null);
    setNextAction(null);
    load();
  };

  const doUploadCurriculum = async (item, form) => {
    const url = item.kind === 'reg'
      ? `/api/registrations/${item.id}/upload-curriculum`
      : `/api/course-requests/${item.id}/upload-curriculum`;
    await axios.put(url, { performed_by: user.name, role: 'L&D Team', ...form });
    setCurriculumModal(null);
    await load();
    setNextAction({
      title: 'Curriculum uploaded!',
      body: `"${item.course}" curriculum has been uploaded and approved. You can now set the trainer name and training date.`,
      hint: null,
      cta: null,
    });
  };


  const doAddParticipants = async (item, participants) => {
    const roleLabel = isManager ? 'Reporting Manager' : 'Functional Head';
    if (item.kind === 'nom') {
      await axios.put(`/api/nominations/${item.id}/add-participants`, { performed_by: user.name, role: roleLabel, participants });
    } else if (item.kind === 'course') {
      await axios.put(`/api/course-requests/${item.id}/finalize`, { performed_by: user.name, role: roleLabel, participants });
    } else {
      await axios.put(`/api/registrations/${item.id}/finalize`, { performed_by: user.name, role: roleLabel, remarks: '' });
    }
    setParticipantsModal(null);
    await load();
    setNextAction({
      title: 'Participants nominated!',
      body: `${participants.length} participant(s) nominated and finalized for "${item.course}".`,
      hint: 'You can track the training status from the Status page.',
      cta: { label: 'View Status', path: '/workflow' },
    });
  };

  const doRequestParticipants = async (item, trainerName, trainingDate) => {
    const url = item.kind === 'nom'
      ? `/api/nominations/${item.id}/request-participants`
      : `/api/course-requests/${item.id}/request-participants`;
    await axios.put(url, {
      performed_by: user.name,
      role: 'L&D Team',
      trainer_name: trainerName,
      training_date: trainingDate,
    });
    setRequestNominationModal(null);
    setDetail(null);
    await load();
    setNextAction({
      title: 'Nomination request sent!',
      body: `Manager of "${item.course}" has been notified by email to nominate participants.`,
      hint: `Trainer: ${trainerName || 'TBD'} · Date: ${trainingDate || 'TBD'}`,
      cta: null,
    });
  };

  if (loading) return <SkeletonTable rows={5} cols={8} />;

  const tabDescriptions = {
    pending: isLD ? 'Validate new requests and acknowledge new course requests.' : 'Approve or reject L&D-validated requests.',
    nominations: 'Curriculum and logistics have been finalised with the FH. Set the trainer and training date, then notify the requesting manager to nominate participants.',
    participants: 'Training schedule confirmed — nominate participants for enrollment.',
  };

  const emptyMsg = {
    pending: isLD ? 'No requests pending L&D validation' : 'No requests pending approval',
    curriculum: 'No approved requests awaiting curriculum upload',
    review: 'No curriculum pending your review',
    nominations: 'No approved course requests awaiting trainer/date assignment',
    participants: 'No trainings awaiting participant nomination',
  };

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {curriculumModal && (
        <CurriculumModal item={curriculumModal} onClose={() => setCurriculumModal(null)} onSubmit={doUploadCurriculum} />
      )}
      {rejectRequestModal && (
        <RejectRequestModal item={rejectRequestModal}
          onClose={() => setRejectRequestModal(null)} onSubmit={doReject} />
      )}
      {participantsModal && (
        <AddParticipantsModal item={participantsModal} employees={employees}
          onClose={() => setParticipantsModal(null)} onSubmit={doAddParticipants} />
      )}
      {requestNominationModal && (
        <RequestNominationModal item={requestNominationModal}
          onClose={() => setRequestNominationModal(null)} onSubmit={doRequestParticipants} />
      )}

      <div>
        <h1 className="text-2xl font-bold text-slate-800">Approval Queue</h1>
        <p className="text-slate-500 text-sm mt-1">Manage request approvals, curriculum review, and participant nominations</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setDetail(null); setNextAction(null); }}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors flex items-center gap-2 ${
              tab === t.key
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            {t.label}
            {t.count > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                tab === t.key ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      <p className="text-xs text-slate-500 -mt-2">{tabDescriptions[tab]}</p>

      {nextAction && (
        <div className="flex items-start justify-between gap-4 bg-emerald-50 border border-emerald-300 rounded-xl px-5 py-4">
          <div className="flex-1">
            <p className="text-sm font-bold text-emerald-800">{nextAction.title}</p>
            <p className="text-xs text-emerald-700 mt-0.5">{nextAction.body}</p>
            <p className="text-xs text-emerald-600 mt-0.5 opacity-80">{nextAction.hint}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {nextAction.cta && (
              <button onClick={() => navigate(nextAction.cta.path)}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">
                {nextAction.cta.label} <ArrowRight size={13} />
              </button>
            )}
            <button onClick={() => setNextAction(null)} className="text-emerald-400 hover:text-emerald-600">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="card !p-4 flex items-center gap-3">
        <Search size={16} className="text-slate-400 flex-shrink-0" />
        <input value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="Search by ID, course or employee..." className="form-input flex-1 !border-0 !ring-0 !p-0 text-sm" />
        <span className="text-xs text-slate-400 whitespace-nowrap">{currentItems.length} items</span>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="table-th">Request ID</th>
              <th className="table-th">Nomination Type</th>
              <th className="table-th">Course Name</th>
              <th className="table-th">Submitted By</th>
              <th className="table-th">Department</th>
              <th className="table-th">Submitted On</th>
              <th className="table-th">Training Date</th>
              <th className="table-th min-w-[200px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentItems.map(item => {
              const isOpen = detail?.id === item.id;
              return (
                <>
                  <tr key={item.id} className={`table-row ${isOpen ? 'bg-sky-50/60' : ''}`}>
                    <td className="table-td font-mono text-xs font-medium text-sky-600">{item.id}</td>
                    <td className="table-td">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        item.raw?.requested_by_fh ? 'bg-amber-100 text-amber-700' :
                        item.kind === 'reg' ? 'bg-blue-100 text-blue-700' :
                        item.kind === 'nom' ? 'bg-purple-100 text-purple-700' :
                        'bg-teal-100 text-teal-700'
                      }`}>
                        {item.type}
                      </span>
                    </td>
                    <td className="table-td font-medium">{item.course}</td>
                    <td className="table-td">
                      {item.employee === user?.name
                        ? <span className="text-slate-500 italic">You</span>
                        : item.employee}
                    </td>
                    <td className="table-td">{item.department}</td>
                    <td className="table-td">
                      <p className="text-xs text-slate-700 font-medium">{item.submittedDate.date}</p>
                      {item.submittedDate.time && (
                        <p className="text-[10px] text-slate-400 mt-0.5">{item.submittedDate.time}</p>
                      )}
                    </td>
                    <td className="table-td text-xs font-medium text-blue-700">
                      {(item.raw?.training_date || item.raw?.target_completion_date)
                        ? new Date(item.raw.training_date || item.raw.target_completion_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                        : item.kind === 'nom'
                          ? <span className="text-slate-400 text-xs">Not set</span>
                          : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="table-td">
                      <div className="flex items-center gap-1.5 flex-nowrap">
                        <button
                          onClick={() => setDetail(isOpen ? null : item)}
                          className={`flex items-center gap-1 whitespace-nowrap text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${
                            isOpen
                              ? 'bg-sky-600 text-white hover:bg-sky-700'
                              : 'bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100'
                          }`}
                        >
                          <Eye size={12} /> {isOpen ? 'Close' : 'Review'}
                        </button>
                        {tab === 'pending' && <>
                          <button onClick={() => doApprove(item)} className="btn-success flex items-center gap-1 whitespace-nowrap">
                            <CheckCircle size={12} /> Approve
                          </button>
                          <button onClick={() => setRejectRequestModal(item)} className="btn-danger flex items-center gap-1 whitespace-nowrap">
                            <XCircle size={12} /> Reject
                          </button>
                        </>}
                        {tab === 'nominations' && isLD && (
                          <button onClick={() => setRequestNominationModal(item)} className="btn-primary flex items-center gap-1 whitespace-nowrap">
                            <Users size={12} /> Set Trainer
                          </button>
                        )}
                        {tab === 'participants' && (isManager || isFH) && (
                          <button onClick={() => setParticipantsModal(item)} className="btn-primary flex items-center gap-1 whitespace-nowrap">
                            <Users size={12} /> Nominate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Inline expandable detail row */}
                  {isOpen && (
                    <tr key={`${item.id}-detail`} className="bg-sky-50/40">
                      <td colSpan={8} className="px-6 py-4 border-b border-sky-100">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
                          <div><p className="text-xs text-slate-400">Request Type</p><p className="font-medium">{item.type}</p></div>
                          <div><p className="text-xs text-slate-400">Course</p><p className="font-medium">{item.course}</p></div>
                          <div><p className="text-xs text-slate-400">Submitted By</p><p className="font-medium">{item.employee}</p></div>
                          <div><p className="text-xs text-slate-400">Department</p><p className="font-medium">{item.department}</p></div>
                          {(item.raw?.training_date || item.raw?.target_completion_date) && (
                            <div className="md:col-span-4 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                              <span className="text-xs font-semibold text-blue-600">Requested Training Date:</span>
                              <span className="text-sm font-bold text-blue-800">{new Date(item.raw.training_date || item.raw.target_completion_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                            </div>
                          )}
                          {item.fhApprovedNote && (
                            <div className="md:col-span-4 flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                              <CheckCircle size={14} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-xs font-semibold text-emerald-700">FH Approved</p>
                                <p className="text-xs text-emerald-600 mt-0.5">{item.fhApprovedNote}</p>
                              </div>
                            </div>
                          )}
                          {item.raw.reason && <div className="md:col-span-4"><p className="text-xs text-slate-400">Enrollment Reason</p><p className="font-medium">{item.raw.reason}</p></div>}
                          {item.raw.business_need && <div className="md:col-span-4"><p className="text-xs text-slate-400">Business Need</p><p className="font-medium">{item.raw.business_need}</p></div>}
                          {item.raw.skill_gap && <div className="md:col-span-2"><p className="text-xs text-slate-400">Skill Gap</p><p className="font-medium">{item.raw.skill_gap}</p></div>}
                          {item.kind === 'course' && item.raw.priority && <div><p className="text-xs text-slate-400">Priority</p><p className="font-medium">{item.raw.priority}</p></div>}
                          {item.kind === 'course' && item.raw.expected_participants && <div><p className="text-xs text-slate-400">Expected Participants</p><p className="font-medium">{item.raw.expected_participants}</p></div>}
                          {item.raw.curriculum_title && (
                            <div className="md:col-span-4 p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <div>
                                  <p className="text-xs font-semibold text-indigo-700 flex items-center gap-1">
                                    <BookOpen size={12} /> Curriculum: {item.raw.curriculum_title}
                                  </p>
                                  {item.raw.curriculum_uploaded_by && (
                                    <p className="text-xs text-indigo-500 mt-0.5">Shared by {item.raw.curriculum_uploaded_by}</p>
                                  )}
                                </div>
                                {item.raw.curriculum_link ? (
                                  <a href={item.raw.curriculum_link} download={item.raw.curriculum_title || 'curriculum'}
                                    className="flex items-center gap-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-lg font-medium flex-shrink-0">
                                    <Download size={11} /> Download
                                  </a>
                                ) : (
                                  <span className="text-xs text-indigo-400 italic flex-shrink-0">No file attached</span>
                                )}
                              </div>
                              {item.raw.curriculum_outline && <p className="text-xs text-indigo-600 whitespace-pre-line mt-1">{item.raw.curriculum_outline}</p>}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {tab === 'nominations' && isLD && (
                            <button onClick={() => { setDetail(null); setRequestNominationModal(item); }} className="btn-primary flex items-center gap-2">
                              <Users size={15} /> Set Trainer & Request Nominations
                            </button>
                          )}
                          {tab === 'participants' && (isManager || isFH) && (
                            <button onClick={() => { setDetail(null); setParticipantsModal(item); }} className="btn-primary flex items-center gap-2">
                              <Users size={15} /> Nominate Participants
                            </button>
                          )}
                        </div>
                        {agentRuns.length > 0 && (
                          <div className="mt-4 border-t border-sky-200 pt-4">
                            <h4 className="text-sm font-bold text-slate-700 mb-2">Persisted Agent Outputs</h4>
                            <div className="space-y-2">
                              {agentRuns.map(run => (
                                <div key={run.run_id} className="rounded-xl border border-slate-200 bg-white p-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-semibold text-slate-800">{run.agent_label}</p>
                                    <span className="text-[11px] text-slate-400">{run.created_at}</span>
                                  </div>
                                  <p className="mt-1 text-xs text-slate-500">Trigger: {run.trigger_event || 'manual_run'}</p>
                                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-[11px] text-slate-700">{JSON.stringify(run.output_payload, null, 2)}</pre>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {currentItems.length === 0 && (
              <tr><td colSpan={8} className="py-16 text-center text-slate-400">
                <CheckSquare size={36} className="mx-auto mb-2 opacity-30" />
                <p className="font-medium">{emptyMsg[tab]}</p>
              </td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
