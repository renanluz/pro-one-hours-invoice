"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { AppSettings, InvoiceDetails, InvoiceLine, InvoiceTotals, WeekRange, WorkEntry } from "@/types";
import { formatDate, formatMoney, formatUnitPrice } from "@/lib/calculations/format";
import { calculateDailyPayroll, calculateEntriesTotal } from "@/lib/calculations/payroll";
import { invoiceFileName, invoiceMetaDescription } from "./invoice";

type Rgb = [number, number, number];

// Light theme tokens from app/globals.css, so the PDF matches the site.
const theme = {
  ink: [16, 18, 35] as Rgb, // --ink #101223
  ink2: [35, 38, 74] as Rgb, // --ink-2 #23264a
  accent: [43, 68, 232] as Rgb, // --accent #2b44e8
  accentSoft: [238, 240, 254] as Rgb, // --accent-soft #eef0fe
  onDark: [195, 203, 255] as Rgb, // --on-accent-2 #c3cbff
  text2: [79, 86, 126] as Rgb, // invoice paper copy #4f567e
  surface2: [246, 247, 253] as Rgb, // --surface-2 #f6f7fd
  border: [226, 229, 247] as Rgb, // --border #e2e5f7
  white: [255, 255, 255] as Rgb
};

const FONT = "Archivo";
const FONT_HEAVY = "ArchivoExtraBold";
const FALLBACK_FONT = "helvetica";
// Totals sit inset from the right margin so the grand total band stays inside it.
const TOTALS_INSET = 14;

const fontFiles = [
  { file: "Archivo-Regular.ttf", name: FONT, style: "normal" },
  { file: "Archivo-Bold.ttf", name: FONT, style: "bold" },
  { file: "Archivo-ExtraBold.ttf", name: FONT_HEAVY, style: "normal" }
];

let fontDataPromise: Promise<Record<string, string> | null> | null = null;

function arrayBufferToBinaryString(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return binary;
}

function loadFontData(): Promise<Record<string, string> | null> {
  if (!fontDataPromise) {
    fontDataPromise = Promise.all(
      fontFiles.map(async ({ file }) => {
        const response = await fetch(`/fonts/${file}`);
        if (!response.ok) throw new Error(`Failed to load ${file}`);
        return [file, arrayBufferToBinaryString(await response.arrayBuffer())] as const;
      })
    )
      .then((entries) => Object.fromEntries(entries))
      .catch(() => {
        fontDataPromise = null;
        return null;
      });
  }
  return fontDataPromise;
}

type Fonts = { body: string; heavy: string; heavyStyle: string };

async function createDocument(): Promise<{ doc: jsPDF; fonts: Fonts }> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const data = await loadFontData();

  if (!data) {
    return { doc, fonts: { body: FALLBACK_FONT, heavy: FALLBACK_FONT, heavyStyle: "bold" } };
  }

  for (const { file, name, style } of fontFiles) {
    doc.addFileToVFS(file, data[file]);
    doc.addFont(file, name, style);
  }
  return { doc, fonts: { body: FONT, heavy: FONT_HEAVY, heavyStyle: "normal" } };
}

function runAsync(task: () => Promise<void>): void {
  task().catch((error) => {
    console.error("PDF generation failed", error);
  });
}

function drawHeader(
  doc: jsPDF,
  fonts: Fonts,
  { title, meta, margin }: { title: string; meta: string[]; margin: number }
): void {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(...theme.ink);
  doc.rect(0, 0, pageWidth, 112, "F");
  doc.setFillColor(...theme.accent);
  doc.rect(0, 112, pageWidth, 4, "F");

  doc.setFont(fonts.heavy, fonts.heavyStyle);
  doc.setFontSize(28);
  doc.setTextColor(...theme.white);
  doc.text(title, margin, 66, { charSpace: -0.4 });

  doc.setFont(fonts.body, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...theme.onDark);
  meta.forEach((line, index) => {
    doc.text(line, pageWidth - margin, 44 + index * 16, { align: "right" });
  });
}

