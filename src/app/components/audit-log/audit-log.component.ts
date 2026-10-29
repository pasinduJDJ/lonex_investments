import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuditLogEntry, AuditLogFilters, AuditLogService, AuditOperation } from '../../service/audit-log.service';

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './audit-log.component.html',
  styleUrl: './audit-log.component.css'
})
export class AuditLogComponent implements OnInit {
  readonly operations: Array<AuditOperation | 'All'> = ['All', 'Members', 'Loans', 'Payments', 'Finance'];
  readonly pageSizes = [25, 50, 100];
  selectedOperation: AuditOperation | 'All' = 'All';
  search = '';
  dateFrom = '';
  dateTo = '';
  page = 1;
  pageSize = 25;
  total = 0;
  items: AuditLogEntry[] = [];
  selectedEntry: AuditLogEntry | null = null;
  isLoading = false;
  errorMessage = '';

  constructor(private auditLogService: AuditLogService) {}

  ngOnInit(): void {
    void this.loadLogs();
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  get detailEntries(): Array<{ key: string; value: string }> {
    return Object.entries(this.selectedEntry?.details || {}).map(([key, value]) => ({
      key: key.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase()),
      value: typeof value === 'object' ? JSON.stringify(value) : String(value)
    }));
  }

  async loadLogs(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';
    try {
      const result = await this.auditLogService.getLogs(this.filters());
      this.items = result.items;
      this.total = result.total;
      this.page = result.page;
    } catch (error: any) {
      this.items = [];
      this.total = 0;
      this.errorMessage = error?.message || 'Unable to load audit records.';
    } finally {
      this.isLoading = false;
    }
  }

  selectOperation(operation: AuditOperation | 'All'): void {
    this.selectedOperation = operation;
    this.applyFilters();
  }

  applyFilters(): void {
    this.page = 1;
    void this.loadLogs();
  }

  clearFilters(): void {
    this.selectedOperation = 'All';
    this.search = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.applyFilters();
  }

  changePage(nextPage: number): void {
    if (nextPage < 1 || nextPage > this.totalPages || nextPage === this.page) return;
    this.page = nextPage;
    void this.loadLogs();
  }

  changePageSize(): void {
    this.page = 1;
    void this.loadLogs();
  }

  private filters(): AuditLogFilters {
    return {
      operation: this.selectedOperation,
      search: this.search,
      dateFrom: this.dateFrom,
      dateTo: this.dateTo,
      page: this.page,
      pageSize: this.pageSize
    };
  }
}
