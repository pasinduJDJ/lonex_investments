import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AnalysisService, formatLocalIsoDate, parseCalendarDate } from './analysis.service';
import { Client, LoanWithClient, Payment } from './loan-manage.service';
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

// -------------------------------------------------------------
// Report 01: Loan History Interfaces
// -------------------------------------------------------------
export interface LoanHistoryRow {
  loanId: string;
  loanNumber: string;
  clientId: string;
  customerName: string;
  nicNumber: string;
  mobileNumber: string;
  loanDate: string;
  principalAmount: number;
  totalAmountDue: number;
  totalPaid: number;
  remainingAmount: number;
  installmentAmount: number;
  loanType: string;
  totalInstallments: number;
  paidInstallments: number;
  remainingInstallments: number;
  expectedEndDate: string;
  status: 'Active' | 'Completed' | 'Overdue';
}

export interface LoanHistoryFilters {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: 'all' | 'active' | 'completed' | 'overdue';
  loanType?: 'all' | 'daily' | 'weekly' | 'monthly';
}

export interface LoanHistorySummary {
  totalLoans: number;
  totalPrincipal: number;
  totalDue: number;
  totalPaid: number;
  totalRemaining: number;
  activeCount: number;
  completedCount: number;
  overdueCount: number;
}

// -------------------------------------------------------------
// Report 02: Active Loans Interfaces
// -------------------------------------------------------------
export interface ActiveLoanRow {
  loanId: string;
  loanNumber: string;
  clientId: string;
  customerName: string;
  nicNumber: string;
  mobileNumber: string;
  loanDate: string;
  principalAmount: number;
  totalAmountDue: number;
  totalPaid: number;
  remainingAmount: number;
  installmentAmount: number;
  loanType: string;
  paidInstallments: number;
  remainingInstallments: number;
  totalInstallments: number;
  nextExpectedPaymentDate: string;
  expectedEndDate: string;
  progressPercent: number;
  status: 'Active' | 'Overdue';
  isOverdue: boolean;
}

export interface ActiveLoansFilters {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  loanType?: 'all' | 'daily' | 'weekly' | 'monthly';
  overdueFilter?: 'all' | 'active-only' | 'overdue-only';
}

export interface ActiveLoansSummary {
  totalActiveLoans: number;
  totalPrincipal: number;
  totalDue: number;
  totalPaid: number;
  totalOutstanding: number;
  dueThisWeekCount: number;
  dueThisWeekAmount: number;
}

// -------------------------------------------------------------
// Report 03: Completed Loans Interfaces
// -------------------------------------------------------------
export interface CompletedLoanRow {
  loanId: string;
  loanNumber: string;
  clientId: string;
  customerName: string;
  nicNumber: string;
  mobileNumber: string;
  loanDate: string;
  principalAmount: number;
  totalAmountDue: number;
  totalPaid: number;
  completionDate: string;
  originalExpectedEndDate: string;
  loanType: string;
  status: 'Completed';
}

export interface CompletedLoansFilters {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  completionDateFrom?: string;
  completionDateTo?: string;
  loanType?: 'all' | 'daily' | 'weekly' | 'monthly';
}

export interface CompletedLoansSummary {
  totalCompletedLoans: number;
  totalPrincipal: number;
  totalCollected: number;
  completedDuringPeriodCount: number;
}

// -------------------------------------------------------------
// Report 04: Delayed / Overdue Loans Interfaces
// (100% Aligned with Analysis -> Late Payments)
// -------------------------------------------------------------
export interface OverdueLoanRow {
  loanId: string;
  loanNumber: string;
  clientId: string;
  customerName: string;
  nicNumber: string;
  mobileNumber: string;
  loanDate: string;
  loanType: string;
  expectedPaymentDate: string;
  expectedInstalmentAmount: number;
  totalPaid: number;
  remainingBalance: number;
  overdueInstallments: number;
  overdueAmount: number;
  daysLate: number;
  expectedEndDate: string;
  status: 'Due Today' | 'Late' | 'Overdue';
}

