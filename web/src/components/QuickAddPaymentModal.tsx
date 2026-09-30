import { useState, useEffect } from 'react';
import {
  X,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  CreditCard,
  User,
  Hash,
  FileText,
  BookmarkPlus,
  Loader2,
  Phone,
  Car,
  Wallet,
  Sparkles,
} from 'lucide-react';
import { api } from '../services/api';
import { Worker, ParsedSmsResult, PaymentMode } from '../types';
import { formatDateInput } from '../utils/formatters';
import { TrainSmsModal } from './TrainSmsModal';

interface QuickAddPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  workers: Worker[];
  preselectedWorkerId?: string | null;
  onPaymentSuccess: (msg: string) => void;
  onShowToast?: (type: 'success' | 'error' | 'info', message: string) => void;
}

const SAMPLE_MESSAGES = [
  {
    label: 'MTN MoMo (Kofi Oduro - GHS 410)',
    text: 'Payment received for GHS 410.00 from Kofi Oduro  Current Balance: GHS 410.44 . Available Balance: GHS 410.44. Reference: Data. Transaction ID: 89601310174. TRANSACTION FEE: 0.00',
  },
  {
    label: 'MTN MoMo (Abakah Kojo - GHS 53)',
    text: 'Payment received for GHS 53.00 from ABAKAH KOJO  Current Balance: GHS 100.03 . Available Balance: GHS 100.03. Reference: ABAKAH KOJO ,233529282215,1 from VODAFONE. Transaction ID: 89195251384. TRANSACTION FEE: 0.00',
  },
  {
    label: 'Telecel Cash (Dankyi Ebenezer - GHS 56)',
    text: '0000014592375973 Confirmed. You have received GHS56.00 from MTN MOBILE MONEY with transaction reference: Transfer From: 233540276077-DANKYI-EBENEZER  on 2026-09-22 at 06:26:04. Your Telecel Cash balance is GHS59.63.\nRef: Edk.\nStay alert. Never share your PIN or OTP with anyone or click unknown links. Protect your personal information.',
  },
  {
    label: 'Telecel Cash (Nana Kweku - GHS 15)',
    text: '0000014535180494 Confirmed. You have received GHS15.00 from 233504938290 - OPPONG-NANA KWEKU on 2026-09-19 at 21:37:35. Your Telecel Cash balance is GHS15.00. Reference: Spotify.\nStay alert. Never share your PIN or OTP with anyone or click unknown links. Protect your personal information',
  },
];

