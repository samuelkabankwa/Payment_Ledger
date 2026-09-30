import { useState, useEffect } from 'react';
import {
  TrendingUp,
  CreditCard,
  Users,
  AlertCircle,
  Clock,
  Sparkles,
  ChevronRight,
  Zap,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { api } from '../services/api';
import { OverviewAnalytics, Worker } from '../types';
import {
  formatCurrency,
  formatPercentage,
  formatRelativeDays,
} from '../utils/formatters';

interface DashboardViewProps {
  onSelectWorker: (workerId: string) => void;
  onOpenQuickAddWithWorker?: (workerId: string) => void;
  onViewAllWorkers: () => void;
}

export function DashboardView({
  onSelectWorker,
  onOpenQuickAddWithWorker,
  onViewAllWorkers,
}: DashboardViewProps) {
  const [data, setData] = useState<OverviewAnalytics | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [overviewData, workersList] = await Promise.all([
        api.getOverviewAnalytics(),
        api.getWorkers(),
      ]);
      setData(overviewData);
      setWorkers(workersList);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] space-y-3">
        <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        <span className="text-sm text-slate-400">Loading fleet analytics...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error || 'Unable to retrieve dashboard information'}</span>
        </div>
        <button
          onClick={loadDashboardData}
          className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-xs font-semibold text-rose-200 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const { kpis, workers_near_clearing, workers_overdue, cashflow_trend } = data;

  const collectionRate =
    kpis.total_initial_debt > 0
      ? Math.round((kpis.total_collected_all_time / kpis.total_initial_debt) * 1000) / 10
      : 0;

  return (
    <div className="space-y-6 pb-12">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Outstanding Debt */}
        <div className="bg-slate-850 border border-slate-800 rounded-2xl p-5 shadow-sm hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Total Outstanding Debt
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {formatCurrency(kpis.total_outstanding_debt)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>Initial Portfolio:</span>
            <span className="font-semibold text-slate-300">
              {formatCurrency(kpis.total_initial_debt)}
            </span>
          </div>
        </div>

        {/* Collected This Month */}
        <div className="bg-slate-850 border border-slate-800 rounded-2xl p-5 shadow-sm hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Collections (This Month)
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-400 tracking-tight">
            {formatCurrency(kpis.total_collected_this_month)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>All-time Collected:</span>
            <span className="font-semibold text-emerald-300">
              {formatCurrency(kpis.total_collected_all_time)}
            </span>
          </div>
        </div>

        {/* Fleet Repayment Progress */}
        <div className="bg-slate-850 border border-slate-800 rounded-2xl p-5 shadow-sm hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Repayment Progress
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-blue-400 tracking-tight">
            {collectionRate}%
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-3">
            <div
              className="bg-gradient-to-r from-blue-500 to-emerald-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, collectionRate)}%` }}
            />
          </div>
        </div>

        {/* Active Workers & Alerts */}
        <div className="bg-slate-850 border border-slate-800 rounded-2xl p-5 shadow-sm hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Active Workers
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>{kpis.active_workers}</span>
            <span className="text-xs font-medium text-slate-400">
              drivers ({kpis.cleared_workers} cleared)
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            {kpis.behind_schedule_count > 0 ? (
              <span className="text-amber-400 font-semibold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {kpis.behind_schedule_count} behind schedule
              </span>
            ) : (
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                All drivers on track
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Cashflow Chart & Overdue Attention Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Collections Trend Chart (2 columns on lg) */}
        <div className="lg:col-span-2 bg-slate-850 border border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Monthly Mobile Money Collections
              </h3>
              <p className="text-xs text-slate-400">
                Historical monthly cash flow across all drivers
              </p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={cashflow_trend}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="period"
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  tickFormatter={(val) => `GHS ${val / 1000}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                  formatter={(value: any) => [
                    formatCurrency(Number(value)),
                    'Collections',
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                />
                <Bar
                  dataKey="collections"
                  name="Collections (GHS)"
                  fill="#10b981"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right side: Near Clearing or Quick Summary */}
        <div className="bg-slate-850 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Settlement Radar
              </h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Drivers nearing debt freedom (within 1-2 weekly payments)
            </p>

            {workers_near_clearing.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-400 space-y-1">
                <Clock className="w-5 h-5 mx-auto text-slate-500 mb-2" />
                <div className="font-semibold text-slate-300">
                  No drivers close to clearing yet
                </div>
                <div>All drivers are actively repaying their multi-year term.</div>
              </div>
            ) : (
              <div className="space-y-3">
                {workers_near_clearing.map((w) => (
                  <div
                    key={w.id}
                    onClick={() => onSelectWorker(w.id)}
                    className="p-3 bg-slate-900 hover:bg-slate-800 border border-slate-700/60 rounded-xl cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm">
                        {w.name}
                      </span>
                      <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                        {w.payments_left} payments left!
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1 flex justify-between">
                      <span>{w.car_type || 'Vehicle'}</span>
                      <span className="font-semibold text-rose-300">
                        {formatCurrency(w.outstanding_debt)} remaining
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800">
            <button
              onClick={onViewAllWorkers}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
            >
              <span>View All Worker Profiles</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Workers Behind Schedule / Overdue Section */}
      <div className="bg-slate-850 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              Drivers Needing Attention (Behind Schedule or &gt;14 Days Inactive)
            </h3>
            <p className="text-xs text-slate-400">
              Drivers whose pace is below 90% or haven&apos;t sent payment in over two weeks
            </p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            {workers_overdue.length} Drivers
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workers_overdue.map((w) => (
            <div
              key={w.id}
              className="bg-slate-900 border border-slate-700/70 rounded-xl p-4 hover:border-slate-600 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h4
                      onClick={() => onSelectWorker(w.id)}
                      className="font-bold text-white hover:text-emerald-400 cursor-pointer transition-colors text-sm"
                    >
                      {w.name}
                    </h4>
                    <span className="text-xs text-slate-400">
                      {w.car_type || 'Vehicle'} • {w.number_plate || '-'}
                    </span>
                  </div>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      (w.pace_pct ?? 0) < 80
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {formatPercentage(w.pace_pct)} Pace
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs border-t border-slate-800/80 pt-2">
                  <div>
                    <span className="text-slate-500 block text-[11px]">
                      Outstanding:
                    </span>
                    <span className="font-semibold text-rose-300">
                      {formatCurrency(w.outstanding_debt)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">
                      Last Paid:
                    </span>
                    <span
                      className={`font-semibold ${
                        (w.days_since_last_payment ?? 0) > 14
                          ? 'text-rose-400'
                          : 'text-slate-300'
                      }`}
                    >
                      {formatRelativeDays(w.days_since_last_payment)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                <button
                  onClick={() => onSelectWorker(w.id)}
                  className="text-xs text-slate-300 hover:text-white flex items-center gap-1"
                >
                  <span>View Ledger</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                {onOpenQuickAddWithWorker && (
                  <button
                    onClick={() => onOpenQuickAddWithWorker(w.id)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold transition-colors"
                  >
                    <Zap className="w-3 h-3 fill-current" />
                    <span>Add Payment</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fleet Driver Roster Preview */}
      <div className="bg-slate-850 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              Active Drivers Fleet
            </h3>
            <p className="text-xs text-slate-400">
              Quick view of balances and repayment consistency
            </p>
          </div>
          <button
            onClick={onViewAllWorkers}
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
          >
            <span>Full List &amp; Ledger</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4 font-semibold">Driver Name</th>
                <th className="py-3 px-4 font-semibold">Car &amp; Plate</th>
                <th className="py-3 px-4 font-semibold text-right">Weekly Target</th>
                <th className="py-3 px-4 font-semibold text-right">Paid So Far</th>
                <th className="py-3 px-4 font-semibold text-right">Outstanding Debt</th>
                <th className="py-3 px-4 font-semibold text-center">Pace %</th>
                <th className="py-3 px-4 font-semibold text-center">Consistency %</th>
                <th className="py-3 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {workers.slice(0, 5).map((w) => (
                <tr
                  key={w.id}
                  className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                  onClick={() => onSelectWorker(w.id)}
                >
                  <td className="py-3.5 px-4 font-bold text-white">
                    {w.name}
                  </td>
                  <td className="py-3.5 px-4 text-slate-400">
                    {w.car_type || '-'} ({w.number_plate || '-'})
                  </td>
                  <td className="py-3.5 px-4 text-right font-semibold text-slate-300">
                    {formatCurrency(w.expected_weekly_payment)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-semibold text-emerald-400">
                    {formatCurrency(w.total_paid)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-rose-300">
                    {formatCurrency(w.outstanding_debt)}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full font-bold text-[11px] ${
                        (w.pace_pct ?? 0) >= 90
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-amber-500/10 text-amber-400'
                      }`}
                    >
                      {formatPercentage(w.pace_pct)}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="inline-block px-2 py-0.5 rounded-full font-bold text-[11px] bg-blue-500/10 text-blue-400">
                      {formatPercentage(w.consistency_pct)}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectWorker(w.id);
                      }}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
                    >
                      Ledger →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