export interface OverdueLoansFilters {
  search?: string;
  loanType?: 'all' | 'daily' | 'weekly' | 'monthly';
  severity?: 'all' | '1-7' | '8-30' | '31+';
}

export interface OverdueLoansSummary {
  totalOverdueLoans: number;
  totalOverdueAmount: number;
  totalOutstandingBalance: number;
  count1To7Days: number;
  count8To30Days: number;
  count31PlusDays: number;
}

// -------------------------------------------------------------
// Report 05: Repayment Schedule Interfaces
// -------------------------------------------------------------
export interface EffectiveScheduleItem {
  installmentNumber: number;
  expectedDate: string;
  expectedAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentDate?: string;
  status: 'Paid' | 'Partially Paid' | 'Due' | 'Upcoming' | 'Overdue';
}

export interface RepaymentScheduleData {
  loan: LoanWithClient;
  customerName: string;
  nicNumber: string;
  mobileNumber: string;
  loanNumber: string;
  loanDate: string;
  principalAmount: number;
  interestRate: number;
  documentCharge: number;
  totalAmountDue: number;
  totalPaid: number;
  remainingAmount: number;
  installmentAmount: number;
  frequency: string;
  totalInstallments: number;
  paidInstallments: number;
  remainingInstallments: number;
  expectedEndDate: string;
  status: string;
  isRescheduled: boolean;
  scheduleRows: EffectiveScheduleItem[];
  payments: Payment[];
}

@Injectable({
  providedIn: 'root'
})
export class LoanReportService {

  constructor(
    private supabaseService: SupabaseService,
    private analysisService: AnalysisService
  ) {}

  /**
   * Helper to load core raw loans and payments datasets from Supabase (READ-ONLY)
   */
  private fetchRawData(): Observable<{ loans: LoanWithClient[]; payments: any[] }> {
    const supabase = this.supabaseService.getClient();

    return from(
      Promise.all([
        supabase
          .from('loans')
          .select(`
            *,
            client:clients(*)
          `)
          .order('start_date', { ascending: false }),
        supabase
          .from('payments')
          .select(`
            *,
            loans(loan_number, client_id, clients(first_name, last_name, register_number, nic_number, mobile_number))
          `)
          .order('paid_date', { ascending: false })
      ])
    ).pipe(
      map(([loansRes, paymentsRes]) => {
        if (loansRes.error) throw new Error('Error fetching loans: ' + loansRes.error.message);
        if (paymentsRes.error) throw new Error('Error fetching payments: ' + paymentsRes.error.message);

        return {
          loans: (loansRes.data || []) as LoanWithClient[],
          payments: (paymentsRes.data || []) as any[]
        };
      })
    );
  }

