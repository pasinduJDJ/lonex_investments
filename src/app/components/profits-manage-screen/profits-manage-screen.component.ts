import { Component, OnInit } from '@angular/core';
import { ProfitManageService, PaymentWithLoanNumber, Invest, Expense } from '../../service/profit-manage.service';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-profits-manage-screen',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule],
  providers: [DatePipe],
  templateUrl: './profits-manage-screen.component.html',
  styleUrl: './profits-manage-screen.component.css'
})
export class ProfitsManageScreenComponent implements OnInit {
  capital: number | null = null;
  payments: PaymentWithLoanNumber[] = [];
  totalProfit: number | null = null;
  loans: any[] = [];
  totalDocumentCharges: number = 0;
  investHistory: Invest[] = [];
  expenses: Expense[] = [];
  addCapitalForm: FormGroup;
  addExpenseForm: FormGroup;
  addCapitalSuccess = false;
  addCapitalError = '';
  addExpenseSuccess = false;
  addExpenseError = '';

  // Loading States for smooth rendering
  isLoadingCapital: boolean = true;
  isLoadingPayments: boolean = true;
  isLoadingProfit: boolean = true;
  isLoadingExpenses: boolean = true;
  isLoadingLoans: boolean = true;
  isLoadingAssets: boolean = true;

  activeTab: 'actions' | 'expenses' | 'capital' | 'loans' | 'payments' = 'actions';

  startDate: string = '';
  endDate: string = '';

  constructor(
    private profitService: ProfitManageService,
    private fb: FormBuilder,
    private datePipe: DatePipe
  ) {
    this.addCapitalForm = this.fb.group({
      amount: [null, [Validators.required, Validators.min(1)]],
      remark: ['', [Validators.required, Validators.minLength(3)]]
    });
    this.addExpenseForm = this.fb.group({
      amount: [null, [Validators.required, Validators.min(1)]],
      remark: ['', [Validators.required, Validators.minLength(3)]]
    });
    // Initialize with empty dates to load all data by default
    this.startDate = '';
    this.endDate = '';
  }

  ngOnInit() {
    this.loadAll();
  }

  get totalExpenses(): number {
    return (this.expenses || []).reduce((sum, e) => sum + (e.amount || 0), 0);
  }

  get totalIncome(): number {
    return (this.payments || []).reduce((sum, p) => sum + (p.paid_amount || 0), 0);
  }

  get currentPeriodLoanProfit(): number {
    if (this.startDate && this.endDate && this.loans.length > 0) {
      const closedLoans = this.loans.filter(l => l.status === 'closed');
      return closedLoans.reduce((sum, loan) => sum + (loan.total_paid - (loan.principal_amount + loan.document_charge)), 0);
    }
    return this.totalProfit !== null ? this.totalProfit : 0;
  }

  get netProfit(): number {
    return this.currentPeriodLoanProfit - this.totalExpenses;
  }

  get isNetProfitPositive(): boolean {
    return this.netProfit > 0;
  }

  get isNetProfitNegative(): boolean {
    return this.netProfit < 0;
  }

  loadAll() {
    this.isLoadingCapital = true;
    this.profitService.getBankCapital().subscribe({
      next: (c: any) => {
        this.capital = c ? c.current_balance : 0;
        this.isLoadingCapital = false;
      },
      error: () => {
        this.isLoadingCapital = false;
      }
    });

    this.loadPayments();
    this.loadLoans();
    this.loadInvestHistory();
    this.loadExpenses();

    this.isLoadingProfit = true;
    this.profitService.getTotalProfit().subscribe({
      next: (p: number) => {
        this.totalProfit = p;
        this.isLoadingProfit = false;
      },
      error: () => {
        this.isLoadingProfit = false;
      }
    });
    
    // Debug: Check table structure
    this.profitService.debugTables().subscribe({
      next: (debugData) => {
        console.log('Debug data:', debugData);
      },
      error: (error) => {
        console.error('Debug error:', error);
      }
    });
  }

  loadPayments() {
    this.isLoadingPayments = true;
    // Load all data by default, or filtered data if dates are selected
    const startDate = this.startDate && this.endDate ? this.startDate : undefined;
    const endDate = this.startDate && this.endDate ? this.endDate : undefined;
    this.profitService.getLatestPaymentsWithLoanNumber(startDate, endDate).subscribe({
      next: (p: PaymentWithLoanNumber[]) => {
        this.payments = p;
        this.isLoadingPayments = false;
      },
      error: () => {
        this.isLoadingPayments = false;
      }
    });
  }

