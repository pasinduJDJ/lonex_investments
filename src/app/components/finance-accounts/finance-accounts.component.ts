import { Component, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AccountManageService, AccountType, AccountTransaction } from '../../service/account-manage.service';
import { FinanceTransactionService, FinanceTransaction } from '../../service/finance-transaction.service';

@Component({
  selector: 'app-finance-accounts',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, DecimalPipe],
  templateUrl: './finance-accounts.component.html',
  styleUrl: './finance-accounts.component.css'
})
export class FinanceAccountsComponent implements OnInit {
  // Account balances
  bankCapitalBalance: number | null = null;
  assetsBalance: number | null = null;

  isLoadingBalances: boolean = true;
  isLoadingActivity: boolean = true;
  isSubmitting: boolean = false;

  // Notification banners
  successMessage: string = '';
  errorMessage: string = '';

  // Activity Ledger
  allTransactions: FinanceTransaction[] = [];
  filteredActivity: FinanceTransaction[] = [];
  selectedAccountFilter: 'ALL' | 'BANK_CAPITAL' | 'ASSETS_CASH' = 'ALL';
  selectedDateFilter: 'ALL' | 'TODAY' | 'WEEK' | 'MONTH' = 'ALL';
  searchQuery: string = '';

  // Pagination
  currentPage: number = 1;
  pageSize: number = 25;
  pageSizeOptions: number[] = [25, 50, 100];

  // Modals visibility
  showCashInModal: boolean = false;
  showCashOutModal: boolean = false;
  showTransferModal: boolean = false;
  showConfirmModal: boolean = false;

  // Forms
  cashInForm: FormGroup;
  cashOutForm: FormGroup;
  transferForm: FormGroup;

  // Staged data for confirmation dialog
  stagedAction: {
    type: 'CASH_IN' | 'CASH_OUT' | 'TRANSFER';
    title: string;
    fromAccountName?: string;
    toAccountName?: string;
    amount: number;
    date: string;
    description: string;
    reference?: string;
    projectedBalances: { accountName: string; current: number; projected: number }[];
  } | null = null;

  constructor(
    private accountService: AccountManageService,
    private financeTxService: FinanceTransactionService,
    private fb: FormBuilder,
    private router: Router
  ) {
    const today = new Date().toISOString().split('T')[0];

    this.cashInForm = this.fb.group({
      destinationAccount: ['BANK_CAPITAL', Validators.required],
      amount: [null, [Validators.required, Validators.min(0.01)]],
      transactionDate: [today, Validators.required],
      description: ['', [Validators.required, Validators.minLength(3)]],
      reference: ['']
    });

    this.cashOutForm = this.fb.group({
      sourceAccount: ['BANK_CAPITAL', Validators.required],
      amount: [null, [Validators.required, Validators.min(0.01)]],
      transactionDate: [today, Validators.required],
      description: ['', [Validators.required, Validators.minLength(3)]],
      reference: ['']
    });

    this.transferForm = this.fb.group({
      fromAccount: ['BANK_CAPITAL', Validators.required],
      toAccount: ['ASSETS_CASH', Validators.required],
      amount: [null, [Validators.required, Validators.min(0.01)]],
      transactionDate: [today, Validators.required],
      description: ['', [Validators.required, Validators.minLength(3)]],
      reference: ['']
    });
  }

  ngOnInit(): void {
    this.loadBalances();
    this.loadActivity();
  }

  loadBalances(): void {
    this.isLoadingBalances = true;
    this.accountService.getAccountsSummary().subscribe({
      next: accounts => {
        const bank = accounts.find(a => a.type === 'BANK_CAPITAL');
        const assets = accounts.find(a => a.type === 'ASSETS_CASH');
        this.bankCapitalBalance = bank ? bank.balance : 0;
        this.assetsBalance = assets ? assets.balance : 0;
        this.isLoadingBalances = false;
      },
      error: err => {
        console.error('Failed to load account balances:', err);
        this.isLoadingBalances = false;
        this.errorMessage = 'Could not load authoritative account balances.';
      }
    });
  }