  // =========================================================================
  // REPORT 01: LOAN HISTORY REPORT (100% READ-ONLY)
  // =========================================================================
  getLoanHistoryReport(filters: LoanHistoryFilters = {}): Observable<{
    rows: LoanHistoryRow[];
    summary: LoanHistorySummary;
  }> {
    return this.fetchRawData().pipe(
      map(({ loans, payments }) => {
        // Run authoritative derivation bundle
        const bundle = this.analysisService.deriveAnalysisBundle(loans, payments);
        const overdueMap = new Set(bundle.latePayments.map(lp => lp.loanId));

        let rows: LoanHistoryRow[] = loans.map(loan => {
          const client = loan.client;
          const customerName = client ? `${client.first_name || ''} ${client.last_name || ''}`.trim() : 'Unknown';
          const nicNumber = client?.nic_number || '-';
          const mobileNumber = client?.mobile_number || client?.home_number || '-';
          const loanDate = loan.start_date || loan.created_at?.split('T')[0] || '-';

          const totalInstallments = loan.installments && loan.installments > 0
            ? loan.installments
            : Math.max(1, Math.round(loan.total_amount_due / (loan.principal_amount > 0 ? (loan.total_amount_due / 20) : 1)));

          const installmentAmount = Math.max(1, Math.round(loan.total_amount_due / totalInstallments));
          const paidInstallments = Math.floor(loan.total_paid / installmentAmount);
          const remainingInstallments = Math.max(0, totalInstallments - paidInstallments);

          const isCompleted = loan.status === 'closed' || loan.remaining_amount <= 0;
          const isOverdue = !isCompleted && overdueMap.has(loan.id);

          let displayStatus: 'Active' | 'Completed' | 'Overdue' = 'Active';
          if (isCompleted) {
            displayStatus = 'Completed';
          } else if (isOverdue) {
            displayStatus = 'Overdue';
          }

          return {
            loanId: loan.id,
            loanNumber: loan.loan_number,
            clientId: loan.client_id,
            customerName,
            nicNumber,
            mobileNumber,
            loanDate,
            principalAmount: Number(loan.principal_amount) || 0,
            totalAmountDue: Number(loan.total_amount_due) || 0,
            totalPaid: Number(loan.total_paid) || 0,
            remainingAmount: Number(loan.remaining_amount) || 0,
            installmentAmount,
            loanType: (loan.loan_type || 'monthly').toUpperCase(),
            totalInstallments,
            paidInstallments,
            remainingInstallments,
            expectedEndDate: loan.end_date || '-',
            status: displayStatus
          };
        });

        // Filter by Date (authoritative loan date / start_date)
        if (filters.dateFrom) {
          rows = rows.filter(r => r.loanDate !== '-' && r.loanDate >= filters.dateFrom!);
        }
        if (filters.dateTo) {
          rows = rows.filter(r => r.loanDate !== '-' && r.loanDate <= filters.dateTo!);
        }

        // Filter by Status
        if (filters.status && filters.status !== 'all') {
          rows = rows.filter(r => r.status.toLowerCase() === filters.status!.toLowerCase());
        }

        // Filter by Loan Type / Frequency
        if (filters.loanType && filters.loanType !== 'all') {
          rows = rows.filter(r => r.loanType.toLowerCase() === filters.loanType!.toLowerCase());
        }

        // Search Filter
        if (filters.search && filters.search.trim()) {
          const q = filters.search.trim().toLowerCase();
          rows = rows.filter(r =>
            r.loanNumber.toLowerCase().includes(q) ||
            r.customerName.toLowerCase().includes(q) ||
            r.nicNumber.toLowerCase().includes(q) ||
            r.mobileNumber.toLowerCase().includes(q)
          );
        }

        const summary: LoanHistorySummary = {
          totalLoans: rows.length,
          totalPrincipal: rows.reduce((s, r) => s + r.principalAmount, 0),
          totalDue: rows.reduce((s, r) => s + r.totalAmountDue, 0),
          totalPaid: rows.reduce((s, r) => s + r.totalPaid, 0),
          totalRemaining: rows.reduce((s, r) => s + r.remainingAmount, 0),
          activeCount: rows.filter(r => r.status === 'Active').length,
          completedCount: rows.filter(r => r.status === 'Completed').length,
          overdueCount: rows.filter(r => r.status === 'Overdue').length
        };

        return { rows, summary };
      })
    );
  }

