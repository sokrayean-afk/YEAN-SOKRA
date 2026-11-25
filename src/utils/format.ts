import type {
  Category,
  CurrencyCode,
  HouseholdMember,
  HouseholdSettings,
  PaymentMethod,
  Transaction,
} from '../types/finance';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'សាច់ប្រាក់',
  aba: 'ABA Pay',
  acleda: 'ACLEDA',
  wing: 'Wing',
  other: 'ផ្សេងៗ',
};

export const MEMBER_LABELS: Record<HouseholdMember, string> = {
  husband: 'ប្តី',
  wife: 'ប្រពន្ធ',
  joint: 'រួម (ប្តី+ប្រពន្ធ)',
  family: 'រួម (ប្តី+ប្រពន្ធ)',
};

export function getMemberLabel(
  member: HouseholdMember,
  settings?: Pick<HouseholdSettings, 'husbandName' | 'wifeName'>
): string {
  if (member === 'husband') return settings?.husbandName?.trim() || 'ប្តី';
  if (member === 'wife') return settings?.wifeName?.trim() || 'ប្រពន្ធ';
  return 'រួម';
}

export function formatMoney(
  amountUsd: number,
  currency: CurrencyCode,
  exchangeRate: number,
  options?: { compact?: boolean; showSign?: boolean }
): string {
  const isNegative = amountUsd < 0;
  const absUsd = Math.abs(amountUsd);
  const sign = isNegative ? '-' : options?.showSign && amountUsd > 0 ? '+' : '';

  if (currency === 'KHR') {
    const khr = Math.round((absUsd * exchangeRate) / 100) * 100;
    if (options?.compact && khr >= 1_000_000) {
      return `${sign}${(khr / 1_000_000).toFixed(2)}លាន ៛`;
    }
    if (options?.compact && khr >= 10_000) {
      return `${sign}${Math.round(khr / 1000).toLocaleString('en-US')}ពាន់ ៛`;
    }
    return `${sign}${khr.toLocaleString('en-US')} ៛`;
  }

  if (options?.compact && absUsd >= 1000) {
    return `${sign}$${(absUsd / 1000).toFixed(2)}k`;
  }

  return `${sign}$${absUsd.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDualHint(
  amountUsd: number,
  primaryCurrency: CurrencyCode,
  exchangeRate: number
): string {
  const secondary: CurrencyCode = primaryCurrency === 'USD' ? 'KHR' : 'USD';
  return formatMoney(amountUsd, secondary, exchangeRate);
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  return `${Math.round(value)}%`;
}

export function exportTransactionsToCsv(
  transactions: Transaction[],
  categories: Category[],
  exchangeRate: number,
  filename: string,
  settings?: Pick<HouseholdSettings, 'husbandName' | 'wifeName'>
): void {
  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  const headers = [
    'កាលបរិច្ឆេទ',
    'ប្រភេទ',
    'ក្រុមចំណូល/ចំណាយ',
    'ទឹកប្រាក់ (USD)',
    'ទឹកប្រាក់ (KHR)',
    'វិធីទូទាត់',
    'អ្នកប្រើប្រាស់ (ប្តី/ប្រពន្ធ)',
    'កំណត់ចំណាំ',
  ];

  const escapeCell = (val: string) => `"${String(val).replace(/"/g, '""')}"`;

  const rows = transactions.map((tx) => {
    const typeLabel = tx.type === 'income' ? 'ចំណូល' : 'ចំណាយ';
    const catName = catMap.get(tx.categoryId) || tx.categoryId;
    const khr = Math.round(tx.amountUsd * exchangeRate);
    return [
      tx.date,
      typeLabel,
      catName,
      tx.amountUsd.toFixed(2),
      String(khr),
      PAYMENT_METHOD_LABELS[tx.paymentMethod],
      getMemberLabel(tx.member, settings),
      tx.note,
    ]
      .map(escapeCell)
      .join(',');
  });

  // Add UTF-8 BOM so Khmer renders cleanly in Microsoft Excel
  const csvContent = '\uFEFF' + [headers.map(escapeCell).join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
