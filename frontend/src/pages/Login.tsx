import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Clock, Send, ShieldAlert, BarChart3, AlertCircle } from 'lucide-react';

export const Login: React.FC = () => {
  const { user, loginWithGoogle, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authError = searchParams.get('error');

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        {/* Glow decoration */}
        <div className="absolute -top-16 -right-16 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-tr from-emerald-500 to-teal-400 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
            <Mail className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">ReachInbox</h1>
          <p className="text-xs text-slate-400 mt-1">
            Production-Grade Full-Stack Email Job Scheduler
          </p>
        </div>

        {authError && (
          <div className="mb-6 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{authError}</span>
          </div>
        )}

        {/* Google OAuth Button */}
        <div className="space-y-4 mb-8">
          <button
            onClick={loginWithGoogle}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-sm transition-all shadow-md active:scale-[0.98]"
          >
            {/* Google SVG Logo */}
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-800"></div>
            <span className="flex-shrink mx-3 text-[10px] text-slate-500 uppercase font-semibold tracking-wider">
              Or
            </span>
            <div className="flex-grow border-t border-slate-800"></div>
          </div>

          <button
            onClick={() => useAuth().loginAsDemoUser()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-medium text-xs border border-slate-700/80 transition-all"
          >
            <span>⚡ Quick Demo Login (Reviewer Mode)</span>
          </button>
        </div>

        {/* Feature Badges */}
        <div className="grid grid-cols-2 gap-2.5 text-left pt-4 border-t border-slate-800">
          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="text-[11px] text-slate-300">BullMQ Delayed Jobs</span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center gap-2">
            <Send className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-[11px] text-slate-300">Ethereal SMTP</span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-[11px] text-slate-300">Rate Limiter</span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-400 shrink-0" />
            <span className="text-[11px] text-slate-300">Elasticsearch</span>
          </div>
        </div>
      </div>
    </div>
  );
};
