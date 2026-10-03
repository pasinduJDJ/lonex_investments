import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  CustomerReportService,
  CustomerMasterRow,
  CustomerMasterSummary,
  CustomerLoanSummaryRow,
  CustomerLoanSummaryTotals,
  CustomerStatementData,
  GuarantorReportRow,
  GuarantorReportSummary
} from '../../service/customer-report.service';
import { ExcelExportService, ExcelColumnDef } from '../../service/excel-export.service';
import { Client, LoanManageService } from '../../service/loan-manage.service';

export type ReportType = 'customer-master' | 'loan-summary' | 'statement' | 'guarantor';

@Component({
  selector: 'app-customer-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './customer-reports.component.html',
  styleUrl: './customer-reports.component.css'
})
export class CustomerReportsComponent implements OnInit, OnDestroy {
  activeReportType: ReportType = 'customer-master';

  // Common UI State
  isLoading: boolean = false;
  isExporting: boolean = false;
  errorMessage: string = '';

  // Pagination State
  pageSize: number = 25;
  currentPage: number = 1;
  pageSizeOptions: number[] = [25, 50, 100];

  // Report 01: Customer Master
  masterRows: CustomerMasterRow[] = [];
  masterSummary: CustomerMasterSummary = { totalCustomers: 0, totalMembers: 0, totalNonMembers: 0 };
  masterSearch: string = '';
  masterDateFrom: string = '';
  masterDateTo: string = '';
  masterMembership: 'all' | 'member' | 'non-member' = 'all';

  // Report 02: Customer Loan Summary
  loanSummaryRows: CustomerLoanSummaryRow[] = [];
  loanSummaryTotals: CustomerLoanSummaryTotals = {
    totalCustomersWithLoans: 0,
    totalLoansIssued: 0,
    totalActiveLoans: 0,
    totalCompletedLoans: 0,
    totalAmountDue: 0,
    totalPaid: 0,
    totalRemaining: 0
  };
  loanSummarySearch: string = '';
  loanSummaryDateFrom: string = '';
  loanSummaryDateTo: string = '';
  loanSummaryStatus: 'all' | 'active' | 'completed' | 'overdue' = 'all';

  // Report 03: Customer Statement
  allClientsList: Client[] = [];
  selectedClientId: string = '';
  selectedClientSearchText: string = '';
  statementData: CustomerStatementData | null = null;
  statementDateFrom: string = '';
  statementDateTo: string = '';

  // Report 04: Guarantor Report
  guarantorRows: GuarantorReportRow[] = [];
  guarantorSummary: GuarantorReportSummary = {
    totalRelationships: 0,
    uniqueGuarantors: 0,
    totalGuaranteedBalance: 0,
    activeGuarantees: 0
  };
  guarantorSearch: string = '';
  guarantorDateFrom: string = '';
  guarantorDateTo: string = '';
  guarantorStatus: 'all' | 'active' | 'closed' = 'all';

