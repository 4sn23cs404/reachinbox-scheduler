import React, { useEffect, useState } from 'react';
import { Search, Clock, RefreshCw, XCircle } from 'lucide-react';
import api from '../api/client';
import { ScheduledEmail } from '../types';

export const ScheduledEmails: React.FC = () => {
  const [emails, setEmails] = useState<ScheduledEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchScheduled = async () => {
    try {
      setLoading(true);
      const res = await api.get('/emails/scheduled', {
        params: { page, limit: 10, search },
      });
      setEmails(res.data.emails || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
    } catch (err) {
      console.error('Failed to load scheduled emails:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScheduled();
  }, [page, search]);

  const handleCancelCampaign = async (campaignId: string) => {
    if (!confirm('Are you sure you want to cancel pending emails for this campaign?')) return;
    try {
      setCancellingId(campaignId);
      await api.post(`/campaigns/${campaignId}/cancel`);
      fetchScheduled();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to cancel campaign.');
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Scheduled Emails</h1>
          <p className="text-xs text-slate-400 mt-1">
            Emails queued in BullMQ waiting for their designated dispatch times.
          </p>
        </div>
        <button
          onClick={fetchScheduled}
          className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
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

      {/* Table */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
        {loading ? (
          <div className="py-16 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
            <span>Loading scheduled queue...</span>
          </div>
        ) : emails.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-xs">
            No scheduled emails found matching your filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="pb-3 font-medium">Recipient</th>
                  <th className="pb-3 font-medium">Subject</th>
                  <th className="pb-3 font-medium">Campaign</th>
                  <th className="pb-3 font-medium">Sender</th>
                  <th className="pb-3 font-medium">Scheduled Time</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {emails.map((email) => (
                  <tr key={email.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 font-semibold text-white">{email.recipientEmail}</td>
                    <td className="py-3 text-slate-300 max-w-xs truncate">{email.subject}</td>
                    <td className="py-3 text-slate-400">{email.campaign?.name || '—'}</td>
                    <td className="py-3 text-slate-400">{email.sender?.email || '—'}</td>
                    <td className="py-3 text-slate-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>{new Date(email.scheduledAt).toLocaleString()}</span>
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        {email.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {email.campaignId && (
                        <button
                          onClick={() => handleCancelCampaign(email.campaignId)}
                          disabled={cancellingId === email.campaignId}
                          title="Cancel this campaign"
                          className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors"
                        >
                          <XCircle className="w-4 h-4" />
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
