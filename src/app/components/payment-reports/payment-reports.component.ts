import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { 
  PaymentReportService,
  PaymentHistoryRow,
  PaymentHistorySummary,
  DelayedPaymentRow,
  DelayedPaymentsSummary,
  CollectionRow,
  CollectionSummary,
  UpcomingPaymentRow,
  UpcomingPaymentsSummary,
  PaymentPerformanceData,
  PerformancePeriodRow,
  PerformancePaymentRow
} from '../../service/payment-report.service';
import { ExcelExportService, ExcelColumnDef } from '../../service/excel-export.service';
import { formatLocalIsoDate } from '../../service/analysis.service';

export type PaymentReportType = 
  | 'payment-history'
  | 'delayed-payments'
  | 'collection'
  | 'upcoming-payments'
  | 'payment-performance';

@Component({
  selector: 'app-payment-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './payment-reports.component.html',
  styleUrl: './payment-reports.component.css'
})
export class PaymentReportsComponent implements OnInit, OnDestroy {
  activeReportType: PaymentReportType = 'payment-history';
  isLoading: boolean = false;
  isExporting: boolean = false;
  errorMessage: string = '';

  // Pagination Controls
  currentPage: number = 1;
  pageSize: number = 25;
  pageSizeOptions: number[] = [25, 50, 100];

  // Report 01: Payment History State
  historyRows: PaymentHistoryRow[] = [];
  historySummary: PaymentHistorySummary = {
    totalPayments: 0,
    totalCollected: 0,
    averagePayment: 0
  };
  historySearch: string = '';
  historyDateFrom: string = '';
  historyDateTo: string = '';
  historyLoanType: 'all' | 'daily' | 'weekly' | 'monthly' = 'all';
  historyLoanStatus: 'all' | 'active' | 'closed' = 'all';

  // Report 02: Delayed Payments State
  delayedRows: DelayedPaymentRow[] = [];
  delayedSummary: DelayedPaymentsSummary = {
    totalDelayedObligations: 0,
    totalOverdueAmount: 0,
    affectedCustomers: 0,
    affectedLoans: 0,
    count1To7Days: 0,
    count8To30Days: 0,
    count31PlusDays: 0
  };
  delayedSearch: string = '';
  delayedDateFrom: string = '';
  delayedDateTo: string = '';
  delayedLoanType: 'all' | 'daily' | 'weekly' | 'monthly' = 'all';
  delayedSeverity: 'all' | '1-7' | '8-30' | '31+' = 'all';

  // Report 03: Collection Report State
  collectionRows: CollectionRow[] = [];
  collectionSummary: CollectionSummary = {
    totalCollected: 0,
    transactionCount: 0,
    customersPaid: 0,
    loansPaid: 0,
    averagePayment: 0,
    dailyCollections: 0,
    weeklyCollections: 0,
    monthlyCollections: 0
  };
  collectionSearch: string = '';
  collectionDateFrom: string = '';
  collectionDateTo: string = '';
  collectionLoanType: 'all' | 'daily' | 'weekly' | 'monthly' = 'all';

  // Report 04: Upcoming Payments State
  upcomingRows: UpcomingPaymentRow[] = [];
  upcomingSummary: UpcomingPaymentsSummary = {
    expectedPaymentCount: 0,
    customersDue: 0,
    loansDue: 0,
    totalExpectedCollection: 0,
    dailyExpected: 0,
    weeklyExpected: 0,
    monthlyExpected: 0
  };
  upcomingQuickPeriod: 'today' | 'this_week' | 'next_week' | 'custom' = 'this_week';
  upcomingSearch: string = '';
  upcomingDateFrom: string = '';
  upcomingDateTo: string = '';
  upcomingLoanType: 'all' | 'daily' | 'weekly' | 'monthly' = 'all';

  // Report 05: Payment Performance State
  performanceData: PaymentPerformanceData | null = null;
  performanceDateFrom: string = '';
  performanceDateTo: string = '';
  performanceLoanType: 'all' | 'daily' | 'weekly' | 'monthly' = 'all';
  performanceSearch: string = '';
  performanceActiveTab: 'periodic' | 'payments' = 'periodic';

