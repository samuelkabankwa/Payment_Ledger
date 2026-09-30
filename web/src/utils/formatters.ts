export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return 'GHS 0.00';
  }
  const num = Number(amount);
  return `GHS ${num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function formatDateInput(dateString: string | null | undefined): string {
  if (!dateString) return new Date().toISOString().slice(0, 10);
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
    return d.toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function formatPercentage(val: number | null | undefined): string {
  if (val === null || val === undefined) return '-';
  return `${Math.round(val * 10) / 10}%`;
}

export function formatRelativeDays(days: number | null | undefined): string {
  if (days === null || days === undefined) return 'Never paid';
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}
