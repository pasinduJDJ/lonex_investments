import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface Client {
  client_id: string;
  register_number?: number;
  first_name: string;
  last_name: string;
  nic_number: string;
  mobile_number?: string;
  home_number?: string;
  street_address?: string;
  town_one?: string;
  town_two?: string;
  group?: string;
  is_member: boolean;
  created_at: string;
  first_guarantor_name?: string;
  first_guarantor_nic?: string;
  first_guarantor_tp?: string;
  first_guarantor_address?: string;
  second_guarantor_name?: string;
  second_guarantor_nic?: string;
  second_guarantor_tp?: string;
  second_guarantor_address?: string;
}

export interface LoanGuarantor {
  id?: string;
  loan_id: string;
  guarantor_id: string;
  guarantor_order: number;
  created_at?: string;
  guarantor?: Client;
}

export interface LoanRescheduleHistory {
  id?: string;
  loan_id: string;
  reschedule_date: string;
  old_installment_amount: number;
  new_installment_amount: number;
  old_remaining_installments: number;
  new_remaining_installments: number;
  old_end_date?: string;
  new_end_date: string;
  remaining_balance: number;
  changed_by?: string;
  notes?: string;
  created_at?: string;
}

export interface Loan {
  id: string;
  loan_reg_number?: number;
  client_id: string;
  loan_number: string;
  loan_type: 'daily' | 'weekly' | 'monthly';
  principal_amount: number;
  interest_rate: number;
  document_charge: number;
  total_amount_due: number;
  total_paid: number;
  remaining_amount: number;
  status: 'active' | 'closed';
  created_at: string;
  start_date: string;
  end_date: string;
  client?: Client;
  installments?: number;
}

export interface Payment {
  id: string;
  loan_id: string;
  paid_amount: number;
  paid_date: string;
  remark?: string;
  created_at: string;
}

export interface BankCapital {
  id: string;
  starting_balance: number;
  current_balance: number;
  last_updated: string;
  remark?: string;
}

export interface LoanWithClient extends Loan {
  client: Client;
  installments?: number;
}

@Injectable({
  providedIn: 'root'
})
export class LoanManageService {

  constructor(private supabaseService: SupabaseService) { }

