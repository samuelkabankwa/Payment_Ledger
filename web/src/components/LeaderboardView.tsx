import { useState, useEffect } from 'react';
import {
  Trophy,
  Medal,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Filter,
  Car,
  Phone,
} from 'lucide-react';
import { api } from '../services/api';
import { LeaderboardWorker } from '../types';
import {
  formatCurrency,
  formatPercentage,
  formatDate,
} from '../utils/formatters';

interface LeaderboardViewProps {
  onSelectWorker: (workerId: string) => void;
}

export function LeaderboardView({ onSelectWorker }: LeaderboardViewProps) {
  const [workers, setWorkers] = useState<LeaderboardWorker[]>([]);
  const [sortBy, setSortBy] = useState<'pace' | 'consistency'>('pace');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'CLEARED'>('ACTIVE');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getLeaderboard({
        sortBy,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      });
      setWorkers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load leaderboard.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [sortBy, statusFilter]);

  const getRankBadge = (index: number) => {
    if (index === 0) {
      return (
        <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-sm shadow-md shadow-amber-500/10">
          <Trophy className="w-4 h-4 text-amber-400" />
        </div>
      );
    }
    if (index === 1) {
      return (
        <div className="w-8 h-8 rounded-full bg-slate-300/20 text-slate-200 border border-slate-300/30 flex items-center justify-center font-bold text-sm">
          <Medal className="w-4 h-4 text-slate-300" />
        </div>
      );
    }
    if (index === 2) {
      return (
        <div className="w-8 h-8 rounded-full bg-amber-700/20 text-amber-600 border border-amber-700/30 flex items-center justify-center font-bold text-sm">
          <Medal className="w-4 h-4 text-amber-600" />
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center font-semibold text-xs">
        #{index + 1}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Title & Controls Header */}
      <div className="bg-slate-850 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Driver Performance Leaderboard
              </h2>
              <p className="text-xs text-slate-400">
                Weekly payment consistency and repayment pace ranking
              </p>
            </div>
          </div>
        </div>

        {/* Filter and Sort Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-xl p-1 text-xs">
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                statusFilter === 'ACTIVE'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter('CLEARED')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                statusFilter === 'CLEARED'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Cleared
            </button>
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All
            </button>
          </div>

          {/* Sort By Toggle */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-xl p-1 text-xs">
            <span className="text-[11px] font-semibold text-slate-400 pl-2 pr-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-slate-500" />
              Rank by:
            </span>
            <button
              onClick={() => setSortBy('pace')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                sortBy === 'pace'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Pace %
            </button>
            <button
              onClick={() => setSortBy('consistency')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                sortBy === 'consistency'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Consistency %
            </button>
          </div>
        </div>
      </div>

      {/* Leaderboard Table / Cards */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[350px] space-y-3">
          <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
          <span className="text-sm text-slate-400">Ranking drivers...</span>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
          {error}
        </div>
      ) : workers.length === 0 ? (
        <div className="p-12 text-center bg-slate-850 border border-slate-800 rounded-2xl text-slate-400">
          No workers found for this selection.
        </div>
      ) : (
        <div className="bg-slate-850 border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4 font-semibold text-center w-14">
                    Rank
                  </th>
                  <th className="py-3.5 px-4 font-semibold">Driver &amp; Vehicle</th>
                  <th className="py-3.5 px-4 font-semibold text-right">
                    Weekly Target
                  </th>
                  <th className="py-3.5 px-4 font-semibold text-right">
                    Outstanding Debt
                  </th>
                  <th className="py-3.5 px-4 font-semibold text-center">
                    Weeks Active
                  </th>
                  <th className="py-3.5 px-4 font-semibold text-center">
                    Pace %
                  </th>
                  <th className="py-3.5 px-4 font-semibold text-center">
                    Consistency %
                  </th>
                  <th className="py-3.5 px-4 font-semibold">Payoff Projection</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {workers.map((worker, index) => {
                  const debt = Number(worker.initial_debt) + Number(worker.total_debt_added);
                  const progressPct =
                    debt > 0 ? Math.min(100, Math.round((worker.total_paid / debt) * 100)) : 100;

                  return (
                    <tr
                      key={worker.id}
                      className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                      onClick={() => onSelectWorker(worker.id)}
                    >
                      {/* Rank Medal */}
                      <td className="py-4 px-4 text-center">
                        <div className="flex justify-center">
                          {getRankBadge(index)}
                        </div>
                      </td>

                      {/* Driver & Car */}
                      <td className="py-4 px-4">
                        <div className="font-bold text-white text-sm group-hover:text-emerald-400 transition-colors">
                          {worker.name}
                        </div>
                        <div className="flex items-center gap-2 text-slate-400 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Car className="w-3 h-3 text-slate-500" />
                            {worker.car_type || 'Vehicle'} • {worker.number_plate || '-'}
                          </span>
                          {worker.phone && (
                            <span className="flex items-center gap-1 text-[11px] text-slate-500">
                              <Phone className="w-2.5 h-2.5" />
                              {worker.phone}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Target */}
                      <td className="py-4 px-4 text-right font-semibold text-slate-300">
                        {formatCurrency(worker.expected_weekly_payment)}
                        <span className="text-[10px] text-slate-500 block">per week</span>
                      </td>

                      {/* Outstanding Debt & Progress */}
                      <td className="py-4 px-4 text-right">
                        <div className="font-bold text-rose-300">
                          {formatCurrency(worker.outstanding_debt)}
                        </div>
                        <div className="w-24 ml-auto bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1.5">
                          <div
                            className="bg-emerald-400 h-full rounded-full"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {progressPct}% settled
                        </span>
                      </td>

                      {/* Weeks */}
                      <td className="py-4 px-4 text-center text-slate-300 font-medium">
                        {worker.too_early ? (
                          <span className="text-slate-500 italic text-[11px]">
                            &lt;1 wk
                          </span>
                        ) : (
                          <div>
                            <span className="font-bold text-white">
                              {worker.distinct_weeks_paid}
                            </span>
                            <span className="text-slate-500"> / {worker.weeks_elapsed} wks</span>
                          </div>
                        )}
                      </td>

                      {/* Pace % Badge */}
                      <td className="py-4 px-4 text-center">
                        {worker.too_early ? (
                          <span className="text-[11px] text-slate-500 italic">
                            Too early
                          </span>
                        ) : (
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full font-bold text-xs ${
                              (worker.pace_pct ?? 0) >= 100
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : (worker.pace_pct ?? 0) >= 90
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {formatPercentage(worker.pace_pct)}
                          </span>
                        )}
                      </td>

                      {/* Consistency % Badge */}
                      <td className="py-4 px-4 text-center">
                        {worker.too_early ? (
                          <span className="text-[11px] text-slate-500 italic">
                            Too early
                          </span>
                        ) : (
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full font-bold text-xs ${
                              (worker.consistency_pct ?? 0) >= 80
                                ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                                : 'bg-slate-700 text-slate-300'
                            }`}
                          >
                            {formatPercentage(worker.consistency_pct)}
                          </span>
                        )}
                      </td>

                      {/* Projected Payoff */}
                      <td className="py-4 px-4">
                        <div className="text-slate-200 font-medium flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{formatDate(worker.projected_end_date || worker.expected_end_date)}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 block">
                          Contract: {formatDate(worker.expected_end_date)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 text-center">
                        {worker.is_behind_schedule ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                            <AlertCircle className="w-3 h-3" />
                            Behind
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            On Track
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectWorker(worker.id);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs flex items-center gap-1 ml-auto transition-colors"
                        >
                          <span>Ledger</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
