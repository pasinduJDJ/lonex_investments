import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  LoanReportService,
  LoanHistoryRow,
  LoanHistorySummary,
  ActiveLoanRow,
  ActiveLoansSummary,
  CompletedLoanRow,
  CompletedLoansSummary,
  OverdueLoanRow,
  OverdueLoansSummary,
  RepaymentScheduleData
} from '../../service/loan-report.service';
import { ExcelExportService, ExcelColumnDef } from '../../service/excel-export.service';
import { LoanManageService, LoanWithClient } from '../../service/loan-manage.service';

export type LoanReportType = 'loan-history' | 'active-loans' | 'completed-loans' | 'overdue-loans' | 'repayment-schedule';

@Component({
  selector: 'app-loan-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './loan-reports.component.html',
  styleUrl: './loan-reports.component.css'
})
export class LoanReportsComponent implements OnInit, OnDestroy {
  activeReportType: LoanReportType = 'loan-history';

  // Common UI State
  isLoading: boolean = false;
  isExporting: boolean = false;
  errorMessage: string = '';

  // Pagination State
  pageSize: number = 25;
  currentPage: number = 1;
  pageSizeOptions: number[] = [25, 50, 100];

  // Report 01: Loan History State
  historyRows: LoanHistoryRow[] = [];
  historySummary: LoanHistorySummary = {
    totalLoans: 0,
    totalPrincipal: 0,
    totalDue: 0,
    totalPaid: 0,
    totalRemaining: 0,
    activeCount: 0,
    completedCount: 0,
    overdueCount: 0
  };
  historySearch: string = '';
  historyDateFrom: string = '';
  historyDateTo: string = '';
  historyStatus: 'all' | 'active' | 'completed' | 'overdue' = 'all';
  historyLoanType: 'all' | 'daily' | 'weekly' | 'monthly' = 'all';

  // Report 02: Active Loans State
  activeRows: ActiveLoanRow[] = [];
  activeSummary: ActiveLoansSummary = {
    totalActiveLoans: 0,
    totalPrincipal: 0,
    totalDue: 0,
    totalPaid: 0,
    totalOutstanding: 0,
    dueThisWeekCount: 0,
    dueThisWeekAmount: 0
  };
  activeSearch: string = '';
  activeDateFrom: string = '';
  activeDateTo: string = '';
  activeLoanType: 'all' | 'daily' | 'weekly' | 'monthly' = 'all';
  activeOverdueFilter: 'all' | 'active-only' | 'overdue-only' = 'all';

  // Report 03: Completed Loans State
  completedRows: CompletedLoanRow[] = [];
  completedSummary: CompletedLoansSummary = {
    totalCompletedLoans: 0,
    totalPrincipal: 0,
    totalCollected: 0,
    completedDuringPeriodCount: 0
  };
  completedSearch: string = '';
  completedDateFrom: string = '';
  completedDateTo: string = '';
  completedDateCompletionFrom: string = '';
  completedDateCompletionTo: string = '';
  completedLoanType: 'all' | 'daily' | 'weekly' | 'monthly' = 'all';

  // Report 04: Delayed / Overdue Loans State
  overdueRows: OverdueLoanRow[] = [];
  overdueSummary: OverdueLoansSummary = {
    totalOverdueLoans: 0,
    totalOverdueAmount: 0,
    totalOutstandingBalance: 0,
    count1To7Days: 0,
    count8To30Days: 0,
    count31PlusDays: 0
  };
  overdueSearch: string = '';
  overdueLoanType: 'all' | 'daily' | 'weekly' | 'monthly' = 'all';
  overdueSeverity: 'all' | '1-7' | '8-30' | '31+' = 'all';

  // Report 05: Repayment Schedule State
  allLoansList: LoanWithClient[] = [];
  selectedLoanId: string = '';
  scheduleData: RepaymentScheduleData | null = null;

