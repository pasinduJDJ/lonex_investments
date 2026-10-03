import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export interface ExcelColumnDef {
  header: string;
  key: string;
  width?: number;
  type?: 'text' | 'number' | 'currency' | 'date';
}

export interface ExcelMetadataItem {
  label: string;
  value: string | number;
}

export interface SingleSheetReportConfig {
  filename: string;
  sheetName: string;
  reportTitle: string;
  metadata?: ExcelMetadataItem[];
  columns: ExcelColumnDef[];
  data: any[];
  summaryItems?: ExcelMetadataItem[];
}

export interface MultiSheetConfig {
  filename: string;
  sheets: {
    sheetName: string;
    sheetTitle: string;
    metadata?: ExcelMetadataItem[];
    columns: ExcelColumnDef[];
    data: any[];
    summaryItems?: ExcelMetadataItem[];
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class ExcelExportService {

  constructor() {}

  /**
   * Sanitizes strings to prevent Excel Formula Injection (CSV/Formula injection).
   * Values starting with =, +, -, @ are escaped with a leading single quote.
   */
  private sanitizeCellValue(value: any, isTextOnly: boolean = false): any {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      // If it starts with potential formula chars and isn't a plain negative number
      if (/^[=+\-@]/.test(trimmed)) {
        // If it's a valid negative number, keep it as number
        if (/^-\d+(\.\d+)?$/.test(trimmed)) {
          return isTextOnly ? `'${trimmed}` : parseFloat(trimmed);
        }
        return `'${trimmed}`;
      }
      return isTextOnly ? `'${trimmed}` : trimmed;
    }

    if (typeof value === 'number') {
      return isTextOnly ? `'${value}` : value;
    }

    return String(value);
  }

  /**
   * Formats a date object or string into standard DD/MM/YYYY
   */
  formatDate(dateInput: string | Date | null | undefined): string {
    if (!dateInput) return '-';
    try {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return String(dateInput);
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return String(dateInput);
    }
  }

  /**
   * Formats current date for default report metadata
   */
  getTodayFormatted(): string {
    const d = new Date();
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Generates a date-stamped filename: e.g. Customer_Master_Report_2026-10-03.xlsx
   */
  generateFilename(baseName: string, suffix?: string): string {
    const today = new Date().toISOString().split('T')[0];
    const cleanBase = baseName.replace(/\s+/g, '_');
    if (suffix) {
      const cleanSuffix = suffix.replace(/[^a-zA-Z0-9_-]/g, '_');
      return `${cleanBase}_${cleanSuffix}_${today}.xlsx`;
    }
    return `${cleanBase}_${today}.xlsx`;
  }

  /**
   * Exports a single-sheet workbook with enterprise header branding and formatted data.
   */
  exportSingleSheetReport(config: SingleSheetReportConfig): void {
    const wb = XLSX.utils.book_new();
    const ws = this.createReportWorksheet(
      config.reportTitle,
      config.metadata || [],
      config.columns,
      config.data,
      config.summaryItems
    );

    XLSX.utils.book_append_sheet(wb, ws, config.sheetName.substring(0, 31)); // Excel max sheet name is 31 chars
    this.saveWorkbook(wb, config.filename);
  }

  /**
   * Exports a multi-sheet workbook (e.g. Customer Statement with Summary, Loans, Payments).
   */
  exportMultiSheetReport(config: MultiSheetConfig): void {
    const wb = XLSX.utils.book_new();

    for (const sheetConfig of config.sheets) {
      const ws = this.createReportWorksheet(
        sheetConfig.sheetTitle,
        sheetConfig.metadata || [],
        sheetConfig.columns,
        sheetConfig.data,
        sheetConfig.summaryItems
      );
      XLSX.utils.book_append_sheet(wb, ws, sheetConfig.sheetName.substring(0, 31));
    }

    this.saveWorkbook(wb, config.filename);
  }

  /**
   * Helper that builds an XLSX worksheet with company banner, metadata, headers, rows, and auto widths.
   */
  private createReportWorksheet(
    reportTitle: string,
    metadata: ExcelMetadataItem[],
    columns: ExcelColumnDef[],
    data: any[],
    summaryItems?: ExcelMetadataItem[]
  ): XLSX.WorkSheet {
    const rows: any[][] = [];

    // 1. Company Brand Header
    rows.push(['LONEX INVESTMENTS']);
    rows.push([reportTitle.toUpperCase()]);
    rows.push([`Generated: ${this.getTodayFormatted()}`]);

    // 2. Metadata / Filter Period criteria
    if (metadata && metadata.length > 0) {
      for (const meta of metadata) {
        rows.push([`${meta.label}:`, meta.value]);
      }
    }

    // 3. Summary row if any
    if (summaryItems && summaryItems.length > 0) {
      rows.push([]);
      rows.push(['--- REPORT SUMMARY ---']);
      for (const item of summaryItems) {
        rows.push([item.label, item.value]);
      }
    }

    // 4. Blank row before table
    rows.push([]);

    // 5. Column Headers
    const headerRow = columns.map(c => c.header);
    rows.push(headerRow);

    // 6. Data Rows
    for (const item of data) {
      const row: any[] = [];
      for (const col of columns) {
        const rawVal = item[col.key];
        if (col.type === 'number' || col.type === 'currency') {
          const num = typeof rawVal === 'number' ? rawVal : parseFloat(rawVal);
          row.push(isNaN(num) ? 0 : num);
        } else if (col.type === 'date') {
          row.push(this.formatDate(rawVal));
        } else if (col.type === 'text') {
          // Explicit text column (IDs, NIC, phone numbers to preserve leading zeroes)
          const str = rawVal !== null && rawVal !== undefined ? String(rawVal) : '';
          row.push(this.sanitizeCellValue(str, true));
        } else {
          row.push(this.sanitizeCellValue(rawVal));
        }
      }
      rows.push(row);
    }

    // Create Worksheet from array of arrays
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Calculate auto column widths
    const colWidths: { wch: number }[] = columns.map((col, colIdx) => {
      let maxLen = col.header.length;
      if (col.width) {
        return { wch: col.width };
      }
      for (const item of data) {
        const val = item[col.key];
        if (val !== undefined && val !== null) {
          const strVal = String(val);
          if (strVal.length > maxLen) {
            maxLen = strVal.length;
          }
        }
      }
      return { wch: Math.min(Math.max(maxLen + 4, 12), 45) };
    });

    ws['!cols'] = colWidths;

    return ws;
  }

  /**
   * Writes the workbook to file and triggers browser download.
   */
  private saveWorkbook(wb: XLSX.WorkBook, filename: string): void {
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8'
    });
    saveAs(blob, filename);
  }
}
