"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { AppSettings, InvoiceDetails, InvoiceLine, InvoiceTotals, WeekRange, WorkEntry } from "@/types";
import { formatDate, formatMoney, formatUnitPrice } from "@/lib/calculations/format";
import { calculateDailyPayroll, calculateEntriesTotal } from "@/lib/calculations/payroll";
import { invoiceFileName, invoiceMetaDescription } from "./invoice";

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
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 44;
  const pageWidth = doc.internal.pageSize.getWidth();
  const includedLines = lines.filter((line) => line.included);

  doc.setProperties({
    title: invoiceMetaDescription(details),
    subject: `Work invoice for ${week.label}`,
    author: details.fromName
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("INVOICE", margin, 58);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Invoice #: ${details.invoiceNumber}`, pageWidth - margin, 48, {
    align: "right"
  });
  doc.text(`Date: ${formatDate(details.invoiceDate)}`, pageWidth - margin, 64, {
    align: "right"
  });
  doc.text(`Week: ${week.label}`, pageWidth - margin, 80, {
    align: "right"
  });

  doc.setFont("helvetica", "bold");
  doc.text("From", margin, 118);
  doc.text("Bill To", pageWidth / 2 + 8, 118);

  doc.setFont("helvetica", "normal");
  doc.text(
    [details.fromName, `ABN: ${details.fromAbn}`, details.fromAddress].filter(Boolean),
    margin,
    136
  );
  doc.text(details.invoiceTo.split("\n").filter(Boolean), pageWidth / 2 + 8, 136);

  autoTable(doc, {
    startY: 210,
    margin: { left: margin, right: margin },
    head: [["Description", "Qty", "Unit Price", "Total"]],
    body: includedLines.map((line) => [
      line.description,
      String(line.declaredHours),
      formatUnitPrice(line.unitPrice),
      formatMoney(line.total)
    ]),
    styles: {
      font: "helvetica",
      fontSize: 10,
      cellPadding: 8,
      lineColor: [220, 226, 232],
      lineWidth: 0.4
    },
    headStyles: {
      fillColor: [18, 32, 47],
      textColor: [255, 255, 255],
      fontStyle: "bold"
    },
    columnStyles: {
      1: { halign: "right", cellWidth: 70 },
      2: { halign: "right", cellWidth: 90 },
      3: { halign: "right", cellWidth: 90 }
    }
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 300;
  const totalsX = pageWidth - margin - 190;
  const totalsY = finalY + 28;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Subtotal", totalsX, totalsY);
  doc.text(formatMoney(totals.subtotal), pageWidth - margin, totalsY, { align: "right" });
  doc.text("Tax 0%", totalsX, totalsY + 20);
  doc.text(formatMoney(totals.tax), pageWidth - margin, totalsY + 20, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.text("Total", totalsX, totalsY + 44);
  doc.text(formatMoney(totals.total), pageWidth - margin, totalsY + 44, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.text("Payment Details", margin, totalsY + 92);
  doc.setFont("helvetica", "normal");
  doc.text(details.bankDetails.split("\n").filter(Boolean), margin, totalsY + 110);

  doc.save(invoiceFileName(details));
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
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 44;
  const pageWidth = doc.internal.pageSize.getWidth();
  const totals = calculateEntriesTotal(entries, settings);

  doc.setProperties({
    title: `Real hours ${details.invoiceNumber}`,
    subject: `Real hours report for ${week.label}`,
    author: details.fromName
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("REAL HOURS", margin, 58);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Reference #: ${details.invoiceNumber}`, pageWidth - margin, 48, {
    align: "right"
  });
  doc.text(`Date: ${formatDate(details.invoiceDate)}`, pageWidth - margin, 64, {
    align: "right"
  });
  doc.text(`Week: ${week.label}`, pageWidth - margin, 80, {
    align: "right"
  });

  doc.setFont("helvetica", "bold");
  doc.text("Worker", margin, 118);
  doc.text("Client", pageWidth / 2 + 8, 118);

  doc.setFont("helvetica", "normal");
  doc.text(
    [details.fromName, `ABN: ${details.fromAbn}`, details.fromAddress].filter(Boolean),
    margin,
    136
  );
  doc.text(details.invoiceTo.split("\n").filter(Boolean), pageWidth / 2 + 8, 136);

  autoTable(doc, {
    startY: 210,
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
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 7,
      lineColor: [220, 226, 232],
      lineWidth: 0.4
    },
    headStyles: {
      fillColor: [18, 32, 47],
      textColor: [255, 255, 255],
      fontStyle: "bold"
    },
    columnStyles: {
      2: { halign: "center", cellWidth: 48 },
      3: { halign: "center", cellWidth: 48 },
      4: { halign: "right", cellWidth: 44 },
      5: { halign: "right", cellWidth: 44 },
      6: { halign: "right", cellWidth: 40 },
      7: { halign: "right", cellWidth: 76 }
    }
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 300;
  const totalsX = pageWidth - margin - 220;
  const totalsY = finalY + 28;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Total real hours", totalsX, totalsY);
  doc.text(`${totals.totalHours.toFixed(2)}h`, pageWidth - margin, totalsY, { align: "right" });
  doc.text("Regular hours", totalsX, totalsY + 20);
  doc.text(`${totals.regularHours.toFixed(2)}h`, pageWidth - margin, totalsY + 20, { align: "right" });
  doc.text("Overtime hours", totalsX, totalsY + 40);
  doc.text(`${totals.overtimeHours.toFixed(2)}h`, pageWidth - margin, totalsY + 40, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.text("Total real amount", totalsX, totalsY + 68);
  doc.text(formatMoney(totals.totalAmount), pageWidth - margin, totalsY + 68, {
    align: "right"
  });

  doc.save(`${details.invoiceNumber || "invoice"}-real-hours.pdf`);
}