export function QuickAddPaymentModal({
  isOpen,
  onClose,
  workers,
  preselectedWorkerId,
  onPaymentSuccess,
  onShowToast,
}: QuickAddPaymentModalProps) {
  const [tab, setTab] = useState<'paste' | 'confirm' | 'manual'>('paste');
  const [rawSms, setRawSms] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Train SMS Modal state
  const [isTrainModalOpen, setIsTrainModalOpen] = useState(false);
  const [trainSmsPrefill, setTrainSmsPrefill] = useState('');

  const handleOpenTrain = (sms?: string) => {
    setTrainSmsPrefill(sms || rawSms || '');
    setIsTrainModalOpen(true);
  };

  // Form fields for confirm/save
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [entryDate, setEntryDate] = useState<string>(formatDateInput(null));
  const [dateMissingFlag, setDateMissingFlag] = useState<boolean>(false);
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [senderName, setSenderName] = useState<string>('');
  const [provider, setProvider] = useState<string>('MTN');
  const [note, setNote] = useState<string>('');
  const [entryType, setEntryType] = useState<'PAYMENT' | 'DEBT_ADDED'>('PAYMENT');
  const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]);
  const [paymentMode, setPaymentMode] = useState<string>('Momo');
  const [rememberAlias, setRememberAlias] = useState<boolean>(false);
  const [suggestedMatchInfo, setSuggestedMatchInfo] = useState<{
    text: string;
    score: number;
  } | null>(null);

  // Fetch payment modes on mount
  useEffect(() => {
    api
      .getPaymentModes()
      .then((modes) => {
        if (modes && modes.length > 0) {
          setPaymentModes(modes);
        } else {
          setPaymentModes([
            { id: '1', name: 'Momo' },
            { id: '2', name: 'Cash' },
            { id: '3', name: 'Bank Transfer' },
          ]);
        }
      })
      .catch(() => {
        setPaymentModes([
          { id: '1', name: 'Momo' },
          { id: '2', name: 'Cash' },
          { id: '3', name: 'Bank Transfer' },
        ]);
      });
  }, []);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setTab('paste');
      setRawSms('');
      setParseError(null);
      setSaveError(null);
      setDateMissingFlag(false);
      setSuggestedMatchInfo(null);
      setSelectedWorkerId(preselectedWorkerId || (workers[0]?.id ?? ''));
      setAmount('');
      setEntryDate(formatDateInput(null));
      setTransactionRef('');
      setSenderName('');
      setPaymentMode('Momo');
      setProvider('MTN');
      setNote('');
      setEntryType('PAYMENT');
      setRememberAlias(false);
    }
  }, [isOpen, preselectedWorkerId, workers]);

  // Adjust rememberAlias checkbox when selectedWorkerId or senderName changes
  useEffect(() => {
    if (!senderName || !selectedWorkerId) {
      setRememberAlias(false);
      return;
    }
    const currentWorker = workers.find((w) => w.id === selectedWorkerId);
    if (currentWorker) {
      const workerNameNorm = currentWorker.name.trim().toLowerCase();
      const senderNameNorm = senderName.trim().toLowerCase();
      // If sender name is not identical to worker's real name, default to true
      setRememberAlias(workerNameNorm !== senderNameNorm);
    }
  }, [selectedWorkerId, senderName, workers]);

  if (!isOpen) return null;

  const handleParse = async () => {
    if (!rawSms.trim()) {
      setParseError('Please paste an SMS message to parse.');
      return;
    }

    setIsParsing(true);
    setParseError(null);
    setSaveError(null);

    try {
      const res: ParsedSmsResult = await api.parseSms(rawSms);
      const parsed = res.parsed;

      // Populate form fields
      setAmount(parsed.amount !== null ? String(parsed.amount) : '');
      setEntryDate(formatDateInput(parsed.entry_date));
      setDateMissingFlag(parsed.date_missing);
      setTransactionRef(parsed.transaction_ref || '');
      setSenderName(parsed.sender_name || '');
      setProvider(parsed.provider || 'MTN');
      setPaymentMode('Momo');
      setNote(parsed.note || '');
      setEntryType('PAYMENT');

      // Worker assignment
      if (res.suggested_worker) {
        setSelectedWorkerId(res.suggested_worker.id);
        const simPct = Math.round(res.suggested_worker.similarity * 100);
        const matchLabel =
          res.suggested_worker.matched_on === 'phone'
            ? 'Direct Phone Match (100%)'
            : res.suggested_worker.matched_on.includes('alias')
            ? `Alias Match (${simPct}%)`
            : `Name Match (${simPct}%)`;
        setSuggestedMatchInfo({
          text: `${res.suggested_worker.name} — ${matchLabel}`,
          score: res.suggested_worker.similarity,
        });
      } else if (preselectedWorkerId) {
        setSelectedWorkerId(preselectedWorkerId);
        setSuggestedMatchInfo(null);
      } else {
        setSelectedWorkerId(workers[0]?.id || '');
        setSuggestedMatchInfo(null);
      }

      setTab('confirm');
    } catch (err: any) {
      setParseError(err.message || 'Failed to parse SMS message.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleSave = async () => {
    if (!selectedWorkerId) {
      setSaveError('Please select a worker for this transaction.');
      return;
    }

    const numAmount = parseFloat(amount.replace(/,/g, ''));
    if (isNaN(numAmount) || numAmount <= 0) {
      setSaveError('Please enter a valid amount greater than 0.');
      return;
    }

    if (!entryDate) {
      setSaveError('Please select a transaction date.');
      return;
    }

    if (!paymentMode) {
      setSaveError('Please select a mode of payment (Momo, Cash, or Bank Transfer).');
      return;
    }

    if (!transactionRef.trim()) {
      setSaveError('Please enter a transaction reference.');
      return;
    }

    if (!senderName.trim()) {
      setSaveError('Please enter a sender name.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      await api.createLedgerEntry(selectedWorkerId, {
        type: entryType,
        amount: numAmount,
        entry_date: entryDate,
        payment_mode: paymentMode,
        transaction_ref: transactionRef.trim(),
        sender_name: senderName.trim(),
        source: tab === 'confirm' ? 'SMS_PARSED' : 'MANUAL',
        provider: paymentMode === 'Momo' ? provider : null,
        note: note.trim() || null,
        save_alias_if_new: rememberAlias,
      });

      const workerObj = workers.find((w) => w.id === selectedWorkerId);
      const workerName = workerObj?.name || 'Worker';
      onPaymentSuccess(
        `Recorded ${entryType === 'PAYMENT' ? 'payment' : 'debt'} of GHS ${numAmount.toFixed(
          2
        )} for ${workerName} successfully.`
      );
      onClose();
    } catch (err: any) {
      if (err.status === 409 || err.details?.error === 'DUPLICATE_TRANSACTION') {
        const conflict = err.details?.existing_entry;
        const conflictDate = conflict?.entry_date
          ? new Date(conflict.entry_date).toLocaleDateString()
          : 'a previous date';
        const conflictWorker = conflict?.worker_name
          ? `worker "${conflict.worker_name}"`
          : 'another worker';
        setSaveError(
          `Duplicate Transaction! Reference "${transactionRef}" has already been recorded for ${conflictWorker} on ${conflictDate}.`
        );
      } else {
        setSaveError(err.message || 'Failed to record entry.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const selectedWorker = workers.find((w) => w.id === selectedWorkerId);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {tab === 'confirm'
                  ? 'Confirm Payment Details'
                  : tab === 'manual'
                  ? 'Add Manual Ledger Entry'
                  : 'Quick Add Payment (Paste SMS)'}
              </h2>
              <p className="text-xs text-slate-400">
                {tab === 'confirm'
                  ? 'Review extracted mobile money data before recording'
                  : tab === 'manual'
                  ? 'Record a manual payment or debt addition without SMS'
                  : 'Paste MTN MoMo or Telecel Cash SMS for automated field extraction'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenTrain(rawSms)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-colors"
              title="Train or teach new SMS templates to the parser"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Train Parser</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs inside modal */}
        <div className="px-6 pt-3 flex gap-2 border-b border-slate-800 bg-slate-900">
          <button
            onClick={() => setTab('paste')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all ${
              tab === 'paste'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Paste SMS
          </button>
          {tab === 'confirm' && (
            <button
              onClick={() => setTab('confirm')}
              className="pb-2.5 px-3 text-xs font-semibold border-b-2 border-emerald-500 text-emerald-400"
            >
              Confirm Extracted Data
            </button>
          )}
          <button
            onClick={() => {
              setTab('manual');
              setDateMissingFlag(false);
              setTransactionRef('');
            }}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all ${
              tab === 'manual'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Manual Entry Form
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-4">
          {/* TAB 1: PASTE SMS */}
          {tab === 'paste' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Paste Raw Mobile Money SMS Message:
                </label>
                <textarea
                  rows={4}
                  value={rawSms}
                  onChange={(e) => setRawSms(e.target.value)}
                  placeholder="e.g. Payment received for GHS 410.00 from Kofi Oduro ... Transaction ID: 89601310174"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono text-xs leading-relaxed"
                />
              </div>

              {/* Sample Quick-Test Buttons */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-slate-400">
                  Or test with actual telco message samples:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SAMPLE_MESSAGES.map((sample, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setRawSms(sample.text)}
                      className="text-left text-xs bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 rounded-lg p-2.5 transition-colors group"
                    >
                      <div className="font-semibold text-slate-300 group-hover:text-emerald-400">
                        {sample.label}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">
                        {sample.text}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {parseError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{parseError}</span>
                  </div>
                  <div className="pt-2 border-t border-rose-500/20 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-slate-300 text-[11px]">
                      Is this a new SMS format or provider?
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenTrain(rawSms)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-500/40 text-xs font-semibold transition-all"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Teach / Train Parser this SMS →
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleParse}
                  disabled={isParsing || !rawSms.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all"
                >
                  {isParsing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Parsing SMS...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 fill-current" />
                      Parse Message
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2 & 3: CONFIRM EXTRACTED DATA / MANUAL ENTRY */}
          {(tab === 'confirm' || tab === 'manual') && (
            <div className="space-y-4">
              {/* Date Missing Alert for MTN messages */}
              {dateMissingFlag && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-amber-300">
                      Date not included in MTN MoMo SMS:
                    </span>{' '}
                    The transaction date has been defaulted to today. Please
                    confirm or adjust the date below before saving.
                  </div>
                </div>
              )}

              {/* Suggested Match Banner */}
              {tab === 'confirm' && suggestedMatchInfo && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      <strong className="text-white">Suggested Worker:</strong>{' '}
                      {suggestedMatchInfo.text}
                    </span>
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                    Auto-Matched
                  </span>
                </div>
              )}

              {/* Worker Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-blue-400" />
                  Assign to Worker / Driver *
                </label>
                <select
                  value={selectedWorkerId}
                  onChange={(e) => setSelectedWorkerId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="" disabled>
                    -- Select Worker --
                  </option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} {w.car_type ? `(${w.car_type})` : ''}{' '}
                      {w.number_plate ? `[${w.number_plate}]` : ''} — Balance:{' '}
                      GHS {w.outstanding_debt.toLocaleString()}
                    </option>
                  ))}
                </select>
                {selectedWorker && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-slate-400 px-1">
                    {selectedWorker.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {selectedWorker.phone}
                      </span>
                    )}
                    {selectedWorker.number_plate && (
                      <span className="flex items-center gap-1">
                        <Car className="w-3 h-3 text-slate-400" />
                        {selectedWorker.number_plate}
                      </span>
                    )}
                    <span>
                      Target: GHS {selectedWorker.expected_weekly_payment}/wk
                    </span>
                  </div>
                )}
              </div>

              {/* Amount & Entry Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                    Amount (GHS) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">
                      GHS
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-12 pr-3 py-2 text-sm text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                    Transaction Date *
                  </label>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Mode of Payment & Entry Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-purple-400" />
                    Mode of Payment *
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-sm text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {paymentModes.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Entry Type *
                  </label>
                  <select
                    value={entryType}
                    onChange={(e) =>
                      setEntryType(e.target.value as 'PAYMENT' | 'DEBT_ADDED')
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="PAYMENT">PAYMENT (Reduces Debt)</option>
                    <option value="DEBT_ADDED">DEBT_ADDED (Increases Debt)</option>
                  </select>
                </div>
              </div>

              {/* Transaction Ref & Sender Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-cyan-400" />
                    Transaction Reference (Unique ID) *
                  </label>
                  <input
                    type="text"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    placeholder="e.g. 89601310174 (duplicate guard)"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-sm text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      Sender Name (from SMS or Transfer) *
                    </label>
                    {selectedWorker && ((selectedWorker.aliases && selectedWorker.aliases.length > 0) || selectedWorker.phone) && (
                      <span className="text-[10px] text-emerald-400 font-medium">
                        Aliases available
                      </span>
                    )}
                  </div>

                  {/* Driver Alias Dropdown Quick-Select */}
                  {selectedWorker && (
                    <div className="mb-1.5">
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            setSenderName(e.target.value);
                          }
                        }}
                        className="w-full bg-slate-900 border border-slate-700 hover:border-emerald-500/60 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
                      >
                        <option value="">
                          ▼ Fill from {selectedWorker.name}&apos;s aliases / name...
                        </option>
                        <option value={selectedWorker.name}>
                          👤 {selectedWorker.name} (Primary Name)
                        </option>
                        {selectedWorker.aliases && selectedWorker.aliases.length > 0 && (
                          <optgroup label="Driver's Saved Aliases">
                            {selectedWorker.aliases.map((alias) => (
                              <option key={alias.id} value={alias.alias_name}>
                                🏷️ {alias.alias_name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {selectedWorker.phone && (
                          <option value={selectedWorker.phone}>
                            📞 {selectedWorker.phone} (Phone)
                          </option>
                        )}
                      </select>
                    </div>
                  )}

                  <div className="relative">
                    <input
                      type="text"
                      list="quickadd-worker-aliases"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="e.g. Kofi Oduro / Akornor Ventures"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <datalist id="quickadd-worker-aliases">
                      {selectedWorker && (
                        <>
                          <option value={selectedWorker.name} />
                          {selectedWorker.aliases?.map((a) => (
                            <option key={a.id} value={a.alias_name} />
                          ))}
                          {selectedWorker.phone && <option value={selectedWorker.phone} />}
                        </>
                      )}
                    </datalist>
                  </div>

                  {/* Quick Clickable Alias Chips */}
                  {selectedWorker && selectedWorker.aliases && selectedWorker.aliases.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-slate-400">Quick fill:</span>
                      <button
                        type="button"
                        onClick={() => setSenderName(selectedWorker.name)}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors"
                      >
                        {selectedWorker.name}
                      </button>
                      {selectedWorker.aliases.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setSenderName(a.alias_name)}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition-colors"
                        >
                          🏷️ {a.alias_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Telco Provider (when Momo is selected) */}
              {paymentMode === 'Momo' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Telco Provider *
                  </label>
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="MTN">MTN MoMo</option>
                    <option value="TELECEL">Telecel Cash</option>
                    <option value="OTHER">Other / Manual</option>
                  </select>
                </div>
              )}

              {/* Remember Alias Checkbox */}
              {senderName.trim() && (
                <div className="p-3 bg-slate-850 border border-slate-700/80 rounded-xl flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="rememberAlias"
                    checked={rememberAlias}
                    onChange={(e) => setRememberAlias(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded text-emerald-500 bg-slate-900 border-slate-700 focus:ring-emerald-500"
                  />
                  <label
                    htmlFor="rememberAlias"
                    className="text-xs text-slate-300 leading-relaxed cursor-pointer"
                  >
                    <span className="font-semibold text-emerald-400 flex items-center gap-1 inline">
                      <BookmarkPlus className="w-3.5 h-3.5 inline mr-1" />
                      Remember &quot;{senderName}&quot; as an alias
                    </span>{' '}
                    for {selectedWorker?.name || 'this worker'}. Future payments
                    from this name will automatically match this worker.
                  </label>
                </div>
              )}

              {/* Note / Memo */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    Notes / Memo
                  </span>
                  <span className="text-[11px] text-slate-400 font-normal">
                    (Optional — the only non-mandatory field)
                  </span>
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Week 18 payment, Spotify ref (leave blank if none)"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Save Error Display */}
              {saveError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <span className="leading-relaxed">{saveError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex justify-between items-center gap-3">
                {tab === 'confirm' && (
                  <button
                    type="button"
                    onClick={() => setTab('paste')}
                    className="text-xs text-slate-400 hover:text-slate-200 underline"
                  >
                    ← Back to SMS
                  </button>
                )}
                {tab === 'manual' && <div />}

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving Entry...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Confirm & Save Entry
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dynamic SMS Parser Training & Template Management Modal */}
      <TrainSmsModal
        isOpen={isTrainModalOpen}
        onClose={() => setIsTrainModalOpen(false)}
        initialSms={trainSmsPrefill}
        onPatternSaved={() => {
          if (onShowToast) {
            onShowToast('success', 'SMS Pattern saved and ready to use!');
          }
        }}
        onShowToast={onShowToast || ((type, msg) => console.log(type, msg))}
      />
    </div>
  );
}