  loadActivity(): void {
    this.isLoadingActivity = true;
    this.financeTxService.loadAllTransactions().subscribe({
      next: list => {
        this.allTransactions = list;
        this.applyFilters();
        this.isLoadingActivity = false;
      },
      error: err => {
        console.error('Failed to load activity:', err);
        this.isLoadingActivity = false;
        this.errorMessage = 'Could not load account activity history.';
      }
    });
  }

  // --- Filtering & Tabs ---

  setAccountFilter(filter: 'ALL' | 'BANK_CAPITAL' | 'ASSETS_CASH'): void {
    this.selectedAccountFilter = filter;
    this.currentPage = 1;
    this.applyFilters();
  }

  setDateFilter(filter: 'ALL' | 'TODAY' | 'WEEK' | 'MONTH'): void {
    this.selectedDateFilter = filter;
    this.currentPage = 1;
    this.applyFilters();
  }

  onSearchChange(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  applyFilters(): void {
    let result = [...this.allTransactions];

    // 1. Account Filter
    if (this.selectedAccountFilter === 'BANK_CAPITAL') {
      result = result.filter(tx => 
        tx.sourceAccount.includes('Bank Capital') || 
        tx.description.includes('Bank Capital') ||
        tx.type === 'Loan Disbursement' ||
        tx.type === 'Loan Repayment' ||
        tx.type === 'Capital Deposit' ||
        tx.type === 'Expense'
      );
    } else if (this.selectedAccountFilter === 'ASSETS_CASH') {
      result = result.filter(tx => 
        tx.sourceAccount.includes('Assets') || 
        tx.description.includes('Assets') ||
        tx.type === 'Document Charge' ||
        (tx.type === 'Transfer' && tx.sourceAccount.includes('Assets'))
      );
    }

    // 2. Date Quick Filter
    if (this.selectedDateFilter !== 'ALL') {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      if (this.selectedDateFilter === 'TODAY') {
        result = result.filter(t => t.date === todayStr);
      } else if (this.selectedDateFilter === 'WEEK') {
        const startOfWeek = new Date(now);
        const day = startOfWeek.getDay() || 7;
        startOfWeek.setDate(startOfWeek.getDate() - day + 1);
        const startStr = startOfWeek.toISOString().split('T')[0];
        result = result.filter(t => t.date >= startStr && t.date <= todayStr);
      } else if (this.selectedDateFilter === 'MONTH') {
        const startStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-01`;
        result = result.filter(t => t.date >= startStr && t.date <= todayStr);
      }
    }

    // 3. Search Query
    if (this.searchQuery && this.searchQuery.trim().length > 0) {
      const q = this.searchQuery.toLowerCase().trim();
      result = result.filter(t =>
        (t.reference && t.reference.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.type && t.type.toLowerCase().includes(q)) ||
        (t.sourceAccount && t.sourceAccount.toLowerCase().includes(q))
      );
    }

    this.filteredActivity = result;
  }

  // --- Pagination ---

  get totalPages(): number {
    return Math.ceil(this.filteredActivity.length / this.pageSize) || 1;
  }

  get paginatedTransactions(): FinanceTransaction[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredActivity.slice(start, start + this.pageSize);
  }

  setPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  onPageSizeChange(newSize: number): void {
    this.pageSize = newSize;
    this.currentPage = 1;
  }

  // --- Live Balance Projections ---

  getAccountBalance(type: AccountType): number {
    if (type === 'BANK_CAPITAL') return this.bankCapitalBalance ?? 0;
    if (type === 'ASSETS_CASH') return this.assetsBalance ?? 0;
    return 0;
  }

  getAccountLabel(type: AccountType): string {
    return type === 'BANK_CAPITAL' ? 'Bank Capital' : 'Assets / Cash';
  }

  // Cash In projection
  get cashInProjectedBalance(): number {
    const dest = this.cashInForm.value.destinationAccount as AccountType;
    const current = this.getAccountBalance(dest);
    const amount = Number(this.cashInForm.value.amount) || 0;
    return current + amount;
  }

  // Cash Out projection
  get cashOutProjectedBalance(): number {
    const src = this.cashOutForm.value.sourceAccount as AccountType;
    const current = this.getAccountBalance(src);
    const amount = Number(this.cashOutForm.value.amount) || 0;
    return current - amount;
  }

  // Transfer projections
  get transferSourceProjected(): number {
    const src = this.transferForm.value.fromAccount as AccountType;
    const current = this.getAccountBalance(src);
    const amount = Number(this.transferForm.value.amount) || 0;
    return current - amount;
  }

  get transferDestProjected(): number {
    const dest = this.transferForm.value.toAccount as AccountType;
    const current = this.getAccountBalance(dest);
    const amount = Number(this.transferForm.value.amount) || 0;
    return current + amount;
  }

  // --- Modal Openers & Validation Triggers ---

  openCashInModal(): void {
    const today = new Date().toISOString().split('T')[0];
    this.cashInForm.reset({
      destinationAccount: 'BANK_CAPITAL',
      amount: null,
      transactionDate: today,
      description: '',
      reference: `CI-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`
    });
    this.errorMessage = '';
    this.showCashInModal = true;
  }

  openCashOutModal(): void {
    const today = new Date().toISOString().split('T')[0];
    this.cashOutForm.reset({
      sourceAccount: 'BANK_CAPITAL',
      amount: null,
      transactionDate: today,
      description: '',
      reference: `CO-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`
    });
    this.errorMessage = '';
    this.showCashOutModal = true;
  }

  openTransferModal(): void {
    const today = new Date().toISOString().split('T')[0];
    this.transferForm.reset({
      fromAccount: 'BANK_CAPITAL',
      toAccount: 'ASSETS_CASH',
      amount: null,
      transactionDate: today,
      description: '',
      reference: `TR-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`
    });
    this.errorMessage = '';
    this.showTransferModal = true;
  }

  closeAllModals(): void {
    this.showCashInModal = false;
    this.showCashOutModal = false;
    this.showTransferModal = false;
    this.showConfirmModal = false;
    this.stagedAction = null;
  }

  // --- Submissions to Confirmation Dialog ---

  submitCashIn(): void {
    if (this.cashInForm.invalid) {
      this.errorMessage = 'Please complete all required fields with a valid amount.';
      return;
    }
    const val = this.cashInForm.value;
    const dest = val.destinationAccount as AccountType;
    const current = this.getAccountBalance(dest);

    this.stagedAction = {
      type: 'CASH_IN',
      title: 'Confirm Cash In',
      toAccountName: this.getAccountLabel(dest),
      amount: Number(val.amount),
      date: val.transactionDate,
      description: val.description,
      reference: val.reference,
      projectedBalances: [
        {
          accountName: this.getAccountLabel(dest),
          current,
          projected: current + Number(val.amount)
        }
      ]
    };
    this.showCashInModal = false;
    this.showConfirmModal = true;
  }

  submitCashOut(): void {
    if (this.cashOutForm.invalid) {
      this.errorMessage = 'Please complete all required fields with a valid amount.';
      return;
    }
    const val = this.cashOutForm.value;
    const src = val.sourceAccount as AccountType;
    const current = this.getAccountBalance(src);
    const amt = Number(val.amount);

    if (amt > current) {
      this.errorMessage = `Insufficient balance. Available balance is Rs. ${current.toLocaleString('en-US', { minimumFractionDigits: 2 })}.`;
      return;
    }

    this.stagedAction = {
      type: 'CASH_OUT',
      title: 'Confirm Cash Out',
      fromAccountName: this.getAccountLabel(src),
      amount: amt,
      date: val.transactionDate,
      description: val.description,
      reference: val.reference,
      projectedBalances: [
        {
          accountName: this.getAccountLabel(src),
          current,
          projected: current - amt
        }
      ]
    };
    this.showCashOutModal = false;
    this.showConfirmModal = true;
  }

  submitTransfer(): void {
    if (this.transferForm.invalid) {
      this.errorMessage = 'Please complete all required fields with a valid amount.';
      return;
    }
    const val = this.transferForm.value;
    const src = val.fromAccount as AccountType;
    const dest = val.toAccount as AccountType;

    if (src === dest) {
      this.errorMessage = 'Source and Destination accounts cannot be the same.';
      return;
    }

    const currentSrc = this.getAccountBalance(src);
    const currentDest = this.getAccountBalance(dest);
    const amt = Number(val.amount);

    if (amt > currentSrc) {
      this.errorMessage = `Insufficient balance in ${this.getAccountLabel(src)}. Available: Rs. ${currentSrc.toLocaleString('en-US', { minimumFractionDigits: 2 })}.`;
      return;
    }

    this.stagedAction = {
      type: 'TRANSFER',
      title: 'Confirm Inter-Account Transfer',
      fromAccountName: this.getAccountLabel(src),
      toAccountName: this.getAccountLabel(dest),
      amount: amt,
      date: val.transactionDate,
      description: val.description,
      reference: val.reference,
      projectedBalances: [
        {
          accountName: this.getAccountLabel(src),
          current: currentSrc,
          projected: currentSrc - amt
        },
        {
          accountName: this.getAccountLabel(dest),
          current: currentDest,
          projected: currentDest + amt
        }
      ]
    };
    this.showTransferModal = false;
    this.showConfirmModal = true;
  }

  // --- Final Execution after explicit user confirmation ---

  async executeConfirmedAction(): Promise<void> {
    if (!this.stagedAction || this.isSubmitting) return;

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      if (this.stagedAction.type === 'CASH_IN') {
        const val = this.cashInForm.value;
        const res = await this.accountService.recordCashIn({
          destinationAccount: val.destinationAccount,
          amount: Number(val.amount),
          transactionDate: val.transactionDate,
          description: val.description,
          reference: val.reference
        });
        this.successMessage = `Cash In of Rs. ${Number(val.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} to ${this.getAccountLabel(val.destinationAccount)} posted successfully!`;
      } else if (this.stagedAction.type === 'CASH_OUT') {
        const val = this.cashOutForm.value;
        const res = await this.accountService.recordCashOut({
          sourceAccount: val.sourceAccount,
          amount: Number(val.amount),
          transactionDate: val.transactionDate,
          description: val.description,
          reference: val.reference
        });
        this.successMessage = `Cash Out of Rs. ${Number(val.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} from ${this.getAccountLabel(val.sourceAccount)} posted successfully!`;
      } else if (this.stagedAction.type === 'TRANSFER') {
        const val = this.transferForm.value;
        const res = await this.accountService.recordTransfer({
          fromAccount: val.fromAccount,
          toAccount: val.toAccount,
          amount: Number(val.amount),
          transactionDate: val.transactionDate,
          description: val.description,
          reference: val.reference
        });
        this.successMessage = `Transfer of Rs. ${Number(val.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} from ${this.getAccountLabel(val.fromAccount)} to ${this.getAccountLabel(val.toAccount)} completed successfully!`;
      }

      this.closeAllModals();
      this.loadBalances();
      this.loadActivity();
    } catch (err: any) {
      console.error('Action failed:', err);
      this.errorMessage = err.message || 'Transaction could not be completed.';
      this.showConfirmModal = false;
    } finally {
      this.isSubmitting = false;
    }
  }

  // --- Helpers ---

  getBadgeClass(type: string): string {
    switch (type) {
      case 'Loan Repayment':
      case 'Capital Deposit':
      case 'Cash In':
        return 'badge-emerald';
      case 'Loan Disbursement':
      case 'Document Charge':
        return 'badge-gold';
      case 'Expense':
      case 'Cash Out':
        return 'badge-red';
      case 'Transfer':
        return 'badge-slate';
      default:
        return 'badge-default';
    }
  }

  viewLoan(loanNumber?: string): void {
    if (loanNumber) {
      this.router.navigate(['/single-loan', loanNumber]);
    }
  }
}
