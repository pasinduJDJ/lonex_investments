import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Observable, from } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { AccountManageService } from './account-manage.service';

export type TransactionType =
  | 'Loan Disbursement'
  | 'Loan Repayment'
  | 'Capital Deposit'
  | 'Expense'
  | 'Cash In'
  | 'Cash Out'
  | 'Transfer'
  | 'Document Charge';

export interface FinanceTransaction {
  id: string;
  date: string;
  reference: string;
  type: TransactionType;
  description: string;
  sourceAccount: string;
  moneyIn: number | null;
  moneyOut: number | null;
  status: string;
  relatedLoanNumber?: string;
  createdAt?: string;
  transferAmount?: number;
}

export interface TransactionSummary {
  totalMoneyIn: number;
  totalMoneyOut: number;
  netMovement: number;
  totalCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class FinanceTransactionService {

  constructor(
    private supabaseService: SupabaseService,
    private accountService: AccountManageService
  ) { }

  /**
   * Loads all authoritative financial transaction records and normalizes them into a unified ledger
   */
  loadAllTransactions(): Observable<FinanceTransaction[]> {
    const supabase = this.supabaseService.getClient();

    return from(
      Promise.all([
        // 1. Loans (Disbursements and Document Charges)
        supabase
          .from('loans')
          .select(`
            id,
            loan_number,
            principal_amount,
            document_charge,
            start_date,
            created_at,
            status,
            client:clients(first_name, last_name)
          `)
          .order('start_date', { ascending: false }),

        // 2. Payments (Repayments)
        supabase
          .from('payments')
          .select(`
            id,
            paid_amount,
            paid_date,
            remark,
            created_at,
            loans(loan_number, client_id, clients(first_name, last_name))
          `)
          .order('paid_date', { ascending: false }),

        // 3. Capital Deposits (invest)
        supabase
          .from('invest')
          .select('*')
          .order('date', { ascending: false }),

        // 4. Operating Expenses (expenses)
        supabase
          .from('expenses')
          .select('*')
          .order('expense_date', { ascending: false }),

        // 5. Account Transactions (Cash In, Cash Out, Transfers)
        this.accountService.getAccountTransactions().toPromise().catch(() => [])
      ])
    ).pipe(
      map(([loansRes, paymentsRes, investRes, expensesRes, accountTxList]) => {
        if (loansRes.error) throw new Error('Error loading loans: ' + loansRes.error.message);
        if (paymentsRes.error) throw new Error('Error loading payments: ' + paymentsRes.error.message);
        if (investRes.error) throw new Error('Error loading capital deposits: ' + investRes.error.message);
        if (expensesRes.error) throw new Error('Error loading expenses: ' + expensesRes.error.message);

        const transactions: FinanceTransaction[] = [];

        // Pre-scan explicit account transactions for deduplication
        const accountTxs = (accountTxList as any[]) || [];
        const explicitDocChargeLoanRefs = new Set<string>();
        for (const tx of accountTxs) {
          if (tx.transaction_type === 'DOCUMENT_CHARGE') {
            if (tx.reference) {
              explicitDocChargeLoanRefs.add(tx.reference.trim().toUpperCase());
            }
          }
        }

        // A. Normalize Loan Disbursements and Document Charges
        const loans = loansRes.data || [];
        for (const loan of loans) {
          const clientObj = (loan as any).client;
          const clientName = clientObj
            ? `${clientObj.first_name || ''} ${clientObj.last_name || ''}`.trim()
            : 'Customer';
          const disbDate = loan.start_date || (loan.created_at ? loan.created_at.split('T')[0] : '');
          const loanRef = (loan.loan_number || '').trim();
          const loanRefUpper = loanRef.toUpperCase();

          // A1. Loan Disbursement Outflow (Bank Capital)
          transactions.push({
            id: `DISB-${loan.id}`,
            date: disbDate,
            reference: loanRef || 'N/A',
            type: 'Loan Disbursement',
            description: `Loan disbursed to ${clientName}`,
            sourceAccount: 'Bank Capital',
            moneyIn: null,
            moneyOut: Number(loan.principal_amount) || 0,
            status: 'Disbursed',
            relatedLoanNumber: loanRef || undefined,
            createdAt: loan.created_at
          });

          // A2. Derived Historical Document Charge Inflow (Assets / Cash)
          const docCharge = Number(loan.document_charge) || 0;
          const isGenuineLoan = loan.status !== 'cancelled' && loan.status !== 'voided';
          const hasExplicitTx = (loanRefUpper && explicitDocChargeLoanRefs.has(loanRefUpper)) ||
            (loan.id && explicitDocChargeLoanRefs.has(loan.id.toUpperCase()));

          if (docCharge > 0 && isGenuineLoan && !hasExplicitTx) {
            transactions.push({
              id: `DOC-${loan.id}`,
              date: disbDate,
              reference: loanRef || 'N/A',
              type: 'Document Charge',
              description: `Document charge for loan ${loanRef} (${clientName})`.trim(),
              sourceAccount: 'Assets / Cash',
              moneyIn: docCharge,
              moneyOut: null,
              status: 'Collected',
              relatedLoanNumber: loanRef || undefined,
              createdAt: loan.created_at || disbDate
            });
          }
        }

        // B. Normalize Loan Repayments
        const payments = paymentsRes.data || [];
        for (const payment of payments) {
          const loanData = (payment as any).loans;
          const clientData = loanData?.clients;
          const clientName = clientData
            ? `${clientData.first_name || ''} ${clientData.last_name || ''}`.trim()
            : 'Customer';
          const loanNum = loanData?.loan_number || 'N/A';
          const desc = `Repayment received from ${clientName}` + (payment.remark ? ` (${payment.remark})` : '');

          transactions.push({
            id: `PAY-${payment.id}`,
            date: payment.paid_date || (payment.created_at ? payment.created_at.split('T')[0] : ''),
            reference: loanNum,
            type: 'Loan Repayment',
            description: desc,
            sourceAccount: 'Bank Capital',
            moneyIn: Number(payment.paid_amount) || 0,
            moneyOut: null,
            status: 'Received',
            relatedLoanNumber: loanNum !== 'N/A' ? loanNum : undefined,
            createdAt: payment.created_at
          });
        }

        // C. Normalize Capital Deposits
        const deposits = investRes.data || [];
        for (const dep of deposits) {
          transactions.push({
            id: `DEP-${dep.id}`,
            date: dep.date,
            reference: `DEP-${dep.id.toString().slice(0, 8).toUpperCase()}`,
            type: 'Capital Deposit',
            description: dep.remark || 'Capital deposit into Bank Capital',
            sourceAccount: 'Bank Capital',
            moneyIn: Number(dep.amount) || 0,
            moneyOut: null,
            status: 'Deposited',
            createdAt: dep.created_at || dep.date
          });
        }

        // D. Normalize Expenses
        const expenses = expensesRes.data || [];
        for (const exp of expenses) {
          transactions.push({
            id: `EXP-${exp.id}`,
            date: exp.expense_date,
            reference: `EXP-${exp.id.toString().slice(0, 8).toUpperCase()}`,
            type: 'Expense',
            description: exp.remark || 'Operating expense',
            sourceAccount: 'Bank Capital',
            moneyIn: null,
            moneyOut: Number(exp.amount) || 0,
            status: 'Paid',
            createdAt: exp.created_at || exp.expense_date
          });
        }

        // E. Normalize Account Transactions (Cash In, Cash Out, Transfers)
        for (const tx of accountTxs) {
          if (tx.transaction_type === 'CASH_IN') {
            const destName = tx.destination_account === 'BANK_CAPITAL' ? 'Bank Capital' : 'Assets / Cash';
            transactions.push({
              id: `CI-${tx.id}`,
              date: tx.transaction_date,
              reference: tx.reference || `CI-${tx.id.toString().slice(0, 8)}`,
              type: 'Cash In',
              description: tx.description,
              sourceAccount: destName,
              moneyIn: Number(tx.amount) || 0,
              moneyOut: null,
              status: 'Posted',
              createdAt: tx.created_at
            });
          } else if (tx.transaction_type === 'CASH_OUT') {
            const srcName = tx.source_account === 'BANK_CAPITAL' ? 'Bank Capital' : 'Assets / Cash';
            transactions.push({
              id: `CO-${tx.id}`,
              date: tx.transaction_date,
              reference: tx.reference || `CO-${tx.id.toString().slice(0, 8)}`,
              type: 'Cash Out',
              description: tx.description,
              sourceAccount: srcName,
              moneyIn: null,
              moneyOut: Number(tx.amount) || 0,
              status: 'Posted',
              createdAt: tx.created_at
            });
          } else if (tx.transaction_type === 'TRANSFER') {
            const fromName = tx.source_account === 'BANK_CAPITAL' ? 'Bank Capital' : 'Assets / Cash';
            const toName = tx.destination_account === 'BANK_CAPITAL' ? 'Bank Capital' : 'Assets / Cash';
            transactions.push({
              id: `TR-${tx.id}`,
              date: tx.transaction_date,
              reference: tx.reference || `TR-${tx.id.toString().slice(0, 8)}`,
              type: 'Transfer',
              description: `Transfer: ${fromName} → ${toName} (${tx.description})`,
              sourceAccount: `${fromName} → ${toName}`,
              moneyIn: null,
              moneyOut: null,
              transferAmount: Number(tx.amount) || 0,
              status: 'Transferred',
              createdAt: tx.created_at
            });
          } else if (tx.transaction_type === 'DOCUMENT_CHARGE') {
            transactions.push({
              id: `DC-${tx.id}`,
              date: tx.transaction_date,
              reference: tx.reference || 'N/A',
              type: 'Document Charge',
              description: tx.description || `Document charge for loan ${tx.reference || ''}`.trim(),
              sourceAccount: 'Assets / Cash',
              moneyIn: Number(tx.amount) || 0,
              moneyOut: null,
              status: 'Collected',
              relatedLoanNumber: tx.reference || undefined,
              createdAt: tx.created_at
            });
          }
        }

        // Deterministic sorting: Newest date first, secondary createdAt, tertiary unique id
        transactions.sort((a, b) => {
          const dateDiff = (b.date || '').localeCompare(a.date || '');
          if (dateDiff !== 0) return dateDiff;
          const createdDiff = (b.createdAt || '').localeCompare(a.createdAt || '');
          if (createdDiff !== 0) return createdDiff;
          return (a.id || '').localeCompare(b.id || '');
        });

        return transactions;
      }),
      catchError(err => {
        console.error('Failed to load unified finance transactions:', err);
        throw err;
      })
    );
  }

  /**
   * Helper to compute summary of filtered transactions
   */
  calculateSummary(transactions: FinanceTransaction[]): TransactionSummary {
    let totalMoneyIn = 0;
    let totalMoneyOut = 0;

    for (const t of transactions) {
      if (t.moneyIn) totalMoneyIn += t.moneyIn;
      if (t.moneyOut) totalMoneyOut += t.moneyOut;
    }

    return {
      totalMoneyIn,
      totalMoneyOut,
      netMovement: totalMoneyIn - totalMoneyOut,
      totalCount: transactions.length
    };
  }
}
