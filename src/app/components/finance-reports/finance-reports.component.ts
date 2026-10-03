import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { 
  FinanceReportService,
  AccountHistoryRow,
  AccountHistorySummary,
  TransactionHistoryRow,
  TransactionHistorySummary,
  IncomeRow,
  ExpenseRow,
  IncomeExpenseSummary,
  CapitalRow,
  CapitalSummary,
  ExpenseReportRow,
  ExpenseReportSummary,
  CashMovementRow,
  CashMovementSummary
} from '../../service/finance-report.service';
import { ExcelExportService, ExcelColumnDef } from '../../service/excel-export.service';

export type FinanceReportType = 
  | 'account-history'
  | 'transaction-history'
  | 'income-expense'
  | 'capital-history'
  | 'expense'
  | 'cash-movement';

@Component({
  selector: 'app-finance-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './finance-reports.component.html',
  styleUrl: './finance-reports.component.css'
})
export class FinanceReportsComponent implements OnInit, OnDestroy {
  activeReportType: FinanceReportType = 'account-history';
  isLoading: boolean = false;
  isExporting: boolean = false;
  errorMessage: string = '';

  // Pagination Controls
  currentPage: number = 1;
  pageSize: number = 25;
  pageSizeOptions: number[] = [25, 50, 100];

  // =========================================================================
  // Report 01: Account History State
  // =========================================================================
  accountRows: AccountHistoryRow[] = [];
  accountSummary: AccountHistorySummary = {
    accountName: 'Bank Capital',
    currentBalance: 0,
    totalMoneyIn: 0,
    totalMoneyOut: 0,
    netMovement: 0,
    transactionCount: 0,
    limitationNote: ''
  };
  accountFilter: 'BANK_CAPITAL' | 'ASSETS_CASH' = 'BANK_CAPITAL';
  accountTxTypeFilter: string = 'all';
  accountDateFrom: string = '';
  accountDateTo: string = '';
  accountSearch: string = '';

  // =========================================================================
  // Report 02: Transaction History State
  // =========================================================================
  txRows: TransactionHistoryRow[] = [];
  txSummary: TransactionHistorySummary = {
    totalTransactions: 0,
    totalMoneyIn: 0,
    totalMoneyOut: 0,
    netMovement: 0,
    internalTransfersCount: 0,
    internalTransfersVolume: 0
  };
  txTypeFilter: string = 'all';
  txAccountFilter: string = 'all';
  txDateFrom: string = '';
  txDateTo: string = '';
  txSearch: string = '';

  // =========================================================================
  // Report 03: Income & Expense State
  // =========================================================================
  incomeRows: IncomeRow[] = [];
  expenseRows: ExpenseRow[] = [];
  ieSummary: IncomeExpenseSummary = {
    totalIncome: 0,
    totalExpenses: 0,
    netProfit: 0,
    totalRepaymentsCollected: 0,
    closedLoansCount: 0,
    expensesCount: 0
  };
  ieDateFrom: string = '';
  ieDateTo: string = '';
  ieSearch: string = '';
  ieActiveTab: 'income' | 'expenses' = 'income';

  // =========================================================================
  // Report 04: Capital History State
  // =========================================================================
  capitalRows: CapitalRow[] = [];
  capitalSummary: CapitalSummary = {
    totalCapitalDeposited: 0,
    bankCapitalDeposits: 0,
    assetsCashDeposits: 0,
    depositCount: 0
  };
  capDateFrom: string = '';
  capDateTo: string = '';
  capAccountFilter: string = 'all';
  capSearch: string = '';

  // =========================================================================
  // Report 05: Expense Report State
  // =========================================================================
  expenseReportRows: ExpenseReportRow[] = [];
  expenseReportSummary: ExpenseReportSummary = {
    totalExpenses: 0,
    bankCapitalExpenses: 0,
    assetsCashExpenses: 0,
    expenseCount: 0
  };
  expDateFrom: string = '';
  expDateTo: string = '';
  expAccountFilter: string = 'all';
  expSearch: string = '';

  // =========================================================================
  // Report 06: Cash / Account Movement State
  // =========================================================================
  cmRows: CashMovementRow[] = [];
  cmSummary: CashMovementSummary = {
    bankCapitalIn: 0,
    bankCapitalOut: 0,
    bankCapitalNet: 0,
    assetsCashIn: 0,
    assetsCashOut: 0,
    assetsCashNet: 0,
    companyExternalIn: 0,
    companyExternalOut: 0,
    companyExternalNet: 0,
    internalTransfersVolume: 0
  };
  cmDateFrom: string = '';
  cmDateTo: string = '';
  cmAccountFilter: string = 'all';
  cmMovementFilter: 'all' | 'in' | 'out' = 'all';
  cmTxTypeFilter: string = 'all';
  cmSearch: string = '';

