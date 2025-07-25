import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Observable, from, map, switchMap } from 'rxjs';
import { BankCapital, Payment, Loan } from './loan-manage.service';

export interface Expense {
  id: string;
  amount: number;
  remark?: string;
  expense_date: string;
  created_at: string;
}

export interface PaymentWithLoanNumber extends Payment {
  loan_number: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProfitManageService {
  constructor(private supabaseService: SupabaseService) { }

  // 1. Get current bank capital
  getBankCapital(): Observable<BankCapital> {
    const supabase = this.supabaseService.getClient();
    return from(
      supabase
        .from('bank_capital')
        .select('*')
        .order('last_updated', { ascending: false })
        .limit(1)
        .single()
    ).pipe(map(res => res.data as BankCapital));
  }

  // 2. Get latest payments with loan number (join loans)
  getLatestPaymentsWithLoanNumber(startDate?: string, endDate?: string): Observable<PaymentWithLoanNumber[]> {
    const supabase = this.supabaseService.getClient();
    let query = supabase
      .from('payments')
      .select('*, loans(loan_number)')
      .order('paid_date', { ascending: false });
    if (startDate && endDate) {
      query = query.gte('paid_date', startDate).lte('paid_date', endDate);
    }
    return from(query).pipe(
      map(res =>
        (res.data as any[]).map(row => ({
          ...row,
          loan_number: row.loans?.loan_number || ''
        }))
      )
    );
  }

  // 3. Get all expenses
  getExpenses(startDate?: string, endDate?: string): Observable<Expense[]> {
    const supabase = this.supabaseService.getClient();
    let query = supabase
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false });
    if (startDate && endDate) {
      query = query.gte('expense_date', startDate).lte('expense_date', endDate);
    }
    return from(query).pipe(map(res => res.data as Expense[]));
  }

  // 4. Add expense and update capital
  addExpenseAndUpdateCapital(expense: { amount: number; remark?: string; expense_date: string }): Observable<any> {
    const supabase = this.supabaseService.getClient();
    // Insert expense, then update capital
    return from(
      supabase
        .from('expenses')
        .insert({ ...expense })
        .select()
        .single()
    ).pipe(
      switchMap((res) =>
        from(
          supabase
            .from('bank_capital')
            .select('*')
            .order('last_updated', { ascending: false })
            .limit(1)
            .single()
        ).pipe(
          switchMap((capitalRes) =>
            from(
              supabase
                .from('bank_capital')
                .update({ current_balance: (capitalRes.data.current_balance - expense.amount), last_updated: new Date().toISOString() })
                .eq('id', capitalRes.data.id)
            )
          )
        )
      )
    );
  }

  // 5. Get total realized profit (sum for closed loans)
  getTotalProfit(): Observable<number> {
    const supabase = this.supabaseService.getClient();
    return from(
      supabase
        .from('loans')
        .select('*')
        .eq('status', 'closed')
    ).pipe(
      map(res => {
        const loans = res.data as Loan[];
        return loans.reduce((sum, loan) => sum + (loan.total_paid - (loan.principal_amount + loan.document_charge)), 0);
      })
    );
  }

  // 6. Decrease bank capital by a given amount (for loan disbursement)
  decreaseBankCapital(amount: number): Observable<any> {
    const supabase = this.supabaseService.getClient();
    return from(
      supabase
        .from('bank_capital')
        .select('*')
        .order('last_updated', { ascending: false })
        .limit(1)
        .single()
    ).pipe(
      switchMap((capitalRes) =>
        from(
          supabase
            .from('bank_capital')
            .update({ current_balance: (capitalRes.data.current_balance - amount), last_updated: new Date().toISOString() })
            .eq('id', capitalRes.data.id)
        )
      )
    );
  }

  // 7. Increase bank capital by a given amount (for payment received)
  increaseBankCapital(amount: number): Observable<any> {
    const supabase = this.supabaseService.getClient();
    return from(
      supabase
        .from('bank_capital')
        .select('*')
        .order('last_updated', { ascending: false })
        .limit(1)
        .single()
    ).pipe(
      switchMap((capitalRes) =>
        from(
          supabase
            .from('bank_capital')
            .update({ current_balance: (capitalRes.data.current_balance + amount), last_updated: new Date().toISOString() })
            .eq('id', capitalRes.data.id)
        )
      )
    );
  }
}
