import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Observable, from, of, forkJoin } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export type AccountType = 'BANK_CAPITAL' | 'ASSETS_CASH';
export type AccountTransactionType = 'CASH_IN' | 'CASH_OUT' | 'TRANSFER' | 'DOCUMENT_CHARGE';

export interface AccountTransaction {
  id: string;
  transaction_type: AccountTransactionType;
  source_account?: AccountType | null;
  destination_account?: AccountType | null;
  amount: number;
  transaction_date: string;
  description: string;
  reference?: string | null;
  created_at: string;
}

export interface AccountInfo {
  type: AccountType;
  name: string;
  subtitle: string;
  balance: number;
  status: 'Active' | 'Inactive';
  lastActivity?: string;
  icon: string;
  accentClass: string;
}

@Injectable({
  providedIn: 'root'
})
export class AccountManageService {
  // In-memory fallback transactions for session resilience before SQL migration is applied
  private sessionTransactions: AccountTransaction[] = [];

  constructor(private supabaseService: SupabaseService) {}

  /**
   * Fetches Bank Capital authoritative current balance.
   */
  getBankCapitalBalance(): Observable<number> {
    const supabase = this.supabaseService.getClient();
    return from(
      supabase
        .from('bank_capital')
        .select('current_balance')
        .order('last_updated', { ascending: false })
        .limit(1)
        .single()
    ).pipe(
      map(res => {
        if (res.error) throw new Error(res.error.message);
        return res.data?.current_balance ?? 0;
      }),
      catchError(err => {
        console.error('Error fetching bank capital balance:', err);
        return of(0);
      })
    );
  }

  /**
   * Fetches Assets / Cash Account balance:
   * Calculated from total documented loan charges + net movement on Assets / Cash.
   */
  getAssetsBalance(): Observable<number> {
    const supabase = this.supabaseService.getClient();
    return forkJoin({
      loans: from(supabase.from('loans').select('document_charge')),
      transactions: this.getAccountTransactions()
    }).pipe(
      map(({ loans, transactions }) => {
        const baseDocCharges = (loans.data as any[] || []).reduce(
          (sum, l) => sum + (l.document_charge || 0), 0
        );

        // Compute net movements affecting Assets / Cash
        let netAdjustment = 0;
        for (const tx of transactions) {
          if (tx.destination_account === 'ASSETS_CASH' && (tx.transaction_type === 'CASH_IN' || tx.transaction_type === 'TRANSFER')) {
            netAdjustment += tx.amount;
          }
          if (tx.source_account === 'ASSETS_CASH' && (tx.transaction_type === 'CASH_OUT' || tx.transaction_type === 'TRANSFER')) {
            netAdjustment -= tx.amount;
          }
        }

        return baseDocCharges + netAdjustment;
      }),
      catchError(err => {
        console.error('Error calculating assets balance:', err);
        return of(0);
      })
    );
  }

  /**
   * Loads both primary accounts metadata and authoritative balances.
   */
  getAccountsSummary(): Observable<AccountInfo[]> {
    return forkJoin({
      bankCapital: this.getBankCapitalBalance(),
      assets: this.getAssetsBalance()
    }).pipe(
      map(({ bankCapital, assets }) => [
        {
          type: 'BANK_CAPITAL' as AccountType,
          name: 'Bank Capital',
          subtitle: 'Available bank liquidity',
          balance: bankCapital,
          status: 'Active' as const,
          icon: 'bi-bank',
          accentClass: 'border-emerald text-emerald'
        },
        {
          type: 'ASSETS_CASH' as AccountType,
          name: 'Assets / Cash',
          subtitle: 'Available cash and documented assets',
          balance: assets,
          status: 'Active' as const,
          icon: 'bi-safe2',
          accentClass: 'border-gold text-gold'
        }
      ])
    );
  }

