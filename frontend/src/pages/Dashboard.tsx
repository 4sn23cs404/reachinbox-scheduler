import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Layers,
  Clock,
  Send,
  AlertTriangle,
  Inbox,
  Activity,
  PlusCircle,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import api from '../api/client';
import { DashboardStats, Campaign } from '../types';

export const Dashboard: React.FC = () => {
  const { onOpenCompose } = useOutletContext<{ onOpenCompose: () => void }>();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, campaignsRes] = await Promise.all([
        api.get('/emails/stats'),
        api.get('/campaigns?limit=5'),
      ]);
      setStats(statsRes.data);
      setCampaigns(campaignsRes.data.campaigns || []);
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    const handler = () => fetchDashboardData();
    window.addEventListener('campaign-scheduled', handler);
    return () => window.removeEventListener('campaign-scheduled', handler);
  }, []);

  const statCards = [
    {
      label: 'Total Campaigns',
      value: stats?.totalCampaigns ?? 0,
      icon: Layers,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10 border-indigo-500/20',
    },
    {
      label: 'Scheduled Emails',
      value: stats?.totalScheduled ?? 0,
      icon: Clock,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
    },
    {
      label: 'Sent Emails',
      value: stats?.totalSent ?? 0,
      icon: Send,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
    },
    {
      label: 'Failed Emails',
      value: stats?.totalFailed ?? 0,
      icon: AlertTriangle,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10 border-rose-500/20',
    },
    {
      label: 'Pending In Queue',
      value: stats?.pendingEmails ?? 0,
      icon: Inbox,
      color: 'text-sky-400',
      bg: 'bg-sky-500/10 border-sky-500/20',
    },
    {
      label: 'Active Worker Jobs',
      value: stats?.activeQueueJobs ?? 0,
      icon: Activity,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10 border-purple-500/20',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard Overview</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time status of your email scheduling pipeline and workers.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchDashboardData}
            title="Refresh statistics"
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onOpenCompose}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-xs font-semibold shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Compose Campaign</span>
          </button>
        </div>
      </div>

      {/* 6 Metric Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className={`p-4 rounded-2xl border ${card.bg} bg-slate-900/60 backdrop-blur-sm flex flex-col justify-between`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-medium text-slate-400">{card.label}</span>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <div className="text-2xl font-bold text-white tracking-tight">
                {loading ? '—' : card.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* Live BullMQ Queue Health Box */}
      {stats?.queueStats && (
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-white">BullMQ Live Queue Distribution</h2>
            </div>
            <a
              href="/admin/queues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
            >
              <span>Inspect in Bull Board</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Delayed</div>
              <div className="text-lg font-bold text-amber-400">{stats.queueStats.delayed}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Waiting</div>
              <div className="text-lg font-bold text-sky-400">{stats.queueStats.waiting}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Active</div>
              <div className="text-lg font-bold text-purple-400">{stats.queueStats.active}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Completed</div>
              <div className="text-lg font-bold text-emerald-400">{stats.queueStats.completed}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Failed</div>
              <div className="text-lg font-bold text-rose-400">{stats.queueStats.failed}</div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Campaigns Table */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Recent Campaigns</h2>
          <span className="text-xs text-slate-500">Showing last 5</span>
        </div>

        {campaigns.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            No campaigns scheduled yet. Click &quot;Compose Campaign&quot; to begin.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="pb-3 font-medium">Campaign</th>
                  <th className="pb-3 font-medium">Subject</th>
                  <th className="pb-3 font-medium">Recipients</th>
                  <th className="pb-3 font-medium">Progress (Sent/Failed)</th>
                  <th className="pb-3 font-medium">Start Time</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {campaigns.map((camp) => (
                  <tr key={camp.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 font-semibold text-white">{camp.name}</td>
                    <td className="py-3 text-slate-300 max-w-xs truncate">{camp.subject}</td>
                    <td className="py-3 text-slate-400">{camp.totalEmails} leads</td>
                    <td className="py-3">
                      <span className="text-emerald-400 font-semibold">{camp.sentCount}</span>
                      <span className="text-slate-500"> / </span>
                      <span className="text-rose-400 font-semibold">{camp.failedCount}</span>
                    </td>
                    <td className="py-3 text-slate-400">
                      {new Date(camp.startTime).toLocaleString()}
                    </td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                          camp.status === 'COMPLETED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : camp.status === 'CANCELLED'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {camp.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
