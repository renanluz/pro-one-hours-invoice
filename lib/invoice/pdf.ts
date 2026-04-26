"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { AppSettings, InvoiceDetails, InvoiceLine, InvoiceTotals, WeekRange } from "@/types";
import { formatDate, formatMoney, formatUnitPrice } from "@/lib/calculations/format";
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
