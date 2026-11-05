import React, { useState, useEffect, useRef } from 'react';
import { X, UploadCloud, Calendar, Clock, Send, AlertCircle, CheckCircle2, FileText } from 'lucide-react';
import Papa from 'papaparse';
import api from '../../api/client';
import { EmailSender } from '../../types';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParseResult {
  totalRecords: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  validEmails: string[];
  preview: string[];
}

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length > 254 || trimmed.length < 5) return false;
  return EMAIL_REGEX.test(trimmed);
}

function parseCSVClientSide(content: string, fileName: string): ParseResult {
  const isTxt = fileName.toLowerCase().endsWith('.txt');
  const rawEntries: string[] = [];

  if (isTxt) {
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const parts = line.split(/[,\t]/);
      for (const part of parts) {
        const cleaned = part.trim();
        if (cleaned) rawEntries.push(cleaned);
      }
    }
  } else {
    // Try with headers first
    const parsed = Papa.parse<any>(content, { header: true, skipEmptyLines: true });

    if (parsed.data && parsed.data.length > 0) {
      const firstRow = parsed.data[0];
      const headers = Object.keys(firstRow);
      const emailHeader = headers.find((h) =>
        /email|recipient|mail|address|e-mail/i.test(h.trim())
      );

      for (const row of parsed.data) {
        if (emailHeader && row[emailHeader]) {
          rawEntries.push(String(row[emailHeader]).trim());
        } else {
          // Scan all values for @ symbol
          for (const key of Object.keys(row)) {
            const val = String(row[key] || '').trim();
            if (val.includes('@') && isValidEmail(val)) {
              rawEntries.push(val);
              break;
            }
          }
        }
      }
    }

    // Also try without headers (raw email list)
    if (rawEntries.length === 0) {
      const unheadered = Papa.parse<string[]>(content, { header: false, skipEmptyLines: true });
      for (const row of unheadered.data) {
        if (Array.isArray(row)) {
          for (const cell of row) {
            const val = String(cell || '').trim();
            if (val.includes('@')) {
              rawEntries.push(val);
              break;
            }
          }
        }
      }
    }
  }

  // Dedup + validate
  const seen = new Set<string>();
  const validEmails: string[] = [];
  const invalidEmails: string[] = [];
  let duplicateCount = 0;

  for (const entry of rawEntries) {
    const cleaned = entry.trim().toLowerCase();
    if (!cleaned) continue;
    if (isValidEmail(cleaned)) {
      if (seen.has(cleaned)) {
        duplicateCount++;
      } else {
        seen.add(cleaned);
        validEmails.push(cleaned);
      }
    } else {
      invalidEmails.push(entry);
    }
  }

  return {
    totalRecords: rawEntries.length,
    validCount: validEmails.length,
    invalidCount: invalidEmails.length,
    duplicateCount,
    validEmails,
    preview: validEmails.slice(0, 5),
  };
}

