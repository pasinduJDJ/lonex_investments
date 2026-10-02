import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { 
  FinanceTransactionService, 
  FinanceTransaction, 
  TransactionType, 
  TransactionSummary 
} from '../../service/finance-transaction.service';

export type QuickDateOption = 'all' | 'today' | 'this_week' | 'this_month';

@Component({
  selector: 'app-finance-transactions',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './finance-transactions.component.html',
  styleUrl: './finance-transactions.component.css'
})
export class FinanceTransactionsComponent implements OnInit {
  isLoading: boolean = true;
  isRefreshing: boolean = false;
  errorMessage: string = '';
  allTransactions: FinanceTransaction[] = [];

  // Filter States
  searchQuery: string = '';
  selectedType: string = 'All';
  quickDateFilter: QuickDateOption = 'all';
  dateFrom: string = '';
  dateTo: string = '';

  // Pagination
  currentPage: number = 1;
  pageSize: number = 25;
  pageSizeOptions: number[] = [25, 50, 100];

  readonly transactionTypes: (string)[] = [
    'All',
    'Loan Disbursement',
    'Loan Repayment',
    'Capital Deposit',
    'Expense',
    'Cash In',
    'Cash Out',
    'Transfer',
    'Document Charge'
  ];

  constructor(
    private transactionService: FinanceTransactionService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadTransactions();
  }

  loadTransactions(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.transactionService.loadAllTransactions().subscribe({
      next: (transactions) => {
        this.allTransactions = transactions;
        this.isLoading = false;
        this.isRefreshing = false;
      },
      error: (err) => {
        console.error('Error loading finance transactions:', err);
        this.errorMessage = 'Failed to load central financial transactions. Please check connection and try again.';
        this.isLoading = false;
        this.isRefreshing = false;
      }
    });
  }

  refreshData(): void {
    this.isRefreshing = true;
    this.loadTransactions();
  }

  // ==========================================
  // FILTERING LOGIC
  // ==========================================
  get filteredTransactions(): FinanceTransaction[] {
    let list = this.allTransactions;

    // 1. Transaction Type Filter
    if (this.selectedType !== 'All') {
      list = list.filter(t => t.type === this.selectedType);
    }

    // 2. Global Search (Reference, Description, Loan #, Source)
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      list = list.filter(t => 
        (t.reference && t.reference.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.sourceAccount && t.sourceAccount.toLowerCase().includes(q)) ||
        (t.type && t.type.toLowerCase().includes(q)) ||
        (t.relatedLoanNumber && t.relatedLoanNumber.toLowerCase().includes(q))
      );
    }

    // 3. Date Filters
    if (this.dateFrom) {
      list = list.filter(t => t.date >= this.dateFrom);
    }
    if (this.dateTo) {
      list = list.filter(t => t.date <= this.dateTo);
    }

    // Quick Date Options (only if custom dates are empty)
    if (!this.dateFrom && !this.dateTo && this.quickDateFilter !== 'all') {
      const bounds = this.getQuickDateBounds(this.quickDateFilter);
      if (bounds) {
        list = list.filter(t => t.date >= bounds.start && t.date <= bounds.end);
      }
    }

    return list;
  }

  // ==========================================
  // SUMMARY CALCULATIONS
  // ==========================================
  get summary(): TransactionSummary {
    return this.transactionService.calculateSummary(this.filteredTransactions);
  }

  // ==========================================
  // PAGINATION
  // ==========================================
  get paginatedTransactions(): FinanceTransaction[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredTransactions.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredTransactions.length / this.pageSize));
  }

  setPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
  }

  onSearchChange(): void {
    this.currentPage = 1;
  }

  onTypeChange(type: string): void {
    this.selectedType = type;
    this.currentPage = 1;
  }

  setQuickDate(option: QuickDateOption): void {
    this.quickDateFilter = option;
    this.dateFrom = '';
    this.dateTo = '';
    this.currentPage = 1;
  }

  onCustomDateChange(): void {
    this.quickDateFilter = 'all';
    this.currentPage = 1;
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.selectedType = 'All';
    this.quickDateFilter = 'all';
    this.dateFrom = '';
    this.dateTo = '';
    this.currentPage = 1;
  }

  // ==========================================
  // NAVIGATION ACTIONS
  // ==========================================
  viewLoan(loanNumber?: string): void {
    if (!loanNumber || loanNumber === 'N/A') return;
    this.router.navigate(['/single-loan', loanNumber]);
  }

  // ==========================================
  // DATE HELPER UTILITIES
  // ==========================================
  private getQuickDateBounds(option: QuickDateOption): { start: string; end: string } | null {
    const now = new Date();
    const todayStr = this.formatDate(now);

    if (option === 'today') {
      return { start: todayStr, end: todayStr };
    }

    if (option === 'this_week') {
      const day = now.getDay();
      const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now);
      monday.setDate(diffToMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return {
        start: this.formatDate(monday),
        end: this.formatDate(sunday)
      };
    }

    if (option === 'this_month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return {
        start: this.formatDate(startOfMonth),
        end: this.formatDate(endOfMonth)
      };
    }

    return null;
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
