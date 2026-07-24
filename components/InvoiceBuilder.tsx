"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  AppSettings,
  InvoiceDetails,
  InvoiceLine,
  InvoiceMode,
  WeekRange,
  WorkEntry
} from "@/types";
import {
  buildInvoiceDetails,
  calculateInvoiceTargetAmount,
  calculateInvoiceTotals,
  createInvoiceLines,
  updateManualLine
} from "@/lib/invoice/invoice";
import { generateInvoicePdf, generateRealHoursPdf } from "@/lib/invoice/pdf";
import { formatDate, formatHours, formatMoney, formatUnitPrice } from "@/lib/calculations/format";

interface InvoiceBuilderProps {
  entries: WorkEntry[];
  settings: AppSettings;
  weeks: WeekRange[];
  week: WeekRange;
  weekStart: string;
  onWeekChange: (weekStart: string) => void;
}

export function InvoiceBuilder({
  entries,
  settings,
  weeks,
  week,
  weekStart,
  onWeekChange
}: InvoiceBuilderProps) {
  const [mode, setMode] = useState<InvoiceMode>("automatic");
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [details, setDetails] = useState<InvoiceDetails>(() => buildInvoiceDetails(settings, weekStart));
  const [allowMismatch, setAllowMismatch] = useState(false);

  useEffect(() => {
    setDetails(buildInvoiceDetails(settings, weekStart));
    setLines((current) => createInvoiceLines(entries, settings, mode, current));
    setAllowMismatch(false);
  }, [entries, settings, weekStart, mode]);

  const targetEntries = useMemo(
    () => entries.filter((entry) => lines.some((line) => line.entryId === entry.id && line.included)),
    [entries, lines]
  );
  const realTargetAmount = calculateInvoiceTargetAmount(targetEntries, settings);
  const totals = calculateInvoiceTotals(lines, realTargetAmount);
  const hasMismatch = Math.abs(totals.difference) >= 0.01;
  const canGeneratePdf = lines.some((line) => line.included) && (!hasMismatch || allowMismatch);

  function setDetail<K extends keyof InvoiceDetails>(key: K, value: InvoiceDetails[K]) {
    setDetails((current) => ({ ...current, [key]: value }));
  }

  function changeMode(nextMode: InvoiceMode) {
    setMode(nextMode);
    setLines((current) => createInvoiceLines(entries, settings, nextMode, current));
    setAllowMismatch(false);
  }

  function changeLine(lineId: string, patch: Partial<Pick<InvoiceLine, "included" | "declaredHours" | "unitPrice">>) {
    setLines((current) => {
      const patched = updateManualLine(current, lineId, patch);
      return mode === "automatic"
        ? createInvoiceLines(entries, settings, "automatic", patched)
        : patched;
    });
    setAllowMismatch(false);
  }

  return (
    <section className="panel invoice-builder">
      <div className="section-heading section-heading--stack">
        <div>
          <p className="eyebrow">Invoice generator</p>
          <h2>Preview</h2>
        </div>
        <div className="toolbar">
          <label className="compact-field">
            Week
            <select value={weekStart} onChange={(event) => onWeekChange(event.target.value)}>
              {weeks.map((availableWeek) => (
                <option key={availableWeek.start} value={availableWeek.start}>
                  {availableWeek.label}
                </option>
              ))}
            </select>
          </label>
          <div className="segmented-control" aria-label="Invoice distribution mode">
            <button
              type="button"
              className={mode === "automatic" ? "is-active" : ""}
              onClick={() => changeMode("automatic")}
            >
              Auto
            </button>
            <button
              type="button"
              className={mode === "manual" ? "is-active" : ""}
              onClick={() => changeMode("manual")}
            >
              Manual
            </button>
          </div>
        </div>
      </div>

      <div className="invoice-meta-grid">
        <label>
          Invoice number
          <input value={details.invoiceNumber} onChange={(event) => setDetail("invoiceNumber", event.target.value)} />
        </label>
        <label>
          Invoice date
          <input type="date" value={details.invoiceDate} onChange={(event) => setDetail("invoiceDate", event.target.value)} />
        </label>
        <label>
          From name
          <input value={details.fromName} onChange={(event) => setDetail("fromName", event.target.value)} />
        </label>
        <label>
          ABN
          <input value={details.fromAbn} onChange={(event) => setDetail("fromAbn", event.target.value)} />
        </label>
        <label className="wide-field">
          From address
          <textarea value={details.fromAddress} onChange={(event) => setDetail("fromAddress", event.target.value)} />
        </label>
        <label>
          Invoice to
          <textarea value={details.invoiceTo} onChange={(event) => setDetail("invoiceTo", event.target.value)} />
        </label>
        <label className="wide-field">
          Bank details
          <textarea value={details.bankDetails} onChange={(event) => setDetail("bankDetails", event.target.value)} />
        </label>
      </div>

      <div className="invoice-work-selector">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Included work</p>
            <h3>{week.label}</h3>
          </div>
          <button type="button" className="ghost-button" onClick={() => setLines(createInvoiceLines(entries, settings, "automatic", lines))}>
            Recalculate
          </button>
        </div>

        {lines.length === 0 ? (
          <p className="empty-state">No work entries in this week.</p>
        ) : (
          <div className="invoice-line-editor">
            {lines.map((line) => (
              <article className="invoice-edit-row" key={line.id}>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={line.included}
                    onChange={(event) => changeLine(line.id, { included: event.target.checked })}
                  />
                  <span>
                    <strong>{line.location}</strong>
                    <small>{formatDate(line.date)} - real {formatHours(line.sourceHours)}</small>
                  </span>
                </label>
                <label>
                  Qty
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={line.declaredHours}
                    disabled={mode === "automatic" || !line.included}
                    onChange={(event) => changeLine(line.id, { declaredHours: Number(event.target.value) })}
                  />
                </label>
                <label>
                  Unit
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={line.unitPrice}
                    disabled={mode === "automatic" || !line.included}
                    onChange={(event) => changeLine(line.id, { unitPrice: Number(event.target.value) })}
                  />
                </label>
                <strong>{formatMoney(line.total)}</strong>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="invoice-paper" aria-label="Invoice preview">
        <div className="invoice-paper__header">
          <div>
            <h3>INVOICE</h3>
            <p>{details.fromName}</p>
            <p>ABN: {details.fromAbn}</p>
            <p>{details.fromAddress}</p>
          </div>
          <div>
            <p><strong>Invoice #</strong> {details.invoiceNumber}</p>
            <p><strong>Date</strong> {formatDate(details.invoiceDate)}</p>
            <p><strong>Week</strong> {week.label}</p>
          </div>
        </div>

        <div className="invoice-paper__parties">
          <div>
            <span>Bill To</span>
            {details.invoiceTo.split("\n").map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <div>
            <span>Payment</span>
            {details.bankDetails.split("\n").map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>

        <div className="invoice-table">
          <div className="invoice-table__head">
            <span>Description</span>
            <span>Quantity</span>
            <span>Unit price</span>
            <span>Total</span>
          </div>
          {lines.filter((line) => line.included).map((line) => (
            <div className="invoice-table__row" key={line.id}>
              <span>{line.description}</span>
              <span>{line.declaredHours}</span>
              <span>{formatUnitPrice(line.unitPrice)}</span>
              <span>{formatMoney(line.total)}</span>
            </div>
          ))}
        </div>

        <div className="invoice-total-box">
          <div>
            <span>Subtotal</span>
            <strong>{formatMoney(totals.subtotal)}</strong>
          </div>
          <div>
            <span>Tax 0%</span>
            <strong>{formatMoney(totals.tax)}</strong>
          </div>
          <div className="grand-total">
            <span>Total</span>
            <strong>{formatMoney(totals.total)}</strong>
          </div>
        </div>
      </div>

      <div className={hasMismatch ? "invoice-check invoice-check--warning" : "invoice-check"}>
        <div>
          <strong>{formatHours(totals.declaredHours)} declared</strong>
          <span>
            Real target {formatMoney(totals.realTargetAmount)} - difference {formatMoney(totals.difference)}
          </span>
        </div>
        {hasMismatch && mode === "manual" ? (
          <label className="check-row">
            <input
              type="checkbox"
              checked={allowMismatch}
              onChange={(event) => setAllowMismatch(event.target.checked)}
            />
            <span>Confirm different invoice total</span>
          </label>
        ) : null}
        <div className="toolbar">
          <button
            className="ghost-button"
            type="button"
            disabled={entries.length === 0}
            onClick={() => generateRealHoursPdf({ details, entries, week, settings })}
          >
            Real hours PDF
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={!canGeneratePdf}
            onClick={() => generateInvoicePdf({ details, lines, totals, week, settings })}
          >
            Invoice PDF
          </button>
        </div>
      </div>
    </section>
  );
}