  private routeSub!: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private loanReportService: LoanReportService,
    private excelService: ExcelExportService,
    private loanService: LoanManageService
  ) {}

  ngOnInit(): void {
    // Pre-load loans list for schedule selector
    this.loadLoansList();

    // Listen to route changes
    this.routeSub = this.route.paramMap.subscribe(params => {
      const typeParam = params.get('type') as LoanReportType;
      if (typeParam && ['loan-history', 'active-loans', 'completed-loans', 'overdue-loans', 'repayment-schedule'].includes(typeParam)) {
        this.activeReportType = typeParam;
      } else {
        this.activeReportType = 'loan-history';
      }
      this.currentPage = 1;
      this.errorMessage = '';
      this.loadActiveReport();
    });
  }

  ngOnDestroy(): void {
    if (this.routeSub) {
      this.routeSub.unsubscribe();
    }
  }

  /**
   * Switch between loan reports
   */
  switchReport(type: LoanReportType): void {
    if (this.activeReportType === type) return;
    this.activeReportType = type;
    this.currentPage = 1;
    this.router.navigate(['/loan/reports', type]);
  }

  /**
   * Pre-load loans for Repayment Schedule picker
   */
  private loadLoansList(): void {
    this.loanService.getAllLoans().subscribe({
      next: (loans) => {
        this.allLoansList = loans || [];
        if (this.activeReportType === 'repayment-schedule' && !this.selectedLoanId && this.allLoansList.length > 0) {
          this.selectedLoanId = this.allLoansList[0].id;
          this.loadRepaymentSchedule();
        }
      },
      error: (err) => console.warn('Could not pre-load loans list:', err)
    });
  }

  /**
   * Dispatch method to load current report data
   */
  loadActiveReport(): void {
    this.errorMessage = '';
    switch (this.activeReportType) {
      case 'loan-history':
        this.loadLoanHistory();
        break;
      case 'active-loans':
        this.loadActiveLoans();
        break;
      case 'completed-loans':
        this.loadCompletedLoans();
        break;
      case 'overdue-loans':
        this.loadOverdueLoans();
        break;
      case 'repayment-schedule':
        this.loadRepaymentSchedule();
        break;
    }
  }

  // -------------------------------------------------------------------------
  // Report 01: Loan History
  // -------------------------------------------------------------------------
  loadLoanHistory(): void {
    this.isLoading = true;
    this.loanReportService.getLoanHistoryReport({
      search: this.historySearch,
      dateFrom: this.historyDateFrom || undefined,
      dateTo: this.historyDateTo || undefined,
      status: this.historyStatus,
      loanType: this.historyLoanType
    }).subscribe({
      next: ({ rows, summary }) => {
        this.historyRows = rows;
        this.historySummary = summary;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading loan history:', err);
        this.errorMessage = 'Unable to generate report. Please try again.';
        this.isLoading = false;
      }
    });
  }

  resetHistoryFilters(): void {
    this.historySearch = '';
    this.historyDateFrom = '';
    this.historyDateTo = '';
    this.historyStatus = 'all';
    this.historyLoanType = 'all';
    this.currentPage = 1;
    this.loadLoanHistory();
  }

  exportHistoryToExcel(): void {
    if (this.historyRows.length === 0) return;
    this.isExporting = true;

    try {
      const columns: ExcelColumnDef[] = [
        { header: 'Loan Number', key: 'loanNumber', type: 'text', width: 18 },
        { header: 'Customer Name', key: 'customerName', type: 'text', width: 28 },
        { header: 'NIC Number', key: 'nicNumber', type: 'text', width: 18 },
        { header: 'Loan Date', key: 'loanDate', type: 'date', width: 16 },
        { header: 'Principal Amount (Rs.)', key: 'principalAmount', type: 'currency', width: 22 },
        { header: 'Total Due (Rs.)', key: 'totalAmountDue', type: 'currency', width: 20 },
        { header: 'Total Paid (Rs.)', key: 'totalPaid', type: 'currency', width: 20 },
        { header: 'Remaining Balance (Rs.)', key: 'remainingAmount', type: 'currency', width: 24 },
        { header: 'Instalment (Rs.)', key: 'installmentAmount', type: 'currency', width: 18 },
        { header: 'Frequency', key: 'loanType', type: 'text', width: 14 },
        { header: 'Paid Inst.', key: 'paidInstallments', type: 'number', width: 12 },
        { header: 'Rem. Inst.', key: 'remainingInstallments', type: 'number', width: 12 },
        { header: 'Expected End Date', key: 'expectedEndDate', type: 'date', width: 18 },
        { header: 'Status', key: 'status', type: 'text', width: 14 }
      ];

      const periodStr = (this.historyDateFrom || this.historyDateTo)
        ? `${this.historyDateFrom || 'Start'} to ${this.historyDateTo || 'End'}`
        : 'All Time';

      const metadata = [
        { label: 'Report Name', value: 'Loan History Report' },
        { label: 'Search Query', value: this.historySearch || 'All' },
        { label: 'Status Filter', value: this.historyStatus.toUpperCase() },
        { label: 'Loan Type', value: this.historyLoanType.toUpperCase() },
        { label: 'Date Period', value: periodStr }
      ];

      const summaryItems = [
        { label: 'Total Loans', value: this.historySummary.totalLoans },
        { label: 'Total Principal (Rs.)', value: this.historySummary.totalPrincipal },
        { label: 'Total Due (Rs.)', value: this.historySummary.totalDue },
        { label: 'Total Paid (Rs.)', value: this.historySummary.totalPaid },
        { label: 'Total Remaining (Rs.)', value: this.historySummary.totalRemaining },
        { label: 'Active Loans', value: this.historySummary.activeCount },
        { label: 'Completed Loans', value: this.historySummary.completedCount },
        { label: 'Overdue Loans', value: this.historySummary.overdueCount }
      ];

      const fileSuffix = (this.historyDateFrom && this.historyDateTo)
        ? `${this.historyDateFrom}_${this.historyDateTo}`
        : '';

      this.excelService.exportSingleSheetReport({
        filename: this.excelService.generateFilename('Loan_History_Report', fileSuffix),
        sheetName: 'Loan History',
        reportTitle: 'Loan History Report',
        metadata,
        summaryItems,
        columns,
        data: this.historyRows // Exports FULL filtered dataset
      });
    } catch (e) {
      console.error('Error generating Excel file:', e);
      alert('Failed to generate Excel file. Please try again.');
    } finally {
      this.isExporting = false;
    }
  }

  // -------------------------------------------------------------------------
  // Report 02: Active Loans
  // -------------------------------------------------------------------------
  loadActiveLoans(): void {
    this.isLoading = true;
    this.loanReportService.getActiveLoansReport({
      search: this.activeSearch,
      dateFrom: this.activeDateFrom || undefined,
      dateTo: this.activeDateTo || undefined,
      loanType: this.activeLoanType,
      overdueFilter: this.activeOverdueFilter
    }).subscribe({
      next: ({ rows, summary }) => {
        this.activeRows = rows;
        this.activeSummary = summary;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading active loans:', err);
        this.errorMessage = 'Unable to generate report. Please try again.';
        this.isLoading = false;
      }
    });
  }

  resetActiveFilters(): void {
    this.activeSearch = '';
    this.activeDateFrom = '';
    this.activeDateTo = '';
    this.activeLoanType = 'all';
    this.activeOverdueFilter = 'all';
    this.currentPage = 1;
    this.loadActiveLoans();
  }

  exportActiveLoansToExcel(): void {
    if (this.activeRows.length === 0) return;
    this.isExporting = true;

    try {
      const columns: ExcelColumnDef[] = [
        { header: 'Loan Number', key: 'loanNumber', type: 'text', width: 18 },
        { header: 'Customer Name', key: 'customerName', type: 'text', width: 28 },
        { header: 'NIC Number', key: 'nicNumber', type: 'text', width: 18 },
        { header: 'Mobile Number', key: 'mobileNumber', type: 'text', width: 18 },
        { header: 'Loan Date', key: 'loanDate', type: 'date', width: 16 },
        { header: 'Principal Amount (Rs.)', key: 'principalAmount', type: 'currency', width: 22 },
        { header: 'Total Due (Rs.)', key: 'totalAmountDue', type: 'currency', width: 20 },
        { header: 'Total Paid (Rs.)', key: 'totalPaid', type: 'currency', width: 20 },
        { header: 'Remaining Balance (Rs.)', key: 'remainingAmount', type: 'currency', width: 24 },
        { header: 'Instalment (Rs.)', key: 'installmentAmount', type: 'currency', width: 18 },
        { header: 'Frequency', key: 'loanType', type: 'text', width: 14 },
        { header: 'Paid Inst.', key: 'paidInstallments', type: 'number', width: 12 },
        { header: 'Rem. Inst.', key: 'remainingInstallments', type: 'number', width: 12 },
        { header: 'Next Expected Payment', key: 'nextExpectedPaymentDate', type: 'date', width: 22 },
        { header: 'Expected End Date', key: 'expectedEndDate', type: 'date', width: 18 },
        { header: 'Progress (%)', key: 'progressPercent', type: 'number', width: 14 },
        { header: 'Status', key: 'status', type: 'text', width: 14 }
      ];

      const metadata = [
        { label: 'Report Name', value: 'Active Loans Report' },
        { label: 'Search Query', value: this.activeSearch || 'All' },
        { label: 'Frequency Filter', value: this.activeLoanType.toUpperCase() },
        { label: 'Status Filter', value: this.activeOverdueFilter.toUpperCase() }
      ];

      const summaryItems = [
        { label: 'Total Active Loans', value: this.activeSummary.totalActiveLoans },
        { label: 'Total Principal (Rs.)', value: this.activeSummary.totalPrincipal },
        { label: 'Total Due (Rs.)', value: this.activeSummary.totalDue },
        { label: 'Total Paid (Rs.)', value: this.activeSummary.totalPaid },
        { label: 'Outstanding Balance (Rs.)', value: this.activeSummary.totalOutstanding },
        { label: 'Due This Week Count', value: this.activeSummary.dueThisWeekCount },
        { label: 'Due This Week Amount (Rs.)', value: this.activeSummary.dueThisWeekAmount }
      ];

      this.excelService.exportSingleSheetReport({
        filename: this.excelService.generateFilename('Active_Loans_Report'),
        sheetName: 'Active Loans',
        reportTitle: 'Active Loans Report',
        metadata,
        summaryItems,
        columns,
        data: this.activeRows
      });
    } catch (e) {
      console.error('Error generating Excel file:', e);
      alert('Failed to generate Excel file. Please try again.');
    } finally {
      this.isExporting = false;
    }
  }

  // -------------------------------------------------------------------------
  // Report 03: Completed Loans
  // -------------------------------------------------------------------------
  loadCompletedLoans(): void {
    this.isLoading = true;
    this.loanReportService.getCompletedLoansReport({
      search: this.completedSearch,
      dateFrom: this.completedDateFrom || undefined,
      dateTo: this.completedDateTo || undefined,
      completionDateFrom: this.completedDateCompletionFrom || undefined,
      completionDateTo: this.completedDateCompletionTo || undefined,
      loanType: this.completedLoanType
    }).subscribe({
      next: ({ rows, summary }) => {
        this.completedRows = rows;
        this.completedSummary = summary;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading completed loans:', err);
        this.errorMessage = 'Unable to generate report. Please try again.';
        this.isLoading = false;
      }
    });
  }

  resetCompletedFilters(): void {
    this.completedSearch = '';
    this.completedDateFrom = '';
    this.completedDateTo = '';
    this.completedDateCompletionFrom = '';
    this.completedDateCompletionTo = '';
    this.completedLoanType = 'all';
    this.currentPage = 1;
    this.loadCompletedLoans();
  }

  exportCompletedLoansToExcel(): void {
    if (this.completedRows.length === 0) return;
    this.isExporting = true;

    try {
      const columns: ExcelColumnDef[] = [
        { header: 'Loan Number', key: 'loanNumber', type: 'text', width: 18 },
        { header: 'Customer Name', key: 'customerName', type: 'text', width: 28 },
        { header: 'NIC Number', key: 'nicNumber', type: 'text', width: 18 },
        { header: 'Mobile Number', key: 'mobileNumber', type: 'text', width: 18 },
        { header: 'Loan Date', key: 'loanDate', type: 'date', width: 16 },
        { header: 'Principal Amount (Rs.)', key: 'principalAmount', type: 'currency', width: 22 },
        { header: 'Total Due (Rs.)', key: 'totalAmountDue', type: 'currency', width: 20 },
        { header: 'Total Paid (Rs.)', key: 'totalPaid', type: 'currency', width: 20 },
        { header: 'Completion Date', key: 'completionDate', type: 'date', width: 18 },
        { header: 'Original Expected End Date', key: 'originalExpectedEndDate', type: 'date', width: 24 },
        { header: 'Frequency', key: 'loanType', type: 'text', width: 14 },
        { header: 'Status', key: 'status', type: 'text', width: 14 }
      ];

      const metadata = [
        { label: 'Report Name', value: 'Completed Loans Report' },
        { label: 'Search Query', value: this.completedSearch || 'All' },
        { label: 'Frequency Filter', value: this.completedLoanType.toUpperCase() },
        { label: 'Loan Date Period', value: (this.completedDateFrom || this.completedDateTo) ? `${this.completedDateFrom || 'Start'} to ${this.completedDateTo || 'End'}` : 'All' }
      ];

      const summaryItems = [
        { label: 'Total Completed Loans', value: this.completedSummary.totalCompletedLoans },
        { label: 'Total Principal (Rs.)', value: this.completedSummary.totalPrincipal },
        { label: 'Total Amount Collected (Rs.)', value: this.completedSummary.totalCollected }
      ];

      this.excelService.exportSingleSheetReport({
        filename: this.excelService.generateFilename('Completed_Loans_Report'),
        sheetName: 'Completed Loans',
        reportTitle: 'Completed Loans Report',
        metadata,
        summaryItems,
        columns,
        data: this.completedRows
      });
    } catch (e) {
      console.error('Error generating Excel file:', e);
      alert('Failed to generate Excel file. Please try again.');
    } finally {
      this.isExporting = false;
    }
  }

  // -------------------------------------------------------------------------
  // Report 04: Delayed / Overdue Loans
  // -------------------------------------------------------------------------
  loadOverdueLoans(): void {
    this.isLoading = true;
    this.loanReportService.getOverdueLoansReport({
      search: this.overdueSearch,
      loanType: this.overdueLoanType,
      severity: this.overdueSeverity
    }).subscribe({
      next: ({ rows, summary }) => {
        this.overdueRows = rows;
        this.overdueSummary = summary;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading overdue loans:', err);
        this.errorMessage = 'Unable to generate report. Please try again.';
        this.isLoading = false;
      }
    });
  }

  resetOverdueFilters(): void {
    this.overdueSearch = '';
    this.overdueLoanType = 'all';
    this.overdueSeverity = 'all';
    this.currentPage = 1;
    this.loadOverdueLoans();
  }

  exportOverdueLoansToExcel(): void {
    if (this.overdueRows.length === 0) return;
    this.isExporting = true;

    try {
      const columns: ExcelColumnDef[] = [
        { header: 'Loan Number', key: 'loanNumber', type: 'text', width: 18 },
        { header: 'Customer Name', key: 'customerName', type: 'text', width: 28 },
        { header: 'NIC Number', key: 'nicNumber', type: 'text', width: 18 },
        { header: 'Mobile Number', key: 'mobileNumber', type: 'text', width: 18 },
        { header: 'Loan Date', key: 'loanDate', type: 'date', width: 16 },
        { header: 'Frequency', key: 'loanType', type: 'text', width: 14 },
        { header: 'Expected Payment Date', key: 'expectedPaymentDate', type: 'date', width: 22 },
        { header: 'Instalment Amount (Rs.)', key: 'expectedInstalmentAmount', type: 'currency', width: 22 },
        { header: 'Total Paid (Rs.)', key: 'totalPaid', type: 'currency', width: 18 },
        { header: 'Overdue Instalments', key: 'overdueInstallments', type: 'number', width: 20 },
        { header: 'Overdue Amount (Rs.)', key: 'overdueAmount', type: 'currency', width: 22 },
        { header: 'Remaining Balance (Rs.)', key: 'remainingBalance', type: 'currency', width: 24 },
        { header: 'Days Late', key: 'daysLate', type: 'number', width: 14 },
        { header: 'Expected End Date', key: 'expectedEndDate', type: 'date', width: 18 },
        { header: 'Status', key: 'status', type: 'text', width: 14 }
      ];

      const metadata = [
        { label: 'Report Name', value: 'Delayed / Overdue Loans Report' },
        { label: 'Overdue As Of', value: this.excelService.getTodayFormatted() },
        { label: 'Frequency Filter', value: this.overdueLoanType.toUpperCase() },
        { label: 'Severity Filter', value: this.overdueSeverity.toUpperCase() },
        { label: 'Search Query', value: this.overdueSearch || 'All' }
      ];

      const summaryItems = [
        { label: 'Total Overdue Loans', value: this.overdueSummary.totalOverdueLoans },
        { label: 'Total Overdue Amount (Rs.)', value: this.overdueSummary.totalOverdueAmount },
        { label: 'Total Outstanding Balance (Rs.)', value: this.overdueSummary.totalOutstandingBalance },
        { label: 'Late (1-7 Days)', value: this.overdueSummary.count1To7Days },
        { label: 'Overdue (8-30 Days)', value: this.overdueSummary.count8To30Days },
        { label: 'Critical (31+ Days)', value: this.overdueSummary.count31PlusDays }
      ];

      this.excelService.exportSingleSheetReport({
        filename: this.excelService.generateFilename('Delayed_Overdue_Loans_Report'),
        sheetName: 'Overdue Loans',
        reportTitle: 'Delayed / Overdue Loans Report',
        metadata,
        summaryItems,
        columns,
        data: this.overdueRows
      });
    } catch (e) {
      console.error('Error generating Excel file:', e);
      alert('Failed to generate Excel file. Please try again.');
    } finally {
      this.isExporting = false;
    }
  }

  // -------------------------------------------------------------------------
  // Report 05: Repayment Schedule
  // -------------------------------------------------------------------------
  onSelectLoanChange(): void {
    this.scheduleData = null;
    this.currentPage = 1;
    this.loadRepaymentSchedule();
  }

  loadRepaymentSchedule(): void {
    if (!this.selectedLoanId) {
      if (this.allLoansList.length > 0) {
        this.selectedLoanId = this.allLoansList[0].id;
      } else {
        return;
      }
    }

    this.isLoading = true;
    this.loanReportService.getRepaymentScheduleReport(this.selectedLoanId).subscribe({
      next: (data) => {
        this.scheduleData = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading repayment schedule:', err);
        this.errorMessage = 'Unable to generate repayment schedule.';
        this.isLoading = false;
      }
    });
  }

  exportScheduleToExcel(): void {
    if (!this.scheduleData) return;
    this.isExporting = true;

    try {
      const s = this.scheduleData;

      // Sheet 1: Loan Summary
      const summaryColumns: ExcelColumnDef[] = [
        { header: 'Attribute', key: 'attribute', type: 'text', width: 28 },
        { header: 'Detail / Value', key: 'value', type: 'text', width: 38 }
      ];

      const summaryData = [
        { attribute: 'Loan Number', value: s.loanNumber },
        { attribute: 'Customer Name', value: s.customerName },
        { attribute: 'NIC Number', value: s.nicNumber },
        { attribute: 'Mobile Number', value: s.mobileNumber },
        { attribute: 'Loan Date', value: s.loanDate },
        { attribute: 'Principal Amount (Rs.)', value: s.principalAmount },
        { attribute: 'Interest Rate (%)', value: s.interestRate },
        { attribute: 'Document Charge (Rs.)', value: s.documentCharge },
        { attribute: 'Total Amount Due (Rs.)', value: s.totalAmountDue },
        { attribute: 'Total Repaid (Rs.)', value: s.totalPaid },
        { attribute: 'Remaining Balance (Rs.)', value: s.remainingAmount },
        { attribute: 'Instalment Amount (Rs.)', value: s.installmentAmount },
        { attribute: 'Repayment Frequency', value: s.frequency },
        { attribute: 'Total Installments', value: s.totalInstallments },
        { attribute: 'Paid Installments', value: s.paidInstallments },
        { attribute: 'Remaining Installments', value: s.remainingInstallments },
        { attribute: 'Expected End Date', value: s.expectedEndDate },
        { attribute: 'Loan Status', value: s.status },
        { attribute: 'Rescheduled / Early Settled', value: s.isRescheduled ? 'Yes' : 'No' }
      ];

      // Sheet 2: Repayment Schedule
      const scheduleColumns: ExcelColumnDef[] = [
        { header: 'Instalment No.', key: 'installmentNumber', type: 'number', width: 16 },
        { header: 'Expected Due Date', key: 'expectedDate', type: 'date', width: 20 },
        { header: 'Expected Amount (Rs.)', key: 'expectedAmount', type: 'currency', width: 22 },
        { header: 'Paid Amount (Rs.)', key: 'paidAmount', type: 'currency', width: 20 },
        { header: 'Remaining Due (Rs.)', key: 'remainingAmount', type: 'currency', width: 20 },
        { header: 'Payment Date', key: 'paymentDate', type: 'date', width: 18 },
        { header: 'Status', key: 'status', type: 'text', width: 16 }
      ];

      // Sheet 3: Payment History
      const paymentColumns: ExcelColumnDef[] = [
        { header: 'Payment Date', key: 'paid_date', type: 'date', width: 18 },
        { header: 'Amount Paid (Rs.)', key: 'paid_amount', type: 'currency', width: 20 },
        { header: 'Remark / Method', key: 'remark', type: 'text', width: 28 },
        { header: 'Recorded On', key: 'created_at', type: 'date', width: 18 }
      ];

      this.excelService.exportMultiSheetReport({
        filename: this.excelService.generateFilename('Repayment_Schedule', s.loanNumber),
        sheets: [
          {
            sheetName: 'Loan Summary',
            sheetTitle: `Loan Summary - ${s.loanNumber}`,
            metadata: [
              { label: 'Customer', value: s.customerName },
              { label: 'Loan Number', value: s.loanNumber },
              { label: 'Generated Date', value: this.excelService.getTodayFormatted() }
            ],
            columns: summaryColumns,
            data: summaryData
          },
          {
            sheetName: 'Repayment Schedule',
            sheetTitle: `Effective Repayment Schedule - ${s.loanNumber}`,
            metadata: [
              { label: 'Customer', value: s.customerName },
              { label: 'Loan Number', value: s.loanNumber },
              { label: 'Effective End Date', value: s.expectedEndDate }
            ],
            columns: scheduleColumns,
            data: s.scheduleRows
          },
          {
            sheetName: 'Payment History',
            sheetTitle: `Payment Transactions - ${s.loanNumber}`,
            metadata: [
              { label: 'Customer', value: s.customerName },
              { label: 'Total Payments Recorded', value: s.payments.length }
            ],
            columns: paymentColumns,
            data: s.payments
          }
        ]
      });
    } catch (e) {
      console.error('Error generating repayment schedule Excel:', e);
      alert('Failed to generate Excel file.');
    } finally {
      this.isExporting = false;
    }
  }

  // -------------------------------------------------------------------------
  // Pagination Helpers
  // -------------------------------------------------------------------------
  get totalItems(): number {
    switch (this.activeReportType) {
      case 'loan-history':
        return this.historyRows.length;
      case 'active-loans':
        return this.activeRows.length;
      case 'completed-loans':
        return this.completedRows.length;
      case 'overdue-loans':
        return this.overdueRows.length;
      default:
        return 0;
    }
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalItems / this.pageSize));
  }

  get paginatedHistoryRows(): LoanHistoryRow[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.historyRows.slice(start, start + this.pageSize);
  }

  get paginatedActiveRows(): ActiveLoanRow[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.activeRows.slice(start, start + this.pageSize);
  }

  get paginatedCompletedRows(): CompletedLoanRow[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.completedRows.slice(start, start + this.pageSize);
  }

  get paginatedOverdueRows(): OverdueLoanRow[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.overdueRows.slice(start, start + this.pageSize);
  }

  setPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
  }
}