  // =========================================================================
  // REPORT 02: ACTIVE LOANS REPORT (100% READ-ONLY)
  // =========================================================================
  getActiveLoansReport(filters: ActiveLoansFilters = {}): Observable<{
    rows: ActiveLoanRow[];
    summary: ActiveLoansSummary;
  }> {
    return this.fetchRawData().pipe(
      map(({ loans, payments }) => {
        const bundle = this.analysisService.deriveAnalysisBundle(loans, payments);
        const overdueMap = new Map(bundle.latePayments.map(lp => [lp.loanId, lp]));
        const upcomingMap = new Map(bundle.upcomingPayments.map(up => [up.loanId, up]));

        // Filter strictly to non-completed loans
        const activeLoans = loans.filter(l => l.status !== 'closed' && l.remaining_amount > 0);

        let rows: ActiveLoanRow[] = activeLoans.map(loan => {
          const client = loan.client;
          const customerName = client ? `${client.first_name || ''} ${client.last_name || ''}`.trim() : 'Unknown';
          const nicNumber = client?.nic_number || '-';
          const mobileNumber = client?.mobile_number || client?.home_number || '-';
          const loanDate = loan.start_date || loan.created_at?.split('T')[0] || '-';

          const totalInstallments = loan.installments && loan.installments > 0
            ? loan.installments
            : Math.max(1, Math.round(loan.total_amount_due / (loan.principal_amount > 0 ? (loan.total_amount_due / 20) : 1)));

          const installmentAmount = Math.max(1, Math.round(loan.total_amount_due / totalInstallments));
          const paidInstallments = Math.floor(loan.total_paid / installmentAmount);
          const remainingInstallments = Math.max(0, totalInstallments - paidInstallments);
          const progressPercent = Math.min(100, Math.round((loan.total_paid / loan.total_amount_due) * 100));

          const isOverdue = overdueMap.has(loan.id);
          const nextPayment = upcomingMap.get(loan.id);
          const nextDate = isOverdue
            ? overdueMap.get(loan.id)?.expectedPaymentDate || '-'
            : nextPayment?.expectedDate || '-';

          return {
            loanId: loan.id,
            loanNumber: loan.loan_number,
            clientId: loan.client_id,
            customerName,
            nicNumber,
            mobileNumber,
            loanDate,
            principalAmount: Number(loan.principal_amount) || 0,
            totalAmountDue: Number(loan.total_amount_due) || 0,
            totalPaid: Number(loan.total_paid) || 0,
            remainingAmount: Number(loan.remaining_amount) || 0,
            installmentAmount,
            loanType: (loan.loan_type || 'monthly').toUpperCase(),
            paidInstallments,
            remainingInstallments,
            totalInstallments,
            nextExpectedPaymentDate: nextDate,
            expectedEndDate: loan.end_date || '-',
            progressPercent,
            status: isOverdue ? 'Overdue' : 'Active',
            isOverdue
          };
        });

        // Filter by Date
        if (filters.dateFrom) {
          rows = rows.filter(r => r.loanDate !== '-' && r.loanDate >= filters.dateFrom!);
        }
        if (filters.dateTo) {
          rows = rows.filter(r => r.loanDate !== '-' && r.loanDate <= filters.dateTo!);
        }

        // Filter by Frequency / Type
        if (filters.loanType && filters.loanType !== 'all') {
          rows = rows.filter(r => r.loanType.toLowerCase() === filters.loanType!.toLowerCase());
        }

        // Overdue status filter
        if (filters.overdueFilter && filters.overdueFilter !== 'all') {
          if (filters.overdueFilter === 'active-only') {
            rows = rows.filter(r => !r.isOverdue);
          } else if (filters.overdueFilter === 'overdue-only') {
            rows = rows.filter(r => r.isOverdue);
          }
        }

        // Search Filter
        if (filters.search && filters.search.trim()) {
          const q = filters.search.trim().toLowerCase();
          rows = rows.filter(r =>
            r.loanNumber.toLowerCase().includes(q) ||
            r.customerName.toLowerCase().includes(q) ||
            r.nicNumber.toLowerCase().includes(q) ||
            r.mobileNumber.toLowerCase().includes(q)
          );
        }

        const summary: ActiveLoansSummary = {
          totalActiveLoans: rows.length,
          totalPrincipal: rows.reduce((s, r) => s + r.principalAmount, 0),
          totalDue: rows.reduce((s, r) => s + r.totalAmountDue, 0),
          totalPaid: rows.reduce((s, r) => s + r.totalPaid, 0),
          totalOutstanding: rows.reduce((s, r) => s + r.remainingAmount, 0),
          dueThisWeekCount: bundle.kpis.dueThisWeekCount,
          dueThisWeekAmount: bundle.kpis.dueThisWeekAmount
        };

        return { rows, summary };
      })
    );
  }

