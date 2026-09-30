import {
  Worker,
  LedgerEntry,
  PaymentMode,
  WorkerAlias,
  ParsedSmsResult,
  SmsPattern,
  OverviewAnalytics,
  LeaderboardWorker,
} from '../types';

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    let errorData: any;
    try {
      errorData = await response.json();
    } catch {
      errorData = { error: response.statusText };
    }
    const err: any = new Error(errorData.error || errorData.message || 'API request failed');
    err.status = response.status;
    err.details = errorData;
    throw err;
  }

  return response.json();
}

export const api = {
  // Workers
  async getWorkers(params?: {
    status?: string;
    occupation?: string;
    search?: string;
  }): Promise<Worker[]> {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.occupation) query.append('occupation', params.occupation);
    if (params?.search) query.append('search', params.search);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request<Worker[]>(`/workers${qs}`);
  },

  async getWorker(id: string): Promise<Worker> {
    return request<Worker>(`/workers/${id}`);
  },

  async createWorker(data: {
    name: string;
    phone?: string;
    occupation?: string;
    car_type?: string;
    number_plate?: string;
    initial_debt: number;
    expected_weekly_payment: number;
    start_date: string;
    expected_end_date?: string;
    notes?: string;
    details?: Record<string, any>;
  }): Promise<Worker> {
    return request<Worker>('/workers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateWorker(
    id: string,
    data: {
      name?: string;
      phone?: string;
      occupation?: string;
      car_type?: string;
      number_plate?: string;
      initial_debt?: number;
      expected_weekly_payment?: number;
      start_date?: string;
      expected_end_date?: string;
      status?: 'ACTIVE' | 'CLEARED' | 'INACTIVE';
      notes?: string;
      details?: Record<string, any>;
    }
  ): Promise<Worker> {
    return request<Worker>(`/workers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async markWorkerCleared(id: string): Promise<Worker> {
    return request<Worker>(`/workers/${id}/clear`, {
      method: 'POST',
    });
  },

  // Payment Modes
  async getPaymentModes(): Promise<PaymentMode[]> {
    return request<PaymentMode[]>('/ledger/payment-modes');
  },

  // Ledger Entries
  async getWorkerEntries(workerId: string): Promise<LedgerEntry[]> {
    return request<LedgerEntry[]>(`/workers/${workerId}/ledger`);
  },

  async createLedgerEntry(
    workerId: string,
    data: {
      type: 'DEBT_ADDED' | 'PAYMENT';
      amount: number;
      entry_date: string;
      payment_mode_id?: string | null;
      payment_mode?: string | null;
      transaction_ref?: string | null;
      sender_name?: string | null;
      source?: 'SMS_PARSED' | 'MANUAL';
      provider?: string | null;
      note?: string | null;
      save_alias_if_new?: boolean;
    }
  ): Promise<{
    entry: LedgerEntry;
    alias_created: boolean;
    worker: {
      id: string;
      name: string;
      initial_debt: number;
      total_debt_added: number;
      total_paid: number;
      outstanding_debt: number;
    };
  }> {
    return request(`/workers/${workerId}/ledger`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateLedgerEntry(
    workerId: string,
    entryId: string,
    data: {
      amount?: number;
      entry_date?: string;
      type?: 'DEBT_ADDED' | 'PAYMENT';
      payment_mode_id?: string | null;
      payment_mode?: string | null;
      transaction_ref?: string | null;
      sender_name?: string | null;
      provider?: string | null;
      note?: string | null;
    }
  ): Promise<{
    entry: LedgerEntry;
    worker: {
      id: string;
      name: string;
      initial_debt: number;
      total_debt_added: number;
      total_paid: number;
      outstanding_debt: number;
    };
  }> {
    return request(`/workers/${workerId}/ledger/${entryId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteLedgerEntry(
    workerId: string,
    entryId: string
  ): Promise<{
    message: string;
    worker: {
      id: string;
      name: string;
      initial_debt: number;
      total_debt_added: number;
      total_paid: number;
      outstanding_debt: number;
    };
  }> {
    return request(`/workers/${workerId}/ledger/${entryId}`, {
      method: 'DELETE',
    });
  },

  // Worker Aliases
  async getWorkerAliases(workerId: string): Promise<WorkerAlias[]> {
    return request<WorkerAlias[]>(`/workers/${workerId}/aliases`);
  },

  async createWorkerAlias(
    workerId: string,
    alias_name: string
  ): Promise<WorkerAlias> {
    return request<WorkerAlias>(`/workers/${workerId}/aliases`, {
      method: 'POST',
      body: JSON.stringify({ alias_name }),
    });
  },

  async deleteWorkerAlias(
    workerId: string,
    aliasId: string
  ): Promise<{ message: string }> {
    return request(`/workers/${workerId}/aliases/${aliasId}`, {
      method: 'DELETE',
    });
  },

  // SMS Parsing
  async parseSms(message: string): Promise<ParsedSmsResult> {
    return request<ParsedSmsResult>('/ledger/parse-sms', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },

  // SMS Pattern Training & Management
  async getSmsPatterns(): Promise<SmsPattern[]> {
    return request<SmsPattern[]>('/ledger/sms-patterns');
  },

  async generateSmsPattern(data: {
    example_sms: string;
    provider?: string;
    amount?: string | number | null;
    transaction_ref?: string | null;
    sender_name?: string | null;
    sender_phone?: string | null;
    date?: string | null;
    note?: string | null;
  }): Promise<{
    pattern_regex: string;
    amount_group: number | null;
    ref_group: number | null;
    sender_group: number | null;
    phone_group: number | null;
    date_group: number | null;
    note_group: number | null;
    date_missing: boolean;
    provider: string;
    test_result: ParsedSmsResult['parsed'];
  }> {
    return request('/ledger/sms-patterns/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async testSmsPattern(data: {
    test_sms: string;
    pattern_regex: string;
    amount_group?: number | null;
    ref_group?: number | null;
    sender_group?: number | null;
    phone_group?: number | null;
    date_group?: number | null;
    note_group?: number | null;
    date_missing?: boolean;
    provider?: string;
  }): Promise<ParsedSmsResult['parsed']> {
    return request('/ledger/sms-patterns/test', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async createSmsPattern(data: {
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
    date_missing?: boolean;
    is_active?: boolean;
  }): Promise<SmsPattern> {
    return request<SmsPattern>('/ledger/sms-patterns', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async toggleSmsPattern(id: string): Promise<SmsPattern> {
    return request<SmsPattern>(`/ledger/sms-patterns/${id}/toggle`, {
      method: 'PATCH',
    });
  },

  async deleteSmsPattern(id: string): Promise<{ success: boolean; deleted_id: string }> {
    return request(`/ledger/sms-patterns/${id}`, {
      method: 'DELETE',
    });
  },

  // Analytics
  async getLeaderboard(params?: {
    sortBy?: 'pace' | 'consistency';
    occupation?: string;
    status?: string;
  }): Promise<LeaderboardWorker[]> {
    const query = new URLSearchParams();
    if (params?.sortBy) query.append('sortBy', params.sortBy);
    if (params?.occupation) query.append('occupation', params.occupation);
    if (params?.status) query.append('status', params.status);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request<LeaderboardWorker[]>(`/analytics/leaderboard${qs}`);
  },

  async getOverviewAnalytics(): Promise<OverviewAnalytics> {
    return request<OverviewAnalytics>('/analytics/overview');
  },

  async getWorkerAnalytics(workerId: string): Promise<any> {
    return request(`/analytics/worker/${workerId}`);
  },

  async getOccupationAnalytics(occupation: string): Promise<any> {
    return request(`/analytics/occupation/${encodeURIComponent(occupation)}`);
  },

  // Export URLs
  getExportAllUrl(): string {
    return `${API_BASE_URL}/workers/export-all.xlsx`;
  },

  getWorkerExportUrl(workerId: string): string {
    return `${API_BASE_URL}/workers/${workerId}/export.xlsx`;
  },

  getBackupUrl(): string {
    return `${API_BASE_URL}/backup.json`;
  },
};
