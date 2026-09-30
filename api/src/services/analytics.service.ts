import { prisma } from "../prisma";
import {
  computeWeeklyPaceAndConsistency,
  attachPaymentNumbersAndRunningBalance,
} from "../utils/calculations";
import { WorkerStatus } from "@prisma/client";

export class AnalyticsService {
  /**
   * Driver / Worker Leaderboard
   * Sorted by Pace % DESC (default) or Consistency % DESC
   */
  static async getLeaderboard(options?: {
    sortBy?: "pace" | "consistency";
    occupation?: string;
    status?: WorkerStatus;
  }) {
    const where: any = {};
    if (options?.status) {
      where.status = options.status;
    } else {
      where.status = WorkerStatus.ACTIVE; // Default to active workers
    }

    if (options?.occupation) {
      where.occupation = { equals: options.occupation, mode: "insensitive" };
    }

    const workers = await prisma.worker.findMany({
      where,
      include: {
        ledger_entries: {
          select: {
            id: true,
            type: true,
            amount: true,
            entry_date: true,
            created_at: true,
          },
        },
      },
    });

    const ranked = workers.map((worker) => {
      const metrics = computeWeeklyPaceAndConsistency(worker, worker.ledger_entries);
      return {
        id: worker.id,
        name: worker.name,
        phone: worker.phone,
        occupation: worker.occupation,
        car_type: worker.car_type,
        number_plate: worker.number_plate,
        status: worker.status,
        start_date: worker.start_date,
        expected_weekly_payment: Number(worker.expected_weekly_payment),
        ...metrics,
      };
    });

    const sortBy = options?.sortBy || "pace";

    ranked.sort((a, b) => {
      if (sortBy === "consistency") {
        const valA = a.consistency_pct ?? -1;
        const valB = b.consistency_pct ?? -1;
        if (valB !== valA) return valB - valA;
        return (b.pace_pct ?? -1) - (a.pace_pct ?? -1);
      } else {
        const valA = a.pace_pct ?? -1;
        const valB = b.pace_pct ?? -1;
        if (valB !== valA) return valB - valA;
        return (b.consistency_pct ?? -1) - (a.consistency_pct ?? -1);
      }
    });

    return ranked;
  }

