import { Component, OnInit } from '@angular/core';
import { ProfitManageService, PaymentWithLoanNumber, Invest, Expense } from '../../service/profit-manage.service';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-profits-manage-screen',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
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

  loadAll() {
    this.profitService.getBankCapital().subscribe((c: any) => this.capital = c.current_balance);
    this.loadPayments();
    this.loadLoans();
    this.loadInvestHistory();
    this.loadExpenses();
    this.profitService.getTotalProfit().subscribe((p: number) => this.totalProfit = p);
    
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
    // Load all data by default, or filtered data if dates are selected
    const startDate = this.startDate && this.endDate ? this.startDate : undefined;
    const endDate = this.startDate && this.endDate ? this.endDate : undefined;
    this.profitService.getLatestPaymentsWithLoanNumber(startDate, endDate).subscribe((p: PaymentWithLoanNumber[]) => this.payments = p);
  }

  loadLoans() {
    // Load all data by default, or filtered data if dates are selected
    const startDate = this.startDate && this.endDate ? this.startDate : undefined;
    const endDate = this.startDate && this.endDate ? this.endDate : undefined;
    this.profitService.getLoansWithClientByDateRange(startDate, endDate).subscribe((l: any[]) => this.loans = l);
    this.profitService.getTotalDocumentCharges(startDate, endDate).subscribe((total: number) => this.totalDocumentCharges = total);
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
    // Load all data by default, or filtered data if dates are selected
    const startDate = this.startDate && this.endDate ? this.startDate : undefined;
    const endDate = this.startDate && this.endDate ? this.endDate : undefined;
    
    this.profitService.getExpenses(startDate, endDate).subscribe({
      next: (expenses: Expense[]) => {
        console.log('Loaded expenses:', expenses);
        this.expenses = expenses;
      },
      error: (error) => {
        console.error('Error loading expenses:', error);
        this.expenses = [];
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
}