  private routeSub!: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private paymentReportService: PaymentReportService,
    private excelService: ExcelExportService
  ) {}

  ngOnInit(): void {
    // Set default performance dates (current month)
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const firstDay = new Date(y, m, 1);
    const lastDay = new Date(y, m + 1, 0);
    this.performanceDateFrom = formatLocalIsoDate(firstDay);
    this.performanceDateTo = formatLocalIsoDate(lastDay);

    // Listen to route params
    this.routeSub = this.route.paramMap.subscribe(params => {
      const typeParam = params.get('type') as PaymentReportType;
      if (typeParam && [
        'payment-history', 
        'delayed-payments', 
        'collection', 
        'upcoming-payments', 
        'payment-performance'
      ].includes(typeParam)) {
        this.activeReportType = typeParam;
      } else {
        this.activeReportType = 'payment-history';
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
   * Switch between analysis payment reports
   */
  switchReport(type: PaymentReportType): void {
    if (this.activeReportType === type) return;
    this.activeReportType = type;
    this.currentPage = 1;
    this.router.navigate(['/analysis/reports', type]);
  }

  loadActiveReport(): void {
    switch (this.activeReportType) {
      case 'payment-history':
        this.loadPaymentHistory();
        break;
      case 'delayed-payments':
        this.loadDelayedPayments();
        break;
      case 'collection':
        this.loadCollectionReport();
        break;
      case 'upcoming-payments':
        this.loadUpcomingPayments();
        break;
      case 'payment-performance':
        this.loadPaymentPerformance();
        break;
    }
  }

  // -------------------------------------------------------------------------
  // Report 01: Payment History
  // -------------------------------------------------------------------------
  loadPaymentHistory(): void {
    this.isLoading = true;
    this.paymentReportService.getPaymentHistoryReport({
      search: this.historySearch,
      dateFrom: this.historyDateFrom || undefined,
      dateTo: this.historyDateTo || undefined,
      loanType: this.historyLoanType,
      loanStatus: this.historyLoanStatus
    }).subscribe({
      next: ({ rows, summary }) => {
        this.historyRows = rows;
        this.historySummary = summary;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading payment history:', err);
        this.errorMessage = 'Unable to generate report. Please try again.';
        this.isLoading = false;
      }
    });
  }

  resetHistoryFilters(): void {
    this.historySearch = '';
    this.historyDateFrom = '';
    this.historyDateTo = '';
    this.historyLoanType = 'all';
    this.historyLoanStatus = 'all';
    this.currentPage = 1;
    this.loadPaymentHistory();
  }

  exportPaymentHistoryToExcel(): void {
    if (this.historyRows.length === 0) return;
    this.isExporting = true;

    try {
      const columns: ExcelColumnDef[] = [
        { header: 'Payment Date', key: 'paidDate', type: 'date', width: 16 },
        { header: 'Customer Name', key: 'customerName', type: 'text', width: 28 },
        { header: 'NIC Number', key: 'nicNumber', type: 'text', width: 18 },
        { header: 'Mobile', key: 'mobileNumber', type: 'text', width: 16 },
        { header: 'Loan Number', key: 'loanNumber', type: 'text', width: 18 },
        { header: 'Frequency', key: 'loanType', type: 'text', width: 14 },
        { header: 'Loan Status', key: 'loanStatus', type: 'text', width: 14 },
        { header: 'Amount Paid (Rs.)', key: 'paidAmount', type: 'currency', width: 20 },
        { header: 'Remark', key: 'remark', type: 'text', width: 24 },
        { header: 'Recorded Date', key: 'recordedDate', type: 'date', width: 16 }
      ];

      const periodStr = (this.historyDateFrom || this.historyDateTo)
        ? `${this.historyDateFrom || 'Start'} to ${this.historyDateTo || 'End'}`
        : 'All Time';

      const metadata = [
        { label: 'Report Name', value: 'Payment History Report' },
        { label: 'Date Period', value: periodStr },
        { label: 'Frequency Filter', value: this.historyLoanType.toUpperCase() },
        { label: 'Status Filter', value: this.historyLoanStatus.toUpperCase() },
        { label: 'Search Query', value: this.historySearch || 'All' }
      ];

      const summaryItems = [
        { label: 'Total Payments Recorded', value: this.historySummary.totalPayments },
        { label: 'Total Amount Collected (Rs.)', value: this.historySummary.totalCollected },
        { label: 'Average Payment Amount (Rs.)', value: this.historySummary.averagePayment }
      ];

      const fileSuffix = (this.historyDateFrom && this.historyDateTo)
        ? `${this.historyDateFrom}_${this.historyDateTo}`
        : this.excelService.getTodayFormatted();

      this.excelService.exportSingleSheetReport({
        filename: `Payment_History_Report_${fileSuffix}.xlsx`,
        sheetName: 'Payment History',
        reportTitle: 'Payment History Report',
        metadata,
        summaryItems,
        columns,
        data: this.historyRows // FULL filtered dataset
      });
    } catch (e) {
      console.error('Error exporting payment history:', e);
      alert('Failed to generate Excel file. Please try again.');
    } finally {
      this.isExporting = false;
    }
  }

  // -------------------------------------------------------------------------
  // Report 02: Delayed Payments
  // -------------------------------------------------------------------------
  loadDelayedPayments(): void {
    this.isLoading = true;
    this.paymentReportService.getDelayedPaymentsReport({
      search: this.delayedSearch,
      dateFrom: this.delayedDateFrom || undefined,
      dateTo: this.delayedDateTo || undefined,
      loanType: this.delayedLoanType,
      severity: this.delayedSeverity
    }).subscribe({
      next: ({ rows, summary }) => {
        this.delayedRows = rows;
        this.delayedSummary = summary;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading delayed payments:', err);
        this.errorMessage = 'Unable to generate report. Please try again.';
        this.isLoading = false;
      }
    });
  }

  resetDelayedFilters(): void {
    this.delayedSearch = '';
    this.delayedDateFrom = '';
    this.delayedDateTo = '';
    this.delayedLoanType = 'all';
    this.delayedSeverity = 'all';
    this.currentPage = 1;
    this.loadDelayedPayments();
  }

  exportDelayedPaymentsToExcel(): void {
    if (this.delayedRows.length === 0) return;
    this.isExporting = true;

    try {
      const columns: ExcelColumnDef[] = [
        { header: 'Customer Name', key: 'customerName', type: 'text', width: 28 },
        { header: 'NIC Number', key: 'nicNumber', type: 'text', width: 18 },
        { header: 'Mobile', key: 'mobileNumber', type: 'text', width: 16 },
        { header: 'Loan Number', key: 'loanNumber', type: 'text', width: 18 },
        { header: 'Frequency', key: 'loanType', type: 'text', width: 14 },
        { header: 'Expected Due Date', key: 'expectedPaymentDate', type: 'date', width: 18 },
        { header: 'Instalment Expected (Rs.)', key: 'expectedAmount', type: 'currency', width: 22 },
        { header: 'Paid Toward Inst. (Rs.)', key: 'amountPaidTowardObligation', type: 'currency', width: 22 },
        { header: 'Overdue Amount (Rs.)', key: 'overdueAmount', type: 'currency', width: 22 },
        { header: 'Days Late', key: 'daysLate', type: 'number', width: 12 },
        { header: 'Remaining Balance (Rs.)', key: 'remainingBalance', type: 'currency', width: 24 },
        { header: 'Remaining Inst.', key: 'remainingInstallments', type: 'number', width: 14 },
        { header: 'Status', key: 'status', type: 'text', width: 14 }
      ];

      const metadata = [
        { label: 'Report Name', value: 'Delayed Payment Report' },
        { label: 'As Of Date', value: this.excelService.getTodayFormatted() },
        { label: 'Severity Filter', value: this.delayedSeverity.toUpperCase() },
        { label: 'Frequency Filter', value: this.delayedLoanType.toUpperCase() },
        { label: 'Search Query', value: this.delayedSearch || 'All' }
      ];

      const summaryItems = [
        { label: 'Total Delayed Obligations', value: this.delayedSummary.totalDelayedObligations },
        { label: 'Total Overdue Amount (Rs.)', value: this.delayedSummary.totalOverdueAmount },
        { label: 'Affected Customers', value: this.delayedSummary.affectedCustomers },
        { label: 'Affected Loans', value: this.delayedSummary.affectedLoans },
        { label: '1–7 Days Late', value: this.delayedSummary.count1To7Days },
        { label: '8–30 Days Late', value: this.delayedSummary.count8To30Days },
        { label: '31+ Days Late', value: this.delayedSummary.count31PlusDays }
      ];

      this.excelService.exportSingleSheetReport({
        filename: `Delayed_Payment_Report_${this.excelService.getTodayFormatted()}.xlsx`,
        sheetName: 'Delayed Payments',
        reportTitle: 'Delayed Payment Report',
        metadata,
        summaryItems,
        columns,
        data: this.delayedRows // FULL filtered dataset
      });
    } catch (e) {
      console.error('Error exporting delayed payments:', e);
      alert('Failed to generate Excel file. Please try again.');
    } finally {
      this.isExporting = false;
    }
  }

  // -------------------------------------------------------------------------
  // Report 03: Collection Report
  // -------------------------------------------------------------------------
  loadCollectionReport(): void {
    this.isLoading = true;
    this.paymentReportService.getCollectionReport({
      search: this.collectionSearch,
      dateFrom: this.collectionDateFrom || undefined,
      dateTo: this.collectionDateTo || undefined,
      loanType: this.collectionLoanType
    }).subscribe({
      next: ({ rows, summary }) => {
        this.collectionRows = rows;
        this.collectionSummary = summary;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading collection report:', err);
        this.errorMessage = 'Unable to generate report. Please try again.';
        this.isLoading = false;
      }
    });
  }

  resetCollectionFilters(): void {
    this.collectionSearch = '';
    this.collectionDateFrom = '';
    this.collectionDateTo = '';
    this.collectionLoanType = 'all';
    this.currentPage = 1;
    this.loadCollectionReport();
  }

  exportCollectionToExcel(): void {
    if (this.collectionRows.length === 0) return;
    this.isExporting = true;

    try {
      const periodStr = (this.collectionDateFrom || this.collectionDateTo)
        ? `${this.collectionDateFrom || 'Start'} to ${this.collectionDateTo || 'End'}`
        : 'All Time';

      const fileSuffix = (this.collectionDateFrom && this.collectionDateTo)
        ? `${this.collectionDateFrom}_${this.collectionDateTo}`
        : this.excelService.getTodayFormatted();

      // Sheet 1: Collection Summary
      const summaryMetadata = [
        { label: 'Report Name', value: 'Collection Report' },
        { label: 'Collection Period', value: periodStr },
        { label: 'Frequency Filter', value: this.collectionLoanType.toUpperCase() },
        { label: 'Search Query', value: this.collectionSearch || 'All' }
      ];

      const summaryRows = [
        { Metric: 'Total Amount Collected (Rs.)', Value: this.collectionSummary.totalCollected },
        { Metric: 'Number of Transactions', Value: this.collectionSummary.transactionCount },
        { Metric: 'Number of Customers Who Paid', Value: this.collectionSummary.customersPaid },
        { Metric: 'Number of Loans Receiving Payments', Value: this.collectionSummary.loansPaid },
        { Metric: 'Average Payment Amount (Rs.)', Value: this.collectionSummary.averagePayment },
        { Metric: 'Daily Loan Collections (Rs.)', Value: this.collectionSummary.dailyCollections },
        { Metric: 'Weekly Loan Collections (Rs.)', Value: this.collectionSummary.weeklyCollections },
        { Metric: 'Monthly Loan Collections (Rs.)', Value: this.collectionSummary.monthlyCollections }
      ];

      const summaryCols: ExcelColumnDef[] = [
        { header: 'Collection Metric', key: 'Metric', type: 'text', width: 34 },
        { header: 'Value / Amount', key: 'Value', type: 'number', width: 24 }
      ];

      // Sheet 2: Payment Details
      const detailCols: ExcelColumnDef[] = [
        { header: 'Payment Date', key: 'paidDate', type: 'date', width: 16 },
        { header: 'Customer Name', key: 'customerName', type: 'text', width: 28 },
        { header: 'NIC Number', key: 'nicNumber', type: 'text', width: 18 },
        { header: 'Mobile', key: 'mobileNumber', type: 'text', width: 16 },
        { header: 'Loan Number', key: 'loanNumber', type: 'text', width: 18 },
        { header: 'Frequency', key: 'loanType', type: 'text', width: 14 },
        { header: 'Amount Paid (Rs.)', key: 'paidAmount', type: 'currency', width: 20 },
        { header: 'Remark', key: 'remark', type: 'text', width: 24 },
        { header: 'Recorded Date', key: 'recordedDate', type: 'date', width: 16 }
      ];

      this.excelService.exportMultiSheetReport({
        filename: `Collection_Report_${fileSuffix}.xlsx`,
        sheets: [
          {
            sheetName: 'Collection Summary',
            sheetTitle: 'Collection Summary & Breakdown',
            metadata: summaryMetadata,
            columns: summaryCols,
            data: summaryRows
          },
          {
            sheetName: 'Payment Details',
            sheetTitle: 'Payment Details',
            columns: detailCols,
            data: this.collectionRows // FULL filtered dataset
          }
        ]
      });
    } catch (e) {
      console.error('Error exporting collection report:', e);
      alert('Failed to generate Excel file. Please try again.');
    } finally {
      this.isExporting = false;
    }
  }

  // -------------------------------------------------------------------------
  // Report 04: Upcoming Payments
  // -------------------------------------------------------------------------
  loadUpcomingPayments(): void {
    this.isLoading = true;
    this.paymentReportService.getUpcomingPaymentsReport({
      quickPeriod: this.upcomingQuickPeriod,
      search: this.upcomingSearch,
      dateFrom: this.upcomingDateFrom || undefined,
      dateTo: this.upcomingDateTo || undefined,
      loanType: this.upcomingLoanType
    }).subscribe({
      next: ({ rows, summary }) => {
        this.upcomingRows = rows;
        this.upcomingSummary = summary;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading upcoming payments:', err);
        this.errorMessage = 'Unable to generate report. Please try again.';
        this.isLoading = false;
      }
    });
  }

  setUpcomingQuickPeriod(period: 'today' | 'this_week' | 'next_week' | 'custom'): void {
    this.upcomingQuickPeriod = period;
    this.currentPage = 1;
    this.loadUpcomingPayments();
  }

  resetUpcomingFilters(): void {
    this.upcomingQuickPeriod = 'this_week';
    this.upcomingSearch = '';
    this.upcomingDateFrom = '';
    this.upcomingDateTo = '';
    this.upcomingLoanType = 'all';
    this.currentPage = 1;
    this.loadUpcomingPayments();
  }

  exportUpcomingPaymentsToExcel(): void {
    if (this.upcomingRows.length === 0) return;
    this.isExporting = true;

    try {
      const columns: ExcelColumnDef[] = [
        { header: 'Expected Due Date', key: 'expectedDate', type: 'date', width: 18 },
        { header: 'Customer Name', key: 'customerName', type: 'text', width: 28 },
        { header: 'NIC Number', key: 'nicNumber', type: 'text', width: 18 },
        { header: 'Mobile', key: 'mobileNumber', type: 'text', width: 16 },
        { header: 'Loan Number', key: 'loanNumber', type: 'text', width: 18 },
        { header: 'Frequency', key: 'loanType', type: 'text', width: 14 },
        { header: 'Expected Amount (Rs.)', key: 'expectedAmount', type: 'currency', width: 22 },
        { header: 'Remaining Balance (Rs.)', key: 'remainingBalance', type: 'currency', width: 24 },
        { header: 'Remaining Inst.', key: 'remainingInstallments', type: 'number', width: 14 },
        { header: 'Status', key: 'status', type: 'text', width: 14 }
      ];

      const periodLabel = this.upcomingQuickPeriod === 'today' ? 'Today'
        : this.upcomingQuickPeriod === 'this_week' ? 'This Week'
        : this.upcomingQuickPeriod === 'next_week' ? 'Next Week'
        : `${this.upcomingDateFrom || 'Start'} to ${this.upcomingDateTo || 'End'}`;

      const metadata = [
        { label: 'Report Name', value: 'Upcoming Payments Report' },
        { label: 'Selected Period', value: periodLabel },
        { label: 'Frequency Filter', value: this.upcomingLoanType.toUpperCase() },
        { label: 'Search Query', value: this.upcomingSearch || 'All' }
      ];

      const summaryItems = [
        { label: 'Expected Payments Count', value: this.upcomingSummary.expectedPaymentCount },
        { label: 'Customers Due', value: this.upcomingSummary.customersDue },
        { label: 'Loans Due', value: this.upcomingSummary.loansDue },
        { label: 'Total Expected Collection (Rs.)', value: this.upcomingSummary.totalExpectedCollection },
        { label: 'Daily Expected (Rs.)', value: this.upcomingSummary.dailyExpected },
        { label: 'Weekly Expected (Rs.)', value: this.upcomingSummary.weeklyExpected },
        { label: 'Monthly Expected (Rs.)', value: this.upcomingSummary.monthlyExpected }
      ];

      this.excelService.exportSingleSheetReport({
        filename: `Upcoming_Payments_Report_${this.excelService.getTodayFormatted()}.xlsx`,
        sheetName: 'Upcoming Payments',
        reportTitle: 'Upcoming Payments Report',
        metadata,
        summaryItems,
        columns,
        data: this.upcomingRows // FULL filtered dataset
      });
    } catch (e) {
      console.error('Error exporting upcoming payments:', e);
      alert('Failed to generate Excel file. Please try again.');
    } finally {
      this.isExporting = false;
    }
  }

  // -------------------------------------------------------------------------
  // Report 05: Payment Performance Report
  // -------------------------------------------------------------------------
  loadPaymentPerformance(): void {
    this.isLoading = true;
    this.paymentReportService.getPaymentPerformanceReport({
      dateFrom: this.performanceDateFrom || undefined,
      dateTo: this.performanceDateTo || undefined,
      loanType: this.performanceLoanType,
      search: this.performanceSearch
    }).subscribe({
      next: (data) => {
        this.performanceData = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading payment performance:', err);
        this.errorMessage = 'Unable to generate report. Please try again.';
        this.isLoading = false;
      }
    });
  }

  resetPerformanceFilters(): void {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const firstDay = new Date(y, m, 1);
    const lastDay = new Date(y, m + 1, 0);
    this.performanceDateFrom = formatLocalIsoDate(firstDay);
    this.performanceDateTo = formatLocalIsoDate(lastDay);
    this.performanceLoanType = 'all';
    this.performanceSearch = '';
    this.currentPage = 1;
    this.loadPaymentPerformance();
  }

  exportPerformanceToExcel(): void {
    if (!this.performanceData) return;
    this.isExporting = true;

    try {
      const summary = this.performanceData.summary;
      const fileSuffix = `${this.performanceDateFrom}_${this.performanceDateTo}`;

      // Sheet 1: Performance Summary
      const summaryMetadata = [
        { label: 'Report Name', value: 'Payment Performance Report' },
        { label: 'Evaluation Period', value: summary.selectedPeriod },
        { label: 'Frequency Filter', value: this.performanceLoanType.toUpperCase() },
        { label: 'Search Query', value: this.performanceSearch || 'All' }
      ];

      const summaryRows = [
        {
          Frequency: 'Overall Portfolio',
          Expected: summary.totalExpected,
          Actual: summary.totalActual,
          Difference: summary.totalDifference,
          Rate: `${summary.overallCollectionRate}%`
        },
        {
          Frequency: 'Daily Loans',
          Expected: summary.daily.expected,
          Actual: summary.daily.actual,
          Difference: summary.daily.difference,
          Rate: `${summary.daily.collectionRate}%`
        },
        {
          Frequency: 'Weekly Loans',
          Expected: summary.weekly.expected,
          Actual: summary.weekly.actual,
          Difference: summary.weekly.difference,
          Rate: `${summary.weekly.collectionRate}%`
        },
        {
          Frequency: 'Monthly Loans',
          Expected: summary.monthly.expected,
          Actual: summary.monthly.actual,
          Difference: summary.monthly.difference,
          Rate: `${summary.monthly.collectionRate}%`
        }
      ];

      const summaryCols: ExcelColumnDef[] = [
        { header: 'Portfolio Segment', key: 'Frequency', type: 'text', width: 22 },
        { header: 'Expected Collection (Rs.)', key: 'Expected', type: 'currency', width: 24 },
        { header: 'Actual Collected (Rs.)', key: 'Actual', type: 'currency', width: 24 },
        { header: 'Difference (Rs.)', key: 'Difference', type: 'currency', width: 20 },
        { header: 'Collection Rate (%)', key: 'Rate', type: 'text', width: 18 }
      ];

      // Sheet 2: Performance Detail (Periodic Rows)
      const detailCols: ExcelColumnDef[] = [
        { header: 'Period / Date', key: 'periodLabel', type: 'date', width: 18 },
        { header: 'Expected Amount (Rs.)', key: 'expectedAmount', type: 'currency', width: 24 },
        { header: 'Actual Collected (Rs.)', key: 'actualCollected', type: 'currency', width: 24 },
        { header: 'Difference (Rs.)', key: 'difference', type: 'currency', width: 20 },
        { header: 'Collection Rate (%)', key: 'collectionRate', type: 'number', width: 18 }
      ];

      // Sheet 3: Payment Details
      const paymentCols: ExcelColumnDef[] = [
        { header: 'Payment Date', key: 'paidDate', type: 'date', width: 16 },
        { header: 'Customer Name', key: 'customerName', type: 'text', width: 28 },
        { header: 'Loan Number', key: 'loanNumber', type: 'text', width: 18 },
        { header: 'Frequency', key: 'loanType', type: 'text', width: 14 },
        { header: 'Amount Paid (Rs.)', key: 'paidAmount', type: 'currency', width: 20 },
        { header: 'Remark', key: 'remark', type: 'text', width: 24 }
      ];

      this.excelService.exportMultiSheetReport({
        filename: `Payment_Performance_Report_${fileSuffix}.xlsx`,
        sheets: [
          {
            sheetName: 'Performance Summary',
            sheetTitle: 'Payment Performance Summary & Breakdown',
            metadata: summaryMetadata,
            columns: summaryCols,
            data: summaryRows
          },
          {
            sheetName: 'Performance Detail',
            sheetTitle: 'Periodic Collection Performance',
            columns: detailCols,
            data: this.performanceData.periodRows
          },
          {
            sheetName: 'Payment Details',
            sheetTitle: 'Actual Payments Received',
            columns: paymentCols,
            data: this.performanceData.paymentRows
          }
        ]
      });
    } catch (e) {
      console.error('Error exporting payment performance:', e);
      alert('Failed to generate Excel file. Please try again.');
    } finally {
      this.isExporting = false;
    }
  }

  // -------------------------------------------------------------------------
  // Pagination Getters
  // -------------------------------------------------------------------------
  get totalRowsForActiveReport(): number {
    switch (this.activeReportType) {
      case 'payment-history': return this.historyRows.length;
      case 'delayed-payments': return this.delayedRows.length;
      case 'collection': return this.collectionRows.length;
      case 'upcoming-payments': return this.upcomingRows.length;
      case 'payment-performance': 
        return this.performanceActiveTab === 'periodic' 
          ? (this.performanceData?.periodRows.length || 0)
          : (this.performanceData?.paymentRows.length || 0);
      default: return 0;
    }
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalRowsForActiveReport / this.pageSize));
  }

  get pageStartIndex(): number {
    if (this.totalRowsForActiveReport === 0) return 0;
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get pageEndIndex(): number {
    return Math.min(this.currentPage * this.pageSize, this.totalRowsForActiveReport);
  }

  setPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
  }

  get paginatedHistoryRows(): PaymentHistoryRow[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.historyRows.slice(start, start + this.pageSize);
  }

  get paginatedDelayedRows(): DelayedPaymentRow[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.delayedRows.slice(start, start + this.pageSize);
  }

  get paginatedCollectionRows(): CollectionRow[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.collectionRows.slice(start, start + this.pageSize);
  }

  get paginatedUpcomingRows(): UpcomingPaymentRow[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.upcomingRows.slice(start, start + this.pageSize);
  }

  get paginatedPerformancePeriodRows(): PerformancePeriodRow[] {
    if (!this.performanceData) return [];
    const start = (this.currentPage - 1) * this.pageSize;
    return this.performanceData.periodRows.slice(start, start + this.pageSize);
  }

  get paginatedPerformancePaymentRows(): PerformancePaymentRow[] {
    if (!this.performanceData) return [];
    const start = (this.currentPage - 1) * this.pageSize;
    return this.performanceData.paymentRows.slice(start, start + this.pageSize);
  }
}