  // Fetch all loans with client information
  getAllLoans(): Observable<LoanWithClient[]> {
    const supabase = this.supabaseService.getClient();
    return from(
      supabase
        .from('loans')
        .select(`
          *,
          client:clients(*)
        `)
        .order('created_at', { ascending: false })
    ).pipe(
      map(response => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        return response.data as LoanWithClient[];
      })
    );
  }

  // Fetch all clients
  getAllClients(): Observable<Client[]> {
    const supabase = this.supabaseService.getClient();
    return from(
      supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false })
    ).pipe(
      map(response => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        return response.data as Client[];
      })
    );
  }

  // Add a new loan
  addLoan(loanData: {
    client_id: string;
    loan_number: string;
    loan_type: 'daily' | 'weekly' | 'monthly';
    principal_amount: number;
    interest_rate: number;
    document_charge: number;
    start_date: string;
    end_date: string;
  }): Observable<Loan> {
    const supabase = this.supabaseService.getClient();
    
    // Calculate total amount due
    const totalAmountDue = this.calculateTotalAmountDue(
      loanData.principal_amount,
      loanData.interest_rate,
      loanData.document_charge
    );

    const loanToInsert = {
      ...loanData,
      total_amount_due: totalAmountDue,
      remaining_amount: totalAmountDue,
      total_paid: 0,
      status: 'active' as const
    };

    return from(
      supabase
        .from('loans')
        .insert(loanToInsert)
        .select()
        .single()
    ).pipe(
      map(response => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        return response.data as Loan;
      })
    );
  }

  // Calculate total amount due
  private calculateTotalAmountDue(
    principalAmount: number,
    interestRate: number,
    documentCharge: number
  ): number {
    return principalAmount + (principalAmount * interestRate / 100);
  }

  // Get loan by loan number
  getLoanByNumber(loanNumber: string): Observable<LoanWithClient | null> {
    const supabase = this.supabaseService.getClient();
    return from(
      supabase
        .from('loans')
        .select(`
          *,
          client:clients(*)
        `)
        .eq('loan_number', loanNumber)
        .single()
    ).pipe(
      map(response => {
        if (response.error) {
          if (response.error.code === 'PGRST116') {
            return null; // No loan found
          }
          throw new Error(response.error.message);
        }
        return response.data as LoanWithClient;
      })
    );
  }

  // Add payment
  addPayment(paymentData: {
    loan_id: string;
    paid_amount: number;
    remark?: string;
  }): Observable<Payment> {
    const supabase = this.supabaseService.getClient();
    
    const paymentToInsert = {
      ...paymentData,
      paid_date: new Date().toISOString().split('T')[0] // Today's date
    };

    return from(
      supabase
        .from('payments')
        .insert(paymentToInsert)
        .select()
        .single()
    ).pipe(
      map(response => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        return response.data as Payment;
      })
    );
  }

  // Get payments for a loan
  getPaymentsForLoan(loanId: string): Observable<Payment[]> {
    const supabase = this.supabaseService.getClient();
    return from(
      supabase
        .from('payments')
        .select('*')
        .eq('loan_id', loanId)
        .order('paid_date', { ascending: false })
    ).pipe(
      map(response => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        return response.data as Payment[];
      })
    );
  }

  // Get bank capital
  getBankCapital(): Observable<BankCapital> {
    const supabase = this.supabaseService.getClient();
    return from(
      supabase
        .from('bank_capital')
        .select('*')
        .order('last_updated', { ascending: false })
        .limit(1)
        .single()
    ).pipe(
      map(response => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        return response.data as BankCapital;
      })
    );
  }

  // Get loans by date range
  getLoansByDateRange(startDate: string, endDate: string): Observable<LoanWithClient[]> {
    const supabase = this.supabaseService.getClient();
    return from(
      supabase
        .from('loans')
        .select(`
          *,
          client:clients(*)
        `)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false })
    ).pipe(
      map(response => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        return response.data as LoanWithClient[];
      })
    );
  }

  // Get payments by date range
  getPaymentsByDateRange(startDate: string, endDate: string): Observable<Payment[]> {
    const supabase = this.supabaseService.getClient();
    return from(
      supabase
        .from('payments')
        .select('*')
        .gte('paid_date', startDate)
        .lte('paid_date', endDate)
        .order('paid_date', { ascending: false })
    ).pipe(
      map(response => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        return response.data as Payment[];
      })
    );
  }

  // Get client profile with loans and payments
  getClientProfile(clientId: string): Observable<{ client: Client; loans: Loan[]; payments: Payment[] }> {
    const supabase = this.supabaseService.getClient();
    
    return from(
      Promise.all([
        supabase.from('clients').select('*').eq('client_id', clientId).single(),
        supabase.from('loans').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
        supabase.from('payments').select('*, loans!inner(*)').eq('loans.client_id', clientId).order('paid_date', { ascending: false })
      ])
    ).pipe(
      map(([clientResponse, loansResponse, paymentsResponse]) => {
        if (clientResponse.error) throw new Error(clientResponse.error.message);
        if (loansResponse.error) throw new Error(loansResponse.error.message);
        if (paymentsResponse.error) throw new Error(paymentsResponse.error.message);

        return {
          client: clientResponse.data as Client,
          loans: loansResponse.data as Loan[],
          payments: paymentsResponse.data as Payment[]
        };
      })
    );
  }

  // Calculate profit for a loan
  calculateLoanProfit(loan: Loan): number {
    return loan.total_paid - (loan.principal_amount + loan.document_charge);
  }

  // Get loans by loan_reg_number
  getLoansByRegNumber(loanRegNumber: number): Observable<LoanWithClient[]> {
    const supabase = this.supabaseService.getClient();
    return from(
      supabase
        .from('loans')
        .select(`
          *,
          client:clients(*)
        `)
        .eq('loan_number', loanRegNumber)
        .order('created_at', { ascending: false })
    ).pipe(
      map(response => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        return response.data as LoanWithClient[];
      })
    );
  }

  // Update loan status
  updateLoanStatus(loanId: string, status: 'active' | 'closed'): Observable<any> {
    const supabase = this.supabaseService.getClient();
    return from(
      supabase
        .from('loans')
        .update({ status })
        .eq('id', loanId)
    );
  }

  // Calculate expected, paid, and remaining installments for a loan
  async getInstallmentStats(loan: {
    id: string,
    start_date: string,
    end_date: string,
    loan_type: 'daily' | 'weekly' | 'monthly',
    total_amount_due: number
  }): Promise<{
    expected: number,
    paid: number,
    remaining: number,
    totalPaid: number,
    installmentAmount: number
  }> {
    // Calculate number of expected installments
    const start = new Date(loan.start_date);
    const end = new Date(loan.end_date);
    let expected = 0;
    if (loan.loan_type === 'daily') {
      const timeDiff = end.getTime() - start.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
      expected = Math.max(1, daysDiff);
    }
    
    
    else if (loan.loan_type === 'weekly') {
      // Calculate total days
      const timeDiff = end.getTime() - start.getTime();
      const totalDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
      
      // Calculate weeks
      let weeks = Math.floor(totalDays / 7);
      
      // If there are remaining days, count as an additional week
      const remainingDays = totalDays % 7;
      if (remainingDays > 0) {
        weeks += 1;
      }
      
      expected = Math.max(1, weeks);
    } 
    
    else if (loan.loan_type === 'monthly') {
      // Calculate months difference
      let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      
      // If end day is before start day, don't count the last month as complete
      if (end.getDate() < start.getDate()) {
        months -= 1;
      }
      
      // Ensure at least 1 month
      expected = Math.max(1, months);
    }

    
    // Calculate per-installment amount
    const installmentAmount = Math.round(loan.total_amount_due / expected);
    // Fetch all payments for this loan
    const supabase = this.supabaseService.getClient();
    const { data: payments, error } = await supabase
      .from('payments')
      .select('paid_amount')
      .eq('loan_id', loan.id);
    let totalPaid = 0;
    if (payments && Array.isArray(payments)) {
      totalPaid = payments.reduce((sum, p) => sum + (p.paid_amount || 0), 0);
    }
    // Calculate paid installments (can be fractional)
    const paid = Math.floor(totalPaid / installmentAmount);
    const remaining = Math.max(expected - paid, 0);
    return {
      expected,
      paid,
      remaining,
      totalPaid,
      installmentAmount
    };
  }

  // Get client by NIC number
  getClientByNIC(nicNumber: string): Observable<Client | null> {
    const supabase = this.supabaseService.getClient();
    return from(
      supabase
        .from('clients')
        .select('*')
        .eq('nic_number', nicNumber)
        .single()
    ).pipe(
      map(response => {
        if (response.error) {
          if (response.error.code === 'PGRST116') {
            return null; // No client found
          }
          throw new Error(response.error.message);
        }
        return response.data as Client;
      })
    );
  }

  // Delete loan by loan_reg_number
  deleteLoanByRegNumber(loanRegNumber: number): Observable<any> {
    const supabase = this.supabaseService.getClient();
    return from(
      supabase
        .from('loans')
        .delete()
        .eq('loan_number', loanRegNumber)
    );
  }

  // Update client information
  updateClient(clientId: string, updateData: Partial<Client>): Observable<Client> {
    const supabase = this.supabaseService.getClient();
    return from(
      supabase
        .from('clients')
        .update(updateData)
        .eq('client_id', clientId)
        .select()
        .single()
    ).pipe(
      map(response => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        return response.data as Client;
      })
    );
  }

  // Search registered member by NIC (case-insensitive)
  searchRegisteredMemberByNic(nicNumber: string): Observable<Client | null> {
    const cleanNic = (nicNumber || '').trim();
    if (!cleanNic) return of(null);

    const supabase = this.supabaseService.getClient();
    return from(
      supabase
        .from('clients')
        .select('*')
        .ilike('nic_number', cleanNic)
        .limit(1)
    ).pipe(
      map(response => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        if (response.data && response.data.length > 0) {
          return response.data[0] as Client;
        }
        return null;
      }),
      catchError(err => {
        console.error('Error searching member by NIC:', err);
        return of(null);
      })
    );
  }

  // Get loan-level guarantors for a specific loan
  getLoanGuarantors(loanId: string): Observable<LoanGuarantor[]> {
    const supabase = this.supabaseService.getClient();
    return from(
      supabase
        .from('loan_guarantors')
        .select(`
          id,
          loan_id,
          guarantor_id,
          guarantor_order,
          created_at,
          guarantor:clients(*)
        `)
        .eq('loan_id', loanId)
        .order('guarantor_order', { ascending: true })
    ).pipe(
      map(response => {
        if (response.error) {
          // Gracefully handle if table does not exist or has RLS issue
          console.warn('Loan guarantors query notice:', response.error.message);
          return [];
        }
        const rows = (response.data || []) as any[];
        return rows.map(r => ({
          id: r.id,
          loan_id: r.loan_id,
          guarantor_id: r.guarantor_id,
          guarantor_order: r.guarantor_order,
          created_at: r.created_at,
          guarantor: Array.isArray(r.guarantor) ? (r.guarantor[0] as Client) : (r.guarantor as Client)
        })) as LoanGuarantor[];
      }),
      catchError(err => {
        console.warn('Error fetching loan guarantors, using fallback:', err);
        return of([]);
      })
    );
  }

  // Save loan-level guarantors for a specific loan
  saveLoanGuarantors(loanId: string, guarantor1Id: string, guarantor2Id: string): Observable<any> {
    const supabase = this.supabaseService.getClient();
    const rows = [
      {
        loan_id: loanId,
        guarantor_id: guarantor1Id,
        guarantor_order: 1
      },
      {
        loan_id: loanId,
        guarantor_id: guarantor2Id,
        guarantor_order: 2
      }
    ];

    return from(
      supabase
        .from('loan_guarantors')
        .insert(rows)
    ).pipe(
      map(response => {
        if (response.error) {
          console.warn('Could not insert to loan_guarantors table (migration may be pending):', response.error.message);
          return { success: false, error: response.error };
        }
        return { success: true, data: response.data };
      }),
      catchError(err => {
        console.warn('saveLoanGuarantors catch:', err);
        return of({ success: false, error: err });
      })
    );
  }

  // Fetch reschedule history for a loan
  getLoanRescheduleHistory(loanId: string): Observable<LoanRescheduleHistory[]> {
    const supabase = this.supabaseService.getClient();
    return from(
      supabase
        .from('loan_reschedule_history')
        .select('*')
        .eq('loan_id', loanId)
        .order('created_at', { ascending: false })
    ).pipe(
      map(response => {
        if (response.error) {
          console.warn('Loan reschedule history query notice:', response.error.message);
          return [];
        }
        return (response.data || []) as LoanRescheduleHistory[];
      }),
      catchError(err => {
        console.warn('Error fetching loan reschedule history:', err);
        return of([]);
      })
    );
  }

  // Execute early settlement / reschedule future installments
  rescheduleLoan(
    loanId: string, 
    rescheduleData: {
      newEndDate: string;
      newTotalInstallments: number;
      oldInstallmentAmount: number;
      newInstallmentAmount: number;
      oldRemainingInstallments: number;
      newRemainingInstallments: number;
      oldEndDate: string;
      remainingBalance: number;
      changedBy?: string;
      notes?: string;
    }
  ): Observable<{ success: boolean; error?: any }> {
    const supabase = this.supabaseService.getClient();

    return from(
      (async () => {
        // Step 1: Update the loan's end_date and total installments
        const { error: loanUpdateError } = await supabase
          .from('loans')
          .update({
            end_date: rescheduleData.newEndDate,
            installments: rescheduleData.newTotalInstallments
          })
          .eq('id', loanId);

        if (loanUpdateError) {
          throw new Error('Failed to update loan schedule: ' + loanUpdateError.message);
        }

        // Step 2: Record audit entry in loan_reschedule_history
        try {
          const { error: historyError } = await supabase
            .from('loan_reschedule_history')
            .insert({
              loan_id: loanId,
              reschedule_date: new Date().toISOString(),
              old_installment_amount: rescheduleData.oldInstallmentAmount,
              new_installment_amount: rescheduleData.newInstallmentAmount,
              old_remaining_installments: rescheduleData.oldRemainingInstallments,
              new_remaining_installments: rescheduleData.newRemainingInstallments,
              old_end_date: rescheduleData.oldEndDate,
              new_end_date: rescheduleData.newEndDate,
              remaining_balance: rescheduleData.remainingBalance,
              changed_by: rescheduleData.changedBy || 'Admin',
              notes: rescheduleData.notes || 'Early Settlement / Future Repayment Rescheduled'
            });

          if (historyError) {
            console.warn('Audit record warning (table migration may be pending):', historyError.message);
          }
        } catch (auditErr) {
          console.warn('Audit record notice:', auditErr);
        }

        return { success: true };
      })()
    ).pipe(
      map(res => ({ success: true })),
      catchError(err => {
        console.error('rescheduleLoan error:', err);
        return of({ success: false, error: err.message || err });
      })
    );
  }

  /**
   * Validates whether a loan number complies with the new Stage 2 standard: 12-YY-NNNN
   */
  isValidNewLoanNumberFormat(loanNumber: string): boolean {
    return /^12-\d{2}-\d{4}$/.test(loanNumber);
  }

  /**
   * Generates the next sequential loan number for NEW loans in format: 12-YY-NNNN.
   * 1. Attempts atomic Postgres RPC (generate_next_loan_number) with row-level mutex.
   * 2. If RPC is unavailable/pending migration, falls back to querying the loans table directly.
   * 
   * @param targetYear Optional year override (useful for yearly reset testing, defaults to current calendar year)
   */
  async generateNextLoanNumber(targetYear?: number): Promise<string> {
    const supabase = this.supabaseService.getClient();
    const currYear = targetYear || new Date().getFullYear();
    const yearYY = (currYear % 100).toString().padStart(2, '0');

    try {
      const { data, error } = await supabase.rpc('generate_next_loan_number', {
        target_year: currYear
      });

      if (!error && data && typeof data === 'string' && this.isValidNewLoanNumberFormat(data)) {
        return data;
      }

      if (error) {
        console.warn('Notice from generate_next_loan_number RPC, using fallback:', error.message);
      }
    } catch (rpcErr) {
      console.warn('RPC invocation failed, using query fallback:', rpcErr);
    }

    // Direct database query fallback
    return this.generateNextLoanNumberFallback(currYear, yearYY);
  }

  /**
   * Fallback loan number generator that inspects the loans table directly.
   */
  private async generateNextLoanNumberFallback(currYear: number, yearYY: string): Promise<string> {
    const supabase = this.supabaseService.getClient();
    const prefix = `12-${yearYY}-`;

    const { data, error } = await supabase
      .from('loans')
      .select('loan_number')
      .ilike('loan_number', `${prefix}%`);

    let maxSeq = 0;
    if (data && data.length > 0) {
      for (const row of data) {
        if (row.loan_number) {
          const match = row.loan_number.match(/^12-\d{2}-(\d{4})$/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxSeq) {
              maxSeq = num;
            }
          }
        }
      }
    }

    const nextSeq = maxSeq + 1;
    return `12-${yearYY}-${nextSeq.toString().padStart(4, '0')}`;
  }
}