  // =========================================================================
  // REPORT 03: COMPLETED LOANS REPORT (100% READ-ONLY)
  // =========================================================================
  getCompletedLoansReport(filters: CompletedLoansFilters = {}): Observable<{
    rows: CompletedLoanRow[];
    summary: CompletedLoansSummary;
  }> {
    return this.fetchRawData().pipe(
      map(({ loans, payments }) => {
        // Group payments by loan_id to find authoritative completion date (latest repayment date)
        const paymentsByLoanId = new Map<string, any[]>();
        for (const p of payments) {
          const list = paymentsByLoanId.get(p.loan_id) || [];
          list.push(p);
          paymentsByLoanId.set(p.loan_id, list);
        }

        // Identify completed loans using authoritative criteria (status === 'closed' or remaining_amount <= 0)
        const completedLoans = loans.filter(l => l.status === 'closed' || l.remaining_amount <= 0);

        let rows: CompletedLoanRow[] = completedLoans.map(loan => {
          const client = loan.client;
          const customerName = client ? `${client.first_name || ''} ${client.last_name || ''}`.trim() : 'Unknown';
          const nicNumber = client?.nic_number || '-';
          const mobileNumber = client?.mobile_number || client?.home_number || '-';
          const loanDate = loan.start_date || loan.created_at?.split('T')[0] || '-';

          // Derive completion date: date of the last payment that cleared the balance, or end_date fallback
          const loanPayments = paymentsByLoanId.get(loan.id) || [];
          let completionDate = '-';
          if (loanPayments.length > 0) {
            // Sort ascending to get latest
            const sorted = [...loanPayments].sort((a, b) => (a.paid_date || '').localeCompare(b.paid_date || ''));
            completionDate = sorted[sorted.length - 1].paid_date || '-';
          } else {
            completionDate = loan.end_date || '-';
          }

          return {
            loanId: loan.id,
            loanNumber: loan.loan_number,
            clientId: loan.client_id,
            customerName,
            nicNumber,
            mobileNumber,
            loanDate,
            principalAmount: Number(loan.principal_amount) || 0,
            totalAmountDue: Number(loan.total_amount_due) || 0,
            totalPaid: Number(loan.total_paid) || 0,
            completionDate,
            originalExpectedEndDate: loan.end_date || '-',
            loanType: (loan.loan_type || 'monthly').toUpperCase(),
            status: 'Completed'
          };
        });

        // Filter by Loan Date (start_date)
        if (filters.dateFrom) {
          rows = rows.filter(r => r.loanDate !== '-' && r.loanDate >= filters.dateFrom!);
        }
        if (filters.dateTo) {
          rows = rows.filter(r => r.loanDate !== '-' && r.loanDate <= filters.dateTo!);
        }

        // Filter by Completion Date
        if (filters.completionDateFrom) {
          rows = rows.filter(r => r.completionDate !== '-' && r.completionDate >= filters.completionDateFrom!);
        }
        if (filters.completionDateTo) {
          rows = rows.filter(r => r.completionDate !== '-' && r.completionDate <= filters.completionDateTo!);
        }

        // Filter by Loan Type / Frequency
        if (filters.loanType && filters.loanType !== 'all') {
          rows = rows.filter(r => r.loanType.toLowerCase() === filters.loanType!.toLowerCase());
        }

        // Search Filter
        if (filters.search && filters.search.trim()) {
          const q = filters.search.trim().toLowerCase();
          rows = rows.filter(r =>
            r.loanNumber.toLowerCase().includes(q) ||
            r.customerName.toLowerCase().includes(q) ||
            r.nicNumber.toLowerCase().includes(q) ||
            r.mobileNumber.toLowerCase().includes(q)
          );
        }

        const summary: CompletedLoansSummary = {
          totalCompletedLoans: rows.length,
          totalPrincipal: rows.reduce((s, r) => s + r.principalAmount, 0),
          totalCollected: rows.reduce((s, r) => s + r.totalPaid, 0),
          completedDuringPeriodCount: rows.filter(r => r.completionDate !== '-').length
        };

        return { rows, summary };
      })
    );
  }

