import { useState, useEffect } from 'react';
import {
  X,
  UserPlus,
  Calendar,
  CreditCard,
  Car,
  Phone,
  Hash,
  FileText,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Sliders,
} from 'lucide-react';
import { api } from '../services/api';
import { Worker, WorkerStatus } from '../types';
import { formatDateInput } from '../utils/formatters';

interface AddWorkerModalProps {
  isOpen: boolean;
  onClose: () => void;
  workerToEdit?: Worker | null;
  onSuccess: (msg: string) => void;
}

export function AddWorkerModal({
  isOpen,
  onClose,
  workerToEdit,
  onSuccess,
}: AddWorkerModalProps) {
  const isEditing = Boolean(workerToEdit);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [occupation, setOccupation] = useState('Driver');
  const [carType, setCarType] = useState('Toyota Vitz');
  const [numberPlate, setNumberPlate] = useState('');
  const [initialDebt, setInitialDebt] = useState('');
  const [expectedWeeklyPayment, setExpectedWeeklyPayment] = useState('1080');
  const [startDate, setStartDate] = useState(formatDateInput(null));
  const [expectedEndDate, setExpectedEndDate] = useState('');
  const [status, setStatus] = useState<WorkerStatus>('ACTIVE');
  const [notes, setNotes] = useState('');
  const [detailsJson, setDetailsJson] = useState('{}');
  const [showDetailsEditor, setShowDetailsEditor] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-calculate suggested end date when start_date, initial_debt, or expected_weekly_payment changes
  const calculateSuggestedEndDate = (start: string, debtStr: string, weeklyStr: string): string => {
    const debt = parseFloat(debtStr);
    const weekly = parseFloat(weeklyStr);
    if (!start || isNaN(debt) || isNaN(weekly) || debt <= 0 || weekly <= 0) {
      return '';
    }
    const weeksNeeded = Math.ceil(debt / weekly);
    const d = new Date(start);
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + weeksNeeded * 7);
    return d.toISOString().slice(0, 10);
  };

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (workerToEdit) {
        setName(workerToEdit.name);
        setPhone(workerToEdit.phone || '');
        setOccupation(workerToEdit.occupation);
        setCarType(workerToEdit.car_type || '');
        setNumberPlate(workerToEdit.number_plate || '');
        setInitialDebt(String(workerToEdit.initial_debt));
        setExpectedWeeklyPayment(String(workerToEdit.expected_weekly_payment));
        setStartDate(formatDateInput(workerToEdit.start_date));
        setExpectedEndDate(formatDateInput(workerToEdit.expected_end_date));
        setStatus(workerToEdit.status);
        setNotes(workerToEdit.notes || '');
        setDetailsJson(
          workerToEdit.details
            ? JSON.stringify(workerToEdit.details, null, 2)
            : '{}'
        );
        setShowDetailsEditor(Boolean(workerToEdit.details));
      } else {
        setName('');
        setPhone('');
        setOccupation('Driver');
        setCarType('Toyota Vitz');
        setNumberPlate('');
        setInitialDebt('168480');
        setExpectedWeeklyPayment('1080');
        const today = formatDateInput(null);
        setStartDate(today);
        setExpectedEndDate(calculateSuggestedEndDate(today, '168480', '1080'));
        setStatus('ACTIVE');
        setNotes('');
        setDetailsJson('{}');
        setShowDetailsEditor(false);
      }
    }
  }, [isOpen, workerToEdit]);

  // Recalculate suggested end date when user types initial debt, weekly payment, or start date
  const handleAutoSuggestEndDate = () => {
    const suggested = calculateSuggestedEndDate(startDate, initialDebt, expectedWeeklyPayment);
    if (suggested) {
      setExpectedEndDate(suggested);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Worker name is required.');
      return;
    }

    const numInitialDebt = parseFloat(initialDebt);
    if (isNaN(numInitialDebt) || numInitialDebt < 0) {
      setError('Initial debt must be a number greater than or equal to 0.');
      return;
    }

    const numWeekly = parseFloat(expectedWeeklyPayment);
    if (isNaN(numWeekly) || numWeekly <= 0) {
      setError('Expected weekly payment must be strictly greater than 0.');
      return;
    }

    let parsedDetails: Record<string, any> | undefined;
    if (detailsJson.trim()) {
      try {
        parsedDetails = JSON.parse(detailsJson);
      } catch {
        setError('Details field must be valid JSON format (e.g. {"color": "Silver"}).');
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (isEditing && workerToEdit) {
        await api.updateWorker(workerToEdit.id, {
          name: name.trim(),
          phone: phone.trim() || undefined,
          occupation: occupation.trim() || 'Driver',
          car_type: carType.trim() || undefined,
          number_plate: numberPlate.trim() || undefined,
          initial_debt: numInitialDebt,
          expected_weekly_payment: numWeekly,
          start_date: startDate,
          expected_end_date: expectedEndDate || undefined,
          status,
          notes: notes.trim() || undefined,
          details: parsedDetails,
        });
        onSuccess(`Updated ${name} profile successfully.`);
      } else {
        await api.createWorker({
          name: name.trim(),
          phone: phone.trim() || undefined,
          occupation: occupation.trim() || 'Driver',
          car_type: carType.trim() || undefined,
          number_plate: numberPlate.trim() || undefined,
          initial_debt: numInitialDebt,
          expected_weekly_payment: numWeekly,
          start_date: startDate,
          expected_end_date: expectedEndDate || undefined,
          notes: notes.trim() || undefined,
          details: parsedDetails,
        });
        onSuccess(`Worker ${name} created successfully.`);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save worker.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {isEditing ? `Edit Worker: ${workerToEdit?.name}` : 'Add New Driver / Worker'}
              </h2>
              <p className="text-xs text-slate-400">
                {isEditing
                  ? 'Update driver profile, target payment, or contract details'
                  : 'Register a new worker with debt ledger and weekly payment target'}
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

        <form onSubmit={handleSubmit} className="p-6 max-h-[75vh] overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Personal Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Eric Sarfo"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                Phone Number (Mobile Money)
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 233540276077 or 0540276077"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Occupation & Vehicle Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Occupation
              </label>
              <input
                type="text"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                placeholder="Driver"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Car className="w-3.5 h-3.5 text-slate-400" />
                Car Model / Type
              </label>
              <input
                type="text"
                value={carType}
                onChange={(e) => setCarType(e.target.value)}
                placeholder="e.g. Toyota Vitz"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-slate-400" />
                Number Plate
              </label>
              <input
                type="text"
                value={numberPlate}
                onChange={(e) => setNumberPlate(e.target.value)}
                placeholder="e.g. GN 2013-26"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase"
              />
            </div>
          </div>

          {/* Financials: Initial Debt & Weekly Payment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-rose-400" />
                Initial Debt (GHS) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={initialDebt}
                onChange={(e) => setInitialDebt(e.target.value)}
                onBlur={handleAutoSuggestEndDate}
                placeholder="168480.00"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                Expected Weekly Payment (GHS) *
              </label>
              <input
                type="number"
                step="0.01"
                min="1"
                required
                value={expectedWeeklyPayment}
                onChange={(e) => setExpectedWeeklyPayment(e.target.value)}
                onBlur={handleAutoSuggestEndDate}
                placeholder="1080.00"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Must be &gt; 0 (used for pace calculation)
              </span>
            </div>
          </div>

          {/* Contract Dates: Start & Expected End */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                Start Date *
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                onBlur={handleAutoSuggestEndDate}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  Expected End Date
                </label>
                <button
                  type="button"
                  onClick={handleAutoSuggestEndDate}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  Auto-Calculate
                </button>
              </div>
              <input
                type="date"
                value={expectedEndDate}
                onChange={(e) => setExpectedEndDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Status (If editing) */}
          {isEditing && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Worker Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as WorkerStatus)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="ACTIVE">ACTIVE (On active repayment schedule)</option>
                <option value="CLEARED">CLEARED (Debt fully settled)</option>
                <option value="INACTIVE">INACTIVE (Contract paused / retired)</option>
              </select>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Notes / Payment Agreements
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Reliable driver, weekly payments on Thursdays"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
            />
          </div>

          {/* Flexible Details JSON Editor Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowDetailsEditor(!showDetailsEditor)}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 py-1"
            >
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span>{showDetailsEditor ? 'Hide Extra Details JSON' : '+ Add Extra Details (JSON Field)'}</span>
            </button>
            {showDetailsEditor && (
              <div className="mt-2 space-y-1">
                <textarea
                  rows={3}
                  value={detailsJson}
                  onChange={(e) => setDetailsJson(e.target.value)}
                  placeholder='{"engine": "1.3L", "color": "Silver"}'
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[10px] text-slate-500">
                  Store custom occupation-specific fields without database schema migrations.
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
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
                  Saving Worker...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  {isEditing ? 'Save Changes' : 'Create Worker Profile'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
