import React, { useState } from 'react';
import { Search, ExternalLink, Calendar, Filter } from 'lucide-react';
import api from '../api/client';

export const SearchEmails: React.FC = () => {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [totalHits, setTotalHits] = useState(0);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setLoading(true);
      setSearched(true);
      const res = await api.get('/search/emails', {
        params: {
          q: query || undefined,
          status: status || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        },
      });

      setResults(res.data.emails || []);
      setTotalHits(res.data.pagination?.total || 0);
    } catch (err: any) {
      console.error('Elasticsearch search error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Elasticsearch Email Search</h1>
        <p className="text-xs text-slate-400 mt-1">
          High-performance full-text search across recipients, subjects, email bodies, campaigns, and senders.
        </p>
      </div>

      {/* Search & Filter Form */}
      <form onSubmit={handleSearch} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search keywords (e.g., recipient email, campaign name, subject words)..."
            className="w-full pl-10 pr-28 py-3 rounded-xl bg-slate-800/80 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold shadow-md transition-colors"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800/60 text-xs">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-slate-500" />
              <span>Status</span>
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs"
            >
              <option value="">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="processing">Processing</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-500" />
              <span>From Date</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-500" />
              <span>To Date</span>
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs"
            />
          </div>
        </div>
      </form>

      {/* Results Box */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Search Results</h2>
          {searched && (
            <span className="text-xs text-slate-400">
              Found <strong className="text-emerald-400">{totalHits}</strong> matching documents in Elasticsearch
            </span>
          )}
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-500 text-xs">Querying Elasticsearch cluster...</div>
        ) : !searched ? (
          <div className="py-16 text-center text-slate-500 text-xs">
            Enter a query above to search documents indexed in Elasticsearch.
          </div>
        ) : results.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-xs">
            No emails matched your search criteria.
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
                  <th className="pb-3 font-medium">Scheduled</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Preview</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {results.map((email) => (
                  <tr key={email.emailId || email.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 font-semibold text-white">{email.recipientEmail}</td>
                    <td className="py-3 text-slate-300 max-w-xs truncate">{email.subject}</td>
                    <td className="py-3 text-slate-400">{email.campaignName || '—'}</td>
                    <td className="py-3 text-slate-400">{email.senderEmail || '—'}</td>
                    <td className="py-3 text-slate-400">
                      {email.scheduledAt ? new Date(email.scheduledAt).toLocaleString() : '—'}
                    </td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                          email.status === 'sent'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : email.status === 'failed'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {email.status}
                      </span>
                    </td>
                    <td className="py-3">
                      {email.etherealPreviewUrl ? (
                        <a
                          href={email.etherealPreviewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium"
                        >
                          <span>Preview</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-500 text-[11px]">—</span>
                      )}
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