  // =========================================================================
  // REPORT 04: DELAYED / OVERDUE LOANS REPORT
  // (100% Single Source of Truth with Analysis -> Late Payments)
  // =========================================================================
  getOverdueLoansReport(filters: OverdueLoansFilters = {}): Observable<{
    rows: OverdueLoanRow[];
    summary: OverdueLoansSummary;
  }> {
    return this.fetchRawData().pipe(
      map(({ loans, payments }) => {
        // Reuse authoritative Late Payments logic from AnalysisService
        const bundle = this.analysisService.deriveAnalysisBundle(loans, payments);
        const loansMap = new Map(loans.map(l => [l.id, l]));

        let rows: OverdueLoanRow[] = bundle.latePayments.map(lp => {
          const originalLoan = loansMap.get(lp.loanId);
          const nicNumber = originalLoan?.client?.nic_number || '-';
          const loanDate = originalLoan?.start_date || originalLoan?.created_at?.split('T')[0] || '-';
          const expectedEndDate = originalLoan?.end_date || '-';

          return {
            loanId: lp.loanId,
            loanNumber: lp.loanNumber,
            clientId: lp.clientId,
            customerName: lp.customerName,
            nicNumber,
            mobileNumber: lp.customerMobile,
            loanDate,
            loanType: lp.loanType.toUpperCase(),
            expectedPaymentDate: lp.expectedPaymentDate,
            expectedInstalmentAmount: lp.expectedInstalmentAmount,
            totalPaid: originalLoan?.total_paid || 0,
            remainingBalance: lp.remainingBalance,
            overdueInstallments: lp.overdueInstallments,
            overdueAmount: lp.overdueAmount, // Represents uncollected due amount, NOT full remaining balance!
            daysLate: lp.daysLate,
            expectedEndDate,
            status: lp.status
          };
        });

        // Filter by Loan Type / Frequency
        if (filters.loanType && filters.loanType !== 'all') {
          rows = rows.filter(r => r.loanType.toLowerCase() === filters.loanType!.toLowerCase());
        }

        // Filter by Overdue Severity
        if (filters.severity && filters.severity !== 'all') {
          if (filters.severity === '1-7') {
            rows = rows.filter(r => r.daysLate >= 1 && r.daysLate <= 7);
          } else if (filters.severity === '8-30') {
            rows = rows.filter(r => r.daysLate >= 8 && r.daysLate <= 30);
          } else if (filters.severity === '31+') {
            rows = rows.filter(r => r.daysLate >= 31);
          }
        }

        // Search Filter
        if (filters.search && filters.search.trim()) {
          const q = filters.search.trim().toLowerCase();
          rows = rows.filter(r =>
            r.loanNumber.toLowerCase().includes(q) ||
            r.customerName.toLowerCase().includes(q) ||
            r.nicNumber.toLowerCase().includes(q) ||
            r.mobileNumber.toLowerCase().includes(q)
          );
        }

        const summary: OverdueLoansSummary = {
          totalOverdueLoans: rows.length,
          totalOverdueAmount: rows.reduce((s, r) => s + r.overdueAmount, 0),
          totalOutstandingBalance: rows.reduce((s, r) => s + r.remainingBalance, 0),
          count1To7Days: rows.filter(r => r.daysLate >= 1 && r.daysLate <= 7).length,
          count8To30Days: rows.filter(r => r.daysLate >= 8 && r.daysLate <= 30).length,
          count31PlusDays: rows.filter(r => r.daysLate >= 31).length
        };

        return { rows, summary };
      })
    );
  }