  loadLoans() {
    this.isLoadingLoans = true;
    this.isLoadingAssets = true;
    // Load all data by default, or filtered data if dates are selected
    const startDate = this.startDate && this.endDate ? this.startDate : undefined;
    const endDate = this.startDate && this.endDate ? this.endDate : undefined;
    this.profitService.getLoansWithClientByDateRange(startDate, endDate).subscribe({
      next: (l: any[]) => {
        this.loans = l;
        this.isLoadingLoans = false;
      },
      error: () => {
        this.isLoadingLoans = false;
      }
    });

    // Assets Account reflects documented assets reserve
    this.profitService.getTotalDocumentCharges().subscribe({
      next: (total: number) => {
        this.totalDocumentCharges = total;
        this.isLoadingAssets = false;
      },
      error: () => {
        this.isLoadingAssets = false;
      }
    });
  }

  loadInvestHistory() {
    // Load all data by default, or filtered data if dates are selected
    const startDate = this.startDate && this.endDate ? this.startDate : undefined;
    const endDate = this.startDate && this.endDate ? this.endDate : undefined;
    
    this.profitService.getInvestHistory(startDate, endDate).subscribe({
      next: (investments: Invest[]) => {
        console.log('Loaded invest history:', investments);
        this.investHistory = investments;
      },
      error: (error) => {
        console.error('Error loading invest history:', error);
        this.investHistory = [];
      }
    });
  }

  loadExpenses() {
    this.isLoadingExpenses = true;
    // Load all data by default, or filtered data if dates are selected
    const startDate = this.startDate && this.endDate ? this.startDate : undefined;
    const endDate = this.startDate && this.endDate ? this.endDate : undefined;
    
    this.profitService.getExpenses(startDate, endDate).subscribe({
      next: (expenses: Expense[]) => {
        console.log('Loaded expenses:', expenses);
        this.expenses = expenses;
        this.isLoadingExpenses = false;
      },
      error: (error) => {
        console.error('Error loading expenses:', error);
        this.expenses = [];
        this.isLoadingExpenses = false;
      }
    });
  }

  onDateRangeChange() {
    this.loadPayments();
    this.loadLoans();
    this.loadInvestHistory();
    this.loadExpenses();
  }

  onAddCapital() {
    if (this.addCapitalForm.invalid) {
      this.addCapitalError = 'Please fill all required fields correctly.';
      return;
    }
    
    this.addCapitalSuccess = false;
    this.addCapitalError = '';
    this.profitService.addMoneyToCapital(this.addCapitalForm.value).subscribe({
      next: () => {
        this.addCapitalSuccess = true;
        this.addCapitalForm.reset({
          amount: null,
          remark: ''
        });
        setTimeout(() => {
          this.loadAll();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 500);
      },
      error: err => {
        this.addCapitalError = 'Failed to add money to capital.';
      }
    });
  }

  onAddExpense() {
    if (this.addExpenseForm.invalid) {
      this.addExpenseError = 'Please fill all required fields correctly.';
      return;
    }
    
    // Check if expense amount exceeds bank capital
    if (this.capital !== null && this.addExpenseForm.value.amount > this.capital) {
      this.addExpenseError = `Expense amount (Rs. ${this.addExpenseForm.value.amount}) cannot exceed current capital (Rs. ${this.capital}).`;
      return;
    }
    
    this.addExpenseSuccess = false;
    this.addExpenseError = '';
    
    const expenseData = {
      amount: this.addExpenseForm.value.amount,
      remark: this.addExpenseForm.value.remark,
      expense_date: new Date().toISOString().split('T')[0] // Today's date
    };
    
    this.profitService.addExpenseAndUpdateCapital(expenseData).subscribe({
      next: () => {
        this.addExpenseSuccess = true;
        this.addExpenseForm.reset({
          amount: null,
          remark: ''
        });
        setTimeout(() => {
          this.loadAll();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 500);
      },
      error: err => {
        this.addExpenseError = 'Failed to add expense.';
      }
    });
  }

  // Clear error messages when user starts typing
  onExpenseFormChange() {
    if (this.addExpenseError) {
      this.addExpenseError = '';
    }
  }

  onCapitalFormChange() {
    if (this.addCapitalError) {
      this.addCapitalError = '';
    }
  }

  setActiveTab(tab: 'actions' | 'expenses' | 'capital' | 'loans' | 'payments'): void {
    this.activeTab = tab;
  }

  clearDateFilter(): void {
    this.startDate = '';
    this.endDate = '';
    this.onDateRangeChange();
  }
}