  /**
   * Individual worker analytics
   */
  static async getWorkerAnalytics(workerId: string) {
    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      include: {
        aliases: true,
        ledger_entries: {
          orderBy: [{ entry_date: "asc" }, { created_at: "asc" }],
        },
      },
    });

    if (!worker) return null;

    const metrics = computeWeeklyPaceAndConsistency(worker, worker.ledger_entries);
    const numberedEntries = attachPaymentNumbersAndRunningBalance(
      worker.initial_debt,
      worker.ledger_entries
    );

    const totalDebt = metrics.initial_debt + metrics.total_debt_added;
    const progressPct =
      totalDebt > 0
        ? Math.min(100, Math.round((metrics.total_paid / totalDebt) * 1000) / 10)
        : 100;

    // Monthly payments summary
    const monthlyMap = new Map<string, { total: number; count: number }>();
    for (const e of worker.ledger_entries) {
      if (e.type === "PAYMENT") {
        const m = new Date(e.entry_date).toISOString().slice(0, 7); // YYYY-MM
        const curr = monthlyMap.get(m) || { total: 0, count: 0 };
        curr.total += Number(e.amount);
        curr.count += 1;
        monthlyMap.set(m, curr);
      }
    }

    const monthlyHistory = Array.from(monthlyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, data]) => ({
        month,
        total_paid: Math.round(data.total * 100) / 100,
        payment_count: data.count,
      }));

    return {
      worker: {
        id: worker.id,
        name: worker.name,
        phone: worker.phone,
        occupation: worker.occupation,
        car_type: worker.car_type,
        number_plate: worker.number_plate,
        start_date: worker.start_date,
        expected_end_date: worker.expected_end_date,
        expected_weekly_payment: Number(worker.expected_weekly_payment),
        status: worker.status,
        notes: worker.notes,
        aliases: worker.aliases,
      },
      metrics: {
        ...metrics,
        progress_pct: progressPct,
      },
      monthly_history: monthlyHistory,
      recent_entries: numberedEntries.slice(-10).reverse(), // Last 10 entries
    };
  }

  /**
   * Analytics per occupation / group
   */
  static async getOccupationAnalytics(occupation: string) {
    const workers = await prisma.worker.findMany({
      where: {
        occupation: { equals: occupation, mode: "insensitive" },
      },
      include: {
        ledger_entries: {
          select: {
            type: true,
            amount: true,
            entry_date: true,
            created_at: true,
          },
        },
      },
    });

    const now = new Date();
    const currentMonthPrefix = now.toISOString().slice(0, 7); // YYYY-MM

    let totalInitialDebt = 0;
    let totalDebtAdded = 0;
    let totalPaid = 0;
    let totalCollectedThisMonth = 0;
    let activeCount = 0;
    let behindScheduleCount = 0;
    let totalRemainingWeeks = 0;
    let activeWithDebtCount = 0;

    const workerSummaries = workers.map((worker) => {
      const metrics = computeWeeklyPaceAndConsistency(worker, worker.ledger_entries);
      totalInitialDebt += metrics.initial_debt;
      totalDebtAdded += metrics.total_debt_added;
      totalPaid += metrics.total_paid;

      if (worker.status === WorkerStatus.ACTIVE) {
        activeCount += 1;
        if (metrics.is_behind_schedule) {
          behindScheduleCount += 1;
        }

        if (metrics.outstanding_debt > 0) {
          const weeklyRate =
            metrics.total_paid > 0 && metrics.weeks_elapsed >= 1
              ? metrics.total_paid / metrics.weeks_elapsed
              : Number(worker.expected_weekly_payment);
          if (weeklyRate > 0) {
            totalRemainingWeeks += Math.ceil(metrics.outstanding_debt / weeklyRate);
            activeWithDebtCount += 1;
          }
        }
      }

      for (const e of worker.ledger_entries) {
        if (e.type === "PAYMENT") {
          const m = new Date(e.entry_date).toISOString().slice(0, 7);
          if (m === currentMonthPrefix) {
            totalCollectedThisMonth += Number(e.amount);
          }
        }
      }

      return {
        id: worker.id,
        name: worker.name,
        car_type: worker.car_type,
        number_plate: worker.number_plate,
        status: worker.status,
        outstanding_debt: metrics.outstanding_debt,
        total_paid: metrics.total_paid,
        pace_pct: metrics.pace_pct,
        consistency_pct: metrics.consistency_pct,
        is_behind_schedule: metrics.is_behind_schedule,
      };
    });

    const totalOutstandingDebt = totalInitialDebt + totalDebtAdded - totalPaid;
    const avgTimeToClearWeeks =
      activeWithDebtCount > 0 ? Math.round(totalRemainingWeeks / activeWithDebtCount) : 0;

    return {
      occupation,
      total_workers: workers.length,
      active_workers: activeCount,
      behind_schedule_count: behindScheduleCount,
      total_initial_debt: Math.round(totalInitialDebt * 100) / 100,
      total_outstanding_debt: Math.round(totalOutstandingDebt * 100) / 100,
      total_collected_all_time: Math.round(totalPaid * 100) / 100,
      total_collected_this_month: Math.round(totalCollectedThisMonth * 100) / 100,
      average_time_to_clear_weeks: avgTimeToClearWeeks,
      workers: workerSummaries,
    };
  }

  /**
   * Fleet-wide overall overview analytics
   */
  static async getOverviewAnalytics() {
    const workers = await prisma.worker.findMany({
      include: {
        ledger_entries: {
          select: {
            id: true,
            type: true,
            amount: true,
            entry_date: true,
            created_at: true,
          },
        },
      },
    });

    const now = new Date();
    const currentMonthPrefix = now.toISOString().slice(0, 7);

    let totalInitialDebt = 0;
    let totalDebtAdded = 0;
    let totalPaid = 0;
    let totalCollectedThisMonth = 0;

    let activeCount = 0;
    let clearedCount = 0;
    let inactiveCount = 0;
    let behindScheduleCount = 0;

    const workersNearClearing: any[] = [];
    const workersOverdue: any[] = [];

    // Monthly cashflow aggregation
    const monthlyCashflow = new Map<string, { collections: number; debt_added: number }>();

    for (const worker of workers) {
      const metrics = computeWeeklyPaceAndConsistency(worker, worker.ledger_entries);
      totalInitialDebt += metrics.initial_debt;
      totalDebtAdded += metrics.total_debt_added;
      totalPaid += metrics.total_paid;

      if (worker.status === WorkerStatus.ACTIVE) {
        activeCount += 1;
        if (metrics.is_behind_schedule) {
          behindScheduleCount += 1;
        }

        // Near clearing: outstanding debt <= 2x expected weekly payment
        const weeklyPayment = Number(worker.expected_weekly_payment) || 1;
        if (metrics.outstanding_debt > 0 && metrics.outstanding_debt <= weeklyPayment * 2) {
          workersNearClearing.push({
            id: worker.id,
            name: worker.name,
            phone: worker.phone,
            car_type: worker.car_type,
            number_plate: worker.number_plate,
            outstanding_debt: metrics.outstanding_debt,
            expected_weekly_payment: weeklyPayment,
            payments_left: Math.ceil(metrics.outstanding_debt / weeklyPayment),
          });
        }

        // Overdue: haven't paid in > 14 days or behind schedule
        if (
          (metrics.days_since_last_payment !== null && metrics.days_since_last_payment > 14) ||
          metrics.is_behind_schedule
        ) {
          workersOverdue.push({
            id: worker.id,
            name: worker.name,
            phone: worker.phone,
            car_type: worker.car_type,
            number_plate: worker.number_plate,
            outstanding_debt: metrics.outstanding_debt,
            days_since_last_payment: metrics.days_since_last_payment,
            pace_pct: metrics.pace_pct,
            consistency_pct: metrics.consistency_pct,
          });
        }
      } else if (worker.status === WorkerStatus.CLEARED) {
        clearedCount += 1;
      } else if (worker.status === WorkerStatus.INACTIVE) {
        inactiveCount += 1;
      }

      // Track cashflow
      for (const e of worker.ledger_entries) {
        const period = new Date(e.entry_date).toISOString().slice(0, 7);
        const curr = monthlyCashflow.get(period) || { collections: 0, debt_added: 0 };
        const amt = Number(e.amount);

        if (e.type === "PAYMENT") {
          curr.collections += amt;
          if (period === currentMonthPrefix) {
            totalCollectedThisMonth += amt;
          }
        } else if (e.type === "DEBT_ADDED") {
          curr.debt_added += amt;
        }

        monthlyCashflow.set(period, curr);
      }
    }

    const totalOutstanding = totalInitialDebt + totalDebtAdded - totalPaid;

    const cashflowTrend = Array.from(monthlyCashflow.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([period, data]) => ({
        period,
        collections: Math.round(data.collections * 100) / 100,
        debt_added: Math.round(data.debt_added * 100) / 100,
      }));

    return {
      kpis: {
        total_initial_debt: Math.round(totalInitialDebt * 100) / 100,
        total_debt_added: Math.round(totalDebtAdded * 100) / 100,
        total_outstanding_debt: Math.round(totalOutstanding * 100) / 100,
        total_collected_all_time: Math.round(totalPaid * 100) / 100,
        total_collected_this_month: Math.round(totalCollectedThisMonth * 100) / 100,
        active_workers: activeCount,
        cleared_workers: clearedCount,
        inactive_workers: inactiveCount,
        behind_schedule_count: behindScheduleCount,
      },
      workers_near_clearing: workersNearClearing,
      workers_overdue: workersOverdue,
      cashflow_trend: cashflowTrend,
    };
  }
}