  // =========================================================================
  // REPORT 05: REPAYMENT SCHEDULE REPORT (100% READ-ONLY)
  // (Reflects current effective schedule including early settlement/reschedule)
  // =========================================================================
  getRepaymentScheduleReport(loanId: string): Observable<RepaymentScheduleData | null> {
    if (!loanId) return of(null);

    const supabase = this.supabaseService.getClient();

    return from(
      Promise.all([
        supabase
          .from('loans')
          .select(`
            *,
            client:clients(*)
          `)
          .eq('id', loanId)
          .single(),
        supabase
          .from('payments')
          .select('*')
          .eq('loan_id', loanId)
          .order('paid_date', { ascending: true }),
        Promise.resolve(
          supabase
            .from('loan_reschedule_history')
            .select('*')
            .eq('loan_id', loanId)
        ).catch(() => ({ data: [], error: null }))
      ])
    ).pipe(
      map(([loanRes, paymentsRes, historyRes]) => {
        if (loanRes.error || !loanRes.data) {
          throw new Error('Loan record not found.');
        }

        const loan = loanRes.data as LoanWithClient;
        const payments = (paymentsRes.data || []) as Payment[];
        const history = (historyRes.data || []) as any[];

        const isRescheduled = history && history.length > 0;
        const client = loan.client;
        const customerName = client ? `${client.first_name || ''} ${client.last_name || ''}`.trim() : 'Unknown';
        const nicNumber = client?.nic_number || '-';
        const mobileNumber = client?.mobile_number || client?.home_number || '-';
        const loanDate = loan.start_date || loan.created_at?.split('T')[0] || '-';

        // Total installments based on current effective loan configuration
        const totalInstallments = loan.installments && loan.installments > 0
          ? loan.installments
          : Math.max(1, Math.round(loan.total_amount_due / (loan.principal_amount > 0 ? (loan.total_amount_due / 20) : 1)));

        const installmentAmount = Math.max(1, Math.round(loan.total_amount_due / totalInstallments));
        const paidInstallments = Math.floor(loan.total_paid / installmentAmount);
        const remainingInstallments = Math.max(0, totalInstallments - paidInstallments);

        // Generate effective schedule rows
        const scheduleRows: EffectiveScheduleItem[] = [];
        const baseDate = parseCalendarDate(loan.start_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Calculate cumulative paid pool
        let remainingPaidPool = loan.total_paid || 0;

        for (let i = 1; i <= totalInstallments; i++) {
          const d = new Date(baseDate);
          if (loan.loan_type === 'daily') {
            d.setDate(d.getDate() + i);
          } else if (loan.loan_type === 'weekly') {
            d.setDate(d.getDate() + (i * 7));
          } else if (loan.loan_type === 'monthly') {
            d.setMonth(d.getMonth() + i);
          }

          const expDateStr = formatLocalIsoDate(d);
          const isDatePast = d < today;

          let paidForThisInstalment = 0;
          let remainingForThisInstalment = installmentAmount;
          let status: 'Paid' | 'Partially Paid' | 'Due' | 'Upcoming' | 'Overdue' = 'Upcoming';

          if (remainingPaidPool >= installmentAmount) {
            paidForThisInstalment = installmentAmount;
            remainingForThisInstalment = 0;
            remainingPaidPool -= installmentAmount;
            status = 'Paid';
          } else if (remainingPaidPool > 0) {
            paidForThisInstalment = remainingPaidPool;
            remainingForThisInstalment = installmentAmount - remainingPaidPool;
            remainingPaidPool = 0;
            status = isDatePast ? 'Overdue' : 'Partially Paid';
          } else {
            status = isDatePast ? 'Overdue' : (d.getTime() === today.getTime() ? 'Due' : 'Upcoming');
          }

          // Match corresponding payment if available
          const matchingPayment = payments[i - 1];

          scheduleRows.push({
            installmentNumber: i,
            expectedDate: expDateStr,
            expectedAmount: installmentAmount,
            paidAmount: paidForThisInstalment,
            remainingAmount: remainingForThisInstalment,
            paymentDate: matchingPayment?.paid_date,
            status
          });
        }

        return {
          loan,
          customerName,
          nicNumber,
          mobileNumber,
          loanNumber: loan.loan_number,
          loanDate,
          principalAmount: Number(loan.principal_amount) || 0,
          interestRate: Number(loan.interest_rate) || 0,
          documentCharge: Number(loan.document_charge) || 0,
          totalAmountDue: Number(loan.total_amount_due) || 0,
          totalPaid: Number(loan.total_paid) || 0,
          remainingAmount: Number(loan.remaining_amount) || 0,
          installmentAmount,
          frequency: (loan.loan_type || 'monthly').toUpperCase(),
          totalInstallments,
          paidInstallments,
          remainingInstallments,
          expectedEndDate: loan.end_date || '-',
          status: loan.status === 'closed' ? 'Completed' : (loan.remaining_amount <= 0 ? 'Completed' : 'Active'),
          isRescheduled,
          scheduleRows,
          payments
        };
      })
    );
  }
}
