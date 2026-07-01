import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { canAccessRolePath, getDefaultRouteForRole, useAuth } from '../context/AuthContext';
import {
  BookOpen, Users, Eye, EyeOff,
  CheckCircle, BarChart3, Shield, Mail, User,
} from 'lucide-react';

const FEATURES = [
  { icon: BookOpen,   text: 'Browse training catalog & register' },
  { icon: Users,      text: 'Nominate team members for programs' },
  { icon: CheckCircle,text: 'Multi-level approval workflows' },
  { icon: BarChart3,  text: 'Track participation & completion' },
  { icon: Shield,     text: 'Role-based access & audit trail' },
];

export default function Login() {
  const { login, getDefaultRoute, requestPasswordReset } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode]         = useState('signin');
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [error, setError]       = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fromPath = location.state?.from?.pathname;
  const nextPath = useMemo(() => {
    return getDefaultRoute();
  }, [getDefaultRoute]);

  const handleSignIn = (e) => {
    e.preventDefault();
    setSuccessMessage('');
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Enter your name, company email and password.');
      return;
    }

    setSubmitting(true);
    login(email.trim().toLowerCase(), password, name.trim()).then((result) => {
      if (result.success) {
        const targetPath = fromPath && canAccessRolePath(result.user.role, fromPath)
          ? fromPath
          : getDefaultRouteForRole(result.user.role);
        navigate(targetPath || nextPath, { replace: true });
        return;
      }
      setError(result.message);
    }).finally(() => setSubmitting(false));
  };

  const handleForgotSubmit = (e) => {
    e.preventDefault();
    setSuccessMessage('');
    if (!email.trim()) {
      setError('Enter your work email to submit a reset request.');
      return;
    }

    setSubmitting(true);
    setError('');
    requestPasswordReset(email.trim().toLowerCase()).then((result) => {
      if (result.success) {
        setForgotMessage(result.message);
        return;
      }
      setError(result.message);
    }).finally(() => setSubmitting(false));
  };

  return (
    <div className="min-h-screen flex">

      {/* ── Left Brand Panel ────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-5/12 xl:w-2/5 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 flex-col justify-between p-10 relative overflow-hidden">
        {/* decorative circles */}
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-blue-700/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 -right-10 w-56 h-56 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <BookOpen size={20} className="text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-none">LevelShift</p>
              <p className="text-slate-400 text-xs">AI-Powered LMS</p>
            </div>
          </div>

          <h2 className="text-3xl font-extrabold text-white leading-tight mb-3">
            Learning &amp; Development<br />
            <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              Portal
            </span>
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-10">
            Streamline training nominations, approvals and curriculum management — all in one place.
          </p>

          <div className="space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center shrink-0">
                  <Icon size={15} className="text-blue-300" />
                </div>
                <span className="text-slate-300 text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-slate-600 text-xs">© 2025 LevelShift Internal · Demo Environment</p>
        </div>
      </div>

      {/* ── Right Login Panel ────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md">

          {/* mobile logo */}
          <div className="flex lg:hidden items-center gap-2 mb-8 justify-center">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <BookOpen size={18} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm">LevelShift LMS</p>
              <p className="text-slate-400 text-xs">AI-Powered Portal</p>
            </div>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-800">
              {mode === 'forgot' ? 'Reset password access' : 'Secure sign in'}
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {mode === 'forgot'
                ? 'Submit a password reset request using your company email.'
                : 'Use your company email and password to access your role-specific workspace.'}
            </p>
          </div>

          <form onSubmit={mode === 'forgot' ? handleForgotSubmit : handleSignIn} className="space-y-4">

            {mode === 'signin' && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setError(''); }}
                    placeholder="Enter your full name"
                    className="w-full bg-white border-2 border-slate-200 focus:border-blue-500 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition-colors"
                    autoComplete="name"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Work Email
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  placeholder="name@company.com"
                  className="w-full bg-white border-2 border-slate-200 focus:border-blue-500 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition-colors"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    {roleConfig.departmentLabel}
                  </label>
                  <input
                    type="text"
                    value={department}
                    readOnly
                    placeholder={roleConfig.departmentPlaceholder}
                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-600 placeholder-slate-400 focus:outline-none transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    {roleConfig.businessUnitLabel}
                  </label>
                  <input
                    type="text"
                    value={businessUnit}
                    readOnly
                    placeholder={roleConfig.businessUnitPlaceholder}
                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-600 placeholder-slate-400 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Designation
                  </label>
                  <input
                    type="text"
                    value={designation}
                    readOnly
                    placeholder={roleConfig.designationPlaceholder}
                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-600 placeholder-slate-400 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    {roleConfig.skillsLabel}
                  </label>
                  <input
                    type="text"
                    value={currentSkills}
                    readOnly
                    placeholder={roleConfig.skillsPlaceholder}
                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-600 placeholder-slate-400 focus:outline-none transition-colors"
                  />
                </div>
              </>
            )}

            {mode === 'register' && lookupBusy && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <p className="text-blue-700 text-xs font-medium">Verifying your dataset record and access type...</p>
              </div>
            )}

            {mode === 'signin' && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    placeholder="Enter your password"
                    className="w-full bg-white border-2 border-slate-200 focus:border-blue-500 rounded-xl px-3 py-2.5 pr-10 text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition-colors"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <div className="mt-2 flex justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setError(''); setForgotMessage(''); setSuccessMessage(''); setPassword(''); }}
                    className="text-xs font-medium text-blue-500 transition-colors hover:text-blue-700"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <p className="text-red-600 text-xs font-medium">{error}</p>
              </div>
            )}

            {successMessage && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <p className="text-emerald-700 text-xs font-medium">{successMessage}</p>
              </div>
            )}

            {forgotMessage && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <p className="text-emerald-700 text-xs font-medium">{forgotMessage}</p>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 text-white py-3 rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg"
              disabled={submitting}
            >
              {submitting ? 'Please wait...' : mode === 'forgot' ? 'Submit reset request' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-lg bg-emerald-100 p-2 text-emerald-600">
                <CheckCircle size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Role access is assigned after authentication</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  The portal now determines your permissions from your account profile and only loads the pages allowed for that user.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
