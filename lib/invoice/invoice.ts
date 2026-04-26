import type {
  AppSettings,
  InvoiceDetails,
  InvoiceLine,
  InvoiceMode,
  InvoiceTotals,
  WorkEntry
} from "@/types";
import {
  formatDate,
  formatShortDate,
  roundHours,
  roundMoney,
  roundRate,
  todayIso
} from "@/lib/calculations/format";
import { calculateDailyPayroll } from "@/lib/calculations/payroll";

export function makeInvoiceNumber(weekStart: string): string {
  return `PRO-${weekStart.replaceAll("-", "")}`;
}

export function buildInvoiceDetails(
  settings: AppSettings,
  weekStart: string
): InvoiceDetails {
  return {
    invoiceNumber: makeInvoiceNumber(weekStart),
    invoiceDate: todayIso(),
    invoiceTo: `${settings.clientName}\n${settings.clientAddress}`,
    bankDetails: `${settings.bankName}\nBSB: ${settings.bsb}\nAccount: ${settings.accountNumber}`,
    fromName: settings.userName,
    fromAbn: settings.abn,
    fromAddress: settings.address
  };
}

function roundDeclaredHours(value: number): number {
  return Math.max(0, Math.round(value));
}

function allocateDeclaredHours(
  entries: WorkEntry[],
  settings: AppSettings
): number[] {
  const entryData = entries.map((entry, index) => {
    const payroll = calculateDailyPayroll(entry, settings);
    return {
      index,
      sourceHours: payroll.totalHours,
      realAmount: payroll.totalAmount
    };
  });
  const totalSourceHours = entryData.reduce((sum, entry) => sum + entry.sourceHours, 0);
  const targetHours =
    totalSourceHours > settings.declaredWeeklyLimitHours
      ? settings.declaredWeeklyLimitHours
      : Math.round(totalSourceHours);

  if (targetHours <= 0 || entryData.length === 0) {
    return entryData.map(() => 0);
  }

  if (targetHours < entryData.length) {
    return entryData
      .map((entry) => ({ ...entry, baseHours: 0 }))
      .sort((a, b) =>
        b.realAmount - a.realAmount || b.sourceHours - a.sourceHours || a.index - b.index
      )
      .map((entry, position) => ({
        ...entry,
        baseHours: position < targetHours ? 1 : 0
      }))
      .sort((a, b) => a.index - b.index)
      .map((entry) => entry.baseHours);
  }

  const baseAllocation = entryData.map((entry) => ({
    ...entry,
    baseHours: 1
  }));
  const remainingHours = targetHours - entryData.length;

  if (remainingHours <= 0) {
    return baseAllocation.map((entry) => entry.baseHours);
  }

  const weightedAllocation = baseAllocation.map((entry) => {
    const weight = Math.max(entry.sourceHours - 1, 0);
    const exactExtra = weight <= 0
      ? 0
      : (weight / baseAllocation.reduce((sum, item) => sum + Math.max(item.sourceHours - 1, 0), 0)) * remainingHours;
    const extraHours = Math.floor(exactExtra);

    return {
      ...entry,
      extraHours,
      remainder: exactExtra - extraHours,
      baseHours: entry.baseHours + extraHours
    };
  });

  let stillNeeded =
    targetHours - weightedAllocation.reduce((sum, entry) => sum + entry.baseHours, 0);

  if (stillNeeded > 0) {
    const remainderOrder = [...weightedAllocation].sort((a, b) =>
      b.remainder - a.remainder || b.realAmount - a.realAmount || b.sourceHours - a.sourceHours || a.index - b.index
    );

    for (const entry of remainderOrder) {
      if (stillNeeded === 0) {
        break;
      }

      entry.baseHours += 1;
      stillNeeded -= 1;
    }
  }

  return weightedAllocation
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.baseHours);
}

export function createInvoiceLines(
  entries: WorkEntry[],
  settings: AppSettings,
  mode: InvoiceMode,
  previousLines?: InvoiceLine[]
): InvoiceLine[] {
  const includedEntries = entries.filter((entry) => {
    const previous = previousLines?.find((line) => line.entryId === entry.id);
    return previous ? previous.included : true;
  });
  const declaredHours = allocateDeclaredHours(includedEntries, settings);
  const lines = entries.map<InvoiceLine>((entry) => {
    const previous = previousLines?.find((line) => line.entryId === entry.id);
    const payroll = calculateDailyPayroll(entry, settings);
    const included = previous ? previous.included : true;
    const includedIndex = includedEntries.findIndex((includedEntry) => includedEntry.id === entry.id);
    const autoDeclaredHours = included && includedIndex >= 0 ? declaredHours[includedIndex] : 0;
    const automaticUnitPrice =
      autoDeclaredHours > 0
        ? roundRate(payroll.totalAmount / autoDeclaredHours)
        : 0;
    const manualDeclaredHours = previous?.declaredHours ?? autoDeclaredHours;
    const manualUnitPrice = previous?.unitPrice ?? automaticUnitPrice;
    const quantity = mode === "manual" ? manualDeclaredHours : autoDeclaredHours;
    const unitPrice = mode === "manual" ? manualUnitPrice : automaticUnitPrice;
    const total = included
      ? mode === "manual"
        ? roundMoney(quantity * unitPrice)
        : payroll.totalAmount
      : 0;

    return {
      id: previous?.id ?? `line-${entry.id}`,
      entryId: entry.id,
      included,
      date: entry.date,
      location: entry.location,
      description: `${entry.location} - ${formatShortDate(entry.date)}`,
      sourceHours: payroll.totalHours,
      declaredHours: roundDeclaredHours(quantity),
      unitPrice: roundRate(unitPrice),
      total: roundMoney(total)
    };
  });

  return mode === "automatic"
    ? lines
    : lines;
}

export function calculateInvoiceTargetAmount(
  entries: WorkEntry[],
  settings: AppSettings
): number {
  return roundMoney(
    entries.reduce(
      (sum, entry) => sum + calculateDailyPayroll(entry, settings).totalAmount,
      0
    )
  );
}

export function calculateInvoiceTotals(
  lines: InvoiceLine[],
  realTargetAmount: number
): InvoiceTotals {
  const includedLines = lines.filter((line) => line.included);
  const subtotal = roundMoney(
    includedLines.reduce((sum, line) => sum + line.total, 0)
  );
  const declaredHours = roundHours(
    includedLines.reduce((sum, line) => sum + line.declaredHours, 0)
  );

  return {
    subtotal,
    tax: 0,
    total: subtotal,
    declaredHours,
    realTargetAmount: roundMoney(realTargetAmount),
    difference: roundMoney(subtotal - realTargetAmount)
  };
}

export function updateManualLine(
  lines: InvoiceLine[],
  lineId: string,
  patch: Partial<Pick<InvoiceLine, "included" | "declaredHours" | "unitPrice">>
): InvoiceLine[] {
  return lines.map((line) => {
    if (line.id !== lineId) {
      return line;
    }

    const next = {
      ...line,
      ...patch
    };

    return {
      ...next,
      declaredHours: roundDeclaredHours(next.declaredHours),
      unitPrice: roundRate(Math.max(0, next.unitPrice)),
      total: next.included
        ? roundMoney(Math.max(0, next.declaredHours) * Math.max(0, next.unitPrice))
        : 0
    };
  });
}

export function invoiceFileName(details: InvoiceDetails): string {
  return `${details.invoiceNumber || "invoice"}.pdf`;
}

export function invoiceMetaDescription(details: InvoiceDetails): string {
  return `Invoice ${details.invoiceNumber} issued ${formatDate(details.invoiceDate)}`;
}
