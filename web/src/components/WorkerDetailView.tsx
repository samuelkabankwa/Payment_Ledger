import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Calendar,
  CreditCard,
  Car,
  Phone,
  Edit,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Zap,
  Plus,
  Trash2,
  Copy,
  Check,
  Tag,
  Clock,
  Sliders,
} from 'lucide-react';
import { api } from '../services/api';
import { Worker, LedgerEntry, WorkerAlias } from '../types';
import {
  formatCurrency,
  formatDate,
  formatPercentage,
  formatRelativeDays,
} from '../utils/formatters';
import { EditEntryModal } from './EditEntryModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';

interface WorkerDetailViewProps {
  workerId: string;
  onBack: () => void;
  onOpenQuickAddWithWorker: (workerId: string) => void;
  onOpenEditWorker: (worker: Worker) => void;
  onShowToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export function WorkerDetailView({
  workerId,
  onBack,
  onOpenQuickAddWithWorker,
  onOpenEditWorker,
  onShowToast,
}: WorkerDetailViewProps) {
  const [worker, setWorker] = useState<Worker | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [aliases, setAliases] = useState<WorkerAlias[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter entries
  const [filterType, setFilterType] = useState<'ALL' | 'PAYMENT' | 'DEBT_ADDED'>('ALL');

  // New alias input
  const [newAliasName, setNewAliasName] = useState('');
  const [isAddingAlias, setIsAddingAlias] = useState(false);

  // Modals state
  const [editingEntry, setEditingEntry] = useState<LedgerEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<LedgerEntry | null>(null);
  const [deletingAlias, setDeletingAlias] = useState<WorkerAlias | null>(null);
  const [isMarkingCleared, setIsMarkingCleared] = useState(false);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  // Copy ref state
  const [copiedRef, setCopiedRef] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [workerData, entriesData, aliasesData] = await Promise.all([
        api.getWorker(workerId),
        api.getWorkerEntries(workerId),
        api.getWorkerAliases(workerId),
      ]);
      setWorker(workerData);
      setEntries(entriesData);
      setAliases(aliasesData);
    } catch (err: any) {
      setError(err.message || 'Failed to load worker details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [workerId]);

  const handleCopyRef = (ref: string) => {
    navigator.clipboard.writeText(ref);
    setCopiedRef(ref);
    setTimeout(() => setCopiedRef(null), 2000);
  };

  const handleAddAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAliasName.trim() || !worker) return;

    setIsAddingAlias(true);
    try {
      const alias = await api.createWorkerAlias(worker.id, newAliasName.trim());
      setAliases((prev) => [...prev, alias]);
      setNewAliasName('');
      onShowToast('success', `Added alias "${alias.alias_name}" successfully.`);
    } catch (err: any) {
      onShowToast('error', err.message || 'Failed to add alias.');
    } finally {
      setIsAddingAlias(false);
    }
  };

  const handleDeleteAliasConfirm = async () => {
    if (!deletingAlias || !worker) return;
    try {
      await api.deleteWorkerAlias(worker.id, deletingAlias.id);
      setAliases((prev) => prev.filter((a) => a.id !== deletingAlias.id));
      onShowToast('info', `Removed alias "${deletingAlias.alias_name}".`);
      setDeletingAlias(null);
    } catch (err: any) {
      onShowToast('error', err.message || 'Failed to delete alias.');
    }
  };

  const handleDeleteEntryConfirm = async () => {
    if (!deletingEntry || !worker) return;
    try {
      await api.deleteLedgerEntry(worker.id, deletingEntry.id);
      onShowToast('info', 'Ledger entry deleted. Balance recalculated.');
      setDeletingEntry(null);
      loadData();
    } catch (err: any) {
      onShowToast('error', err.message || 'Failed to delete entry.');
    }
  };

  const handleMarkClearedConfirm = async () => {
    if (!worker) return;
    setIsMarkingCleared(true);
    try {
      const updated = await api.markWorkerCleared(worker.id);
      setWorker(updated);
      setIsConfirmingClear(false);
      onShowToast('success', `Worker ${updated.name} has been marked as CLEARED.`);
    } catch (err: any) {
      onShowToast('error', err.message || 'Failed to mark worker cleared.');
    } finally {
      setIsMarkingCleared(false);
    }
  };

  const handleExportStatement = () => {
    window.open(api.getWorkerExportUrl(workerId), '_blank');
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] space-y-3">
        <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        <span className="text-sm text-slate-400">Loading worker profile and ledger...</span>
      </div>
    );
  }

  if (error || !worker) {
    return (
      <div className="p-8 text-center bg-slate-850 border border-slate-800 rounded-2xl space-y-4">
        <AlertCircle className="w-10 h-10 mx-auto text-rose-400" />
        <div className="text-white font-bold">{error || 'Worker not found'}</div>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
        >
          ← Return to Worker List
        </button>
      </div>
    );
  }

  const filteredEntries = entries.filter((e) => {
    if (filterType === 'ALL') return true;
    return e.type === filterType;
  });

  const totalDebt = Number(worker.initial_debt) + Number(worker.total_debt_added);
  const progressPct =
    totalDebt > 0 ? Math.min(100, Math.round((worker.total_paid / totalDebt) * 100)) : 100;

  return (
    <div className="space-y-6 pb-16">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-xs font-semibold transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to All Workers</span>
        </button>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => onOpenQuickAddWithWorker(worker.id)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition-all"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Add Payment (Paste SMS)</span>
          </button>

          <button
            onClick={handleExportStatement}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export Statement (.xlsx)</span>
          </button>

          <button
            onClick={() => onOpenEditWorker(worker)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold transition-all"
          >
            <Edit className="w-3.5 h-3.5" />
            <span>Edit Profile</span>
          </button>

          {worker.status !== 'CLEARED' && (
            <button
              onClick={() => setIsConfirmingClear(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-semibold transition-all"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Mark Cleared</span>
            </button>
          )}
        </div>
      </div>

      {/* Driver Header Profile Card */}
      <div className="bg-slate-850 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {worker.name}
              </h1>
              <span
                className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                  worker.status === 'ACTIVE'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : worker.status === 'CLEARED'
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    : 'bg-slate-700 text-slate-300'
                }`}
              >
                {worker.status}
              </span>
              {worker.is_behind_schedule && (
                <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Behind Schedule
                </span>
              )}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1 text-slate-300 font-medium">
                <Car className="w-4 h-4 text-slate-500" />
                {worker.car_type || 'Vehicle'} • {worker.number_plate || '-'}
              </span>

              {worker.phone && (
                <span className="flex items-center gap-1 text-slate-300 font-medium">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  {worker.phone}
                </span>
              )}

              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                Start: {formatDate(worker.start_date)}
              </span>

              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                Expected End: {formatDate(worker.expected_end_date)}
              </span>
            </div>

            {worker.notes && (
              <p className="mt-3 text-xs text-slate-400 italic bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 max-w-2xl">
                &ldquo;{worker.notes}&rdquo;
              </p>
            )}
          </div>

          {/* Quick Payoff Comparison Card */}
          <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 min-w-[260px] text-xs space-y-2">
            <div className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-cyan-400" />
              Payoff Trajectory
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Contract End Date:</span>
              <span className="font-semibold text-slate-200">
                {formatDate(worker.expected_end_date)}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Projected Payoff (At Pace):</span>
              <span className="font-bold text-emerald-400">
                {formatDate(worker.projected_end_date || worker.expected_end_date)}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Last Payment:</span>
              <span className="font-medium text-slate-300">
                {formatRelativeDays(worker.days_since_last_payment)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Big Metric Strips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Outstanding Balance */}
        <div className="bg-slate-850 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Outstanding Debt
          </span>
          <div className="text-2xl font-black text-rose-300 tracking-tight mt-1">
            {formatCurrency(worker.outstanding_debt)}
          </div>
          <div className="mt-2 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-400 h-full rounded-full"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">
            {progressPct}% settled ({formatCurrency(worker.total_paid)} paid)
          </span>
        </div>

        {/* Initial Debt */}
        <div className="bg-slate-850 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Initial Principal
          </span>
          <div className="text-xl font-bold text-white tracking-tight mt-1">
            {formatCurrency(worker.initial_debt)}
          </div>
          <span className="text-[11px] text-slate-500 mt-2 block">
            Added Debt: {formatCurrency(worker.total_debt_added)}
          </span>
        </div>

        {/* Weekly Payment Target */}
        <div className="bg-slate-850 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Weekly Target
          </span>
          <div className="text-xl font-bold text-emerald-400 tracking-tight mt-1">
            {formatCurrency(worker.expected_weekly_payment)}
          </div>
          <span className="text-[11px] text-slate-400 mt-2 block">
            7-day rolling installment
          </span>
        </div>

        {/* Pace & Consistency */}
        <div className="bg-slate-850 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Pace &amp; Consistency
          </span>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`text-lg font-bold ${
                (worker.pace_pct ?? 0) >= 90 ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {formatPercentage(worker.pace_pct)}
            </span>
            <span className="text-slate-500 text-xs">•</span>
            <span className="text-lg font-bold text-blue-400">
              {formatPercentage(worker.consistency_pct)}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 mt-2 block">
            {worker.distinct_weeks_paid} / {worker.weeks_elapsed} weeks paid
          </span>
        </div>
      </div>

      {/* Aliases Section & Flexible Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Aliases Manager */}
        <div className="lg:col-span-2 bg-slate-850 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">
                Sender Aliases &amp; Payment Entities
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">
              Used for automated SMS fuzzy matching
            </span>
          </div>

          <p className="text-xs text-slate-400">
            Names or business ventures this driver uses when making mobile money transfers:
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {aliases.length === 0 ? (
              <span className="text-xs text-slate-500 italic">
                No aliases saved yet. Add one below or parse an SMS with a different sender name.
              </span>
            ) : (
              aliases.map((alias) => (
                <span
                  key={alias.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900 border border-slate-700/80 text-xs font-semibold text-slate-200 group"
                >
                  <span>{alias.alias_name}</span>
                  <button
                    type="button"
                    onClick={() => setDeletingAlias(alias)}
                    className="text-slate-500 hover:text-rose-400 p-0.5 rounded transition-colors"
                    title={`Delete alias ${alias.alias_name}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))
            )}
          </div>

          {/* Add Alias Form */}
          <form onSubmit={handleAddAlias} className="flex items-center gap-2 pt-2">
            <input
              type="text"
              value={newAliasName}
              onChange={(e) => setNewAliasName(e.target.value)}
              placeholder="e.g. DEBRINGO VENTURES or NANA ODURO"
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="submit"
              disabled={isAddingAlias || !newAliasName.trim()}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Alias</span>
            </button>
          </form>
        </div>

        {/* Flexible Details Section */}
        <div className="bg-slate-850 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Custom Metadata</h3>
          </div>
          <p className="text-xs text-slate-400">
            Stored details JSON for this {worker.occupation.toLowerCase()}:
          </p>

          {worker.details && Object.keys(worker.details).length > 0 ? (
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 space-y-1">
              {Object.entries(worker.details).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-slate-500">{k}:</span>
                  <span className="font-semibold text-slate-200">{String(v)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-center text-xs text-slate-500">
              No extra JSON fields configured.
            </div>
          )}
        </div>
      </div>

      {/* Ledger Entries Table */}
      <div className="bg-slate-850 border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Table Header Controls */}
        <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-400" />
              Payment &amp; Debt Ledger
            </h3>
            <p className="text-xs text-slate-400">
              {entries.length} historical transactions recorded with dynamic running balance
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter Toggle */}
            <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-xl p-1 text-xs">
              <button
                onClick={() => setFilterType('ALL')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  filterType === 'ALL'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All ({entries.length})
              </button>
              <button
                onClick={() => setFilterType('PAYMENT')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  filterType === 'PAYMENT'
                    ? 'bg-slate-800 text-emerald-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Payments
              </button>
              <button
                onClick={() => setFilterType('DEBT_ADDED')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  filterType === 'DEBT_ADDED'
                    ? 'bg-slate-800 text-rose-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Debt Added
              </button>
            </div>

            <button
              onClick={() => onOpenQuickAddWithWorker(worker.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition-all"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>+ Add Entry</span>
            </button>
          </div>
        </div>

        {/* Entries Table */}
        {filteredEntries.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No ledger entries found for this filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold text-center w-16">Pmt #</th>
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold">Type</th>
                  <th className="py-3 px-4 font-semibold">Mode</th>
                  <th className="py-3 px-4 font-semibold text-right">Amount</th>
                  <th className="py-3 px-4 font-semibold text-right">Running Balance</th>
                  <th className="py-3 px-4 font-semibold">Transaction Reference</th>
                  <th className="py-3 px-4 font-semibold">Sender / Source</th>
                  <th className="py-3 px-4 font-semibold">Note / Memo</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredEntries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="hover:bg-slate-800/40 transition-colors group"
                  >
                    {/* Payment # */}
                    <td className="py-3 px-4 text-center font-bold text-slate-400">
                      {entry.payment_number ? (
                        <span className="inline-block px-2 py-0.5 rounded-md bg-slate-800 text-emerald-400 text-xs">
                          #{entry.payment_number}
                        </span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>

                    {/* Date */}
                    <td className="py-3 px-4 font-sans text-slate-300">
                      {formatDate(entry.entry_date)}
                    </td>

                    {/* Type */}
                    <td className="py-3 px-4 font-sans">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          entry.type === 'PAYMENT'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {entry.type === 'PAYMENT' ? 'PAYMENT' : 'DEBT ADDED'}
                      </span>
                    </td>

                    {/* Mode of Payment */}
                    <td className="py-3 px-4 font-sans">
                      {entry.payment_mode?.name === 'Cash' ? (
                        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          Cash
                        </span>
                      ) : entry.payment_mode?.name === 'Bank Transfer' ? (
                        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                          Bank Transfer
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          {entry.payment_mode?.name || 'Momo'}
                        </span>
                      )}
                    </td>

                    {/* Amount */}
                    <td
                      className={`py-3 px-4 text-right font-bold text-sm ${
                        entry.type === 'PAYMENT'
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {entry.type === 'PAYMENT' ? '-' : '+'}
                      {formatCurrency(entry.amount)}
                    </td>

                    {/* Running Balance */}
                    <td className="py-3 px-4 text-right font-bold text-slate-200">
                      {formatCurrency(entry.running_balance)}
                    </td>

                    {/* Transaction Reference */}
                    <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                      {entry.transaction_ref ? (
                        <div className="flex items-center gap-1.5">
                          <span>{entry.transaction_ref}</span>
                          <button
                            onClick={() => handleCopyRef(entry.transaction_ref!)}
                            className="text-slate-500 hover:text-white p-0.5 rounded transition-colors"
                            title="Copy Transaction ID"
                          >
                            {copiedRef === entry.transaction_ref ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-600 italic">None</span>
                      )}
                    </td>

                    {/* Sender & Provider */}
                    <td className="py-3 px-4 font-sans text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs">
                          {entry.sender_name || worker.name}
                        </span>
                        {entry.provider && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                            {entry.provider}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Note */}
                    <td className="py-3 px-4 font-sans text-slate-400 text-xs max-w-xs truncate">
                      {entry.note || '-'}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right font-sans">
                      <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => setEditingEntry(entry)}
                          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          title="Edit Entry"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingEntry(entry)}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                          title="Delete Entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Entry Modal */}
      {editingEntry && (
        <EditEntryModal
          isOpen={Boolean(editingEntry)}
          onClose={() => setEditingEntry(null)}
          entry={editingEntry}
          workerName={worker.name}
          workerAliases={aliases}
          workerPhone={worker.phone}
          onSuccess={(msg) => {
            onShowToast('success', msg);
            loadData();
          }}
        />
      )}

      {/* Delete Entry Modal */}
      {deletingEntry && (
        <DeleteConfirmModal
          isOpen={Boolean(deletingEntry)}
          title="Delete Ledger Entry"
          message={`Are you sure you want to delete this ${deletingEntry.type} entry of ${formatCurrency(
            deletingEntry.amount
          )} on ${formatDate(deletingEntry.entry_date)}? The running balance will be recalculated automatically.`}
          onConfirm={handleDeleteEntryConfirm}
          onCancel={() => setDeletingEntry(null)}
        />
      )}

      {/* Delete Alias Modal */}
      {deletingAlias && (
        <DeleteConfirmModal
          isOpen={Boolean(deletingAlias)}
          title="Remove Sender Alias"
          message={`Remove alias "${deletingAlias.alias_name}" from ${worker.name}? Future SMS with this sender name will no longer match this worker automatically.`}
          onConfirm={handleDeleteAliasConfirm}
          onCancel={() => setDeletingAlias(null)}
        />
      )}

      {/* Mark Cleared Modal */}
      {isConfirmingClear && (
        <DeleteConfirmModal
          isOpen={isConfirmingClear}
          title="Mark Worker as Cleared"
          message={`Are you sure you want to mark ${worker.name} as CLEARED? This indicates their debt has been fully settled and removes them from the active collection alerts, while keeping their full ledger history preserved.`}
          isDeleting={isMarkingCleared}
          onConfirm={handleMarkClearedConfirm}
          onCancel={() => setIsConfirmingClear(false)}
        />
      )}
    </div>
  );
}
