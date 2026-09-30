import { useState, useEffect } from 'react';
import {
  X,
  Edit3,
  Calendar,
  CreditCard,
  Hash,
  FileText,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Wallet,
} from 'lucide-react';
import { api } from '../services/api';
import { LedgerEntry, LedgerEntryType, PaymentMode, WorkerAlias } from '../types';
import { formatDateInput } from '../utils/formatters';

interface EditEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: LedgerEntry | null;
  workerName: string;
  workerAliases?: WorkerAlias[];
  workerPhone?: string | null;
  onSuccess: (msg: string) => void;
}

export function EditEntryModal({
  isOpen,
  onClose,
  entry,
  workerName,
  workerAliases = [],
  workerPhone,
  onSuccess,
}: EditEntryModalProps) {
  const [amount, setAmount] = useState('');
  const [entryDate, setEntryDate] = useState('');
  const [type, setType] = useState<LedgerEntryType>('PAYMENT');
  const [transactionRef, setTransactionRef] = useState('');
  const [senderName, setSenderName] = useState('');
  const [note, setNote] = useState('');
  const [paymentModes, setPaymentModes] = useState<PaymentMode[]>([]);
  const [paymentMode, setPaymentMode] = useState('Momo');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (isOpen && entry) {
      setError(null);
      setAmount(String(entry.amount));
      setEntryDate(formatDateInput(entry.entry_date));
      setType(entry.type);
      setPaymentMode(entry.payment_mode?.name || 'Momo');
      setTransactionRef(entry.transaction_ref || '');
      setSenderName(entry.sender_name || '');
      setNote(entry.note || '');
    }
  }, [isOpen, entry]);

  if (!isOpen || !entry) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const numAmount = parseFloat(amount.replace(/,/g, ''));
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Amount must be a number greater than 0.');
      return;
    }

    if (!entryDate) {
      setError('Transaction date is required.');
      return;
    }

    if (!paymentMode) {
      setError('Mode of payment is required.');
      return;
    }

    if (!transactionRef.trim()) {
      setError('Transaction reference is required.');
      return;
    }

    if (!senderName.trim()) {
      setError('Sender name is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await api.updateLedgerEntry(entry.worker_id, entry.id, {
        amount: numAmount,
        entry_date: entryDate,
        type,
        payment_mode: paymentMode,
        transaction_ref: transactionRef.trim(),
        sender_name: senderName.trim(),
        note: note.trim() || null,
      });

      onSuccess(`Updated entry #${entry.payment_number || ''} for ${workerName} successfully.`);
      onClose();
    } catch (err: any) {
      if (err.status === 409 || err.details?.error === 'DUPLICATE_TRANSACTION') {
        const conflict = err.details?.existing_entry;
        const conflictWorker = conflict?.worker_name
          ? `worker "${conflict.worker_name}"`
          : 'another worker';
        setError(
          `Duplicate Transaction! Reference "${transactionRef}" is already used by ${conflictWorker}.`
        );
      } else {
        setError(err.message || 'Failed to update entry.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                Edit Ledger Entry {entry.payment_number ? `(#${entry.payment_number})` : ''}
              </h2>
              <p className="text-xs text-slate-400">
                Updating transaction for {workerName}
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                Amount (GHS) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                Date *
              </label>
              <input
                type="date"
                required
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-purple-400" />
                Mode of Payment *
              </label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                value={type}
                onChange={(e) => setType(e.target.value as LedgerEntryType)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="PAYMENT">PAYMENT (Reduces Debt)</option>
                <option value="DEBT_ADDED">DEBT_ADDED (Increases Debt)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-cyan-400" />
                Transaction Ref *
              </label>
              <input
                type="text"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                placeholder="Mobile Money ID"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Sender Name / Alias *
                </label>
                {((workerAliases && workerAliases.length > 0) || workerPhone) && (
                  <span className="text-[10px] text-emerald-400 font-medium">
                    Aliases available
                  </span>
                )}
              </div>

              {/* Driver Alias Dropdown Quick-Select */}
              {((workerAliases && workerAliases.length > 0) || workerPhone || workerName) && (
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
                      ▼ Fill from {workerName}&apos;s aliases / name...
                    </option>
                    <option value={workerName}>
                      👤 {workerName} (Primary Name)
                    </option>
                    {workerAliases && workerAliases.length > 0 && (
                      <optgroup label="Driver's Saved Aliases">
                        {workerAliases.map((alias) => (
                          <option key={alias.id} value={alias.alias_name}>
                            🏷️ {alias.alias_name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {workerPhone && (
                      <option value={workerPhone}>
                        📞 {workerPhone} (Phone)
                      </option>
                    )}
                  </select>
                </div>
              )}

              <div className="relative">
                <input
                  type="text"
                  list="edit-worker-aliases"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="e.g. KOFI ODURO"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <datalist id="edit-worker-aliases">
                  <option value={workerName} />
                  {workerAliases?.map((a) => (
                    <option key={a.id} value={a.alias_name} />
                  ))}
                  {workerPhone && <option value={workerPhone} />}
                </datalist>
              </div>

              {/* Quick Clickable Alias Chips */}
              {workerAliases && workerAliases.length > 0 && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-slate-400">Quick fill:</span>
                  <button
                    type="button"
                    onClick={() => setSenderName(workerName)}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors"
                  >
                    {workerName}
                  </button>
                  {workerAliases.map((a) => (
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

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                Notes / Reference Memo
              </span>
              <span className="text-[11px] text-slate-400 font-normal">
                (Optional — the only non-mandatory field)
              </span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Corrected parsed amount (optional)"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Update Entry
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
