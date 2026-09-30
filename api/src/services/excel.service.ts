import ExcelJS from "exceljs";
import { prisma } from "../prisma";
import {
  computeWeeklyPaceAndConsistency,
  attachPaymentNumbersAndRunningBalance,
} from "../utils/calculations";

export class ExcelService {
  /**
   * Per-worker detailed statement export (.xlsx)
   */
  static async generateWorkerStatement(workerId: string): Promise<Buffer | null> {
    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      include: {
        aliases: true,
        ledger_entries: {
          orderBy: [{ entry_date: "asc" }, { created_at: "asc" }],
        },
      },
    });

    if (!worker) return null;

    const metrics = computeWeeklyPaceAndConsistency(worker, worker.ledger_entries);
    const numberedEntries = attachPaymentNumbersAndRunningBalance(
      worker.initial_debt,
      worker.ledger_entries
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Worker Debt Ledger";
    workbook.created = new Date();

    const sheetName = (worker.name || "Statement").replace(/[*?:/\\\[\]]/g, "").slice(0, 30);
    const ws = workbook.addWorksheet(sheetName, {
      views: [{ showGridLines: true }],
    });

    // 1. Title
    ws.mergeCells("A1:H1");
    const titleCell = ws.getCell("A1");
    titleCell.value = "WORKER DEBT STATEMENT & PAYMENT LEDGER";
    titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
    titleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E293B" }, // Slate 800
    };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };
    ws.getRow(1).height = 32;

    // 2. Worker Profile Summary Card
    ws.addRow([]); // Blank line 2

    const summaryRows = [
      ["Worker Name:", worker.name, "", "Status:", worker.status],
      ["Occupation:", worker.occupation, "", "Car Type:", worker.car_type || "N/A"],
      ["Phone:", worker.phone || "N/A", "", "Number Plate:", worker.number_plate || "N/A"],
      [
        "Start Date:",
        new Date(worker.start_date).toLocaleDateString(),
        "",
        "Expected End Date:",
        new Date(worker.expected_end_date).toLocaleDateString(),
      ],
      [
        "Initial Debt:",
        Number(worker.initial_debt),
        "",
        "Projected End Date:",
        metrics.projected_end_date
          ? new Date(metrics.projected_end_date).toLocaleDateString()
          : "N/A",
      ],
      [
        "Total Paid:",
        metrics.total_paid,
        "",
        "Weekly Expected Target:",
        Number(worker.expected_weekly_payment),
      ],
      [
        "Outstanding Debt:",
        metrics.outstanding_debt,
        "",
        "Pace / Consistency:",
        metrics.too_early
          ? "Too early to calculate"
          : `${metrics.pace_pct ?? 0}% Pace | ${metrics.consistency_pct ?? 0}% Consistency`,
      ],
    ];

    for (const r of summaryRows) {
      const row = ws.addRow(r);
      row.getCell(1).font = { bold: true, color: { argb: "FF475569" } };
      row.getCell(2).font = { bold: true };
      row.getCell(4).font = { bold: true, color: { argb: "FF475569" } };
      row.getCell(5).font = { bold: true };
    }

    // Format currency fields in summary
    ws.getCell("B7").numFmt = '"GHS "#,##0.00'; // Initial Debt
    ws.getCell("B8").numFmt = '"GHS "#,##0.00'; // Total Paid
    ws.getCell("B9").numFmt = '"GHS "#,##0.00'; // Outstanding Debt
    ws.getCell("E8").numFmt = '"GHS "#,##0.00'; // Weekly target

    // Highlight Outstanding Debt row
    ws.getCell("A9").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    ws.getCell("B9").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } }; // light red
    ws.getCell("B9").font = { bold: true, color: { argb: "FFDC2626" } };

    ws.addRow([]); // Blank line

    // 3. Ledger Entries Table Header
    const tableHeaderRow = ws.addRow([
      "Payment #",
      "Date",
      "Type",
      "Amount",
      "Running Balance",
      "Transaction Ref",
      "Sender / Alias",
      "Notes",
    ]);
    tableHeaderRow.height = 24;

    tableHeaderRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF334155" }, // Slate 700
      };
      cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        top: { style: "thin", color: { argb: "FF94A3B8" } },
        bottom: { style: "medium", color: { argb: "FF0F172A" } },
        left: { style: "thin", color: { argb: "FF94A3B8" } },
        right: { style: "thin", color: { argb: "FF94A3B8" } },
      };
    });

    // 4. Ledger Entries Rows
    for (let i = 0; i < numberedEntries.length; i++) {
      const entry = numberedEntries[i];
      const isPayment = entry.type === "PAYMENT";
      const row = ws.addRow([
        entry.payment_number ? `#${entry.payment_number}` : "-",
        new Date(entry.entry_date).toLocaleDateString(),
        entry.type,
        Number(entry.amount),
        entry.running_balance,
        entry.transaction_ref || "-",
        entry.sender_name || "-",
        entry.note || "-",
      ]);

      row.height = 20;

      // Currency format for amount & running balance
      row.getCell(4).numFmt = '"GHS "#,##0.00';
      row.getCell(5).numFmt = '"GHS "#,##0.00';

      // Alignment
      row.getCell(1).alignment = { horizontal: "center" };
      row.getCell(2).alignment = { horizontal: "center" };
      row.getCell(3).alignment = { horizontal: "center" };
      row.getCell(4).alignment = { horizontal: "right" };
      row.getCell(5).alignment = { horizontal: "right" };

      // Type styling
      if (isPayment) {
        row.getCell(3).font = { bold: true, color: { argb: "FF16A34A" } }; // Green
      } else {
        row.getCell(3).font = { bold: true, color: { argb: "FFDC2626" } }; // Red
      }

      // Alternating row background
      if (i % 2 === 1) {
        row.eachCell((cell) => {
          if (!cell.fill) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF8FAFC" },
            };
          }
        });
      }

      // Thin borders
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
      });
    }

    // Column widths
    ws.columns = [
      { width: 14 }, // Payment #
      { width: 14 }, // Date
      { width: 16 }, // Type
      { width: 18 }, // Amount
      { width: 20 }, // Running Balance
      { width: 24 }, // Transaction Ref
      { width: 26 }, // Sender
      { width: 32 }, // Notes
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * All workers summary export (.xlsx)
   * One row per worker: name, occupation, outstanding debt, expected end date, pace %, consistency %, status
   */
  static async generateAllWorkersSummary(): Promise<Buffer> {
    const workers = await prisma.worker.findMany({
      orderBy: { created_at: "asc" },
      include: {
        ledger_entries: {
          select: {
            type: true,
            amount: true,
            entry_date: true,
            created_at: true,
          },
        },
      },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Worker Debt Ledger";
    const ws = workbook.addWorksheet("All Workers Summary", {
      views: [{ showGridLines: true }],
    });

    // 1. Title Header
    ws.mergeCells("A1:J1");
    const titleCell = ws.getCell("A1");
    titleCell.value = "ALL WORKERS DEBT & PACE SUMMARY";
    titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
    titleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F172A" }, // Slate 900
    };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };
    ws.getRow(1).height = 30;

    // 2. Table Column Headers
    const headerRow = ws.addRow([
      "Worker Name",
      "Occupation",
      "Car Type",
      "Plate Number",
      "Initial Debt",
      "Total Paid",
      "Outstanding Debt",
      "Pace %",
      "Consistency %",
      "Status",
    ]);
    headerRow.height = 24;

    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF334155" },
      };
      cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });

    let totalInitial = 0;
    let totalPaidAll = 0;
    let totalOutstanding = 0;

    // 3. Worker Rows
    workers.forEach((w, idx) => {
      const metrics = computeWeeklyPaceAndConsistency(w, w.ledger_entries);
      totalInitial += metrics.initial_debt;
      totalPaidAll += metrics.total_paid;
      totalOutstanding += metrics.outstanding_debt;

      const row = ws.addRow([
        w.name,
        w.occupation,
        w.car_type || "-",
        w.number_plate || "-",
        metrics.initial_debt,
        metrics.total_paid,
        metrics.outstanding_debt,
        metrics.too_early ? "Too early" : `${metrics.pace_pct ?? 0}%`,
        metrics.too_early ? "Too early" : `${metrics.consistency_pct ?? 0}%`,
        w.status,
      ]);

      row.height = 20;

      // Number formatting
      row.getCell(5).numFmt = '"GHS "#,##0.00';
      row.getCell(6).numFmt = '"GHS "#,##0.00';
      row.getCell(7).numFmt = '"GHS "#,##0.00';

      row.getCell(8).alignment = { horizontal: "center" };
      row.getCell(9).alignment = { horizontal: "center" };
      row.getCell(10).alignment = { horizontal: "center" };

      // Status color
      if (w.status === "ACTIVE") {
        row.getCell(10).font = { bold: true, color: { argb: "FF16A34A" } };
      } else if (w.status === "CLEARED") {
        row.getCell(10).font = { bold: true, color: { argb: "FF2563EB" } };
      }

      if (idx % 2 === 1) {
        row.eachCell((c) => {
          c.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF8FAFC" },
          };
        });
      }

      row.eachCell((c) => {
        c.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
      });
    });

    // 4. Totals Summary Row
    const totalsRow = ws.addRow([
      "TOTALS",
      "",
      "",
      "",
      totalInitial,
      totalPaidAll,
      totalOutstanding,
      "",
      "",
      "",
    ]);
    totalsRow.height = 24;
    totalsRow.eachCell((c) => {
      c.font = { bold: true };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
      c.border = {
        top: { style: "medium", color: { argb: "FF475569" } },
        bottom: { style: "double", color: { argb: "FF475569" } },
      };
    });
    totalsRow.getCell(5).numFmt = '"GHS "#,##0.00';
    totalsRow.getCell(6).numFmt = '"GHS "#,##0.00';
    totalsRow.getCell(7).numFmt = '"GHS "#,##0.00';

    // Set column widths
    ws.columns = [
      { width: 24 }, // Name
      { width: 16 }, // Occupation
      { width: 16 }, // Car Type
      { width: 16 }, // Plate
      { width: 18 }, // Initial Debt
      { width: 18 }, // Total Paid
      { width: 20 }, // Outstanding
      { width: 14 }, // Pace %
      { width: 16 }, // Consistency %
      { width: 14 }, // Status
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