export const ComposeModal: React.FC<ComposeModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [senders, setSenders] = useState<EmailSender[]>([]);
  const [selectedSenderId, setSelectedSenderId] = useState('');
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [startDate, setStartDate] = useState(
    new Date(Date.now() + 60000).toISOString().slice(0, 16)
  );
  const [delayBetweenEmails, setDelayBetweenEmails] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(100);

  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [parsing, setParsing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadSenders();
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setFile(null);
    setParseResult(null);
    setError(null);
    setName('');
    setSubject('');
    setBody('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const loadSenders = async () => {
    try {
      const res = await api.get('/senders');
      setSenders(res.data.senders || []);
      if (res.data.senders?.length > 0) {
        setSelectedSenderId(res.data.senders[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load senders:', err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);
    setParseResult(null);
    setParsing(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      try {
        const result = parseCSVClientSide(content, selectedFile.name);
        setParseResult(result);
        if (result.validCount === 0) {
          setError(
            `No valid email addresses found in "${selectedFile.name}". ` +
            `Make sure your CSV has an "email" column or contains raw email addresses.`
          );
        }
      } catch (err) {
        setError('Failed to parse file. Please upload a valid CSV or TXT file.');
      } finally {
        setParsing(false);
      }
    };
    reader.onerror = () => {
      setError('Failed to read file.');
      setParsing(false);
    };
    reader.readAsText(selectedFile);
  };

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedSenderId) {
      setError('Please select an active email sender.');
      return;
    }

    if (!parseResult || parseResult.validEmails.length === 0) {
      setError('Please upload a valid CSV or TXT file with at least 1 email address.');
      return;
    }

    setScheduling(true);
    try {
      await api.post('/campaigns', {
        name,
        subject,
        body,
        senderId: selectedSenderId,
        recipients: parseResult.validEmails,
        startTime: new Date(startDate).toISOString(),
        delayBetweenEmails: Number(delayBetweenEmails),
        hourlyLimit: Number(hourlyLimit),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to schedule campaign.');
    } finally {
      setScheduling(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Compose New Campaign</h2>
            <p className="text-xs text-slate-400">
              Schedule bulk emails with rate limiting &amp; BullMQ delayed jobs.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSchedule} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Campaign Name & Sender */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Campaign Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Q4 Outreach Campaign"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Sender Account</label>
              <select
                value={selectedSenderId}
                onChange={(e) => setSelectedSenderId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-white text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              >
                {senders.length === 0 && (
                  <option value="">No senders configured — go to Settings</option>
                )}
                {senders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName} ({s.email}) {s.isDefault ? '— Default' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Email Subject</label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Exploring partnerships with ReachInbox"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Email Body</label>
            <textarea
              required
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email message here..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Upload Recipient Leads (CSV or TXT)
            </label>
            <div className="border-2 border-dashed border-slate-700 hover:border-emerald-600 rounded-xl p-5 text-center cursor-pointer transition-colors relative bg-slate-800/30">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <div className="text-xs text-slate-300 font-medium">
                {file ? file.name : 'Click to select or drag & drop CSV/TXT file'}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                CSV must have an <code className="text-emerald-400">email</code> column, or be a plain list of emails. Max 5MB.
              </div>
            </div>

            {/* CSV format hint */}
            {!parseResult && !parsing && (
              <div className="mt-2 p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1">
                  <FileText className="w-3 h-3" />
                  <span className="font-medium text-slate-300">Accepted CSV formats:</span>
                </div>
                <div className="text-[10px] text-slate-500 space-y-0.5 font-mono">
                  <div>• With header: <span className="text-emerald-400">email,name,company</span></div>
                  <div>• Raw list: one email per line</div>
                  <div>• Mixed columns: any column with @ is auto-detected</div>
                </div>
              </div>
            )}

            {parsing && (
              <div className="text-xs text-indigo-400 mt-2 font-medium">Parsing recipients...</div>
            )}

            {parseResult && (
              <div className="mt-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="text-slate-400 text-[10px]">Total Rows</div>
                    <div className="font-semibold text-white">{parseResult.totalRecords}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-800/50">
                    <div className="text-emerald-400 text-[10px]">Valid Emails</div>
                    <div className="font-semibold text-emerald-300">{parseResult.validCount}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-950/30 border border-amber-800/50">
                    <div className="text-amber-400 text-[10px]">Duplicates</div>
                    <div className="font-semibold text-amber-300">{parseResult.duplicateCount}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-rose-950/30 border border-rose-800/50">
                    <div className="text-rose-400 text-[10px]">Invalid</div>
                    <div className="font-semibold text-rose-300">{parseResult.invalidCount}</div>
                  </div>
                </div>
                {parseResult.preview.length > 0 && (
                  <div className="text-[10px] text-slate-400 pt-1">
                    <span className="font-medium text-slate-300">Preview: </span>
                    {parseResult.preview.join(', ')}
                    {parseResult.validCount > 5 ? ` +${parseResult.validCount - 5} more` : ''}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Schedule Config */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-slate-950/50 border border-slate-800">
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>Start Time</span>
              </label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Delay (ms)</span>
              </label>
              <input
                type="number"
                min={0}
                step={500}
                value={delayBetweenEmails}
                onChange={(e) => setDelayBetweenEmails(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Max / Hour</span>
              </label>
              <input
                type="number"
                min={1}
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={scheduling}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={scheduling || parsing || (parseResult?.validCount === 0)}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-xs font-semibold shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{scheduling ? 'Scheduling Jobs...' : `Schedule Campaign${parseResult?.validCount ? ` (${parseResult.validCount} emails)` : ''}`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
