export type WorkerStatus = 'ACTIVE' | 'CLEARED' | 'INACTIVE';
export type LedgerEntryType = 'DEBT_ADDED' | 'PAYMENT';
export type LedgerEntrySource = 'SMS_PARSED' | 'MANUAL';

export interface WorkerAlias {
  id: string;
  worker_id: string;
  alias_name: string;
  created_at: string;
}

export interface Worker {
  id: string;
  name: string;
  phone: string | null;
  occupation: string;
  car_type: string | null;
  number_plate: string | null;
  initial_debt: number;
  expected_weekly_payment: number;
  start_date: string;
  expected_end_date: string;
  status: WorkerStatus;
  details: Record<string, any> | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  aliases?: WorkerAlias[];
  total_debt_added: number;
  total_paid: number;
  outstanding_debt: number;
  days_since_start: number;
  weeks_elapsed: number;
  too_early: boolean;
  distinct_weeks_paid: number;
  consistency_pct: number | null;
  pace_pct: number | null;
  is_behind_schedule: boolean;
  days_since_last_payment: number | null;
  projected_end_date: string | null;
}

export interface PaymentMode {
  id: string;
  name: string;
  created_at?: string;
}

export interface LedgerEntry {
  id: string;
  worker_id: string;
  payment_mode_id?: string | null;
  payment_mode?: PaymentMode | null;
  type: LedgerEntryType;
  amount: number;
  entry_date: string;
  transaction_ref: string | null;
  sender_name: string | null;
  payment_number: number | null;
  source: LedgerEntrySource;
  provider: string | null;
  note: string | null;
  running_balance?: number;
  created_at: string;
}

export interface ParsedSmsResult {
  parsed: {
    provider: 'MTN' | 'TELECEL' | 'AT' | 'BANK' | 'OTHER' | 'UNKNOWN';
    amount: number | null;
    entry_date: string;
    sender_name: string | null;
    sender_phone: string | null;
    transaction_ref: string | null;
    note: string | null;
    date_missing: boolean;
    raw_matched?: boolean;
    pattern_name?: string;
  };
  suggested_worker: {
    id: string;
    name: string;
    phone: string | null;
    matched_on: string;
    matched_text?: string;
    similarity: number;
  } | null;
  all_workers: Array<{
    id: string;
    name: string;
    phone: string | null;
    occupation: string;
  }>;
}

export interface SmsPattern {
  id: string;
  name: string;
  provider: string;
  example_sms: string;
  pattern_regex: string;
  amount_group?: number | null;
  ref_group?: number | null;
  sender_group?: number | null;
  phone_group?: number | null;
  date_group?: number | null;
  note_group?: number | null;
  date_missing: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface OverviewAnalytics {
  kpis: {
    total_initial_debt: number;
    total_debt_added: number;
    total_outstanding_debt: number;
    total_collected_all_time: number;
    total_collected_this_month: number;
    active_workers: number;
    cleared_workers: number;
    inactive_workers: number;
    behind_schedule_count: number;
  };
  workers_near_clearing: Array<{
    id: string;
    name: string;
    phone: string | null;
    car_type: string | null;
    number_plate: string | null;
    outstanding_debt: number;
    expected_weekly_payment: number;
    payments_left: number;
  }>;
  workers_overdue: Array<{
    id: string;
    name: string;
    phone: string | null;
    car_type: string | null;
    number_plate: string | null;
    outstanding_debt: number;
    days_since_last_payment: number | null;
    pace_pct: number | null;
    consistency_pct: number | null;
  }>;
  cashflow_trend: Array<{
    period: string;
    collections: number;
    debt_added: number;
  }>;
}

export interface LeaderboardWorker extends Worker {
  rank?: number;
}
