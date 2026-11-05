import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  User,
  Mail,
  Plus,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Trash2,
  ShieldAlert,
} from 'lucide-react';
import api from '../api/client';
import { EmailSender, SlackStatus } from '../types';

export const Settings: React.FC = () => {
  const { user } = useAuth();
  const [senders, setSenders] = useState<EmailSender[]>([]);
  const [slackStatus, setSlackStatus] = useState<SlackStatus | null>(null);

  // New sender form
  const [showAddSender, setShowAddSender] = useState(false);
  const [senderEmail, setSenderEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [savingSender, setSavingSender] = useState(false);

  // Status message
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchSettings = async () => {
    try {
      const [sendersRes, slackRes] = await Promise.all([
        api.get('/senders'),
        api.get('/slack/status'),
      ]);
      setSenders(sendersRes.data.senders || []);
      setSlackStatus(slackRes.data);
    } catch (err: any) {
      console.error('Failed to load settings:', err);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleAddSender = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSender(true);
    setMessage(null);
    try {
      await api.post('/senders', {
        email: senderEmail,
        displayName,
        isDefault,
      });
      setMessage({ text: 'Sender added successfully!', type: 'success' });
      setSenderEmail('');
      setDisplayName('');
      setIsDefault(false);
      setShowAddSender(false);
      fetchSettings();
    } catch (err: any) {
      setMessage({
        text: err.response?.data?.message || 'Failed to add sender.',
        type: 'error',
      });
    } finally {
      setSavingSender(false);
    }
  };

  const handleDeleteSender = async (id: string) => {
    if (!confirm('Are you sure you want to remove this sender?')) return;
    try {
      await api.delete(`/senders/${id}`);
      fetchSettings();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete sender');
    }
  };

  const handleConnectSlack = () => {
    window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/slack/connect`;
  };

  const handleDisconnectSlack = async () => {
    if (!confirm('Disconnect Slack notifications?')) return;
    try {
      await api.post('/slack/disconnect');
      fetchSettings();
    } catch (err: any) {
      alert('Failed to disconnect Slack.');
    }
  };

  const handleTestSlack = async () => {
    try {
      await api.post('/slack/test');
      alert('Test notification sent successfully to your Slack workspace!');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to send test message');
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">System Settings</h1>
        <p className="text-xs text-slate-400 mt-1">
          Manage your authenticated identity, email dispatchers, and Slack rate-limit webhooks.
        </p>
      </div>

      {message && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* 1. User Profile */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
          <User className="w-4 h-4 text-indigo-400" />
          <h2 className="text-sm font-semibold text-white">Google Profile</h2>
        </div>
        <div className="flex items-center gap-4">
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              className="w-14 h-14 rounded-full border-2 border-slate-700 object-cover"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-lg font-bold text-slate-200">
              {user?.name?.charAt(0) || 'U'}
            </div>
          )}
          <div>
            <div className="text-sm font-semibold text-white">{user?.name}</div>
            <div className="text-xs text-slate-400">{user?.email}</div>
            <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-medium">
              <CheckCircle2 className="w-3 h-3" />
              <span>Google OAuth 2.0 Authenticated</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Sender Accounts Management */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white">Email Senders</h2>
          </div>
          <button
            onClick={() => setShowAddSender(!showAddSender)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-medium border border-emerald-500/30 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Sender</span>
          </button>
        </div>

        {showAddSender && (
          <form
            onSubmit={handleAddSender}
            className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3"
          >
            <div className="text-xs font-semibold text-slate-200">Configure New Sender</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Sales Team"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  placeholder="sender@domain.com"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="defaultCheck"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0"
              />
              <label htmlFor="defaultCheck" className="text-xs text-slate-300">
                Set as default sender
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddSender(false)}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingSender}
                className="px-4 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-semibold"
              >
                {savingSender ? 'Saving...' : 'Save Sender'}
              </button>
            </div>
          </form>
        )}

        <div className="divide-y divide-slate-800">
          {senders.map((s) => (
            <div key={s.id} className="py-3 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-white flex items-center gap-2">
                  <span>{s.displayName}</span>
                  {s.isDefault && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Default
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400">{s.email}</div>
              </div>
              <button
                onClick={() => handleDeleteSender(s.id)}
                className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                title="Remove sender"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Real Slack OAuth 2.0 Integration */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-white">Slack Rate-Limit Notifications</h2>
          </div>
          <span className="text-xs text-slate-400">Mandatory Integration</span>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          When a sender reaches their configured hourly threshold, our BullMQ rate-limiter automatically reschedules the overflow jobs and dispatches an immediate notification to your connected Slack workspace.
        </p>

        {slackStatus?.isConnected ? (
          <div className="p-4 rounded-xl bg-slate-950/80 border border-emerald-800/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Connected to Slack Workspace: {slackStatus.teamName || 'Active'}</span>
              </div>
              <span className="text-[10px] text-slate-400">
                Channel: #{slackStatus.channelName || 'general'}
              </span>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleTestSlack}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold shadow-md transition-colors"
              >
                Send Test Alert
              </button>
              <button
                onClick={handleDisconnectSlack}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-300 text-xs font-medium transition-colors"
              >
                Disconnect Slack
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-200">Slack Disconnected</div>
              <div className="text-[11px] text-slate-500">
                Connect your workspace to receive real-time rate limit alerts.
              </div>
            </div>
            <button
              onClick={handleConnectSlack}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#4A154B] hover:bg-[#611f69] text-white text-xs font-semibold shadow-md transition-all active:scale-[0.98]"
            >
              <span>Connect Slack</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
