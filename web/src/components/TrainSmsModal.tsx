import { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Trash2,
  Play,
  Layers,
  PlusCircle,
  Hash,
  CreditCard,
  User,
  Calendar,
  FileText,
  Phone,
} from 'lucide-react';
import { api } from '../services/api';
import { SmsPattern, ParsedSmsResult } from '../types';

interface TrainSmsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSms?: string;
  onPatternSaved?: () => void;
  onShowToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export function TrainSmsModal({
  isOpen,
  onClose,
  initialSms = '',
  onPatternSaved,
  onShowToast,
}: TrainSmsModalProps) {
  const [tab, setTab] = useState<'train' | 'manage'>('train');

  // Form states for training
  const [name, setName] = useState('');
  const [provider, setProvider] = useState<'MTN' | 'TELECEL' | 'AT' | 'BANK' | 'OTHER'>('MTN');
  const [exampleSms, setExampleSms] = useState('');
  const [amount, setAmount] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [date, setDate] = useState('');
  const [dateMissing, setDateMissing] = useState(false);
  const [note, setNote] = useState('');

  // Generated regex & test result
  const [generatedRegex, setGeneratedRegex] = useState('');
  const [amountGroup, setAmountGroup] = useState<number | null>(null);
  const [refGroup, setRefGroup] = useState<number | null>(null);
  const [senderGroup, setSenderGroup] = useState<number | null>(null);
  const [phoneGroup, setPhoneGroup] = useState<number | null>(null);
  const [dateGroup, setDateGroup] = useState<number | null>(null);
  const [noteGroup, setNoteGroup] = useState<number | null>(null);
  const [showAdvancedRegex, setShowAdvancedRegex] = useState(false);

  const [testResult, setTestResult] = useState<ParsedSmsResult['parsed'] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [trainError, setTrainError] = useState<string | null>(null);

  // Manage patterns state
  const [patterns, setPatterns] = useState<SmsPattern[]>([]);
  const [isLoadingPatterns, setIsLoadingPatterns] = useState(false);
  const [sandboxSms, setSandboxSms] = useState('');
  const [sandboxResult, setSandboxResult] = useState<ParsedSmsResult | null>(null);
  const [isTestingSandbox, setIsTestingSandbox] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialSms) {
        setExampleSms(initialSms);
        setSandboxSms(initialSms);
      }
      loadPatterns();
      setTrainError(null);
      setTestResult(null);
    }
  }, [isOpen, initialSms]);

  const loadPatterns = async () => {
    setIsLoadingPatterns(true);
    try {
      const data = await api.getSmsPatterns();
      setPatterns(data);
    } catch (err: any) {
      console.error('Failed to load patterns:', err);
    } finally {
      setIsLoadingPatterns(false);
    }
  };

  if (!isOpen) return null;

  const handleGenerateRegex = async () => {
    if (!exampleSms.trim()) {
      setTrainError('Please enter an example SMS message.');
      return;
    }
    if (!amount.trim() && !transactionRef.trim()) {
      setTrainError('Please specify at least Amount or Transaction Reference found in the message.');
      return;
    }

    setIsGenerating(true);
    setTrainError(null);
    setTestResult(null);

    try {
      const res = await api.generateSmsPattern({
        example_sms: exampleSms,
        provider,
        amount: amount.trim() || null,
        transaction_ref: transactionRef.trim() || null,
        sender_name: senderName.trim() || null,
        sender_phone: senderPhone.trim() || null,
        date: date.trim() || null,
        note: note.trim() || null,
      });

      setGeneratedRegex(res.pattern_regex);
      setAmountGroup(res.amount_group);
      setRefGroup(res.ref_group);
      setSenderGroup(res.sender_group);
      setPhoneGroup(res.phone_group);
      setDateGroup(res.date_group);
      setNoteGroup(res.note_group);
      setDateMissing(res.date_missing);
      setTestResult(res.test_result);

      if (res.test_result.amount === null && res.test_result.transaction_ref === null) {
        setTrainError('Warning: The generated regex could not match both values. Check that your field values match the exact text inside the SMS.');
      }
    } catch (err: any) {
      setTrainError(err.message || 'Failed to auto-generate pattern.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSavePattern = async () => {
    if (!name.trim()) {
      setTrainError('Please enter a descriptive name for this template.');
      return;
    }
    if (!generatedRegex.trim()) {
      setTrainError('Please generate or provide a regular expression pattern.');
      return;
    }

    setIsSaving(true);
    setTrainError(null);

    try {
      await api.createSmsPattern({
        name: name.trim(),
        provider,
        example_sms: exampleSms.trim(),
        pattern_regex: generatedRegex.trim(),
        amount_group: amountGroup,
        ref_group: refGroup,
        sender_group: senderGroup,
        phone_group: phoneGroup,
        date_group: dateGroup,
        note_group: noteGroup,
        date_missing: dateMissing,
        is_active: true,
      });

      onShowToast('success', `Trained pattern "${name}" saved and active!`);
      if (onPatternSaved) onPatternSaved();
      loadPatterns();
      setTab('manage');
    } catch (err: any) {
      setTrainError(err.message || 'Failed to save pattern.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePattern = async (p: SmsPattern) => {
    try {
      const updated = await api.toggleSmsPattern(p.id);
      setPatterns((prev) => prev.map((item) => (item.id === p.id ? updated : item)));
      onShowToast('info', `Pattern "${p.name}" is now ${updated.is_active ? 'active' : 'inactive'}.`);
    } catch (err: any) {
      onShowToast('error', err.message || 'Failed to toggle pattern.');
    }
  };

  const handleDeletePattern = async (p: SmsPattern) => {
    if (!confirm(`Delete template "${p.name}"?`)) return;
    try {
      await api.deleteSmsPattern(p.id);
      setPatterns((prev) => prev.filter((item) => item.id !== p.id));
      onShowToast('info', `Deleted template "${p.name}".`);
    } catch (err: any) {
      onShowToast('error', err.message || 'Failed to delete pattern.');
    }
  };

  const handleRunSandbox = async () => {
    if (!sandboxSms.trim()) return;
    setIsTestingSandbox(true);
    try {
      const res = await api.parseSms(sandboxSms);
      setSandboxResult(res);
    } catch (err: any) {
      onShowToast('error', err.message || 'Failed to test SMS in sandbox.');
    } finally {
      setIsTestingSandbox(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Train SMS Parser &amp; Templates
              </h2>
              <p className="text-xs text-slate-400">
                Teach the system new mobile money or bank SMS formats for 100% automated extraction
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="px-6 pt-3 flex gap-2 border-b border-slate-800 bg-slate-900">
          <button
            onClick={() => setTab('train')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-all ${
              tab === 'train'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Train New Format
          </button>
          <button
            onClick={() => {
              setTab('manage');
              loadPatterns();
            }}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-all ${
              tab === 'manage'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Manage Active Templates ({patterns.length})
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-4">
          {tab === 'train' && (
            <div className="space-y-4">
              {/* Step 1: Example Message */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  1. Paste Sample SMS in the Unrecognized Format:
                </label>
                <textarea
                  rows={3}
                  value={exampleSms}
                  onChange={(e) => setExampleSms(e.target.value)}
                  placeholder="e.g. Cash In received for GHS 200.00 from BOYE TENNO ENTERPRISE... Transaction ID: 50831423976"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Step 2: Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. MTN Cash In Agent Deposit"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Telco / Channel Provider
                  </label>
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="MTN">MTN MoMo</option>
                    <option value="TELECEL">Telecel Cash</option>
                    <option value="AT">AT Money (AirtelTigo)</option>
                    <option value="BANK">Bank Transfer Alert</option>
                    <option value="OTHER">Other / Merchant</option>
                  </select>
                </div>
              </div>

              {/* Step 3: Specify Values present in the SMS */}
              <div className="p-4 bg-slate-850 rounded-xl border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  2. Tell the system what each value is in this SMS (exact copy-paste from above):
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                      <CreditCard className="w-3 h-3 text-emerald-400" />
                      Amount in SMS *
                    </label>
                    <input
                      type="text"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="e.g. 200.00"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                      <Hash className="w-3 h-3 text-cyan-400" />
                      Transaction Reference *
                    </label>
                    <input
                      type="text"
                      value={transactionRef}
                      onChange={(e) => setTransactionRef(e.target.value)}
                      placeholder="e.g. 50831423976"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                      <User className="w-3 h-3 text-blue-400" />
                      Sender Name in SMS
                    </label>
                    <input
                      type="text"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="e.g. BOYE TENNO ENTERPRISE"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-indigo-400" />
                      Sender Phone (Optional)
                    </label>
                    <input
                      type="text"
                      value={senderPhone}
                      onChange={(e) => setSenderPhone(e.target.value)}
                      placeholder="e.g. 0244123456"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-amber-400" />
                      Date in SMS (e.g. 2026-09-30)
                    </label>
                    <input
                      type="text"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      placeholder="Leave blank if not in SMS"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                      <FileText className="w-3 h-3 text-slate-400" />
                      Note / Reference Memo
                    </label>
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="e.g. Weekly payment (optional)"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                {/* Generate Button */}
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleGenerateRegex}
                    disabled={isGenerating || !exampleSms.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Generating Regex Pattern...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        Auto-Generate &amp; Test Pattern
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Error Display */}
              {trainError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{trainError}</span>
                </div>
              )}

              {/* Test Result Display */}
              {testResult && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Pattern Test Succeeded! Extracted Data:
                    </span>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                      Verified
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1 font-mono">
                    <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Amount:</span>
                      <span className="text-emerald-400 font-bold">
                        GHS {testResult.amount !== null ? testResult.amount.toFixed(2) : 'None'}
                      </span>
                    </div>

                    <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Transaction ID:</span>
                      <span className="text-cyan-400 font-bold truncate block">
                        {testResult.transaction_ref || 'None'}
                      </span>
                    </div>

                    <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Sender:</span>
                      <span className="text-white truncate block">
                        {testResult.sender_name || 'None'}
                      </span>
                    </div>

                    <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Date:</span>
                      <span className="text-amber-400 block">
                        {testResult.entry_date} {testResult.date_missing ? '(defaulted)' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Advanced Regex toggle */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAdvancedRegex(!showAdvancedRegex)}
                      className="text-[11px] text-purple-400 hover:text-purple-300 underline"
                    >
                      {showAdvancedRegex ? 'Hide Pattern Details' : 'View Generated Regular Expression'}
                    </button>
                    {showAdvancedRegex && (
                      <div className="mt-1.5 p-2.5 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 break-all select-all">
                        {generatedRegex}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Save Action */}
              <div className="pt-3 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePattern}
                  disabled={isSaving || !generatedRegex}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg transition-all"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving Pattern...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Save &amp; Activate Pattern
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: MANAGE PATTERNS */}
          {tab === 'manage' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  These templates are evaluated before built-in telco rules.
                </span>
                <button
                  type="button"
                  onClick={() => setTab('train')}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Train New Format
                </button>
              </div>

              {isLoadingPatterns ? (
                <div className="p-8 text-center text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading templates...</span>
                </div>
              ) : patterns.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                  No custom patterns trained yet. Use the &quot;Train New Format&quot; tab to add one!
                </div>
              ) : (
                <div className="space-y-3">
                  {patterns.map((p) => (
                    <div
                      key={p.id}
                      className="p-3.5 bg-slate-850 border border-slate-800 rounded-xl space-y-2 group hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              p.provider === 'MTN'
                                ? 'bg-amber-500/20 text-amber-300'
                                : p.provider === 'TELECEL'
                                ? 'bg-rose-500/20 text-rose-300'
                                : p.provider === 'AT'
                                ? 'bg-blue-500/20 text-blue-300'
                                : 'bg-purple-500/20 text-purple-300'
                            }`}
                          >
                            {p.provider}
                          </span>
                          <span className="text-xs font-bold text-white">{p.name}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                              p.is_active
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-slate-800 text-slate-500'
                            }`}
                          >
                            {p.is_active ? 'Active' : 'Disabled'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleTogglePattern(p)}
                            className="text-[11px] text-slate-400 hover:text-slate-200 underline"
                          >
                            {p.is_active ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePattern(p)}
                            className="text-slate-500 hover:text-rose-400 p-1 rounded"
                            title="Delete template"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="p-2 bg-slate-900 rounded-lg border border-slate-800/80 font-mono text-[11px] text-slate-300 truncate">
                        {p.example_sms}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Sandbox Test Box */}
              <div className="pt-4 border-t border-slate-800 space-y-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-emerald-400" />
                  SMS Parsing Sandbox:
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={sandboxSms}
                    onChange={(e) => setSandboxSms(e.target.value)}
                    placeholder="Paste any SMS to test extraction against active templates..."
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    type="button"
                    onClick={handleRunSandbox}
                    disabled={isTestingSandbox || !sandboxSms.trim()}
                    className="flex items-center gap-1 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                  >
                    {isTestingSandbox ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      'Test Parse'
                    )}
                  </button>
                </div>

                {sandboxResult && (
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">Pattern Used:</span>
                      <span className="text-purple-400 font-semibold">{sandboxResult.parsed.pattern_name || 'Generic'}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">Amount:</span>
                      <span className="text-emerald-400 font-bold">GHS {sandboxResult.parsed.amount}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">Reference:</span>
                      <span className="text-cyan-400 font-bold">{sandboxResult.parsed.transaction_ref}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">Sender:</span>
                      <span className="text-slate-200">{sandboxResult.parsed.sender_name}</span>
                    </div>
                    {sandboxResult.suggested_worker && (
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-500">Matched Driver:</span>
                        <span className="text-emerald-400 font-bold">{sandboxResult.suggested_worker.name} ({Math.round(sandboxResult.suggested_worker.similarity * 100)}%)</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
