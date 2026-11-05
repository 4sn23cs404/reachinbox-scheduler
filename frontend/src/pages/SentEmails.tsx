import React, { useEffect, useState } from 'react';
import { Search, ExternalLink, RefreshCw, RotateCcw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import api from '../api/client';
import { ScheduledEmail } from '../types';

export const SentEmails: React.FC = () => {
  const [emails, setEmails] = useState<ScheduledEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const fetchSent = async () => {
    try {
      setLoading(true);
      const res = await api.get('/emails/sent', {
        params: { page, limit: 10, search, status: statusFilter || undefined },
      });
      setEmails(res.data.emails || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
    } catch (err) {
      console.error('Failed to load sent emails:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSent();
  }, [page, search, statusFilter]);

  const handleRetry = async (emailId: string) => {
    try {
      setRetryingId(emailId);
      await api.post(`/emails/${emailId}/retry`);
      fetchSent();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to retry email.');
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Sent & Delivery Log</h1>
          <p className="text-xs text-slate-400 mt-1">
            Historical log of dispatched emails, delivery statuses, and Ethereal preview links.
          </p>
        </div>
        <button
          onClick={fetchSent}
          className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by recipient or subject..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setStatusFilter('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === ''
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter('sent')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === 'sent'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Delivered
          </button>
          <button
            onClick={() => setStatusFilter('failed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === 'failed'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Failed
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
        {loading ? (
          <div className="py-16 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
            <span>Loading delivery history...</span>
          </div>
        ) : emails.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-xs">
            No sent or failed email records found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="pb-3 font-medium">Recipient</th>
                  <th className="pb-3 font-medium">Subject</th>
                  <th className="pb-3 font-medium">Campaign</th>
                  <th className="pb-3 font-medium">Dispatched Time</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Ethereal Preview</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {emails.map((email) => (
                  <tr key={email.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 font-semibold text-white">{email.recipientEmail}</td>
                    <td className="py-3 text-slate-300 max-w-xs truncate">{email.subject}</td>
                    <td className="py-3 text-slate-400">{email.campaign?.name || '—'}</td>
                    <td className="py-3 text-slate-400">
                      {email.sentAt ? new Date(email.sentAt).toLocaleString() : '—'}
                    </td>
                    <td className="py-3">
                      {email.status === 'sent' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Delivered</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/30">
                          <AlertTriangle className="w-3 h-3" />
                          <span>{email.status}</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3">
                      {email.etherealPreviewUrl ? (
                        <a
                          href={email.etherealPreviewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium underline"
                        >
                          <span>View Preview</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-500 text-[11px]">—</span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      {email.status === 'failed' && (
                        <button
                          onClick={() => handleRetry(email.id)}
                          disabled={retryingId === email.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Retry</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-800 text-xs text-slate-400">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 disabled:opacity-40 text-white"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 disabled:opacity-40 text-white"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
