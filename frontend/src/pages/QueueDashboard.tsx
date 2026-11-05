import React, { useEffect, useState } from 'react';
import { Activity, ExternalLink, RefreshCw, Layers, ShieldCheck, Zap } from 'lucide-react';
import api from '../api/client';

export const QueueDashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchQueueStats = async () => {
    try {
      setLoading(true);
      const res = await api.get('/emails/stats');
      setStats(res.data.queueStats);
    } catch (err) {
      console.error('Failed to load queue stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueueStats();
    const interval = setInterval(fetchQueueStats, 5000); // Poll every 5s for live metrics
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">BullMQ Queue Monitoring</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time job queue metrics backed by persistent Redis 7.0 and BullMQ workers.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchQueueStats}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <a
            href="/admin/queues"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all active:scale-[0.98]"
          >
            <span>Open Full Bull Board UI</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Real-time State Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-amber-500/30">
          <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider mb-2">
            Delayed Jobs
          </div>
          <div className="text-3xl font-bold text-white">{stats?.delayed ?? 0}</div>
          <div className="text-[10px] text-slate-500 mt-1">Scheduled for future timestamps</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-sky-500/30">
          <div className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider mb-2">
            Waiting Jobs
          </div>
          <div className="text-3xl font-bold text-white">{stats?.waiting ?? 0}</div>
          <div className="text-[10px] text-slate-500 mt-1">Eligible & ready for worker</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-purple-500/30">
          <div className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider mb-2">
            Active Jobs
          </div>
          <div className="text-3xl font-bold text-white">{stats?.active ?? 0}</div>
          <div className="text-[10px] text-slate-500 mt-1">Currently being processed</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-emerald-500/30">
          <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider mb-2">
            Completed
          </div>
          <div className="text-3xl font-bold text-white">{stats?.completed ?? 0}</div>
          <div className="text-[10px] text-slate-500 mt-1">Successfully sent</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-rose-500/30">
          <div className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider mb-2">
            Failed Jobs
          </div>
          <div className="text-3xl font-bold text-white">{stats?.failed ?? 0}</div>
          <div className="text-[10px] text-slate-500 mt-1">Retries exhausted</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-700">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Queue State
          </div>
          <div className="text-sm font-bold text-emerald-400 flex items-center gap-1.5 mt-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>RUNNING</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Not paused</div>
        </div>
      </div>

      {/* Architecture Specs Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-indigo-400">
            <Zap className="w-5 h-5" />
            <h3 className="text-sm font-semibold text-white">Configurable Concurrency</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Worker concurrency is dynamically configured via <code className="text-indigo-300">WORKER_CONCURRENCY=5</code>. Jobs process concurrently while honoring sender limits.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
            <h3 className="text-sm font-semibold text-white">Distributed Rate Limiting</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Atomic Redis locks enforce minimum delays (2000ms) and automatic sliding-hour rescheduling to protect sender reputation.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-amber-400">
            <Layers className="w-5 h-5" />
            <h3 className="text-sm font-semibold text-white">Restart Persistence</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Redis uses persistent volume storage. On application restart, the Recovery Service reconciles database records with BullMQ queues.
          </p>
        </div>
      </div>

      {/* Embedded Bull Board Quick Access */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3">
        <Activity className="w-8 h-8 text-indigo-400 mx-auto" />
        <h3 className="text-base font-semibold text-white">Live Administrative Bull Board</h3>
        <p className="text-xs text-slate-400 max-w-lg mx-auto">
          Need deep inspection of job payloads, stack traces, and manual retry triggers? Bull Board is mounted natively on your Express server.
        </p>
        <div className="pt-2">
          <a
            href="/admin/queues"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition-colors"
          >
            <span>Launch Bull Board (/admin/queues)</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
