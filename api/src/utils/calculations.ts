/**
 * Calculate suggested expected_end_date based on:
 * start_date + ceil(initial_debt / expected_weekly_payment) weeks
 */
export function calculateSuggestedEndDate(
  startDate: Date,
  initialDebt: number,
  expectedWeeklyPayment: number
): Date {
  if (expectedWeeklyPayment <= 0 || initialDebt <= 0) {
    return new Date(startDate);
  }
  const weeks = Math.ceil(initialDebt / expectedWeeklyPayment);
  const result = new Date(startDate.getTime());
  result.setDate(result.getDate() + weeks * 7);
  return result;
}

/**
 * Computes debt summary for a worker:
 * - total_debt_added = Σ(DEBT_ADDED)
 * - total_paid = Σ(PAYMENT)
 * - outstanding_debt = initial_debt + total_debt_added - total_paid
 */
export function computeWorkerBalance(
  initialDebt: number | string | any,
  ledgerEntries: Array<{ type: "DEBT_ADDED" | "PAYMENT"; amount: number | string | any }>
) {
  const initial = Number(initialDebt) || 0;
  let totalDebtAdded = 0;
  let totalPaid = 0;

  for (const entry of ledgerEntries) {
    const amt = Number(entry.amount) || 0;
    if (entry.type === "DEBT_ADDED") {
      totalDebtAdded += amt;
    } else if (entry.type === "PAYMENT") {
      totalPaid += amt;
    }
  }

  const outstandingDebt = initial + totalDebtAdded - totalPaid;

  return {
    initial_debt: Math.round(initial * 100) / 100,
    total_debt_added: Math.round(totalDebtAdded * 100) / 100,
    total_paid: Math.round(totalPaid * 100) / 100,
    outstanding_debt: Math.round(outstandingDebt * 100) / 100,
  };
}

/**
 * Dynamically attach payment_number to ledger entries:
 * 1-based index among PAYMENT entries ordered chronologically by entry_date ASC, created_at ASC.
 * For DEBT_ADDED entries, payment_number is null.
 * Also computes running_balance on read.
 */
export function attachPaymentNumbersAndRunningBalance(
  initialDebt: number | string | any,
  entries: Array<any>
) {
  // Sort chronologically
  const sorted = [...entries].sort((a, b) => {
    const dateA = new Date(a.entry_date).getTime();
    const dateB = new Date(b.entry_date).getTime();
    if (dateA !== dateB) return dateA - dateB;
    const createdA = new Date(a.created_at || 0).getTime();
    const createdB = new Date(b.created_at || 0).getTime();
    return createdA - createdB;
  });

  let paymentCounter = 0;
  let runningBalance = Number(initialDebt) || 0;

  return sorted.map((entry) => {
    const amt = Number(entry.amount) || 0;
    let paymentNumber: number | null = null;

    if (entry.type === "PAYMENT") {
      paymentCounter += 1;
      paymentNumber = paymentCounter;
      runningBalance -= amt;
    } else if (entry.type === "DEBT_ADDED") {
      runningBalance += amt;
    }

    return {
      ...entry,
      payment_number: paymentNumber,
      running_balance: Math.round(runningBalance * 100) / 100,
    };
  });
}

/**
 * Weekly pace and consistency calculations anchored to start_date.
 * Weeks are sequential 7-day windows starting from start_date.
 */
export function computeWeeklyPaceAndConsistency(
  worker: {
    start_date: Date | string;
    expected_weekly_payment: number | string | any;
    expected_end_date: Date | string;
    initial_debt: number | string | any;
  },
  ledgerEntries: Array<any>,
  asOfDate: Date = new Date()
) {
  const startDate = new Date(worker.start_date);
  const now = asOfDate;
  const initialDebt = Number(worker.initial_debt) || 0;
  const expectedWeekly = Number(worker.expected_weekly_payment) || 1;

  // Days elapsed since start_date
  const diffMs = now.getTime() - startDate.getTime();
  const daysSinceStart = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const balance = computeWorkerBalance(initialDebt, ledgerEntries);
  const payments = ledgerEntries.filter((e) => e.type === "PAYMENT");

  // Days since last payment
  let daysSinceLastPayment: number | null = null;
  let latestPaymentDate: Date | null = null;
  if (payments.length > 0) {
    const sortedPayments = [...payments].sort(
      (a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime()
    );
    latestPaymentDate = new Date(sortedPayments[0].entry_date);
    const msSinceLast = now.getTime() - latestPaymentDate.getTime();
    daysSinceLastPayment = Math.max(0, Math.floor(msSinceLast / (1000 * 60 * 60 * 24)));
  }

  // Guard: if worker started less than 7 days ago
  if (daysSinceStart < 7) {
    return {
      ...balance,
      days_since_start: Math.max(0, daysSinceStart),
      weeks_elapsed: 0,
      too_early: true,
      consistency_pct: null,
      pace_pct: null,
      is_behind_schedule: false,
      days_since_last_payment: daysSinceLastPayment,
      projected_end_date: worker.expected_end_date,
    };
  }

  const weeksElapsed = Math.floor(daysSinceStart / 7) + 1;

  // Consistency %: distinct weeks with at least 1 PAYMENT / weeks_elapsed (capped at 100%)
  const paidWeeksSet = new Set<number>();
  for (const p of payments) {
    const pDate = new Date(p.entry_date);
    const pDays = Math.floor((pDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (pDays >= 0) {
      const pWeek = Math.floor(pDays / 7) + 1;
      if (pWeek <= weeksElapsed) {
        paidWeeksSet.add(pWeek);
      }
    }
  }

  const consistencyPct = Math.min(
    100,
    Math.round((paidWeeksSet.size / weeksElapsed) * 1000) / 10
  );

  // Pace %: total_paid / (expected_weekly_payment * weeks_elapsed)
  const expectedCumulative = expectedWeekly * weeksElapsed;
  const pacePct = Math.round((balance.total_paid / expectedCumulative) * 1000) / 10;

  // Behind schedule flag: pace < 90% or haven't paid in > 14 days
  const isBehindSchedule = pacePct < 90 || (daysSinceLastPayment !== null && daysSinceLastPayment > 14);

  // Auto-recalculated projected end date
  let projectedEndDate: Date | string = worker.expected_end_date;
  if (balance.outstanding_debt <= 0) {
    projectedEndDate = latestPaymentDate || now;
  } else if (balance.total_paid > 0 && weeksElapsed >= 1) {
    const weeklyRate = balance.total_paid / weeksElapsed;
    const remainingWeeks = Math.ceil(balance.outstanding_debt / weeklyRate);
    const projDate = new Date(now.getTime());
    projDate.setDate(projDate.getDate() + remainingWeeks * 7);
    projectedEndDate = projDate;
  }

  return {
    ...balance,
    days_since_start: daysSinceStart,
    weeks_elapsed: weeksElapsed,
    too_early: false,
    distinct_weeks_paid: paidWeeksSet.size,
    consistency_pct: consistencyPct,
    pace_pct: pacePct,
    is_behind_schedule: isBehindSchedule,
    days_since_last_payment: daysSinceLastPayment,
    projected_end_date: projectedEndDate,
  };
}
