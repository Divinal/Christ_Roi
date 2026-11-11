import { locale } from '../../i18n';
export const formatFCFA = (amount: number): string =>
  `${Math.round(amount).toLocaleString(locale())} FCFA`;

const shortId = (): string => crypto.randomUUID().slice(0, 8).toUpperCase();

export const generateReceiptNumber = (academicYear: string, month: number): string =>
  `REC-${academicYear.split('-')[0]}${String(month).padStart(2, '0')}-${shortId()}`;

export const generatePayslipNumber = (academicYear: string, month: number): string =>
  `PAY-${academicYear.split('-')[0]}${String(month).padStart(2, '0')}-${shortId()}`;
