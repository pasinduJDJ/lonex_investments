import { Injectable } from '@angular/core';
import { Observable, from, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { FinanceTransactionService, FinanceTransaction, TransactionType } from './finance-transaction.service';
import { AccountManageService } from './account-manage.service';
import { ProfitManageService, Expense, Invest } from './profit-manage.service';

// ============================================================================
// 1. ACCOUNT HISTORY INTERFACES
// ============================================================================
export interface AccountHistoryRow {
  date: string;
  reference: string;
  type: TransactionType;
  description: string;
  moneyIn: number | null;
  moneyOut: number | null;
  status: string;
  relatedLoanNumber?: string;
  sourceAccount: string;
}

export interface AccountHistoryFilters {
  account: 'BANK_CAPITAL' | 'ASSETS_CASH';
  dateFrom?: string;
  dateTo?: string;
  transactionType?: string;
  search?: string;
}

export interface AccountHistorySummary {
  accountName: string;
  currentBalance: number;
  totalMoneyIn: number;
  totalMoneyOut: number;
  netMovement: number;
  transactionCount: number;
  limitationNote: string;
}

// ============================================================================
// 2. TRANSACTION HISTORY INTERFACES
// ============================================================================
export interface TransactionHistoryRow {
  date: string;
  reference: string;
  type: TransactionType;
  description: string;
  sourceAccount: string;
  destinationAccount?: string;
  moneyIn: number | null;
  moneyOut: number | null;
  status: string;
  relatedLoanNumber?: string;
  isInternalTransfer: boolean;
}

export interface TransactionHistoryFilters {
  dateFrom?: string;
  dateTo?: string;
  transactionType?: string;
  account?: string;
  search?: string;
}

export interface TransactionHistorySummary {
  totalTransactions: number;
  totalMoneyIn: number;
  totalMoneyOut: number;
  netMovement: number;
  internalTransfersCount: number;
  internalTransfersVolume: number;
}

// ============================================================================
// 3. INCOME & EXPENSE INTERFACES
// ============================================================================
export interface IncomeRow {
  date: string;
  reference: string;
  customerName: string;
  principalAmount: number;
  totalPaid: number;
  documentCharge: number;
  realizedProfit: number;
  status: string;
}

export interface ExpenseRow {
  date: string;
  reference: string;
  description: string;
  paidFromAccount: string;
  amount: number;
}

export interface IncomeExpenseFilters {
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface IncomeExpenseSummary {
  totalIncome: number;           // Realized loan profit on closed loans
  totalExpenses: number;         // Genuine operating expenses
  netProfit: number;             // totalIncome - totalExpenses
  totalRepaymentsCollected: number; // For cash context
  closedLoansCount: number;
  expensesCount: number;
}

// ============================================================================
// 4. CAPITAL HISTORY INTERFACES
// ============================================================================
export interface CapitalRow {
  date: string;
  reference: string;
  destinationAccount: string;
  amount: number;
  remark: string;
}

export interface CapitalFilters {
  dateFrom?: string;
  dateTo?: string;
  destinationAccount?: string;
  search?: string;
}

export interface CapitalSummary {
  totalCapitalDeposited: number;
  bankCapitalDeposits: number;
  assetsCashDeposits: number;
  depositCount: number;
}

// ============================================================================
// 5. EXPENSE REPORT INTERFACES
// ============================================================================
export interface ExpenseReportRow {
  date: string;
  reference: string;
  description: string;
  paidFromAccount: string;
  amount: number;
}

export interface ExpenseReportFilters {
  dateFrom?: string;
  dateTo?: string;
  paidFromAccount?: string;
  search?: string;
}

export interface ExpenseReportSummary {
  totalExpenses: number;
  bankCapitalExpenses: number;
  assetsCashExpenses: number;
  expenseCount: number;
}

// ============================================================================
// 6. CASH / ACCOUNT MOVEMENT INTERFACES
// ============================================================================
export interface CashMovementRow {
  date: string;
  reference: string;
  type: TransactionType;
  description: string;
  sourceAccount: string;
  destinationAccount: string;
  moneyIn: number | null;
  moneyOut: number | null;
  isInternalTransfer: boolean;
  relatedLoanNumber?: string;
}

export interface CashMovementFilters {
  dateFrom?: string;
  dateTo?: string;
  account?: string;
  movement?: 'all' | 'in' | 'out';
  transactionType?: string;
  search?: string;
}

export interface CashMovementSummary {
  bankCapitalIn: number;
  bankCapitalOut: number;
  bankCapitalNet: number;

  assetsCashIn: number;
  assetsCashOut: number;
  assetsCashNet: number;

  companyExternalIn: number;
  companyExternalOut: number;
  companyExternalNet: number;
  internalTransfersVolume: number;
}

@Injectable({
  providedIn: 'root'
})
export class FinanceReportService {

  constructor(
    private supabaseService: SupabaseService,
    private financeTxService: FinanceTransactionService,
    private accountService: AccountManageService,
    private profitService: ProfitManageService
  ) {}

  // ==========================================================================
  // REPORT 01: ACCOUNT HISTORY REPORT
  // ==========================================================================
  getAccountHistoryReport(filters: AccountHistoryFilters): Observable<{ rows: AccountHistoryRow[], summary: AccountHistorySummary }> {
    return forkJoin({
      allTransactions: this.financeTxService.loadAllTransactions(),
      accounts: this.accountService.getAccountsSummary()
    }).pipe(
      map(({ allTransactions, accounts }) => {
        const isBankCapital = filters.account === 'BANK_CAPITAL';
        const targetAccountName = isBankCapital ? 'Bank Capital' : 'Assets / Cash';
        const currentBal = accounts.find(a => a.type === filters.account)?.balance || 0;

        // Filter transactions strictly affecting this account
        let rows: AccountHistoryRow[] = [];

        for (const tx of allTransactions) {
          // Date range filter
          if (filters.dateFrom && tx.date < filters.dateFrom) continue;
          if (filters.dateTo && tx.date > filters.dateTo) continue;

          // Transaction Type filter
          if (filters.transactionType && filters.transactionType !== 'all' && tx.type !== filters.transactionType) {
            continue;
          }

          // Search query filter
          if (filters.search) {
            const q = filters.search.toLowerCase();
            const matchRef = (tx.reference || '').toLowerCase().includes(q);
            const matchDesc = (tx.description || '').toLowerCase().includes(q);
            const matchLoan = (tx.relatedLoanNumber || '').toLowerCase().includes(q);
            if (!matchRef && !matchDesc && !matchLoan) continue;
          }

          let accountMoneyIn: number | null = null;
          let accountMoneyOut: number | null = null;
          let isRelevant = false;

          if (isBankCapital) {
            // Transactions affecting Bank Capital
            if (tx.type === 'Capital Deposit') {
              accountMoneyIn = tx.moneyIn;
              isRelevant = true;
            } else if (tx.type === 'Loan Repayment') {
              accountMoneyIn = tx.moneyIn;
              isRelevant = true;
            } else if (tx.type === 'Loan Disbursement') {
              accountMoneyOut = tx.moneyOut;
              isRelevant = true;
            } else if (tx.type === 'Expense') {
              accountMoneyOut = tx.moneyOut;
              isRelevant = true;
            } else if (tx.type === 'Cash In' && tx.sourceAccount.includes('Bank Capital')) {
              accountMoneyIn = tx.moneyIn;
              isRelevant = true;
            } else if (tx.type === 'Cash Out' && tx.sourceAccount.includes('Bank Capital')) {
              accountMoneyOut = tx.moneyOut;
              isRelevant = true;
            } else if (tx.type === 'Transfer') {
              // Check direction of transfer
              if (tx.sourceAccount.startsWith('Bank Capital →')) {
                // Outflow from Bank Capital
                accountMoneyOut = tx.transferAmount || 0;
                isRelevant = true;
              } else if (tx.sourceAccount.endsWith('→ Bank Capital')) {
                // Inflow to Bank Capital
                accountMoneyIn = tx.transferAmount || 0;
                isRelevant = true;
              }
            }
          } else {
            // Transactions affecting Assets / Cash
            if (tx.type === 'Document Charge') {
              accountMoneyIn = tx.moneyIn;
              isRelevant = true;
            } else if (tx.type === 'Cash In' && tx.sourceAccount.includes('Assets / Cash')) {
              accountMoneyIn = tx.moneyIn;
              isRelevant = true;
            } else if (tx.type === 'Cash Out' && tx.sourceAccount.includes('Assets / Cash')) {
              accountMoneyOut = tx.moneyOut;
              isRelevant = true;
            } else if (tx.type === 'Transfer') {
              if (tx.sourceAccount.startsWith('Assets / Cash →')) {
                // Outflow from Assets / Cash
                accountMoneyOut = tx.transferAmount || 0;
                isRelevant = true;
              } else if (tx.sourceAccount.endsWith('→ Assets / Cash')) {
                // Inflow to Assets / Cash
                accountMoneyIn = tx.transferAmount || 0;
                isRelevant = true;
              }
            }
          }

          if (isRelevant) {
            rows.push({
              date: tx.date,
              reference: tx.reference,
              type: tx.type,
              description: tx.description,
              moneyIn: accountMoneyIn,
              moneyOut: accountMoneyOut,
              status: tx.status,
              relatedLoanNumber: tx.relatedLoanNumber,
              sourceAccount: targetAccountName
            });
          }
        }

        let totalIn = 0;
        let totalOut = 0;
        for (const r of rows) {
          if (r.moneyIn) totalIn += r.moneyIn;
          if (r.moneyOut) totalOut += r.moneyOut;
        }

        return {
          rows,
          summary: {
            accountName: targetAccountName,
            currentBalance: currentBal,
            totalMoneyIn: totalIn,
            totalMoneyOut: totalOut,
            netMovement: totalIn - totalOut,
            transactionCount: rows.length,
            limitationNote: 'Opening and closing balances across arbitrary historical dates are not fabricated to maintain 100% financial integrity. Authoritative current balance and period net movement are displayed.'
          }
        };
      })
    );
  }

  // ==========================================================================
  // REPORT 02: TRANSACTION HISTORY REPORT
  // ==========================================================================
  getTransactionHistoryReport(filters: TransactionHistoryFilters): Observable<{ rows: TransactionHistoryRow[], summary: TransactionHistorySummary }> {
    return this.financeTxService.loadAllTransactions().pipe(
      map(allTxs => {
        let rows: TransactionHistoryRow[] = [];
        let totalIn = 0;
        let totalOut = 0;
        let internalCount = 0;
        let internalVol = 0;

        for (const tx of allTxs) {
          if (filters.dateFrom && tx.date < filters.dateFrom) continue;
          if (filters.dateTo && tx.date > filters.dateTo) continue;

          if (filters.transactionType && filters.transactionType !== 'all' && tx.type !== filters.transactionType) {
            continue;
          }

          if (filters.account && filters.account !== 'all') {
            const accFilter = filters.account.toLowerCase();
            const src = (tx.sourceAccount || '').toLowerCase();
            if (!src.includes(accFilter)) continue;
          }

          if (filters.search) {
            const q = filters.search.toLowerCase();
            const matchRef = (tx.reference || '').toLowerCase().includes(q);
            const matchDesc = (tx.description || '').toLowerCase().includes(q);
            const matchLoan = (tx.relatedLoanNumber || '').toLowerCase().includes(q);
            const matchType = (tx.type || '').toLowerCase().includes(q);
            if (!matchRef && !matchDesc && !matchLoan && !matchType) continue;
          }

          const isInternal = tx.type === 'Transfer';
          let mIn = tx.moneyIn;
          let mOut = tx.moneyOut;

          if (isInternal) {
            internalCount++;
            internalVol += (tx.transferAmount || 0);
          } else {
            if (mIn) totalIn += mIn;
            if (mOut) totalOut += mOut;
          }

          rows.push({
            date: tx.date,
            reference: tx.reference,
            type: tx.type,
            description: tx.description,
            sourceAccount: tx.sourceAccount,
            destinationAccount: tx.type === 'Transfer' ? tx.sourceAccount.split('→')[1]?.trim() : undefined,
            moneyIn: mIn,
            moneyOut: mOut,
            status: tx.status,
            relatedLoanNumber: tx.relatedLoanNumber,
            isInternalTransfer: isInternal
          });
        }

        return {
          rows,
          summary: {
            totalTransactions: rows.length,
            totalMoneyIn: totalIn,
            totalMoneyOut: totalOut,
            netMovement: totalIn - totalOut,
            internalTransfersCount: internalCount,
            internalTransfersVolume: internalVol
          }
        };
      })
    );
  }

  // ==========================================================================
  // REPORT 03: INCOME & EXPENSE REPORT
  // ==========================================================================
  getIncomeExpenseReport(filters: IncomeExpenseFilters): Observable<{ incomeRows: IncomeRow[], expenseRows: ExpenseRow[], summary: IncomeExpenseSummary }> {
    const supabase = this.supabaseService.getClient();

    return forkJoin({
      loansRes: from(
        supabase
          .from('loans')
          .select(`
            id,
            loan_number,
            principal_amount,
            interest_rate,
            total_amount_due,
            total_paid,
            document_charge,
            status,
            start_date,
            end_date,
            created_at,
            client:clients(first_name, last_name)
          `)
          .order('end_date', { ascending: false })
      ),
      expensesRes: from(
        supabase
          .from('expenses')
          .select('*')
          .order('expense_date', { ascending: false })
      ),
      paymentsRes: from(
        supabase
          .from('payments')
          .select('paid_amount, paid_date')
      )
    }).pipe(
      map(({ loansRes, expensesRes, paymentsRes }) => {
        if (loansRes.error) throw new Error(loansRes.error.message);
        if (expensesRes.error) throw new Error(expensesRes.error.message);
        if (paymentsRes.error) throw new Error(paymentsRes.error.message);

        const allLoans = (loansRes.data || []) as any[];
        const allExpenses = (expensesRes.data || []) as Expense[];
        const allPayments = (paymentsRes.data || []) as { paid_amount: number; paid_date: string }[];

        // 1. Filter Closed Loans (Recognized Loan Profit)
        const closedLoans = allLoans.filter(l => l.status === 'closed');
        let incomeRows: IncomeRow[] = [];
        let totalRealizedProfit = 0;

        for (const loan of closedLoans) {
          const closeDate = loan.end_date || (loan.created_at ? loan.created_at.split('T')[0] : '');

          if (filters.dateFrom && closeDate < filters.dateFrom) continue;
          if (filters.dateTo && closeDate > filters.dateTo) continue;

          const clientObj = loan.client;
          const clientName = clientObj
            ? `${clientObj.first_name || ''} ${clientObj.last_name || ''}`.trim()
            : 'Customer';

          if (filters.search) {
            const q = filters.search.toLowerCase();
            const matchLoan = (loan.loan_number || '').toLowerCase().includes(q);
            const matchName = clientName.toLowerCase().includes(q);
            if (!matchLoan && !matchName) continue;
          }

          const principal = Number(loan.principal_amount) || 0;
          const paid = Number(loan.total_paid) || 0;
          const docCharge = Number(loan.document_charge) || 0;
          const profit = paid - (principal + docCharge);

          totalRealizedProfit += profit;

          incomeRows.push({
            date: closeDate,
            reference: loan.loan_number || 'N/A',
            customerName: clientName,
            principalAmount: principal,
            totalPaid: paid,
            documentCharge: docCharge,
            realizedProfit: profit,
            status: 'Closed'
          });
        }

        // 2. Filter Operating Expenses
        let expenseRows: ExpenseRow[] = [];
        let totalExp = 0;

        for (const exp of allExpenses) {
          const expDate = exp.expense_date;

          if (filters.dateFrom && expDate < filters.dateFrom) continue;
          if (filters.dateTo && expDate > filters.dateTo) continue;

          if (filters.search) {
            const q = filters.search.toLowerCase();
            const matchRef = `EXP-${exp.id.toString().slice(0, 8)}`.toLowerCase().includes(q);
            const matchRem = (exp.remark || '').toLowerCase().includes(q);
            if (!matchRef && !matchRem) continue;
          }

          const amt = Number(exp.amount) || 0;
          totalExp += amt;

          expenseRows.push({
            date: expDate,
            reference: `EXP-${exp.id.toString().slice(0, 8).toUpperCase()}`,
            description: exp.remark || 'Operating Expense',
            paidFromAccount: 'Bank Capital',
            amount: amt
          });
        }

        // 3. Collections in period (for cash context)
        let totalRepayments = 0;
        for (const p of allPayments) {
          const pDate = p.paid_date;
          if (filters.dateFrom && pDate < filters.dateFrom) continue;
          if (filters.dateTo && pDate > filters.dateTo) continue;
          totalRepayments += Number(p.paid_amount) || 0;
        }

        return {
          incomeRows,
          expenseRows,
          summary: {
            totalIncome: totalRealizedProfit,
            totalExpenses: totalExp,
            netProfit: totalRealizedProfit - totalExp,
            totalRepaymentsCollected: totalRepayments,
            closedLoansCount: incomeRows.length,
            expensesCount: expenseRows.length
          }
        };
      })
    );
  }

  // ==========================================================================
  // REPORT 04: CAPITAL HISTORY REPORT
  // ==========================================================================
  getCapitalHistoryReport(filters: CapitalFilters): Observable<{ rows: CapitalRow[], summary: CapitalSummary }> {
    return this.profitService.getInvestHistory(filters.dateFrom, filters.dateTo).pipe(
      map(investList => {
        let rows: CapitalRow[] = [];
        let totalDep = 0;
        let bankDep = 0;
        let assetsDep = 0;

        for (const inv of investList) {
          if (filters.search) {
            const q = filters.search.toLowerCase();
            const matchRef = `DEP-${inv.id.toString().slice(0, 8)}`.toLowerCase().includes(q);
            const matchRem = (inv.remark || '').toLowerCase().includes(q);
            if (!matchRef && !matchRem) continue;
          }

          const destAccount = 'Bank Capital'; // Authoritative destination per current system

          if (filters.destinationAccount && filters.destinationAccount !== 'all' && destAccount !== filters.destinationAccount) {
            continue;
          }

          const amt = Number(inv.amount) || 0;
          totalDep += amt;
          bankDep += amt;

          rows.push({
            date: inv.date,
            reference: `DEP-${inv.id.toString().slice(0, 8).toUpperCase()}`,
            destinationAccount: destAccount,
            amount: amt,
            remark: inv.remark || 'Capital Deposit'
          });
        }

        return {
          rows,
          summary: {
            totalCapitalDeposited: totalDep,
            bankCapitalDeposits: bankDep,
            assetsCashDeposits: assetsDep,
            depositCount: rows.length
          }
        };
      })
    );
  }

  // ==========================================================================
  // REPORT 05: EXPENSE REPORT
  // ==========================================================================
  getExpenseReport(filters: ExpenseReportFilters): Observable<{ rows: ExpenseReportRow[], summary: ExpenseReportSummary }> {
    return this.profitService.getExpenses(filters.dateFrom, filters.dateTo).pipe(
      map(expensesList => {
        let rows: ExpenseReportRow[] = [];
        let totalExp = 0;
        let bankExp = 0;
        let assetsExp = 0;

        for (const exp of expensesList) {
          if (filters.search) {
            const q = filters.search.toLowerCase();
            const matchRef = `EXP-${exp.id.toString().slice(0, 8)}`.toLowerCase().includes(q);
            const matchRem = (exp.remark || '').toLowerCase().includes(q);
            if (!matchRef && !matchRem) continue;
          }

          const paidFrom = 'Bank Capital'; // Authoritative source per current system

          if (filters.paidFromAccount && filters.paidFromAccount !== 'all' && paidFrom !== filters.paidFromAccount) {
            continue;
          }

          const amt = Number(exp.amount) || 0;
          totalExp += amt;
          bankExp += amt;

          rows.push({
            date: exp.expense_date,
            reference: `EXP-${exp.id.toString().slice(0, 8).toUpperCase()}`,
            description: exp.remark || 'Operating Expense',
            paidFromAccount: paidFrom,
            amount: amt
          });
        }

        return {
          rows,
          summary: {
            totalExpenses: totalExp,
            bankCapitalExpenses: bankExp,
            assetsCashExpenses: assetsExp,
            expenseCount: rows.length
          }
        };
      })
    );
  }

  // ==========================================================================
  // REPORT 06: CASH / ACCOUNT MOVEMENT REPORT
  // ==========================================================================
  getCashMovementReport(filters: CashMovementFilters): Observable<{ rows: CashMovementRow[], summary: CashMovementSummary }> {
    return this.financeTxService.loadAllTransactions().pipe(
      map(allTxs => {
        let rows: CashMovementRow[] = [];

        let bankIn = 0;
        let bankOut = 0;
        let assetsIn = 0;
        let assetsOut = 0;

        let extIn = 0;
        let extOut = 0;
        let internalVol = 0;

        for (const tx of allTxs) {
          if (filters.dateFrom && tx.date < filters.dateFrom) continue;
          if (filters.dateTo && tx.date > filters.dateTo) continue;

          if (filters.transactionType && filters.transactionType !== 'all' && tx.type !== filters.transactionType) {
            continue;
          }

          if (filters.search) {
            const q = filters.search.toLowerCase();
            const matchRef = (tx.reference || '').toLowerCase().includes(q);
            const matchDesc = (tx.description || '').toLowerCase().includes(q);
            const matchLoan = (tx.relatedLoanNumber || '').toLowerCase().includes(q);
            if (!matchRef && !matchDesc && !matchLoan) continue;
          }

          const isInternal = tx.type === 'Transfer';
          let srcAcc = tx.sourceAccount;
          let destAcc = tx.sourceAccount;

          if (isInternal) {
            const parts = tx.sourceAccount.split('→');
            srcAcc = parts[0]?.trim() || 'Bank Capital';
            destAcc = parts[1]?.trim() || 'Assets / Cash';
            const transferAmt = tx.transferAmount || 0;
            internalVol += transferAmt;

            // Internal Transfer movement:
            // Does NOT affect company external in / out!
            if (srcAcc === 'Bank Capital') bankOut += transferAmt;
            if (srcAcc === 'Assets / Cash') assetsOut += transferAmt;
            if (destAcc === 'Bank Capital') bankIn += transferAmt;
            if (destAcc === 'Assets / Cash') assetsIn += transferAmt;

            // Account filter check
            if (filters.account && filters.account !== 'all') {
              if (srcAcc !== filters.account && destAcc !== filters.account) continue;
            }

            rows.push({
              date: tx.date,
              reference: tx.reference,
              type: tx.type,
              description: tx.description,
              sourceAccount: srcAcc,
              destinationAccount: destAcc,
              moneyIn: transferAmt,
              moneyOut: transferAmt,
              isInternalTransfer: true,
              relatedLoanNumber: tx.relatedLoanNumber
            });
            continue;
          }

          // External transactions
          const mIn = tx.moneyIn || 0;
          const mOut = tx.moneyOut || 0;

          if (filters.account && filters.account !== 'all') {
            if (!tx.sourceAccount.includes(filters.account)) continue;
          }

          if (filters.movement && filters.movement !== 'all') {
            if (filters.movement === 'in' && !mIn) continue;
            if (filters.movement === 'out' && !mOut) continue;
          }

          if (tx.sourceAccount.includes('Bank Capital')) {
            bankIn += mIn;
            bankOut += mOut;
          } else if (tx.sourceAccount.includes('Assets / Cash')) {
            assetsIn += mIn;
            assetsOut += mOut;
          }

          extIn += mIn;
          extOut += mOut;

          rows.push({
            date: tx.date,
            reference: tx.reference,
            type: tx.type,
            description: tx.description,
            sourceAccount: tx.sourceAccount,
            destinationAccount: tx.sourceAccount,
            moneyIn: tx.moneyIn,
            moneyOut: tx.moneyOut,
            isInternalTransfer: false,
            relatedLoanNumber: tx.relatedLoanNumber
          });
        }

        return {
          rows,
          summary: {
            bankCapitalIn: bankIn,
            bankCapitalOut: bankOut,
            bankCapitalNet: bankIn - bankOut,

            assetsCashIn: assetsIn,
            assetsCashOut: assetsOut,
            assetsCashNet: assetsIn - assetsOut,

            companyExternalIn: extIn,
            companyExternalOut: extOut,
            companyExternalNet: extIn - extOut,
            internalTransfersVolume: internalVol
          }
        };
      })
    );
  }
}
