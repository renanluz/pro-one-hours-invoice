"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { AppSettings, InvoiceDetails, InvoiceLine, InvoiceTotals, WeekRange, WorkEntry } from "@/types";
import { formatDate, formatMoney, formatUnitPrice } from "@/lib/calculations/format";
import { calculateDailyPayroll, calculateEntriesTotal } from "@/lib/calculations/payroll";
import { invoiceFileName, invoiceMetaDescription } from "./invoice";

type Rgb = [number, number, number];

// Renan's style guide palette (see app/globals.css): black, red accent, warm greys.
const theme = {
  ink: [0, 0, 0] as Rgb, // --ink #000000
  ink2: [26, 26, 26] as Rgb, // --ink-2 #1A1A1A
  accent: [196, 18, 48] as Rgb, // --accent #C41230
  text2: [74, 74, 74] as Rgb, // --text-2 #4A4A4A
  surface2: [246, 245, 243] as Rgb, // --surface-2 #F6F5F3
  border: [216, 213, 208] as Rgb, // --border #D8D5D0
  white: [255, 255, 255] as Rgb
};

// Body text uses the built-in Helvetica (the guide's Helvetica Neue stack).
const BODY_FONT = "helvetica";
const HEADING_FONT = "ZillaSlab";
const LABEL_FONT = "IBMPlexMono";
// Totals sit inset from the right margin so the grand total callout stays inside it.
const TOTALS_INSET = 14;

const fontFiles = [
  { file: "ZillaSlab-Bold.ttf", name: HEADING_FONT, style: "normal" },
  { file: "IBMPlexMono-Medium.ttf", name: LABEL_FONT, style: "normal" }
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

type FontRef = { name: string; style: string };
type Fonts = { heading: FontRef; label: FontRef };

async function createDocument(): Promise<{ doc: jsPDF; fonts: Fonts }> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const data = await loadFontData();

  if (!data) {
    return {
      doc,
      fonts: { heading: { name: BODY_FONT, style: "bold" }, label: { name: BODY_FONT, style: "bold" } }
    };
  }

  for (const { file, name, style } of fontFiles) {
    doc.addFileToVFS(file, data[file]);
    doc.addFont(file, name, style);
  }
  return {
    doc,
    fonts: { heading: { name: HEADING_FONT, style: "normal" }, label: { name: LABEL_FONT, style: "normal" } }
  };
}

function runAsync(task: () => Promise<void>): void {
  task().catch((error) => {
    console.error("PDF generation failed", error);
  });
}

function drawLabel(doc: jsPDF, fonts: Fonts, text: string, x: number, y: number): void {
  doc.setFont(fonts.label.name, fonts.label.style);
  doc.setFontSize(8);
  doc.setTextColor(...theme.accent);
  doc.text(text.toUpperCase(), x, y, { charSpace: 1.4 });
}

function drawCallout(doc: jsPDF, x: number, y: number, width: number, height: number): void {
  doc.setFillColor(...theme.surface2);
  doc.rect(x, y, width, height, "F");
  doc.setFillColor(...theme.accent);
  doc.rect(x, y, 4, height, "F");
}

function drawHeader(
  doc: jsPDF,
  fonts: Fonts,
  { title, meta, margin }: { title: string; meta: string[]; margin: number }
): void {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont(fonts.heading.name, fonts.heading.style);
  doc.setFontSize(34);
  doc.setTextColor(...theme.ink);
  doc.text(title, margin, 82);

  doc.setFont(fonts.label.name, fonts.label.style);
  doc.setFontSize(9);
  doc.setTextColor(...theme.text2);
  meta.forEach((line, index) => {
    doc.text(line, pageWidth - margin, 52 + index * 15, { align: "right" });
  });

  doc.setFillColor(...theme.ink);
  doc.rect(margin, 100, pageWidth - margin * 2, 5, "F");
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
  const labelY = 140;
  const bodyY = 158;
  const lineHeight = 10 * doc.getLineHeightFactor();

  drawLabel(doc, fonts, left.label, margin, labelY);
  drawLabel(doc, fonts, right.label, rightX, labelY);

  doc.setFont(BODY_FONT, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...theme.ink2);
  doc.text(left.lines, margin, bodyY);
  doc.text(right.lines, rightX, bodyY);

  const tallest = Math.max(left.lines.length, right.lines.length, 1);
  return Math.max(224, bodyY + tallest * lineHeight + 28);
}

function tableTheme(fontSize: number, cellPadding: number) {
  return {
    theme: "plain" as const,
    styles: {
      font: BODY_FONT,
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
  { label, value, x, right, y }: { label: string; value: string; x: number; right: number; y: number }
): void {
  doc.setFont(BODY_FONT, "normal");
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
  drawCallout(doc, x - TOTALS_INSET, y - 23, right - x + TOTALS_INSET * 2, 38);

  doc.setFont(fonts.heading.name, fonts.heading.style);
  doc.setFontSize(15);
  doc.setTextColor(...theme.ink);
  doc.text(label, x, y);
  // Zilla Slab uses old-style figures, so the amount stays in Helvetica for even digits.
  doc.setFont(BODY_FONT, "bold");
  doc.setFontSize(14);
  doc.setTextColor(...theme.accent);
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
      ...tableTheme(10, 9),
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

    drawTotalRow(doc, { label: "Subtotal", value: formatMoney(totals.subtotal), x: totalsX, right: totalsRight, y: totalsY });
    drawTotalRow(doc, { label: "Tax 0%", value: formatMoney(totals.tax), x: totalsX, right: totalsRight, y: totalsY + 20 });
    drawGrandTotal(doc, fonts, { label: "Total", value: formatMoney(totals.total), x: totalsX, right: totalsRight, y: totalsY + 52 });

    const bankLines = details.bankDetails.split("\n").filter(Boolean);
    const paymentY = totalsY + 104;
    const lineHeight = 10 * doc.getLineHeightFactor();
    drawCallout(doc, margin, paymentY - 20, 260, 40 + Math.max(bankLines.length, 1) * lineHeight);

    drawLabel(doc, fonts, "Payment Details", margin + 18, paymentY);
    doc.setFont(BODY_FONT, "normal");
    doc.setFontSize(10);
    doc.setTextColor(...theme.ink2);
    doc.text(bankLines, margin + 18, paymentY + 18);

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
      ...tableTheme(9, 7),
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

    drawTotalRow(doc, {
      label: "Total real hours",
      value: `${totals.totalHours.toFixed(2)}h`,
      x: totalsX,
      right: totalsRight,
      y: totalsY
    });
    drawTotalRow(doc, {
      label: "Regular hours",
      value: `${totals.regularHours.toFixed(2)}h`,
      x: totalsX,
      right: totalsRight,
      y: totalsY + 20
    });
    drawTotalRow(doc, {
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
