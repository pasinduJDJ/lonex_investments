import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Observable, from, map } from 'rxjs';

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
    return principalAmount + (principalAmount * interestRate / 100) + documentCharge;
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
      expected = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    } else if (loan.loan_type === 'weekly') {
      expected = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7)) + 1;
    } else if (loan.loan_type === 'monthly') {
      expected = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
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
}
