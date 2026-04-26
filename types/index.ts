export type CalculationMode = "real" | "invoice";

export type InvoiceMode = "automatic" | "manual";

export interface WorkEntry {
  id: string;
  date: string;
  location: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  userName: string;
  abn: string;
  address: string;
  bankName: string;
  bsb: string;
  accountNumber: string;
  clientName: string;
  clientAddress: string;
  standardHourlyRate: number;
  dailyRegularLimitHours: number;
  overtimeMultiplier: number;
  declaredWeeklyLimitHours: number;
}

export interface DailyCalculation {
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  regularAmount: number;
  overtimeAmount: number;
  totalAmount: number;
}

export interface WeekRange {
  start: string;
  end: string;
  label: string;
}

export interface WeeklySummary {
  week: WeekRange;
  entries: WorkEntry[];
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  realAmount: number;
  suggestedDeclaredHours: number;
  suggestedInvoiceRate: number;
}

export interface InvoiceLine {
  id: string;
  entryId: string;
  included: boolean;
  date: string;
  location: string;
  description: string;
  sourceHours: number;
  declaredHours: number;
  unitPrice: number;
  total: number;
}

export interface InvoiceDetails {
  invoiceNumber: string;
  invoiceDate: string;
  invoiceTo: string;
  bankDetails: string;
  fromName: string;
  fromAbn: string;
  fromAddress: string;
}

export interface InvoiceTotals {
  subtotal: number;
  tax: number;
  total: number;
  declaredHours: number;
  realTargetAmount: number;
  difference: number;
}
