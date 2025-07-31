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

export interface Invest {
  id: string;
  amount: number;
  date: string;
  remark?: string;
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
    return from(query).pipe(
      map(res => {
        console.log('Expenses response:', res);
        if (res.error) {
          console.error('Error fetching expenses:', res.error);
          throw new Error(res.error.message);
        }
        return res.data as Expense[];
      })
    );
  }

  // 4. Add expense and update capital
  addExpenseAndUpdateCapital(expense: { amount: number; remark?: string; expense_date: string }): Observable<any> {
    const supabase = this.supabaseService.getClient();
    console.log('Adding expense:', expense);
    // Insert expense, then update capital
    return from(
      supabase
        .from('expenses')
        .insert({ ...expense })
        .select()
        .single()
    ).pipe(
      map(res => {
        console.log('Expense insert response:', res);
        if (res.error) {
          console.error('Error inserting expense:', res.error);
          throw new Error(res.error.message);
        }
        return res;
      }),
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

  // 8. Add money to capital with remark and store in invest table
  addMoneyToCapital(capitalData: { amount: number; remark?: string }): Observable<any> {
    const supabase = this.supabaseService.getClient();
    console.log('Adding money to capital:', capitalData);
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
            .update({ 
              current_balance: (capitalRes.data.current_balance + capitalData.amount), 
              last_updated: new Date().toISOString(),
              remark: capitalData.remark || capitalRes.data.remark
            })
            .eq('id', capitalRes.data.id)
        ).pipe(
          switchMap(() => {
            // Also store in invest table for history
            const investData = {
              amount: capitalData.amount,
              date: new Date().toISOString().split('T')[0],
              remark: capitalData.remark || 'Capital addition'
            };
            console.log('Inserting invest data:', investData);
            return from(
              supabase
                .from('invest')
                .insert(investData)
                .select()
                .single()
            ).pipe(
              map(res => {
                console.log('Invest insert response:', res);
                if (res.error) {
                  console.error('Error inserting invest data:', res.error);
                  throw new Error(res.error.message);
                }
                return res;
              })
            );
          })
        )
      )
    );
  }

  // 11. Get invest history
  getInvestHistory(startDate?: string, endDate?: string): Observable<Invest[]> {
    const supabase = this.supabaseService.getClient();
    let query = supabase
      .from('invest')
      .select('*')
      .order('date', { ascending: false });
    
    if (startDate && endDate) {
      query = query.gte('date', startDate).lte('date', endDate);
    }
    
    return from(query).pipe(
      map(res => {
        console.log('Invest history response:', res);
        if (res.error) {
          console.error('Error fetching invest history:', res.error);
          throw new Error(res.error.message);
        }
        return res.data as Invest[];
      })
    );
  }

  // 9. Get loans with client details by date range
  getLoansWithClientByDateRange(startDate?: string, endDate?: string): Observable<any[]> {
    const supabase = this.supabaseService.getClient();
    let query = supabase
      .from('loans')
      .select('*, client:clients(first_name, last_name)')
      .order('created_at', { ascending: false });
    
    if (startDate && endDate) {
      query = query.gte('start_date', startDate).lte('start_date', endDate);
    }
    
    return from(query).pipe(
      map(res => {
        const loans = res.data as any[];
        return loans.map(loan => ({
          ...loan,
          client_name: `${loan.client?.first_name || ''} ${loan.client?.last_name || ''}`.trim()
        }));
      })
    );
  }

  // 10. Get total document charges by date range
  getTotalDocumentCharges(startDate?: string, endDate?: string): Observable<number> {
    const supabase = this.supabaseService.getClient();
    let query = supabase
      .from('loans')
      .select('document_charge');
    
    if (startDate && endDate) {
      query = query.gte('start_date', startDate).lte('start_date', endDate);
    }
    
    return from(query).pipe(
      map(res => {
        const loans = res.data as any[];
        return loans.reduce((sum, loan) => sum + (loan.document_charge || 0), 0);
      })
    );
  }

  // 12. Debug method to check table structure
  debugTables(): Observable<any> {
    const supabase = this.supabaseService.getClient();
    return from(
      Promise.all([
        supabase.from('expenses').select('*').limit(5),
        supabase.from('invest').select('*').limit(5)
      ])
    ).pipe(
      map(([expensesRes, investRes]) => {
        console.log('Debug - Expenses table:', expensesRes);
        console.log('Debug - Invest table:', investRes);
        return {
          expenses: expensesRes.data,
          invest: investRes.data
        };
      })
    );
  }
}