function drawParties(
  doc: jsPDF,
  fonts: Fonts,
  {
    margin,
    left,
    right
  }: { margin: number; left: { label: string; lines: string[] }; right: { label: string; lines: string[] } }
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const rightX = pageWidth / 2 + 8;
  const labelY = 152;
  const bodyY = 170;
  const lineHeight = 10 * doc.getLineHeightFactor();

  doc.setFont(fonts.body, "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...theme.accent);
  doc.text(left.label.toUpperCase(), margin, labelY, { charSpace: 1.2 });
  doc.text(right.label.toUpperCase(), rightX, labelY, { charSpace: 1.2 });

  doc.setFont(fonts.body, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...theme.ink2);
  doc.text(left.lines, margin, bodyY);
  doc.text(right.lines, rightX, bodyY);

  const tallest = Math.max(left.lines.length, right.lines.length, 1);
  return Math.max(236, bodyY + tallest * lineHeight + 28);
}

function tableTheme(fonts: Fonts, fontSize: number, cellPadding: number) {
  return {
    theme: "plain" as const,
    styles: {
      font: fonts.body,
      fontSize,
      cellPadding,
      textColor: theme.ink2,
      lineColor: theme.border,
      lineWidth: { bottom: 0.6, top: 0, left: 0, right: 0 }
    },
    headStyles: {
      fillColor: theme.ink,
      textColor: theme.white,
      fontStyle: "bold" as const,
      lineWidth: 0
    },
    alternateRowStyles: {
      fillColor: theme.surface2
    }
  };
}

function lastTableY(doc: jsPDF): number {
  return (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 300;
}

function drawTotalRow(
  doc: jsPDF,
  fonts: Fonts,
  { label, value, x, right, y }: { label: string; value: string; x: number; right: number; y: number }
): void {
  doc.setFont(fonts.body, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...theme.text2);
  doc.text(label, x, y);
  doc.setTextColor(...theme.ink);
  doc.text(value, right, y, { align: "right" });
}

function drawGrandTotal(
  doc: jsPDF,
  fonts: Fonts,
  { label, value, x, right, y }: { label: string; value: string; x: number; right: number; y: number }
): void {
  doc.setFillColor(...theme.accentSoft);
  doc.roundedRect(x - TOTALS_INSET, y - 22, right - x + TOTALS_INSET * 2, 36, 8, 8, "F");

  doc.setFont(fonts.heavy, fonts.heavyStyle);
  doc.setFontSize(13);
  doc.setTextColor(...theme.accent);
  doc.text(label, x, y);
  doc.text(value, right, y, { align: "right" });
}

export function generateInvoicePdf({
  details,
  lines,
  totals,
  week
}: {
  details: InvoiceDetails;
  lines: InvoiceLine[];
  totals: InvoiceTotals;
  week: WeekRange;
  settings: AppSettings;
}): void {
  runAsync(async () => {
    const { doc, fonts } = await createDocument();
    const margin = 44;
    const pageWidth = doc.internal.pageSize.getWidth();
    const right = pageWidth - margin;
    const totalsRight = right - TOTALS_INSET;
    const includedLines = lines.filter((line) => line.included);

    doc.setProperties({
      title: invoiceMetaDescription(details),
      subject: `Work invoice for ${week.label}`,
      author: details.fromName
    });

    drawHeader(doc, fonts, {
      title: "INVOICE",
      margin,
      meta: [
        `Invoice #: ${details.invoiceNumber}`,
        `Date: ${formatDate(details.invoiceDate)}`,
        `Week: ${week.label}`
      ]
    });

    const tableY = drawParties(doc, fonts, {
      margin,
      left: {
        label: "From",
        lines: [details.fromName, `ABN: ${details.fromAbn}`, details.fromAddress].filter(Boolean)
      },
      right: { label: "Bill To", lines: details.invoiceTo.split("\n").filter(Boolean) }
    });

    autoTable(doc, {
      startY: tableY,
      margin: { left: margin, right: margin },
      head: [["Description", "Qty", "Unit Price", "Total"]],
      body: includedLines.map((line) => [
        line.description,
        String(line.declaredHours),
        formatUnitPrice(line.unitPrice),
        formatMoney(line.total)
      ]),
      ...tableTheme(fonts, 10, 9),
      columnStyles: {
        1: { halign: "right", cellWidth: 70 },
        2: { halign: "right", cellWidth: 90 },
        3: { halign: "right", cellWidth: 90, textColor: theme.ink }
      },
      didParseCell: (hook) => {
        if (hook.section === "head" && hook.column.index > 0) {
          hook.cell.styles.halign = "right";
        }
      }
    });

    const totalsX = right - 190;
    const totalsY = lastTableY(doc) + 30;

    drawTotalRow(doc, fonts, { label: "Subtotal", value: formatMoney(totals.subtotal), x: totalsX, right: totalsRight, y: totalsY });
    drawTotalRow(doc, fonts, { label: "Tax 0%", value: formatMoney(totals.tax), x: totalsX, right: totalsRight, y: totalsY + 20 });
    drawGrandTotal(doc, fonts, { label: "Total", value: formatMoney(totals.total), x: totalsX, right: totalsRight, y: totalsY + 52 });

    const bankLines = details.bankDetails.split("\n").filter(Boolean);
    const paymentY = totalsY + 104;
    const lineHeight = 10 * doc.getLineHeightFactor();
    doc.setFillColor(...theme.surface2);
    doc.setDrawColor(...theme.border);
    doc.setLineWidth(0.6);
    doc.roundedRect(margin, paymentY - 20, 260, 40 + Math.max(bankLines.length, 1) * lineHeight, 8, 8, "FD");

    doc.setFont(fonts.body, "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...theme.accent);
    doc.text("Payment Details".toUpperCase(), margin + 14, paymentY, { charSpace: 1.2 });
    doc.setFont(fonts.body, "normal");
    doc.setFontSize(10);
    doc.setTextColor(...theme.ink2);
    doc.text(bankLines, margin + 14, paymentY + 18);

    doc.save(invoiceFileName(details));
  });
}

export function generateRealHoursPdf({
  details,
  entries,
  week,
  settings
}: {
  details: InvoiceDetails;
  entries: WorkEntry[];
  week: WeekRange;
  settings: AppSettings;
}): void {
  runAsync(async () => {
    const { doc, fonts } = await createDocument();
    const margin = 44;
    const pageWidth = doc.internal.pageSize.getWidth();
    const right = pageWidth - margin;
    const totalsRight = right - TOTALS_INSET;
    const totals = calculateEntriesTotal(entries, settings);

    doc.setProperties({
      title: `Real hours ${details.invoiceNumber}`,
      subject: `Real hours report for ${week.label}`,
      author: details.fromName
    });

    drawHeader(doc, fonts, {
      title: "REAL HOURS",
      margin,
      meta: [
        `Reference #: ${details.invoiceNumber}`,
        `Date: ${formatDate(details.invoiceDate)}`,
        `Week: ${week.label}`
      ]
    });

    const tableY = drawParties(doc, fonts, {
      margin,
      left: {
        label: "Worker",
        lines: [details.fromName, `ABN: ${details.fromAbn}`, details.fromAddress].filter(Boolean)
      },
      right: { label: "Client", lines: details.invoiceTo.split("\n").filter(Boolean) }
    });

    autoTable(doc, {
      startY: tableY,
      margin: { left: margin, right: margin },
      head: [["Date", "Location", "Start", "Finish", "Break", "Hours", "OT", "Amount"]],
      body: entries.map((entry) => {
        const payroll = calculateDailyPayroll(entry, settings);
        return [
          formatDate(entry.date),
          entry.location,
          entry.startTime,
          entry.endTime,
          `${entry.breakMinutes}m`,
          payroll.totalHours.toFixed(2),
          payroll.overtimeHours.toFixed(2),
          formatMoney(payroll.totalAmount)
        ];
      }),
      ...tableTheme(fonts, 9, 7),
      columnStyles: {
        2: { halign: "center", cellWidth: 48 },
        3: { halign: "center", cellWidth: 48 },
        4: { halign: "right", cellWidth: 44 },
        5: { halign: "right", cellWidth: 44 },
        6: { halign: "right", cellWidth: 40 },
        7: { halign: "right", cellWidth: 76, textColor: theme.ink }
      },
      didParseCell: (hook) => {
        if (hook.section === "head") {
          const index = hook.column.index;
          hook.cell.styles.halign = index === 2 || index === 3 ? "center" : index > 3 ? "right" : "left";
        }
      }
    });

    const totalsX = right - 220;
    const totalsY = lastTableY(doc) + 30;

    drawTotalRow(doc, fonts, {
      label: "Total real hours",
      value: `${totals.totalHours.toFixed(2)}h`,
      x: totalsX,
      right: totalsRight,
      y: totalsY
    });
    drawTotalRow(doc, fonts, {
      label: "Regular hours",
      value: `${totals.regularHours.toFixed(2)}h`,
      x: totalsX,
      right: totalsRight,
      y: totalsY + 20
    });
    drawTotalRow(doc, fonts, {
      label: "Overtime hours",
      value: `${totals.overtimeHours.toFixed(2)}h`,
      x: totalsX,
      right: totalsRight,
      y: totalsY + 40
    });
    drawGrandTotal(doc, fonts, {
      label: "Total real amount",
      value: formatMoney(totals.totalAmount),
      x: totalsX,
      right: totalsRight,
      y: totalsY + 72
    });

    doc.save(`${details.invoiceNumber || "invoice"}-real-hours.pdf`);
  });
}