  private routeSub!: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private reportService: CustomerReportService,
    private excelService: ExcelExportService,
    private loanService: LoanManageService
  ) {}

  ngOnInit(): void {
    // Load clients list for the Customer Statement picker
    this.loadClientsList();

    // Listen to route changes
    this.routeSub = this.route.paramMap.subscribe(params => {
      const typeParam = params.get('type') as ReportType;
      if (typeParam && ['customer-master', 'loan-summary', 'statement', 'guarantor'].includes(typeParam)) {
        this.activeReportType = typeParam;
      } else {
        this.activeReportType = 'customer-master';
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
   * Switches active report type and navigates cleanly
   */
  switchReport(type: ReportType): void {
    if (this.activeReportType === type) return;
    this.activeReportType = type;
    this.currentPage = 1;
    this.router.navigate(['/member/reports', type]);
  }

  /**
   * Loads client records for statement picker
   */
  private loadClientsList(): void {
    this.loanService.getAllClients().subscribe({
      next: (clients) => {
        this.allClientsList = clients || [];
        // If on statement report and no client selected yet, pick the first one
        if (this.activeReportType === 'statement' && !this.selectedClientId && this.allClientsList.length > 0) {
          this.selectedClientId = this.allClientsList[0].client_id;
          this.loadCustomerStatement();
        }
      },
      error: (err) => console.warn('Could not pre-load clients list:', err)
    });
  }

  /**
   * Main dispatch method to load active report data
   */
  loadActiveReport(): void {
    this.errorMessage = '';
    switch (this.activeReportType) {
      case 'customer-master':
        this.loadCustomerMaster();
        break;
      case 'loan-summary':
        this.loadLoanSummary();
        break;
      case 'statement':
        this.loadCustomerStatement();
        break;
      case 'guarantor':
        this.loadGuarantorReport();
        break;
    }
  }

  // -------------------------------------------------------------------------
  // Report 01: Customer Master
  // -------------------------------------------------------------------------
  loadCustomerMaster(): void {
    this.isLoading = true;
    this.reportService.getCustomerMasterReport({
      search: this.masterSearch,
      dateFrom: this.masterDateFrom || undefined,
      dateTo: this.masterDateTo || undefined,
      membership: this.masterMembership
    }).subscribe({
      next: ({ rows, summary }) => {
        this.masterRows = rows;
        this.masterSummary = summary;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading Customer Master report:', err);
        this.errorMessage = 'Unable to generate report. Please try again.';
        this.isLoading = false;
      }
    });
  }

  resetMasterFilters(): void {
    this.masterSearch = '';
    this.masterDateFrom = '';
    this.masterDateTo = '';
    this.masterMembership = 'all';
    this.currentPage = 1;
    this.loadCustomerMaster();
  }

  exportMasterToExcel(): void {
    if (this.masterRows.length === 0) return;
    this.isExporting = true;

    try {
      const columns: ExcelColumnDef[] = [
        { header: 'Member ID', key: 'memberId', type: 'text', width: 14 },
        { header: 'Customer Name', key: 'fullName', type: 'text', width: 28 },
        { header: 'NIC Number', key: 'nicNumber', type: 'text', width: 18 },
        { header: 'Mobile Number', key: 'mobileNumber', type: 'text', width: 18 },
        { header: 'Address', key: 'fullAddress', type: 'text', width: 36 },
        { header: 'Registration Date', key: 'registrationDate', type: 'date', width: 18 },
        { header: 'Status', key: 'membershipStatus', type: 'text', width: 14 },
        { header: 'Group', key: 'groupName', type: 'text', width: 16 }
      ];

      const metadata = [
        { label: 'Report Name', value: 'Customer Master Report' },
        { label: 'Filter Search', value: this.masterSearch || 'All' },
        { label: 'Membership Status', value: this.masterMembership.toUpperCase() },
        { label: 'Date Period', value: (this.masterDateFrom || this.masterDateTo) ? `${this.masterDateFrom || 'Start'} to ${this.masterDateTo || 'End'}` : 'All Time' }
      ];

      const summaryItems = [
        { label: 'Total Customers', value: this.masterSummary.totalCustomers },
        { label: 'Registered Members', value: this.masterSummary.totalMembers },
        { label: 'Non-Members', value: this.masterSummary.totalNonMembers }
      ];

      this.excelService.exportSingleSheetReport({
        filename: this.excelService.generateFilename('Customer_Master_Report'),
        sheetName: 'Customer Master',
        reportTitle: 'Customer Master Report',
        metadata,
        summaryItems,
        columns,
        data: this.masterRows // Exports FULL filtered dataset, not just page slice
      });
    } catch (e) {
      console.error('Error generating Excel file:', e);
      alert('Failed to generate Excel file. Please try again.');
    } finally {
      this.isExporting = false;
    }
  }

  // -------------------------------------------------------------------------
  // Report 02: Customer Loan Summary
  // -------------------------------------------------------------------------
  loadLoanSummary(): void {
    this.isLoading = true;
    this.reportService.getCustomerLoanSummaryReport({
      search: this.loanSummarySearch,
      dateFrom: this.loanSummaryDateFrom || undefined,
      dateTo: this.loanSummaryDateTo || undefined,
      loanStatus: this.loanSummaryStatus
    }).subscribe({
      next: ({ rows, totals }) => {
        this.loanSummaryRows = rows;
        this.loanSummaryTotals = totals;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading Loan Summary report:', err);
        this.errorMessage = 'Unable to generate report. Please try again.';
        this.isLoading = false;
      }
    });
  }

  resetLoanSummaryFilters(): void {
    this.loanSummarySearch = '';
    this.loanSummaryDateFrom = '';
    this.loanSummaryDateTo = '';
    this.loanSummaryStatus = 'all';
    this.currentPage = 1;
    this.loadLoanSummary();
  }

  exportLoanSummaryToExcel(): void {
    if (this.loanSummaryRows.length === 0) return;
    this.isExporting = true;

    try {
      const columns: ExcelColumnDef[] = [
        { header: 'Member ID', key: 'memberId', type: 'text', width: 14 },
        { header: 'Customer Name', key: 'customerName', type: 'text', width: 28 },
        { header: 'NIC Number', key: 'nicNumber', type: 'text', width: 18 },
        { header: 'Mobile Number', key: 'mobileNumber', type: 'text', width: 18 },
        { header: 'Total Loans', key: 'totalLoans', type: 'number', width: 14 },
        { header: 'Active Loans', key: 'activeLoans', type: 'number', width: 14 },
        { header: 'Completed Loans', key: 'completedLoans', type: 'number', width: 16 },
        { header: 'Total Loan Amount (Rs.)', key: 'totalLoanAmount', type: 'currency', width: 24 },
        { header: 'Total Paid (Rs.)', key: 'totalPaid', type: 'currency', width: 20 },
        { header: 'Remaining Balance (Rs.)', key: 'remainingAmount', type: 'currency', width: 24 }
      ];

      const metadata = [
        { label: 'Report Name', value: 'Customer Loan Summary' },
        { label: 'Filter Search', value: this.loanSummarySearch || 'All' },
        { label: 'Loan Status Filter', value: this.loanSummaryStatus.toUpperCase() },
        { label: 'Date Period', value: (this.loanSummaryDateFrom || this.loanSummaryDateTo) ? `${this.loanSummaryDateFrom || 'Start'} to ${this.loanSummaryDateTo || 'End'}` : 'All Time' }
      ];

      const summaryItems = [
        { label: 'Total Customers with Loans', value: this.loanSummaryTotals.totalCustomersWithLoans },
        { label: 'Total Loans Issued', value: this.loanSummaryTotals.totalLoansIssued },
        { label: 'Active Loans', value: this.loanSummaryTotals.totalActiveLoans },
        { label: 'Completed Loans', value: this.loanSummaryTotals.totalCompletedLoans },
        { label: 'Total Loan Amount (Rs.)', value: this.loanSummaryTotals.totalAmountDue },
        { label: 'Total Amount Collected (Rs.)', value: this.loanSummaryTotals.totalPaid },
        { label: 'Total Outstanding Balance (Rs.)', value: this.loanSummaryTotals.totalRemaining }
      ];

      this.excelService.exportSingleSheetReport({
        filename: this.excelService.generateFilename('Customer_Loan_Summary'),
        sheetName: 'Customer Loan Summary',
        reportTitle: 'Customer Loan Summary',
        metadata,
        summaryItems,
        columns,
        data: this.loanSummaryRows // Full filtered dataset
      });
    } catch (e) {
      console.error('Error generating Excel file:', e);
      alert('Failed to generate Excel file. Please try again.');
    } finally {
      this.isExporting = false;
    }
  }

  // -------------------------------------------------------------------------
  // Report 03: Customer Statement
  // -------------------------------------------------------------------------
  onSelectCustomerChange(): void {
    this.statementData = null;
    this.currentPage = 1;
    this.loadCustomerStatement();
  }

  loadCustomerStatement(): void {
    if (!this.selectedClientId) {
      if (this.allClientsList.length > 0) {
        this.selectedClientId = this.allClientsList[0].client_id;
      } else {
        return;
      }
    }

    this.isLoading = true;
    this.reportService.getCustomerStatement({
      clientId: this.selectedClientId,
      dateFrom: this.statementDateFrom || undefined,
      dateTo: this.statementDateTo || undefined
    }).subscribe({
      next: (data) => {
        this.statementData = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading Customer Statement:', err);
        this.errorMessage = 'Unable to generate statement. Please check customer selection.';
        this.isLoading = false;
      }
    });
  }

  resetStatementFilters(): void {
    this.statementDateFrom = '';
    this.statementDateTo = '';
    this.loadCustomerStatement();
  }

  exportStatementToExcel(): void {
    if (!this.statementData) return;
    this.isExporting = true;

    try {
      const client = this.statementData;

      // 1. Customer Summary Sheet
      const summaryColumns: ExcelColumnDef[] = [
        { header: 'Attribute', key: 'attribute', type: 'text', width: 28 },
        { header: 'Detail / Value', key: 'value', type: 'text', width: 38 }
      ];

      const summaryData = [
        { attribute: 'Customer Name', value: client.fullName },
        { attribute: 'Member ID', value: client.memberId },
        { attribute: 'NIC Number', value: client.nicNumber },
        { attribute: 'Mobile Number', value: client.mobileNumber },
        { attribute: 'Address', value: client.address },
        { attribute: 'Statement Date', value: this.excelService.getTodayFormatted() },
        { attribute: 'Payment History Period', value: (this.statementDateFrom || this.statementDateTo) ? `${this.statementDateFrom || 'Start'} to ${this.statementDateTo || 'End'}` : 'All Time' },
        { attribute: 'Total Loans Taken', value: client.summary.totalLoans },
        { attribute: 'Active Loans', value: client.summary.activeLoans },
        { attribute: 'Completed Loans', value: client.summary.completedLoans },
        { attribute: 'Total Amount Due (Rs.)', value: client.summary.totalAmountDue },
        { attribute: 'Total Repayments Made (Rs.)', value: client.summary.totalPaid },
        { attribute: 'Outstanding Balance (Rs.)', value: client.summary.totalRemaining }
      ];

      // 2. Loans Sheet
      const loanColumns: ExcelColumnDef[] = [
        { header: 'Loan Number', key: 'loanNumber', type: 'text', width: 18 },
        { header: 'Start Date', key: 'startDate', type: 'date', width: 16 },
        { header: 'End Date', key: 'endDate', type: 'date', width: 16 },
        { header: 'Repayment Type', key: 'loanType', type: 'text', width: 18 },
        { header: 'Principal (Rs.)', key: 'principalAmount', type: 'currency', width: 18 },
        { header: 'Interest Rate (%)', key: 'interestRate', type: 'number', width: 16 },
        { header: 'Document Charge (Rs.)', key: 'documentCharge', type: 'currency', width: 20 },
        { header: 'Total Due (Rs.)', key: 'totalAmountDue', type: 'currency', width: 18 },
        { header: 'Paid (Rs.)', key: 'totalPaid', type: 'currency', width: 18 },
        { header: 'Remaining (Rs.)', key: 'remainingAmount', type: 'currency', width: 18 },
        { header: 'Status', key: 'status', type: 'text', width: 14 }
      ];

      // 3. Payments Sheet
      const paymentColumns: ExcelColumnDef[] = [
        { header: 'Payment Date', key: 'paidDate', type: 'date', width: 16 },
        { header: 'Loan Number', key: 'loanNumber', type: 'text', width: 18 },
        { header: 'Amount (Rs.)', key: 'amount', type: 'currency', width: 18 },
        { header: 'Remark / Method', key: 'remark', type: 'text', width: 28 }
      ];

      this.excelService.exportMultiSheetReport({
        filename: this.excelService.generateFilename('Customer_Statement', client.nicNumber || client.fullName),
        sheets: [
          {
            sheetName: 'Customer Summary',
            sheetTitle: `Customer Statement - ${client.fullName}`,
            metadata: [
              { label: 'Customer', value: client.fullName },
              { label: 'NIC', value: client.nicNumber },
              { label: 'Generated Date', value: this.excelService.getTodayFormatted() }
            ],
            columns: summaryColumns,
            data: summaryData
          },
          {
            sheetName: 'Loans',
            sheetTitle: `Loan Accounts - ${client.fullName}`,
            metadata: [
              { label: 'Customer', value: client.fullName },
              { label: 'NIC', value: client.nicNumber }
            ],
            columns: loanColumns,
            data: client.loans
          },
          {
            sheetName: 'Payments',
            sheetTitle: `Repayment Transactions - ${client.fullName}`,
            metadata: [
              { label: 'Customer', value: client.fullName },
              { label: 'Period Filter', value: (this.statementDateFrom || this.statementDateTo) ? `${this.statementDateFrom || 'Start'} to ${this.statementDateTo || 'End'}` : 'All' }
            ],
            columns: paymentColumns,
            data: client.payments
          }
        ]
      });
    } catch (e) {
      console.error('Error exporting statement to Excel:', e);
      alert('Failed to generate Customer Statement Excel.');
    } finally {
      this.isExporting = false;
    }
  }

  // -------------------------------------------------------------------------
  // Report 04: Guarantor Report
  // -------------------------------------------------------------------------
  loadGuarantorReport(): void {
    this.isLoading = true;
    this.reportService.getGuarantorReport({
      search: this.guarantorSearch,
      dateFrom: this.guarantorDateFrom || undefined,
      dateTo: this.guarantorDateTo || undefined,
      loanStatus: this.guarantorStatus
    }).subscribe({
      next: ({ rows, summary }) => {
        this.guarantorRows = rows;
        this.guarantorSummary = summary;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading Guarantor report:', err);
        this.errorMessage = 'Unable to generate report. Please try again.';
        this.isLoading = false;
      }
    });
  }

  resetGuarantorFilters(): void {
    this.guarantorSearch = '';
    this.guarantorDateFrom = '';
    this.guarantorDateTo = '';
    this.guarantorStatus = 'all';
    this.currentPage = 1;
    this.loadGuarantorReport();
  }

  exportGuarantorToExcel(): void {
    if (this.guarantorRows.length === 0) return;
    this.isExporting = true;

    try {
      const columns: ExcelColumnDef[] = [
        { header: 'Guarantor Name', key: 'guarantorName', type: 'text', width: 26 },
        { header: 'Guarantor NIC', key: 'guarantorNic', type: 'text', width: 18 },
        { header: 'Guarantor Mobile', key: 'guarantorMobile', type: 'text', width: 18 },
        { header: 'Guarantor Member ID', key: 'guarantorMemberId', type: 'text', width: 20 },
        { header: 'Borrower Name', key: 'borrowerName', type: 'text', width: 26 },
        { header: 'Borrower NIC', key: 'borrowerNic', type: 'text', width: 18 },
        { header: 'Borrower Mobile', key: 'borrowerMobile', type: 'text', width: 18 },
        { header: 'Loan Number', key: 'loanNumber', type: 'text', width: 18 },
        { header: 'Loan Date', key: 'loanDate', type: 'date', width: 16 },
        { header: 'Type', key: 'loanType', type: 'text', width: 14 },
        { header: 'Loan Amount (Rs.)', key: 'loanAmount', type: 'currency', width: 20 },
        { header: 'Remaining Balance (Rs.)', key: 'remainingAmount', type: 'currency', width: 22 },
        { header: 'Status', key: 'loanStatus', type: 'text', width: 14 }
      ];

      const metadata = [
        { label: 'Report Name', value: 'Guarantor Report' },
        { label: 'Filter Search', value: this.guarantorSearch || 'All' },
        { label: 'Loan Status Filter', value: this.guarantorStatus.toUpperCase() },
        { label: 'Date Period', value: (this.guarantorDateFrom || this.guarantorDateTo) ? `${this.guarantorDateFrom || 'Start'} to ${this.guarantorDateTo || 'End'}` : 'All Time' }
      ];

      const summaryItems = [
        { label: 'Total Guarantor Relationships', value: this.guarantorSummary.totalRelationships },
        { label: 'Unique Guarantors', value: this.guarantorSummary.uniqueGuarantors },
        { label: 'Active Guarantees', value: this.guarantorSummary.activeGuarantees },
        { label: 'Total Guaranteed Balance (Rs.)', value: this.guarantorSummary.totalGuaranteedBalance }
      ];

      this.excelService.exportSingleSheetReport({
        filename: this.excelService.generateFilename('Guarantor_Report'),
        sheetName: 'Guarantor Report',
        reportTitle: 'Guarantor Report',
        metadata,
        summaryItems,
        columns,
        data: this.guarantorRows // Full filtered dataset
      });
    } catch (e) {
      console.error('Error generating Excel file:', e);
      alert('Failed to generate Excel file. Please try again.');
    } finally {
      this.isExporting = false;
    }
  }

  // -------------------------------------------------------------------------
  // Pagination Helpers
  // -------------------------------------------------------------------------
  get totalItems(): number {
    switch (this.activeReportType) {
      case 'customer-master':
        return this.masterRows.length;
      case 'loan-summary':
        return this.loanSummaryRows.length;
      case 'guarantor':
        return this.guarantorRows.length;
      default:
        return 0;
    }
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalItems / this.pageSize));
  }

  get paginatedMasterRows(): CustomerMasterRow[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.masterRows.slice(start, start + this.pageSize);
  }

  get paginatedLoanSummaryRows(): CustomerLoanSummaryRow[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.loanSummaryRows.slice(start, start + this.pageSize);
  }

  get paginatedGuarantorRows(): GuarantorReportRow[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.guarantorRows.slice(start, start + this.pageSize);
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