  private routeSub!: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private financeReportService: FinanceReportService,
    private excelService: ExcelExportService
  ) {}

  ngOnInit(): void {
    this.routeSub = this.route.params.subscribe(params => {
      const type = params['type'] as FinanceReportType;
      if (type && this.isValidReportType(type)) {
        this.activeReportType = type;
      } else {
        this.activeReportType = 'account-history';
      }
      this.currentPage = 1;
      this.loadActiveReport();
    });
  }

  ngOnDestroy(): void {
    if (this.routeSub) {
      this.routeSub.unsubscribe();
    }
  }

  private isValidReportType(type: string): type is FinanceReportType {
    return [
      'account-history',
      'transaction-history',
      'income-expense',
      'capital-history',
      'expense',
      'cash-movement'
    ].includes(type);
  }

  switchReportType(type: FinanceReportType): void {
    if (this.activeReportType === type) return;
    this.router.navigate(['/finance/reports', type]);
  }

  loadActiveReport(): void {
    this.isLoading = true;
    this.errorMessage = '';

    switch (this.activeReportType) {
      case 'account-history':
        this.loadAccountHistory();
        break;
      case 'transaction-history':
        this.loadTransactionHistory();
        break;
      case 'income-expense':
        this.loadIncomeExpense();
        break;
      case 'capital-history':
        this.loadCapitalHistory();
        break;
      case 'expense':
        this.loadExpenseReport();
        break;
      case 'cash-movement':
        this.loadCashMovement();
        break;
    }
  }

  // 1. Account History
  private loadAccountHistory(): void {
    this.financeReportService.getAccountHistoryReport({
      account: this.accountFilter,
      dateFrom: this.accountDateFrom || undefined,
      dateTo: this.accountDateTo || undefined,
      transactionType: this.accountTxTypeFilter,
      search: this.accountSearch || undefined
    }).subscribe({
      next: res => {
        this.accountRows = res.rows;
        this.accountSummary = res.summary;
        this.isLoading = false;
      },
      error: err => {
        this.errorMessage = 'Failed to load Account History Report. Please try again.';
        this.isLoading = false;
      }
    });
  }

  // 2. Transaction History
  private loadTransactionHistory(): void {
    this.financeReportService.getTransactionHistoryReport({
      dateFrom: this.txDateFrom || undefined,
      dateTo: this.txDateTo || undefined,
      transactionType: this.txTypeFilter,
      account: this.txAccountFilter,
      search: this.txSearch || undefined
    }).subscribe({
      next: res => {
        this.txRows = res.rows;
        this.txSummary = res.summary;
        this.isLoading = false;
      },
      error: err => {
        this.errorMessage = 'Failed to load Transaction History Report. Please try again.';
        this.isLoading = false;
      }
    });
  }

  // 3. Income & Expense
  private loadIncomeExpense(): void {
    this.financeReportService.getIncomeExpenseReport({
      dateFrom: this.ieDateFrom || undefined,
      dateTo: this.ieDateTo || undefined,
      search: this.ieSearch || undefined
    }).subscribe({
      next: res => {
        this.incomeRows = res.incomeRows;
        this.expenseRows = res.expenseRows;
        this.ieSummary = res.summary;
        this.isLoading = false;
      },
      error: err => {
        this.errorMessage = 'Failed to load Income & Expense Report. Please try again.';
        this.isLoading = false;
      }
    });
  }

  // 4. Capital History
  private loadCapitalHistory(): void {
    this.financeReportService.getCapitalHistoryReport({
      dateFrom: this.capDateFrom || undefined,
      dateTo: this.capDateTo || undefined,
      destinationAccount: this.capAccountFilter,
      search: this.capSearch || undefined
    }).subscribe({
      next: res => {
        this.capitalRows = res.rows;
        this.capitalSummary = res.summary;
        this.isLoading = false;
      },
      error: err => {
        this.errorMessage = 'Failed to load Capital History Report. Please try again.';
        this.isLoading = false;
      }
    });
  }

  // 5. Expense Report
  private loadExpenseReport(): void {
    this.financeReportService.getExpenseReport({
      dateFrom: this.expDateFrom || undefined,
      dateTo: this.expDateTo || undefined,
      paidFromAccount: this.expAccountFilter,
      search: this.expSearch || undefined
    }).subscribe({
      next: res => {
        this.expenseReportRows = res.rows;
        this.expenseReportSummary = res.summary;
        this.isLoading = false;
      },
      error: err => {
        this.errorMessage = 'Failed to load Expense Report. Please try again.';
        this.isLoading = false;
      }
    });
  }

  // 6. Cash Movement
  private loadCashMovement(): void {
    this.financeReportService.getCashMovementReport({
      dateFrom: this.cmDateFrom || undefined,
      dateTo: this.cmDateTo || undefined,
      account: this.cmAccountFilter,
      movement: this.cmMovementFilter,
      transactionType: this.cmTxTypeFilter,
      search: this.cmSearch || undefined
    }).subscribe({
      next: res => {
        this.cmRows = res.rows;
        this.cmSummary = res.summary;
        this.isLoading = false;
      },
      error: err => {
        this.errorMessage = 'Failed to load Cash Movement Report. Please try again.';
        this.isLoading = false;
      }
    });
  }

  // =========================================================================
  // Filter Reset Handlers
  // =========================================================================
  resetFilters(): void {
    this.currentPage = 1;
    switch (this.activeReportType) {
      case 'account-history':
        this.accountFilter = 'BANK_CAPITAL';
        this.accountTxTypeFilter = 'all';
        this.accountDateFrom = '';
        this.accountDateTo = '';
        this.accountSearch = '';
        break;
      case 'transaction-history':
        this.txTypeFilter = 'all';
        this.txAccountFilter = 'all';
        this.txDateFrom = '';
        this.txDateTo = '';
        this.txSearch = '';
        break;
      case 'income-expense':
        this.ieDateFrom = '';
        this.ieDateTo = '';
        this.ieSearch = '';
        break;
      case 'capital-history':
        this.capAccountFilter = 'all';
        this.capDateFrom = '';
        this.capDateTo = '';
        this.capSearch = '';
        break;
      case 'expense':
        this.expAccountFilter = 'all';
        this.expDateFrom = '';
        this.expDateTo = '';
        this.expSearch = '';
        break;
      case 'cash-movement':
        this.cmAccountFilter = 'all';
        this.cmMovementFilter = 'all';
        this.cmTxTypeFilter = 'all';
        this.cmDateFrom = '';
        this.cmDateTo = '';
        this.cmSearch = '';
        break;
    }
    this.loadActiveReport();
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadActiveReport();
  }

  // =========================================================================
  // Pagination Helpers
  // =========================================================================
  getActiveRowCount(): number {
    switch (this.activeReportType) {
      case 'account-history': return this.accountRows.length;
      case 'transaction-history': return this.txRows.length;
      case 'income-expense': return this.ieActiveTab === 'income' ? this.incomeRows.length : this.expenseRows.length;
      case 'capital-history': return this.capitalRows.length;
      case 'expense': return this.expenseReportRows.length;
      case 'cash-movement': return this.cmRows.length;
      default: return 0;
    }
  }

  getTotalPages(): number {
    const total = this.getActiveRowCount();
    return Math.max(1, Math.ceil(total / this.pageSize));
  }

  getPaginatedItems<T>(items: T[]): T[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return items.slice(start, start + this.pageSize);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.getTotalPages()) {
      this.currentPage = page;
    }
  }

  // =========================================================================
  // Excel Export
  // =========================================================================
  exportReportToExcel(): void {
    this.isExporting = true;
    try {
      switch (this.activeReportType) {
        case 'account-history':
          this.exportAccountHistoryExcel();
          break;
        case 'transaction-history':
          this.exportTransactionHistoryExcel();
          break;
        case 'income-expense':
          this.exportIncomeExpenseExcel();
          break;
        case 'capital-history':
          this.exportCapitalHistoryExcel();
          break;
        case 'expense':
          this.exportExpenseExcel();
          break;
        case 'cash-movement':
          this.exportCashMovementExcel();
          break;
      }
    } finally {
      this.isExporting = false;
    }
  }

  // 1. Export Account History (Multi-sheet: Summary + Transactions)
  private exportAccountHistoryExcel(): void {
    const accLabel = this.accountFilter === 'BANK_CAPITAL' ? 'Bank_Capital' : 'Assets_Cash';
    const fromStr = this.accountDateFrom || 'All';
    const toStr = this.accountDateTo || 'All';
    const filename = `Account_History_${accLabel}_${fromStr}_${toStr}.xlsx`;

    const summaryColumns: ExcelColumnDef[] = [
      { header: 'Metric', key: 'metric', width: 28, type: 'text' },
      { header: 'Value', key: 'value', width: 28, type: 'text' }
    ];

    const summaryData = [
      { metric: 'Account Name', value: this.accountSummary.accountName },
      { metric: 'Selected Period', value: `${fromStr} to ${toStr}` },
      { metric: 'Authoritative Current Balance', value: this.accountSummary.currentBalance.toFixed(2) },
      { metric: 'Total Money In', value: this.accountSummary.totalMoneyIn.toFixed(2) },
      { metric: 'Total Money Out', value: this.accountSummary.totalMoneyOut.toFixed(2) },
      { metric: 'Net Movement', value: this.accountSummary.netMovement.toFixed(2) },
      { metric: 'Total Transactions', value: this.accountSummary.transactionCount.toString() },
      { metric: 'Financial Integrity Note', value: this.accountSummary.limitationNote }
    ];

    const txColumns: ExcelColumnDef[] = [
      { header: 'Date', key: 'date', width: 14, type: 'date' },
      { header: 'Reference', key: 'reference', width: 18, type: 'text' },
      { header: 'Transaction Type', key: 'type', width: 20, type: 'text' },
      { header: 'Description', key: 'description', width: 35, type: 'text' },
      { header: 'Money In', key: 'moneyIn', width: 16, type: 'number' },
      { header: 'Money Out', key: 'moneyOut', width: 16, type: 'number' },
      { header: 'Status', key: 'status', width: 14, type: 'text' },
      { header: 'Related Loan', key: 'relatedLoanNumber', width: 18, type: 'text' }
    ];

    const txData = this.accountRows.map(r => ({
      date: r.date,
      reference: r.reference,
      type: r.type,
      description: r.description,
      moneyIn: r.moneyIn !== null ? r.moneyIn : 0,
      moneyOut: r.moneyOut !== null ? r.moneyOut : 0,
      status: r.status,
      relatedLoanNumber: r.relatedLoanNumber || '-'
    }));

    this.excelService.exportMultiSheetReport({
      filename,
      sheets: [
        {
          sheetName: 'Account Summary',
          sheetTitle: `LONEX INVESTMENTS - ${this.accountSummary.accountName} Summary`,
          metadata: [
            { label: 'Report Generated', value: this.excelService.getTodayFormatted() },
            { label: 'Account', value: this.accountSummary.accountName },
            { label: 'Current Authoritative Balance', value: this.accountSummary.currentBalance.toFixed(2) }
          ],
          columns: summaryColumns,
          data: summaryData
        },
        {
          sheetName: 'Account Transactions',
          sheetTitle: `${this.accountSummary.accountName} - Detailed Movements`,
          metadata: [
            { label: 'Account', value: this.accountSummary.accountName },
            { label: 'Period', value: `${fromStr} to ${toStr}` },
            { label: 'Record Count', value: this.accountRows.length }
          ],
          columns: txColumns,
          data: txData,
          summaryItems: [
            { label: 'Total Money In', value: this.accountSummary.totalMoneyIn.toFixed(2) },
            { label: 'Total Money Out', value: this.accountSummary.totalMoneyOut.toFixed(2) },
            { label: 'Net Movement', value: this.accountSummary.netMovement.toFixed(2) }
          ]
        }
      ]
    });
  }

  // 2. Export Transaction History (Single sheet: Transactions)
  private exportTransactionHistoryExcel(): void {
    const fromStr = this.txDateFrom || 'All';
    const toStr = this.txDateTo || 'All';
    const filename = `Finance_Transaction_History_${fromStr}_${toStr}.xlsx`;

    const columns: ExcelColumnDef[] = [
      { header: 'Date', key: 'date', width: 14, type: 'date' },
      { header: 'Reference', key: 'reference', width: 18, type: 'text' },
      { header: 'Type', key: 'type', width: 20, type: 'text' },
      { header: 'Description', key: 'description', width: 35, type: 'text' },
      { header: 'Account / Route', key: 'sourceAccount', width: 25, type: 'text' },
      { header: 'Money In', key: 'moneyIn', width: 16, type: 'number' },
      { header: 'Money Out', key: 'moneyOut', width: 16, type: 'number' },
      { header: 'Internal Transfer', key: 'isInternalTransfer', width: 18, type: 'text' },
      { header: 'Status', key: 'status', width: 14, type: 'text' },
      { header: 'Related Loan', key: 'relatedLoanNumber', width: 18, type: 'text' }
    ];

    const data = this.txRows.map(r => ({
      date: r.date,
      reference: r.reference,
      type: r.type,
      description: r.description,
      sourceAccount: r.sourceAccount,
      moneyIn: r.moneyIn !== null ? r.moneyIn : 0,
      moneyOut: r.moneyOut !== null ? r.moneyOut : 0,
      isInternalTransfer: r.isInternalTransfer ? 'Yes' : 'No',
      status: r.status,
      relatedLoanNumber: r.relatedLoanNumber || '-'
    }));

    this.excelService.exportSingleSheetReport({
      filename,
      sheetName: 'Transactions',
      reportTitle: 'LONEX INVESTMENTS - Central Finance Transaction Ledger',
      metadata: [
        { label: 'Generated Date', value: this.excelService.getTodayFormatted() },
        { label: 'Period', value: `${fromStr} to ${toStr}` },
        { label: 'Filter Type', value: this.txTypeFilter },
        { label: 'Total Records', value: this.txRows.length }
      ],
      columns,
      data,
      summaryItems: [
        { label: 'Total External Money In', value: this.txSummary.totalMoneyIn.toFixed(2) },
        { label: 'Total External Money Out', value: this.txSummary.totalMoneyOut.toFixed(2) },
        { label: 'Company Net Movement', value: this.txSummary.netMovement.toFixed(2) },
        { label: 'Internal Transfers Vol', value: this.txSummary.internalTransfersVolume.toFixed(2) }
      ]
    });
  }

  // 3. Export Income & Expense (Multi-sheet: Summary + Income + Expenses)
  private exportIncomeExpenseExcel(): void {
    const fromStr = this.ieDateFrom || 'All';
    const toStr = this.ieDateTo || 'All';
    const filename = `Income_Expense_Report_${fromStr}_${toStr}.xlsx`;

    const summaryColumns: ExcelColumnDef[] = [
      { header: 'Financial Dimension', key: 'dimension', width: 32, type: 'text' },
      { header: 'Amount (LKR)', key: 'amount', width: 22, type: 'text' }
    ];

    const summaryData = [
      { dimension: 'Total Recognized Income (Realized Profit)', amount: this.ieSummary.totalIncome.toFixed(2) },
      { dimension: 'Total Operating Expenses', amount: this.ieSummary.totalExpenses.toFixed(2) },
      { dimension: 'Net Business Profit', amount: this.ieSummary.netProfit.toFixed(2) },
      { dimension: 'Total Cash Repayments Collected', amount: this.ieSummary.totalRepaymentsCollected.toFixed(2) },
      { dimension: 'Closed Loans Generating Profit', amount: this.ieSummary.closedLoansCount.toString() },
      { dimension: 'Operating Expenses Incurred', amount: this.ieSummary.expensesCount.toString() }
    ];

    const incomeColumns: ExcelColumnDef[] = [
      { header: 'Date', key: 'date', width: 14, type: 'date' },
      { header: 'Loan Number', key: 'reference', width: 18, type: 'text' },
      { header: 'Customer', key: 'customerName', width: 28, type: 'text' },
      { header: 'Principal Amount', key: 'principalAmount', width: 18, type: 'number' },
      { header: 'Document Charge', key: 'documentCharge', width: 16, type: 'number' },
      { header: 'Total Collected', key: 'totalPaid', width: 18, type: 'number' },
      { header: 'Realized Profit', key: 'realizedProfit', width: 18, type: 'number' },
      { header: 'Status', key: 'status', width: 14, type: 'text' }
    ];

    const incomeData = this.incomeRows.map(r => ({
      date: r.date,
      reference: r.reference,
      customerName: r.customerName,
      principalAmount: r.principalAmount,
      documentCharge: r.documentCharge,
      totalPaid: r.totalPaid,
      realizedProfit: r.realizedProfit,
      status: r.status
    }));

    const expenseColumns: ExcelColumnDef[] = [
      { header: 'Date', key: 'date', width: 14, type: 'date' },
      { header: 'Reference', key: 'reference', width: 18, type: 'text' },
      { header: 'Description / Remark', key: 'description', width: 35, type: 'text' },
      { header: 'Paid From Account', key: 'paidFromAccount', width: 20, type: 'text' },
      { header: 'Amount', key: 'amount', width: 18, type: 'number' }
    ];

    const expenseData = this.expenseRows.map(r => ({
      date: r.date,
      reference: r.reference,
      description: r.description,
      paidFromAccount: r.paidFromAccount,
      amount: r.amount
    }));

    this.excelService.exportMultiSheetReport({
      filename,
      sheets: [
        {
          sheetName: 'Summary',
          sheetTitle: 'LONEX INVESTMENTS - Financial Performance & P&L Summary',
          metadata: [
            { label: 'Generated Date', value: this.excelService.getTodayFormatted() },
            { label: 'Reporting Period', value: `${fromStr} to ${toStr}` },
            { label: 'Net Profit', value: this.ieSummary.netProfit.toFixed(2) }
          ],
          columns: summaryColumns,
          data: summaryData
        },
        {
          sheetName: 'Income',
          sheetTitle: 'Realized Loan Income (Closed Loans)',
          metadata: [
            { label: 'Period', value: `${fromStr} to ${toStr}` },
            { label: 'Closed Loans', value: this.incomeRows.length },
            { label: 'Total Recognized Income', value: this.ieSummary.totalIncome.toFixed(2) }
          ],
          columns: incomeColumns,
          data: incomeData,
          summaryItems: [
            { label: 'Total Realized Income', value: this.ieSummary.totalIncome.toFixed(2) }
          ]
        },
        {
          sheetName: 'Expenses',
          sheetTitle: 'Operating Expenses Incurred',
          metadata: [
            { label: 'Period', value: `${fromStr} to ${toStr}` },
            { label: 'Expenses Count', value: this.expenseRows.length },
            { label: 'Total Expenses', value: this.ieSummary.totalExpenses.toFixed(2) }
          ],
          columns: expenseColumns,
          data: expenseData,
          summaryItems: [
            { label: 'Total Operating Expenses', value: this.ieSummary.totalExpenses.toFixed(2) }
          ]
        }
      ]
    });
  }

  // 4. Export Capital History (Multi-sheet: Capital Summary + Capital Deposits)
  private exportCapitalHistoryExcel(): void {
    const fromStr = this.capDateFrom || 'All';
    const toStr = this.capDateTo || 'All';
    const filename = `Capital_History_Report_${fromStr}_${toStr}.xlsx`;

    const summaryColumns: ExcelColumnDef[] = [
      { header: 'Account / Metric', key: 'metric', width: 28, type: 'text' },
      { header: 'Capital Inflow (LKR)', key: 'amount', width: 24, type: 'text' }
    ];

    const summaryData = [
      { metric: 'Total Capital Deposited', amount: this.capitalSummary.totalCapitalDeposited.toFixed(2) },
      { metric: 'Bank Capital Deposits', amount: this.capitalSummary.bankCapitalDeposits.toFixed(2) },
      { metric: 'Assets / Cash Deposits', amount: this.capitalSummary.assetsCashDeposits.toFixed(2) },
      { metric: 'Total Deposit Records', amount: this.capitalSummary.depositCount.toString() },
      { metric: 'Financial Accounting Rule', amount: 'Capital additions increase account liquidity and do NOT constitute P&L business income.' }
    ];

    const depositColumns: ExcelColumnDef[] = [
      { header: 'Date', key: 'date', width: 14, type: 'date' },
      { header: 'Reference', key: 'reference', width: 18, type: 'text' },
      { header: 'Destination Account', key: 'destinationAccount', width: 22, type: 'text' },
      { header: 'Amount', key: 'amount', width: 18, type: 'number' },
      { header: 'Remark / Description', key: 'remark', width: 35, type: 'text' }
    ];

    const depositData = this.capitalRows.map(r => ({
      date: r.date,
      reference: r.reference,
      destinationAccount: r.destinationAccount,
      amount: r.amount,
      remark: r.remark
    }));

    this.excelService.exportMultiSheetReport({
      filename,
      sheets: [
        {
          sheetName: 'Capital Summary',
          sheetTitle: 'LONEX INVESTMENTS - Capital Inflows Summary',
          metadata: [
            { label: 'Generated Date', value: this.excelService.getTodayFormatted() },
            { label: 'Period', value: `${fromStr} to ${toStr}` },
            { label: 'Total Capital', value: this.capitalSummary.totalCapitalDeposited.toFixed(2) }
          ],
          columns: summaryColumns,
          data: summaryData
        },
        {
          sheetName: 'Capital Deposits',
          sheetTitle: 'Capital Deposits Detailed Register',
          metadata: [
            { label: 'Period', value: `${fromStr} to ${toStr}` },
            { label: 'Deposit Records', value: this.capitalRows.length }
          ],
          columns: depositColumns,
          data: depositData,
          summaryItems: [
            { label: 'Total Capital Inflow', value: this.capitalSummary.totalCapitalDeposited.toFixed(2) }
          ]
        }
      ]
    });
  }

  // 5. Export Expense Report (Multi-sheet: Expense Summary + Expense Details)
  private exportExpenseExcel(): void {
    const fromStr = this.expDateFrom || 'All';
    const toStr = this.expDateTo || 'All';
    const filename = `Expense_Report_${fromStr}_${toStr}.xlsx`;

    const summaryColumns: ExcelColumnDef[] = [
      { header: 'Account / Metric', key: 'metric', width: 28, type: 'text' },
      { header: 'Expense Total (LKR)', key: 'amount', width: 24, type: 'text' }
    ];

    const summaryData = [
      { metric: 'Total Operating Expenses', amount: this.expenseReportSummary.totalExpenses.toFixed(2) },
      { metric: 'Paid from Bank Capital', amount: this.expenseReportSummary.bankCapitalExpenses.toFixed(2) },
      { metric: 'Paid from Assets / Cash', amount: this.expenseReportSummary.assetsCashExpenses.toFixed(2) },
      { metric: 'Total Expense Records', amount: this.expenseReportSummary.expenseCount.toString() }
    ];

    const expColumns: ExcelColumnDef[] = [
      { header: 'Date', key: 'date', width: 14, type: 'date' },
      { header: 'Reference', key: 'reference', width: 18, type: 'text' },
      { header: 'Description / Remark', key: 'description', width: 35, type: 'text' },
      { header: 'Paid From Account', key: 'paidFromAccount', width: 22, type: 'text' },
      { header: 'Amount', key: 'amount', width: 18, type: 'number' }
    ];

    const expData = this.expenseReportRows.map(r => ({
      date: r.date,
      reference: r.reference,
      description: r.description,
      paidFromAccount: r.paidFromAccount,
      amount: r.amount
    }));

    this.excelService.exportMultiSheetReport({
      filename,
      sheets: [
        {
          sheetName: 'Expense Summary',
          sheetTitle: 'LONEX INVESTMENTS - Operating Expenses Summary',
          metadata: [
            { label: 'Generated Date', value: this.excelService.getTodayFormatted() },
            { label: 'Period', value: `${fromStr} to ${toStr}` },
            { label: 'Total Expenses', value: this.expenseReportSummary.totalExpenses.toFixed(2) }
          ],
          columns: summaryColumns,
          data: summaryData
        },
        {
          sheetName: 'Expense Details',
          sheetTitle: 'Operating Expenses Detailed Register',
          metadata: [
            { label: 'Period', value: `${fromStr} to ${toStr}` },
            { label: 'Record Count', value: this.expenseReportRows.length }
          ],
          columns: expColumns,
          data: expData,
          summaryItems: [
            { label: 'Total Expenses', value: this.expenseReportSummary.totalExpenses.toFixed(2) }
          ]
        }
      ]
    });
  }

  // 6. Export Cash Movement (Multi-sheet: Movement Summary + Bank Capital + Assets Cash + All Movements)
  private exportCashMovementExcel(): void {
    const fromStr = this.cmDateFrom || 'All';
    const toStr = this.cmDateTo || 'All';
    const filename = `Cash_Account_Movement_${fromStr}_${toStr}.xlsx`;

    const summaryColumns: ExcelColumnDef[] = [
      { header: 'Account / Layer', key: 'account', width: 28, type: 'text' },
      { header: 'Money In (LKR)', key: 'moneyIn', width: 20, type: 'text' },
      { header: 'Money Out (LKR)', key: 'moneyOut', width: 20, type: 'text' },
      { header: 'Net Movement (LKR)', key: 'net', width: 22, type: 'text' }
    ];

    const summaryData = [
      {
        account: 'Bank Capital Account',
        moneyIn: this.cmSummary.bankCapitalIn.toFixed(2),
        moneyOut: this.cmSummary.bankCapitalOut.toFixed(2),
        net: this.cmSummary.bankCapitalNet.toFixed(2)
      },
      {
        account: 'Assets / Cash Account',
        moneyIn: this.cmSummary.assetsCashIn.toFixed(2),
        moneyOut: this.cmSummary.assetsCashOut.toFixed(2),
        net: this.cmSummary.assetsCashNet.toFixed(2)
      },
      {
        account: 'Company-Wide (External)',
        moneyIn: this.cmSummary.companyExternalIn.toFixed(2),
        moneyOut: this.cmSummary.companyExternalOut.toFixed(2),
        net: this.cmSummary.companyExternalNet.toFixed(2)
      },
      {
        account: 'Internal Transfers (Zero Company Impact)',
        moneyIn: this.cmSummary.internalTransfersVolume.toFixed(2),
        moneyOut: this.cmSummary.internalTransfersVolume.toFixed(2),
        net: '0.00'
      }
    ];

    const rowColumns: ExcelColumnDef[] = [
      { header: 'Date', key: 'date', width: 14, type: 'date' },
      { header: 'Reference', key: 'reference', width: 18, type: 'text' },
      { header: 'Type', key: 'type', width: 20, type: 'text' },
      { header: 'Description', key: 'description', width: 35, type: 'text' },
      { header: 'Source Account', key: 'sourceAccount', width: 20, type: 'text' },
      { header: 'Destination Account', key: 'destinationAccount', width: 20, type: 'text' },
      { header: 'Money In', key: 'moneyIn', width: 16, type: 'number' },
      { header: 'Money Out', key: 'moneyOut', width: 16, type: 'number' },
      { header: 'Internal Transfer', key: 'isInternalTransfer', width: 18, type: 'text' },
      { header: 'Related Loan', key: 'relatedLoanNumber', width: 18, type: 'text' }
    ];

    const bankCapitalData = this.cmRows
      .filter(r => r.sourceAccount.includes('Bank Capital') || r.destinationAccount.includes('Bank Capital'))
      .map(r => ({
        date: r.date,
        reference: r.reference,
        type: r.type,
        description: r.description,
        sourceAccount: r.sourceAccount,
        destinationAccount: r.destinationAccount,
        moneyIn: r.moneyIn !== null ? r.moneyIn : 0,
        moneyOut: r.moneyOut !== null ? r.moneyOut : 0,
        isInternalTransfer: r.isInternalTransfer ? 'Yes' : 'No',
        relatedLoanNumber: r.relatedLoanNumber || '-'
      }));

    const assetsCashData = this.cmRows
      .filter(r => r.sourceAccount.includes('Assets / Cash') || r.destinationAccount.includes('Assets / Cash'))
      .map(r => ({
        date: r.date,
        reference: r.reference,
        type: r.type,
        description: r.description,
        sourceAccount: r.sourceAccount,
        destinationAccount: r.destinationAccount,
        moneyIn: r.moneyIn !== null ? r.moneyIn : 0,
        moneyOut: r.moneyOut !== null ? r.moneyOut : 0,
        isInternalTransfer: r.isInternalTransfer ? 'Yes' : 'No',
        relatedLoanNumber: r.relatedLoanNumber || '-'
      }));

    const allData = this.cmRows.map(r => ({
      date: r.date,
      reference: r.reference,
      type: r.type,
      description: r.description,
      sourceAccount: r.sourceAccount,
      destinationAccount: r.destinationAccount,
      moneyIn: r.moneyIn !== null ? r.moneyIn : 0,
      moneyOut: r.moneyOut !== null ? r.moneyOut : 0,
      isInternalTransfer: r.isInternalTransfer ? 'Yes' : 'No',
      relatedLoanNumber: r.relatedLoanNumber || '-'
    }));

    this.excelService.exportMultiSheetReport({
      filename,
      sheets: [
        {
          sheetName: 'Movement Summary',
          sheetTitle: 'LONEX INVESTMENTS - Cash & Liquidity Movement Summary',
          metadata: [
            { label: 'Generated Date', value: this.excelService.getTodayFormatted() },
            { label: 'Period', value: `${fromStr} to ${toStr}` },
            { label: 'Company Net External Movement', value: this.cmSummary.companyExternalNet.toFixed(2) }
          ],
          columns: summaryColumns,
          data: summaryData
        },
        {
          sheetName: 'Bank Capital',
          sheetTitle: 'Bank Capital Movements',
          columns: rowColumns,
          data: bankCapitalData,
          summaryItems: [
            { label: 'Net Bank Capital Movement', value: this.cmSummary.bankCapitalNet.toFixed(2) }
          ]
        },
        {
          sheetName: 'Assets Cash',
          sheetTitle: 'Assets / Cash Movements',
          columns: rowColumns,
          data: assetsCashData,
          summaryItems: [
            { label: 'Net Assets / Cash Movement', value: this.cmSummary.assetsCashNet.toFixed(2) }
          ]
        },
        {
          sheetName: 'All Movements',
          sheetTitle: 'Complete Cash Movements Register',
          columns: rowColumns,
          data: allData,
          summaryItems: [
            { label: 'Total External Money In', value: this.cmSummary.companyExternalIn.toFixed(2) },
            { label: 'Total External Money Out', value: this.cmSummary.companyExternalOut.toFixed(2) },
            { label: 'Net External Movement', value: this.cmSummary.companyExternalNet.toFixed(2) }
          ]
        }
      ]
    });
  }
}
