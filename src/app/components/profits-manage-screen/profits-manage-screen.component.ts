import { Component, OnInit } from '@angular/core';
import { ProfitManageService, Expense, PaymentWithLoanNumber } from '../../service/profit-manage.service';
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
  expenses: Expense[] = [];
  totalProfit: number | null = null;
  addExpenseForm: FormGroup;
  addExpenseSuccess = false;
  addExpenseError = '';

  startDate: string = '';
  endDate: string = '';

  constructor(
    private profitService: ProfitManageService,
    private fb: FormBuilder,
    private datePipe: DatePipe
  ) {
    this.addExpenseForm = this.fb.group({
      amount: [null, [Validators.required, Validators.min(1)]],
      remark: [''],
      expense_date: [new Date().toISOString().substring(0, 10), Validators.required]
    });
    const today = new Date();
    this.endDate = this.datePipe.transform(today, 'yyyy-MM-dd') || '';
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    this.startDate = this.datePipe.transform(firstDay, 'yyyy-MM-dd') || '';
  }

  ngOnInit() {
    this.loadAll();
  }

  loadAll() {
    this.profitService.getBankCapital().subscribe((c: any) => this.capital = c.current_balance);
    this.loadPaymentsAndExpenses();
    this.profitService.getTotalProfit().subscribe((p: number) => this.totalProfit = p);
  }

  loadPaymentsAndExpenses() {
    this.profitService.getLatestPaymentsWithLoanNumber(this.startDate, this.endDate).subscribe((p: PaymentWithLoanNumber[]) => this.payments = p);
    this.profitService.getExpenses(this.startDate, this.endDate).subscribe((e: Expense[]) => this.expenses = e);
  }

  onDateRangeChange() {
    this.loadPaymentsAndExpenses();
  }

  onAddExpense() {
    if (this.addExpenseForm.invalid) return;
    this.addExpenseSuccess = false;
    this.addExpenseError = '';
    this.profitService.addExpenseAndUpdateCapital(this.addExpenseForm.value).subscribe({
      next: () => {
        this.addExpenseSuccess = true;
        this.addExpenseForm.reset({
          amount: null,
          remark: '',
          expense_date: new Date().toISOString().substring(0, 10)
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
}
