import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ActivityAction,
  ActivityLogEvent,
  ActivityLogFilters,
  ActivityModule,
  AuditLogService
} from '../../service/audit-log.service';
import { ExcelExportService } from '../../service/excel-export.service';

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './audit-log.component.html',
  styleUrl: './audit-log.component.css'
})
export class AuditLogComponent implements OnInit {
  readonly Math = Math;
  readonly modules: Array<ActivityModule | 'All'> = ['All', 'Members', 'Loans', 'Payments', 'Settlement', 'Finance'];
  readonly actions: Array<ActivityAction | 'All'> = [
    'All', 'Member Created', 'Member Updated', 'Loan Issued', 'Payment Added',
    'Early Settlement / Rescheduling', 'Expense Recorded', 'Capital Deposit',
    'Cash In', 'Cash Out', 'Account Transfer'
  ];
  readonly pageSizes = [25, 50, 100];

  selectedModule: ActivityModule | 'All' = 'All';
  selectedAction: ActivityAction | 'All' = 'All';
  userFilter = '';
  dateFrom = '';
  dateTo = '';
  search = '';
  page = 1;
  pageSize = 25;
  total = 0;
  items: ActivityLogEvent[] = [];
  selectedEvent: ActivityLogEvent | null = null;
  isLoading = false;
  isExporting = false;
  errorMessage = '';

  constructor(
    public auditLogService: AuditLogService,
    private excelService: ExcelExportService
  ) {}

  ngOnInit(): void {
    if (this.auditLogService.isConfigured()) this.loadLogs();
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  get detailsEntries(): Array<{ key: string; value: string }> {
    if (!this.selectedEvent?.details) return [];
    return Object.entries(this.selectedEvent.details).map(([key, value]) => ({
      key: this.humanize(key),
      value: this.formatDetail(value)
    }));
  }

  async loadLogs(): Promise<void> {
    if (!this.auditLogService.isConfigured()) return;
    this.isLoading = true;
    this.errorMessage = '';
    try {
      const result = await this.auditLogService.getLogs(this.currentFilters());
      this.items = result.items;
      this.total = result.total;
      this.page = result.page;
    } catch (error: any) {
      this.errorMessage = error?.message || 'Unable to load activity records.';
      this.items = [];
      this.total = 0;
    } finally {
      this.isLoading = false;
    }
  }

  applyFilters(): void {
    this.page = 1;
    void this.loadLogs();
  }

  selectModule(module: ActivityModule | 'All'): void {
    this.selectedModule = module;
    this.selectedAction = 'All';
    this.applyFilters();
  }

  clearFilters(): void {
    this.selectedModule = 'All';
    this.selectedAction = 'All';
    this.userFilter = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.search = '';
    this.applyFilters();
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.page) return;
    this.page = page;
    void this.loadLogs();
  }

  changePageSize(): void {
    this.page = 1;
    void this.loadLogs();
  }

  viewDetails(event: ActivityLogEvent): void {
    this.selectedEvent = event;
  }

  closeDetails(): void {
    this.selectedEvent = null;
  }

  async exportExcel(): Promise<void> {
    if (this.isExporting) return;
    this.isExporting = true;
    this.errorMessage = '';
    try {
      const records = await this.auditLogService.getAllMatchingLogs(this.currentFilters(false));
      const amountTotal = records.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      const eventRows = records.map(item => ({
        dateTime: this.formatDateTime(item.occurred_at),
        user: item.user_email,
        module: item.module,
        action: item.action,
        reference: item.record_reference,
        description: item.description,
        amount: item.amount,
        details: this.formatDetail(item.details)
      }));

      this.excelService.exportMultiSheetReport({
        filename: this.excelService.generateFilename('Lonex_Activity_Log'),
        sheets: [
          {
            sheetName: 'Audit Summary',
            sheetTitle: 'Activity Log Summary',
            metadata: this.exportMetadata(),
            columns: [
              { header: 'Metric', key: 'metric', type: 'text', width: 28 },
              { header: 'Value', key: 'value', width: 28 }
            ],
            data: [
              { metric: 'Matching Events', value: records.length },
              { metric: 'Total Recorded Amount', value: amountTotal }
            ]
          },
          {
            sheetName: 'Activity Events',
            sheetTitle: 'Activity Log Events',
            metadata: this.exportMetadata(),
            columns: [
              { header: 'Date & Time', key: 'dateTime', type: 'text', width: 22 },
              { header: 'User', key: 'user', type: 'text', width: 28 },
              { header: 'Module', key: 'module', type: 'text', width: 16 },
              { header: 'Action', key: 'action', type: 'text', width: 34 },
              { header: 'Reference', key: 'reference', type: 'text', width: 22 },
              { header: 'Description', key: 'description', type: 'text', width: 45 },
              { header: 'Amount (Rs.)', key: 'amount', type: 'currency', width: 18 },
              { header: 'Details', key: 'details', type: 'text', width: 45 }
            ],
            data: eventRows
          }
        ]
      });
    } catch (error: any) {
      this.errorMessage = error?.message || 'Unable to export the Activity Log.';
    } finally {
      this.isExporting = false;
    }
  }

  moduleBadge(module: ActivityModule): string {
    return `module-${module.toLowerCase()}`;
  }

  private currentFilters(includePaging = true): ActivityLogFilters {
    return {
      module: this.selectedModule,
      action: this.selectedAction,
      user: this.userFilter,
      dateFrom: this.dateFrom,
      dateTo: this.dateTo,
      search: this.search,
      page: includePaging ? this.page : 1,
      pageSize: includePaging ? this.pageSize : 500
    };
  }

  private exportMetadata(): Array<{ label: string; value: string }> {
    return [
      { label: 'Module', value: this.selectedModule },
      { label: 'Action', value: this.selectedAction },
      { label: 'Date From', value: this.dateFrom || 'All dates' },
      { label: 'Date To', value: this.dateTo || 'All dates' },
      { label: 'Search', value: this.search || 'None' }
    ];
  }

  private formatDateTime(value: string): string {
    return new Date(value).toLocaleString('en-GB');
  }

  private humanize(value: string): string {
    return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  private formatDetail(value: unknown): string {
    if (value === null || value === undefined || value === '') return '-';
    if (Array.isArray(value)) return value.map(item => String(item)).join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }
}
