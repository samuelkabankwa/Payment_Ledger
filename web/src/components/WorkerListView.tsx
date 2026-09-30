import { useState } from 'react';
import {
  Search,
  UserPlus,
  Car,
  Phone,
  Calendar,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Zap,
  Edit,
  ChevronRight,
} from 'lucide-react';
import { Worker, WorkerStatus } from '../types';
import {
  formatCurrency,
  formatPercentage,
  formatRelativeDays,
} from '../utils/formatters';
import { api } from '../services/api';

interface WorkerListViewProps {
  workers: Worker[];
  isLoading: boolean;
  onSelectWorker: (workerId: string) => void;
  onOpenAddWorker: () => void;
  onOpenEditWorker: (worker: Worker) => void;
  onOpenQuickAddWithWorker: (workerId: string) => void;
  onRefresh: () => void;
}

export function WorkerListView({
  workers,
  isLoading,
  onSelectWorker,
  onOpenAddWorker,
  onOpenEditWorker,
  onOpenQuickAddWithWorker,
}: WorkerListViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | WorkerStatus>('ACTIVE');

  const filteredWorkers = workers.filter((w) => {
    // Status filter
    if (statusFilter !== 'ALL' && w.status !== statusFilter) {
      return false;
    }
    // Search query
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = w.name.toLowerCase().includes(q);
      const matchPhone = w.phone?.toLowerCase().includes(q);
      const matchPlate = w.number_plate?.toLowerCase().includes(q);
      const matchCar = w.car_type?.toLowerCase().includes(q);
      const matchAlias = w.aliases?.some((a) =>
        a.alias_name.toLowerCase().includes(q)
      );
      if (!matchName && !matchPhone && !matchPlate && !matchCar && !matchAlias) {
        return false;
      }
    }
    return true;
  });

  const totalOutstanding = filteredWorkers.reduce(
    (sum, w) => sum + Number(w.outstanding_debt || 0),
    0
  );
  const totalPaid = filteredWorkers.reduce(
    (sum, w) => sum + Number(w.total_paid || 0),
    0
  );

  const handleExportStatement = (workerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(api.getWorkerExportUrl(workerId), '_blank');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header with Title and Add Worker button */}
      <div className="bg-slate-850 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Worker Profiles &amp; Ledgers
          </h2>
          <p className="text-xs text-slate-400">
            Manage drivers, debt contracts, weekly targets, and mobile money ledgers
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenAddWorker}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add New Worker / Driver</span>
          </button>
        </div>
      </div>

      {/* Summary Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">
            Showing Drivers
          </span>
          <div className="text-lg font-bold text-white mt-1">
            {filteredWorkers.length}{' '}
            <span className="text-xs font-normal text-slate-400">
              of {workers.length} total
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">
            Total Outstanding
          </span>
          <div className="text-lg font-bold text-rose-300 mt-1">
            {formatCurrency(totalOutstanding)}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">
            Total Collected
          </span>
          <div className="text-lg font-bold text-emerald-400 mt-1">
            {formatCurrency(totalPaid)}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">
            Behind Schedule
          </span>
          <div className="text-lg font-bold text-amber-400 mt-1">
            {filteredWorkers.filter((w) => w.is_behind_schedule).length} drivers
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, plate..."
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-700/80 rounded-xl p-1 text-xs w-full sm:w-auto">
          {(['ALL', 'ACTIVE', 'CLEARED', 'INACTIVE'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg font-semibold transition-all ${
                statusFilter === st
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Worker Cards Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] space-y-3">
          <div className="w-9 h-9 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
          <span className="text-xs text-slate-400">Loading worker records...</span>
        </div>
      ) : filteredWorkers.length === 0 ? (
        <div className="p-12 text-center bg-slate-850 border border-slate-800 rounded-2xl text-slate-400">
          No workers match your filter or search query.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredWorkers.map((worker) => {
            const totalDebt = Number(worker.initial_debt) + Number(worker.total_debt_added);
            const progress =
              totalDebt > 0 ? Math.min(100, Math.round((worker.total_paid / totalDebt) * 100)) : 100;

            return (
              <div
                key={worker.id}
                onClick={() => onSelectWorker(worker.id)}
                className="bg-slate-850 border border-slate-800 hover:border-slate-700/90 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group"
              >
                <div>
                  {/* Top Bar: Name, Status & Edit */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-white text-base group-hover:text-emerald-400 transition-colors">
                        {worker.name}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                        <span className="flex items-center gap-1">
                          <Car className="w-3.5 h-3.5 text-slate-500" />
                          {worker.car_type || 'Vehicle'} • {worker.number_plate || '-'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          worker.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : worker.status === 'CLEARED'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {worker.status}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenEditWorker(worker);
                        }}
                        className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors"
                        title="Edit Worker Profile"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Phone & Aliases */}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    {worker.phone && (
                      <span className="flex items-center gap-1 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800 text-[11px]">
                        <Phone className="w-3 h-3 text-slate-500" />
                        {worker.phone}
                      </span>
                    )}
                    {worker.aliases && worker.aliases.length > 0 && (
                      <span className="text-[11px] text-slate-500">
                        {worker.aliases.length} alias{worker.aliases.length > 1 ? 'es' : ''} linked
                      </span>
                    )}
                  </div>

                  {/* Outstanding Debt & Progress Bar */}
                  <div className="mt-4 p-3.5 bg-slate-900 border border-slate-800/80 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Outstanding Balance:</span>
                      <span className="text-base font-bold text-rose-300">
                        {formatCurrency(worker.outstanding_debt)}
                      </span>
                    </div>

                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-400 h-full rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Paid: {formatCurrency(worker.total_paid)}</span>
                      <span>{progress}% cleared</span>
                    </div>
                  </div>

                  {/* Weekly Target & Pace Metrics */}
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Weekly Target:</span>
                      <span className="font-semibold text-slate-200">
                        {formatCurrency(worker.expected_weekly_payment)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Pace / Consistency:</span>
                      <div className="flex items-center gap-1 font-semibold mt-0.5">
                        <span
                          className={`text-xs ${
                            (worker.pace_pct ?? 0) >= 90
                              ? 'text-emerald-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {formatPercentage(worker.pace_pct)} pace
                        </span>
                        <span className="text-slate-500">•</span>
                        <span className="text-xs text-blue-400">
                          {formatPercentage(worker.consistency_pct)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Last Payment Indicator */}
                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/70 pt-2.5">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      Last payment: {formatRelativeDays(worker.days_since_last_payment)}
                    </span>
                    {worker.is_behind_schedule ? (
                      <span className="text-amber-400 font-semibold flex items-center gap-1 text-[10px]">
                        <AlertCircle className="w-3 h-3" /> Behind schedule
                      </span>
                    ) : (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1 text-[10px]">
                        <CheckCircle2 className="w-3 h-3" /> On track
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenQuickAddWithWorker(worker.id);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-semibold text-xs transition-colors"
                      title="Quick Add Payment"
                    >
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      <span>Add Payment</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleExportStatement(worker.id, e)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-emerald-400 transition-colors"
                      title="Export Excel Statement"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <span className="text-xs font-semibold text-slate-300 group-hover:text-emerald-400 flex items-center gap-0.5">
                    View Ledger <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