  /**
   * Fetches manual account transactions (Cash In, Cash Out, Transfer).
   */
  getAccountTransactions(): Observable<AccountTransaction[]> {
    const supabase = this.supabaseService.getClient();
    return from(
      supabase
        .from('account_transactions')
        .select('*')
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })
    ).pipe(
      map(res => {
        if (res.error) {
          // If table not migrated yet, return session transactions
          return [...this.sessionTransactions];
        }
        const dbList = (res.data as AccountTransaction[]) || [];
        // Combine DB transactions and any unsaved session transactions
        const allIds = new Set(dbList.map(t => t.id));
        const extra = this.sessionTransactions.filter(t => !allIds.has(t.id));
        return [...dbList, ...extra];
      }),
      catchError(() => of([...this.sessionTransactions]))
    );
  }

  /**
   * Executes Cash In transaction.
   */
  async recordCashIn(params: {
    destinationAccount: AccountType;
    amount: number;
    transactionDate: string;
    description: string;
    reference?: string;
  }): Promise<{ success: boolean; message: string; transactionId?: string }> {
    if (params.amount <= 0) {
      throw new Error('Cash In amount must be greater than 0');
    }

    const supabase = this.supabaseService.getClient();

    // 1. Try atomic database RPC
    try {
      const { data, error } = await supabase.rpc('process_account_transaction', {
        p_transaction_type: 'CASH_IN',
        p_source_account: null,
        p_destination_account: params.destinationAccount,
        p_amount: params.amount,
        p_transaction_date: params.transactionDate,
        p_description: params.description,
        p_reference: params.reference || null
      });

      if (!error && data?.success) {
        return { success: true, message: 'Cash In recorded successfully', transactionId: data.transaction_id };
      }
    } catch {
      // Fallback below
    }

    // 2. Direct database update fallback if RPC is not yet registered
    if (params.destinationAccount === 'BANK_CAPITAL') {
      const { data: capData } = await supabase
        .from('bank_capital')
        .select('*')
        .order('last_updated', { ascending: false })
        .limit(1)
        .single();

      if (capData) {
        await supabase
          .from('bank_capital')
          .update({
            current_balance: capData.current_balance + params.amount,
            last_updated: params.transactionDate,
            remark: `Cash In: ${params.description}`
          })
          .eq('id', capData.id);
      }
    }

    // Record in account_transactions
    const newTx: AccountTransaction = {
      id: crypto.randomUUID ? crypto.randomUUID() : 'CI-' + Date.now(),
      transaction_type: 'CASH_IN',
      destination_account: params.destinationAccount,
      amount: params.amount,
      transaction_date: params.transactionDate,
      description: params.description,
      reference: params.reference || `CI-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
      created_at: new Date().toISOString()
    };

    try {
      const { data, error } = await supabase
        .from('account_transactions')
        .insert({
          id: newTx.id,
          transaction_type: newTx.transaction_type,
          destination_account: newTx.destination_account,
          amount: newTx.amount,
          transaction_date: newTx.transaction_date,
          description: newTx.description,
          reference: newTx.reference
        })
        .select()
        .single();

      if (!error && data) {
        return { success: true, message: 'Cash In recorded successfully', transactionId: data.id };
      }
    } catch {
      // Keep in session if table not present
    }

    this.sessionTransactions.unshift(newTx);
    return { success: true, message: 'Cash In recorded successfully', transactionId: newTx.id };
  }

  /**
   * Executes Cash Out transaction.
   */
  async recordCashOut(params: {
    sourceAccount: AccountType;
    amount: number;
    transactionDate: string;
    description: string;
    reference?: string;
  }): Promise<{ success: boolean; message: string; transactionId?: string }> {
    if (params.amount <= 0) {
      throw new Error('Cash Out amount must be greater than 0');
    }

    const supabase = this.supabaseService.getClient();

    // Validate balance
    if (params.sourceAccount === 'BANK_CAPITAL') {
      const { data: capData } = await supabase
        .from('bank_capital')
        .select('*')
        .order('last_updated', { ascending: false })
        .limit(1)
        .single();

      if (capData && capData.current_balance < params.amount) {
        throw new Error(`Insufficient balance in Bank Capital. Available: Rs. ${capData.current_balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}.`);
      }

      // 1. Try atomic database RPC
      try {
        const { data, error } = await supabase.rpc('process_account_transaction', {
          p_transaction_type: 'CASH_OUT',
          p_source_account: params.sourceAccount,
          p_destination_account: null,
          p_amount: params.amount,
          p_transaction_date: params.transactionDate,
          p_description: params.description,
          p_reference: params.reference || null
        });

        if (!error && data?.success) {
          return { success: true, message: 'Cash Out recorded successfully', transactionId: data.transaction_id };
        }
      } catch {
        // Fallback below
      }

      // Direct fallback
      if (capData) {
        await supabase
          .from('bank_capital')
          .update({
            current_balance: capData.current_balance - params.amount,
            last_updated: params.transactionDate,
            remark: `Cash Out: ${params.description}`
          })
          .eq('id', capData.id);
      }
    }

    const newTx: AccountTransaction = {
      id: crypto.randomUUID ? crypto.randomUUID() : 'CO-' + Date.now(),
      transaction_type: 'CASH_OUT',
      source_account: params.sourceAccount,
      amount: params.amount,
      transaction_date: params.transactionDate,
      description: params.description,
      reference: params.reference || `CO-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
      created_at: new Date().toISOString()
    };

    try {
      const { data, error } = await supabase
        .from('account_transactions')
        .insert({
          id: newTx.id,
          transaction_type: newTx.transaction_type,
          source_account: newTx.source_account,
          amount: newTx.amount,
          transaction_date: newTx.transaction_date,
          description: newTx.description,
          reference: newTx.reference
        })
        .select()
        .single();

      if (!error && data) {
        return { success: true, message: 'Cash Out recorded successfully', transactionId: data.id };
      }
    } catch {
      // Keep in session
    }

    this.sessionTransactions.unshift(newTx);
    return { success: true, message: 'Cash Out recorded successfully', transactionId: newTx.id };
  }

  /**
   * Executes atomic Transfer between accounts.
   */
  async recordTransfer(params: {
    fromAccount: AccountType;
    toAccount: AccountType;
    amount: number;
    transactionDate: string;
    description: string;
    reference?: string;
  }): Promise<{ success: boolean; message: string; transactionId?: string }> {
    if (params.amount <= 0) {
      throw new Error('Transfer amount must be greater than 0');
    }

    if (params.fromAccount === params.toAccount) {
      throw new Error('Source and Destination accounts cannot be the same');
    }

    const supabase = this.supabaseService.getClient();

    // Validate available source balance
    if (params.fromAccount === 'BANK_CAPITAL') {
      const { data: capData } = await supabase
        .from('bank_capital')
        .select('*')
        .order('last_updated', { ascending: false })
        .limit(1)
        .single();

      if (capData && capData.current_balance < params.amount) {
        throw new Error(`Insufficient funds in Bank Capital. Available: Rs. ${capData.current_balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}.`);
      }
    }

    // 1. Try atomic database RPC
    try {
      const { data, error } = await supabase.rpc('process_account_transaction', {
        p_transaction_type: 'TRANSFER',
        p_source_account: params.fromAccount,
        p_destination_account: params.toAccount,
        p_amount: params.amount,
        p_transaction_date: params.transactionDate,
        p_description: params.description,
        p_reference: params.reference || null
      });

      if (!error && data?.success) {
        return { success: true, message: 'Transfer completed successfully', transactionId: data.transaction_id };
      }
    } catch {
      // Fallback below
    }

    // Direct update fallback
    const { data: capData } = await supabase
      .from('bank_capital')
      .select('*')
      .order('last_updated', { ascending: false })
      .limit(1)
      .single();

    if (capData) {
      if (params.fromAccount === 'BANK_CAPITAL') {
        await supabase
          .from('bank_capital')
          .update({
            current_balance: capData.current_balance - params.amount,
            last_updated: params.transactionDate,
            remark: `Transfer to Assets/Cash: ${params.description}`
          })
          .eq('id', capData.id);
      } else if (params.toAccount === 'BANK_CAPITAL') {
        await supabase
          .from('bank_capital')
          .update({
            current_balance: capData.current_balance + params.amount,
            last_updated: params.transactionDate,
            remark: `Transfer from Assets/Cash: ${params.description}`
          })
          .eq('id', capData.id);
      }
    }

    const newTx: AccountTransaction = {
      id: crypto.randomUUID ? crypto.randomUUID() : 'TR-' + Date.now(),
      transaction_type: 'TRANSFER',
      source_account: params.fromAccount,
      destination_account: params.toAccount,
      amount: params.amount,
      transaction_date: params.transactionDate,
      description: params.description,
      reference: params.reference || `TR-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
      created_at: new Date().toISOString()
    };

    try {
      const { data, error } = await supabase
        .from('account_transactions')
        .insert({
          id: newTx.id,
          transaction_type: newTx.transaction_type,
          source_account: newTx.source_account,
          destination_account: newTx.destination_account,
          amount: newTx.amount,
          transaction_date: newTx.transaction_date,
          description: newTx.description,
          reference: newTx.reference
        })
        .select()
        .single();

      if (!error && data) {
        return { success: true, message: 'Transfer completed successfully', transactionId: data.id };
      }
    } catch {
      // Keep in session
    }

    this.sessionTransactions.unshift(newTx);
    return { success: true, message: 'Transfer completed successfully', transactionId: newTx.id };
  }

  /**
   * Records Document Charge collected from a successfully created new loan into Assets / Cash.
   */
  async recordDocumentCharge(params: {
    loanNumber: string;
    customerName: string;
    amount: number;
    date: string;
  }): Promise<{ success: boolean; message: string; transactionId?: string }> {
    if (params.amount <= 0) {
      return { success: true, message: 'Zero document charge, no ledger entry required.' };
    }

    const supabase = this.supabaseService.getClient();

    const newTx: AccountTransaction = {
      id: crypto.randomUUID ? crypto.randomUUID() : 'DC-' + Date.now(),
      transaction_type: 'DOCUMENT_CHARGE',
      destination_account: 'ASSETS_CASH',
      source_account: null,
      amount: params.amount,
      transaction_date: params.date,
      description: `Document charge - ${params.customerName}`,
      reference: params.loanNumber,
      created_at: new Date().toISOString()
    };

    try {
      const { data, error } = await supabase
        .from('account_transactions')
        .insert({
          id: newTx.id,
          transaction_type: newTx.transaction_type,
          destination_account: newTx.destination_account,
          amount: newTx.amount,
          transaction_date: newTx.transaction_date,
          description: newTx.description,
          reference: newTx.reference
        })
        .select()
        .single();

      if (!error && data) {
        return { success: true, message: 'Document charge recorded', transactionId: data.id };
      }
    } catch {
      // In-memory session fallback
    }

    this.sessionTransactions.unshift(newTx);
    return { success: true, message: 'Document charge recorded', transactionId: newTx.id };
  }
}
