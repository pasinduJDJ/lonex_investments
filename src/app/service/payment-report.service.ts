import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { 
  AnalysisService, 
  parseCalendarDate, 
  formatLocalIsoDate,
  LatePaymentItem,
  UpcomingPaymentItem
} from './analysis.service';
import { LoanWithClient } from './loan-manage.service';

// -------------------------------------------------------------
// Report 01: Payment History Interfaces
// -------------------------------------------------------------
export interface PaymentHistoryRow {
  paymentId: string;
  paidDate: string;
  customerName: string;
  nicNumber: string;
  mobileNumber: string;
  loanNumber: string;
  loanType: string;
  loanStatus: string;
  paidAmount: number;
  remark: string;
  recordedDate: string;
}

export interface PaymentHistoryFilters {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  loanType?: 'all' | 'daily' | 'weekly' | 'monthly';
  loanStatus?: 'all' | 'active' | 'closed';
}

export interface PaymentHistorySummary {
  totalPayments: number;
  totalCollected: number;
  averagePayment: number;
}

// -------------------------------------------------------------
// Report 02: Delayed Payments Interfaces
// -------------------------------------------------------------
export interface DelayedPaymentRow {
  loanId: string;
  loanNumber: string;
  clientId: string;
  customerName: string;
  nicNumber: string;
  mobileNumber: string;
  loanType: string;
  expectedPaymentDate: string;
  expectedAmount: number;
  amountPaidTowardObligation: number;
  overdueAmount: number;
  daysLate: number;
  remainingBalance: number;
  remainingInstallments: number;
  status: 'Due Today' | 'Late' | 'Overdue';
}

export interface DelayedPaymentsFilters {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  loanType?: 'all' | 'daily' | 'weekly' | 'monthly';
  severity?: 'all' | '1-7' | '8-30' | '31+';
}

export interface DelayedPaymentsSummary {
  totalDelayedObligations: number;
  totalOverdueAmount: number;
  affectedCustomers: number;
  affectedLoans: number;
  count1To7Days: number;
  count8To30Days: number;
  count31PlusDays: number;
}

// -------------------------------------------------------------
// Report 03: Collection Report Interfaces
// -------------------------------------------------------------
export interface CollectionRow {
  paymentId: string;
  paidDate: string;
  customerName: string;
  nicNumber: string;
  mobileNumber: string;
  loanNumber: string;
  loanType: string;
  paidAmount: number;
  remark: string;
  recordedDate: string;
}

export interface CollectionFilters {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  loanType?: 'all' | 'daily' | 'weekly' | 'monthly';
}

export interface CollectionSummary {
  totalCollected: number;
  transactionCount: number;
  customersPaid: number;
  loansPaid: number;
  averagePayment: number;
  dailyCollections: number;
  weeklyCollections: number;
  monthlyCollections: number;
}

// -------------------------------------------------------------
// Report 04: Upcoming Payments Interfaces
// -------------------------------------------------------------
export interface UpcomingPaymentRow {
  loanId: string;
  loanNumber: string;
  clientId: string;
  customerName: string;
  nicNumber: string;
  mobileNumber: string;
  loanType: string;
  expectedDate: string;
  expectedAmount: number;
  remainingDue: number;
  remainingBalance: number;
  remainingInstallments: number;
  status: 'Due Today' | 'Upcoming';
}

export interface UpcomingPaymentsFilters {
  quickPeriod?: 'today' | 'this_week' | 'next_week' | 'custom';
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  loanType?: 'all' | 'daily' | 'weekly' | 'monthly';
}

export interface UpcomingPaymentsSummary {
  expectedPaymentCount: number;
  customersDue: number;
  loansDue: number;
  totalExpectedCollection: number;
  dailyExpected: number;
  weeklyExpected: number;
  monthlyExpected: number;
}

// -------------------------------------------------------------
// Report 05: Payment Performance Interfaces
// -------------------------------------------------------------
export interface PerformanceFrequencyBreakdown {
  expected: number;
  actual: number;
  difference: number;
  collectionRate: number; // percentage
}

export interface PerformancePeriodRow {
  periodLabel: string;
  expectedAmount: number;
  actualCollected: number;
  difference: number;
  collectionRate: number; // percentage
}

export interface PerformancePaymentRow {
  paymentId: string;
  paidDate: string;
  customerName: string;
  loanNumber: string;
  loanType: string;
  paidAmount: number;
  remark: string;
}

export interface PaymentPerformanceData {
  summary: {
    selectedPeriod: string;
    totalExpected: number;
    totalActual: number;
    totalDifference: number;
    overallCollectionRate: number;
    daily: PerformanceFrequencyBreakdown;
    weekly: PerformanceFrequencyBreakdown;
    monthly: PerformanceFrequencyBreakdown;
  };
  periodRows: PerformancePeriodRow[];
  paymentRows: PerformancePaymentRow[];
}

export interface PaymentPerformanceFilters {
  dateFrom?: string;
  dateTo?: string;
  loanType?: 'all' | 'daily' | 'weekly' | 'monthly';
  search?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentReportService {

  constructor(
    private supabaseService: SupabaseService,
    private analysisService: AnalysisService
  ) {}

  /**
   * Loads core raw loans and payments datasets from Supabase (100% READ-ONLY)
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
            loans(loan_number, loan_type, status, client_id, clients(first_name, last_name, register_number, nic_number, mobile_number))
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
  // REPORT 01: PAYMENT HISTORY REPORT (100% READ-ONLY)
  // =========================================================================
  getPaymentHistoryReport(filters: PaymentHistoryFilters = {}): Observable<{
    rows: PaymentHistoryRow[];
    summary: PaymentHistorySummary;
  }> {
    return this.fetchRawData().pipe(
      map(({ loans, payments }) => {
        const loanMap = new Map<string, LoanWithClient>();
        loans.forEach(l => loanMap.set(l.id, l));

        let rows: PaymentHistoryRow[] = payments.map(p => {
          const matchedLoan = loanMap.get(p.loan_id);
          const loanJoin = p.loans;
          const clientJoin = loanJoin?.clients || matchedLoan?.client;

          const customerName = clientJoin 
            ? `${clientJoin.first_name || ''} ${clientJoin.last_name || ''}`.trim() 
            : 'Unknown Customer';
          const nicNumber = clientJoin?.nic_number || '-';
          const mobileNumber = clientJoin?.mobile_number || clientJoin?.home_number || '-';

          const loanNumber = loanJoin?.loan_number || matchedLoan?.loan_number || 'N/A';
          const rawLoanType = (loanJoin?.loan_type || matchedLoan?.loan_type || 'monthly').toLowerCase();
          const loanType = rawLoanType.toUpperCase();
          const loanStatus = (loanJoin?.status || matchedLoan?.status || 'active').toLowerCase() === 'closed'
            ? 'Completed'
            : 'Active';

          const paidAmount = Number(p.paid_amount || p.amount || 0);
          const paidDate = p.paid_date ? p.paid_date.split('T')[0] : (p.created_at ? p.created_at.split('T')[0] : '-');
          const recordedDate = p.created_at ? p.created_at.split('T')[0] : paidDate;
          const remark = p.remark || '-';

          return {
            paymentId: p.id,
            paidDate,
            customerName,
            nicNumber,
            mobileNumber,
            loanNumber,
            loanType,
            loanStatus,
            paidAmount,
            remark,
            recordedDate
          };
        });

        // Filter by Date (Payment Date)
        if (filters.dateFrom) {
          rows = rows.filter(r => r.paidDate !== '-' && r.paidDate >= filters.dateFrom!);
        }
        if (filters.dateTo) {
          rows = rows.filter(r => r.paidDate !== '-' && r.paidDate <= filters.dateTo!);
        }

        // Filter by Loan Frequency
        if (filters.loanType && filters.loanType !== 'all') {
          const targetType = filters.loanType.toUpperCase();
          rows = rows.filter(r => r.loanType === targetType);
        }

        // Filter by Loan Status
        if (filters.loanStatus && filters.loanStatus !== 'all') {
          const targetStatus = filters.loanStatus === 'closed' ? 'Completed' : 'Active';
          rows = rows.filter(r => r.loanStatus === targetStatus);
        }

        // Filter by Search Query
        if (filters.search && filters.search.trim().length > 0) {
          const q = filters.search.trim().toLowerCase();
          rows = rows.filter(r => 
            r.loanNumber.toLowerCase().includes(q) ||
            r.customerName.toLowerCase().includes(q) ||
            r.nicNumber.toLowerCase().includes(q) ||
            r.mobileNumber.toLowerCase().includes(q) ||
            r.remark.toLowerCase().includes(q)
          );
        }

        // Calculate reliable summary
        const totalPayments = rows.length;
        const totalCollected = rows.reduce((sum, r) => sum + r.paidAmount, 0);
        const averagePayment = totalPayments > 0 ? Math.round(totalCollected / totalPayments) : 0;

        return {
          rows,
          summary: {
            totalPayments,
            totalCollected,
            averagePayment
          }
        };
      })
    );
  }

  // =========================================================================
  // REPORT 02: DELAYED PAYMENT REPORT (100% READ-ONLY)
  // Reuses exact AnalysisService.deriveAnalysisBundle().latePayments logic
  // =========================================================================
  getDelayedPaymentsReport(filters: DelayedPaymentsFilters = {}): Observable<{
    rows: DelayedPaymentRow[];
    summary: DelayedPaymentsSummary;
  }> {
    return this.fetchRawData().pipe(
      map(({ loans, payments }) => {
        // Reuse shared Analysis derivation engine
        const bundle = this.analysisService.deriveAnalysisBundle(loans, payments);
        const loanMap = new Map<string, LoanWithClient>();
        loans.forEach(l => loanMap.set(l.id, l));

        let rows: DelayedPaymentRow[] = bundle.latePayments.map(lp => {
          const matchedLoan = loanMap.get(lp.loanId);
          const nicNumber = matchedLoan?.client?.nic_number || '-';
          const mobileNumber = lp.customerMobile || matchedLoan?.client?.mobile_number || '-';

          // Partial payment calculation toward current installment
          const installmentAmount = lp.expectedInstalmentAmount || 1;
          const totalPaid = matchedLoan ? Number(matchedLoan.total_paid || 0) : 0;
          const partialPaidTowardInstalment = totalPaid % installmentAmount;

          const remainingInstallments = Math.max(0, lp.totalInstallments - lp.paidInstallments);

          return {
            loanId: lp.loanId,
            loanNumber: lp.loanNumber,
            clientId: lp.clientId,
            customerName: lp.customerName,
            nicNumber,
            mobileNumber,
            loanType: (lp.loanType || 'monthly').toUpperCase(),
            expectedPaymentDate: lp.expectedPaymentDate,
            expectedAmount: lp.expectedInstalmentAmount,
            amountPaidTowardObligation: partialPaidTowardInstalment,
            overdueAmount: lp.overdueAmount,
            daysLate: lp.daysLate,
            remainingBalance: lp.remainingBalance,
            remainingInstallments,
            status: lp.status
          };
        });

        // Filter by Expected Payment Date
        if (filters.dateFrom) {
          rows = rows.filter(r => r.expectedPaymentDate >= filters.dateFrom!);
        }
        if (filters.dateTo) {
          rows = rows.filter(r => r.expectedPaymentDate <= filters.dateTo!);
        }

        // Filter by Loan Frequency
        if (filters.loanType && filters.loanType !== 'all') {
          const targetType = filters.loanType.toUpperCase();
          rows = rows.filter(r => r.loanType === targetType);
        }

        // Filter by Severity
        if (filters.severity && filters.severity !== 'all') {
          if (filters.severity === '1-7') {
            rows = rows.filter(r => r.daysLate >= 1 && r.daysLate <= 7);
          } else if (filters.severity === '8-30') {
            rows = rows.filter(r => r.daysLate >= 8 && r.daysLate <= 30);
          } else if (filters.severity === '31+') {
            rows = rows.filter(r => r.daysLate >= 31);
          }
        }

        // Filter by Search Query
        if (filters.search && filters.search.trim().length > 0) {
          const q = filters.search.trim().toLowerCase();
          rows = rows.filter(r => 
            r.loanNumber.toLowerCase().includes(q) ||
            r.customerName.toLowerCase().includes(q) ||
            r.nicNumber.toLowerCase().includes(q) ||
            r.mobileNumber.toLowerCase().includes(q)
          );
        }

        // Calculate summary
        const totalDelayedObligations = rows.length;
        const totalOverdueAmount = rows.reduce((sum, r) => sum + r.overdueAmount, 0);
        const affectedCustomers = new Set(rows.map(r => r.clientId)).size;
        const affectedLoans = new Set(rows.map(r => r.loanId)).size;

        const count1To7Days = rows.filter(r => r.daysLate >= 1 && r.daysLate <= 7).length;
        const count8To30Days = rows.filter(r => r.daysLate >= 8 && r.daysLate <= 30).length;
        const count31PlusDays = rows.filter(r => r.daysLate >= 31).length;

        return {
          rows,
          summary: {
            totalDelayedObligations,
            totalOverdueAmount,
            affectedCustomers,
            affectedLoans,
            count1To7Days,
            count8To30Days,
            count31PlusDays
          }
        };
      })
    );
  }

  // =========================================================================
  // REPORT 03: COLLECTION REPORT (100% READ-ONLY)
  // =========================================================================
  getCollectionReport(filters: CollectionFilters = {}): Observable<{
    rows: CollectionRow[];
    summary: CollectionSummary;
  }> {
    return this.fetchRawData().pipe(
      map(({ loans, payments }) => {
        const loanMap = new Map<string, LoanWithClient>();
        loans.forEach(l => loanMap.set(l.id, l));

        let rows: CollectionRow[] = payments.map(p => {
          const matchedLoan = loanMap.get(p.loan_id);
          const loanJoin = p.loans;
          const clientJoin = loanJoin?.clients || matchedLoan?.client;

          const customerName = clientJoin 
            ? `${clientJoin.first_name || ''} ${clientJoin.last_name || ''}`.trim() 
            : 'Unknown Customer';
          const nicNumber = clientJoin?.nic_number || '-';
          const mobileNumber = clientJoin?.mobile_number || clientJoin?.home_number || '-';

          const loanNumber = loanJoin?.loan_number || matchedLoan?.loan_number || 'N/A';
          const rawLoanType = (loanJoin?.loan_type || matchedLoan?.loan_type || 'monthly').toLowerCase();
          const loanType = rawLoanType.toUpperCase();

          const paidAmount = Number(p.paid_amount || p.amount || 0);
          const paidDate = p.paid_date ? p.paid_date.split('T')[0] : (p.created_at ? p.created_at.split('T')[0] : '-');
          const recordedDate = p.created_at ? p.created_at.split('T')[0] : paidDate;
          const remark = p.remark || '-';

          return {
            paymentId: p.id,
            paidDate,
            customerName,
            nicNumber,
            mobileNumber,
            loanNumber,
            loanType,
            paidAmount,
            remark,
            recordedDate
          };
        });

        // Filter by Date (Collection Date)
        if (filters.dateFrom) {
          rows = rows.filter(r => r.paidDate !== '-' && r.paidDate >= filters.dateFrom!);
        }
        if (filters.dateTo) {
          rows = rows.filter(r => r.paidDate !== '-' && r.paidDate <= filters.dateTo!);
        }

        // Filter by Loan Frequency
        if (filters.loanType && filters.loanType !== 'all') {
          const targetType = filters.loanType.toUpperCase();
          rows = rows.filter(r => r.loanType === targetType);
        }

        // Filter by Search Query
        if (filters.search && filters.search.trim().length > 0) {
          const q = filters.search.trim().toLowerCase();
          rows = rows.filter(r => 
            r.loanNumber.toLowerCase().includes(q) ||
            r.customerName.toLowerCase().includes(q) ||
            r.nicNumber.toLowerCase().includes(q) ||
            r.remark.toLowerCase().includes(q)
          );
        }

        // Calculate summary
        const totalCollected = rows.reduce((sum, r) => sum + r.paidAmount, 0);
        const transactionCount = rows.length;
        const customersPaid = new Set(rows.map(r => r.customerName)).size;
        const loansPaid = new Set(rows.map(r => r.loanNumber)).size;
        const averagePayment = transactionCount > 0 ? Math.round(totalCollected / transactionCount) : 0;

        // Breakdown by frequency (must reconcile exactly to totalCollected)
        let dailyCollections = 0;
        let weeklyCollections = 0;
        let monthlyCollections = 0;

        for (const r of rows) {
          if (r.loanType === 'DAILY') {
            dailyCollections += r.paidAmount;
          } else if (r.loanType === 'WEEKLY') {
            weeklyCollections += r.paidAmount;
          } else {
            monthlyCollections += r.paidAmount;
          }
        }

        return {
          rows,
          summary: {
            totalCollected,
            transactionCount,
            customersPaid,
            loansPaid,
            averagePayment,
            dailyCollections,
            weeklyCollections,
            monthlyCollections
          }
        };
      })
    );
  }

  // =========================================================================
  // REPORT 04: UPCOMING PAYMENTS REPORT (100% READ-ONLY)
  // Reuses AnalysisService.deriveAnalysisBundle().upcomingPayments logic
  // =========================================================================
  getUpcomingPaymentsReport(filters: UpcomingPaymentsFilters = {}): Observable<{
    rows: UpcomingPaymentRow[];
    summary: UpcomingPaymentsSummary;
  }> {
    return this.fetchRawData().pipe(
      map(({ loans, payments }) => {
        // Reuse shared Analysis derivation engine
        const bundle = this.analysisService.deriveAnalysisBundle(loans, payments);
        const loanMap = new Map<string, LoanWithClient>();
        loans.forEach(l => loanMap.set(l.id, l));

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = formatLocalIsoDate(today);

        const { startOfWeek, endOfWeek } = this.getCurrentWeekBounds(today);
        const startOfWeekStr = formatLocalIsoDate(startOfWeek);
        const endOfWeekStr = formatLocalIsoDate(endOfWeek);

        const startOfNextWeek = new Date(startOfWeek);
        startOfNextWeek.setDate(startOfNextWeek.getDate() + 7);
        const endOfNextWeek = new Date(endOfWeek);
        endOfNextWeek.setDate(endOfNextWeek.getDate() + 7);
        const startOfNextWeekStr = formatLocalIsoDate(startOfNextWeek);
        const endOfNextWeekStr = formatLocalIsoDate(endOfNextWeek);

        let rows: UpcomingPaymentRow[] = bundle.upcomingPayments.map(up => {
          const matchedLoan = loanMap.get(up.loanId);
          const nicNumber = matchedLoan?.client?.nic_number || '-';
          const mobileNumber = up.customerMobile || matchedLoan?.client?.mobile_number || '-';

          return {
            loanId: up.loanId,
            loanNumber: up.loanNumber,
            clientId: up.clientId,
            customerName: up.customerName,
            nicNumber,
            mobileNumber,
            loanType: (up.loanType || 'monthly').toUpperCase(),
            expectedDate: up.expectedDate,
            expectedAmount: up.expectedInstalmentAmount,
            remainingDue: up.expectedInstalmentAmount,
            remainingBalance: up.remainingBalance,
            remainingInstallments: up.remainingInstallments,
            status: up.status
          };
        });

        // Quick Period Filter
        const quickPeriod = filters.quickPeriod || 'this_week';
        if (quickPeriod === 'today') {
          rows = rows.filter(r => r.expectedDate === todayStr);
        } else if (quickPeriod === 'this_week') {
          rows = rows.filter(r => r.expectedDate >= startOfWeekStr && r.expectedDate <= endOfWeekStr);
        } else if (quickPeriod === 'next_week') {
          rows = rows.filter(r => r.expectedDate >= startOfNextWeekStr && r.expectedDate <= endOfNextWeekStr);
        } else if (quickPeriod === 'custom') {
          if (filters.dateFrom) {
            rows = rows.filter(r => r.expectedDate >= filters.dateFrom!);
          }
          if (filters.dateTo) {
            rows = rows.filter(r => r.expectedDate <= filters.dateTo!);
          }
        }

        // Filter by Loan Frequency
        if (filters.loanType && filters.loanType !== 'all') {
          const targetType = filters.loanType.toUpperCase();
          rows = rows.filter(r => r.loanType === targetType);
        }

        // Filter by Search Query
        if (filters.search && filters.search.trim().length > 0) {
          const q = filters.search.trim().toLowerCase();
          rows = rows.filter(r => 
            r.loanNumber.toLowerCase().includes(q) ||
            r.customerName.toLowerCase().includes(q) ||
            r.nicNumber.toLowerCase().includes(q) ||
            r.mobileNumber.toLowerCase().includes(q)
          );
        }

        // Calculate summary
        const expectedPaymentCount = rows.length;
        const customersDue = new Set(rows.map(r => r.clientId)).size;
        const loansDue = new Set(rows.map(r => r.loanId)).size;
        const totalExpectedCollection = rows.reduce((sum, r) => sum + r.expectedAmount, 0);

        let dailyExpected = 0;
        let weeklyExpected = 0;
        let monthlyExpected = 0;

        for (const r of rows) {
          if (r.loanType === 'DAILY') {
            dailyExpected += r.expectedAmount;
          } else if (r.loanType === 'WEEKLY') {
            weeklyExpected += r.expectedAmount;
          } else {
            monthlyExpected += r.expectedAmount;
          }
        }

        return {
          rows,
          summary: {
            expectedPaymentCount,
            customersDue,
            loansDue,
            totalExpectedCollection,
            dailyExpected,
            weeklyExpected,
            monthlyExpected
          }
        };
      })
    );
  }

  // =========================================================================
  // REPORT 05: PAYMENT PERFORMANCE REPORT (100% READ-ONLY)
  // Compares Expected Scheduled Collections vs Actual Recorded Collections
  // =========================================================================
  getPaymentPerformanceReport(filters: PaymentPerformanceFilters = {}): Observable<PaymentPerformanceData> {
    return this.fetchRawData().pipe(
      map(({ loans, payments }) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Default period to current month if not provided
        let fromDate = filters.dateFrom;
        let toDate = filters.dateTo;
        if (!fromDate || !toDate) {
          const y = today.getFullYear();
          const m = today.getMonth();
          const firstDay = new Date(y, m, 1);
          const lastDay = new Date(y, m + 1, 0);
          fromDate = fromDate || formatLocalIsoDate(firstDay);
          toDate = toDate || formatLocalIsoDate(lastDay);
        }

        const loanMap = new Map<string, LoanWithClient>();
        loans.forEach(l => loanMap.set(l.id, l));

        // 1. Calculate EXPECTED collections for all scheduled obligations falling in the period
        // Map of date string -> { expected: number; actual: number }
        const periodMap = new Map<string, { expected: number; actual: number }>();

        let expectedDaily = 0;
        let expectedWeekly = 0;
        let expectedMonthly = 0;

        for (const loan of loans) {
          const rawLoanType = (loan.loan_type || 'monthly').toLowerCase();
          if (filters.loanType && filters.loanType !== 'all' && rawLoanType !== filters.loanType.toLowerCase()) {
            continue;
          }

          // Optional search match
          if (filters.search && filters.search.trim().length > 0) {
            const q = filters.search.trim().toLowerCase();
            const cName = loan.client ? `${loan.client.first_name || ''} ${loan.client.last_name || ''}`.toLowerCase() : '';
            if (!loan.loan_number.toLowerCase().includes(q) && !cName.includes(q)) {
              continue;
            }
          }

          const totalInstallments = loan.installments && loan.installments > 0
            ? loan.installments
            : 12;
          const installmentAmount = Math.max(1, Math.round(loan.total_amount_due / totalInstallments));

          const dates = this.generateInstallmentDates(loan.start_date, totalInstallments, rawLoanType);

          for (const d of dates) {
            const dStr = formatLocalIsoDate(d);
            if (dStr >= fromDate! && dStr <= toDate!) {
              if (!periodMap.has(dStr)) {
                periodMap.set(dStr, { expected: 0, actual: 0 });
              }
              periodMap.get(dStr)!.expected += installmentAmount;

              if (rawLoanType === 'daily') {
                expectedDaily += installmentAmount;
              } else if (rawLoanType === 'weekly') {
                expectedWeekly += installmentAmount;
              } else {
                expectedMonthly += installmentAmount;
              }
            }
          }
        }

        // 2. Calculate ACTUAL collections recorded within the period
        let actualDaily = 0;
        let actualWeekly = 0;
        let actualMonthly = 0;

        const matchingPayments: PerformancePaymentRow[] = [];

        for (const p of payments) {
          const pDate = p.paid_date ? p.paid_date.split('T')[0] : '';
          if (pDate < fromDate! || pDate > toDate!) {
            continue;
          }

          const matchedLoan = loanMap.get(p.loan_id);
          const loanJoin = p.loans;
          const rawLoanType = (loanJoin?.loan_type || matchedLoan?.loan_type || 'monthly').toLowerCase();

          if (filters.loanType && filters.loanType !== 'all' && rawLoanType !== filters.loanType.toLowerCase()) {
            continue;
          }

          const clientJoin = loanJoin?.clients || matchedLoan?.client;
          const customerName = clientJoin 
            ? `${clientJoin.first_name || ''} ${clientJoin.last_name || ''}`.trim() 
            : 'Unknown Customer';
          const loanNumber = loanJoin?.loan_number || matchedLoan?.loan_number || 'N/A';

          if (filters.search && filters.search.trim().length > 0) {
            const q = filters.search.trim().toLowerCase();
            if (!loanNumber.toLowerCase().includes(q) && !customerName.toLowerCase().includes(q)) {
              continue;
            }
          }

          const paidAmount = Number(p.paid_amount || p.amount || 0);

          if (!periodMap.has(pDate)) {
            periodMap.set(pDate, { expected: 0, actual: 0 });
          }
          periodMap.get(pDate)!.actual += paidAmount;

          if (rawLoanType === 'daily') {
            actualDaily += paidAmount;
          } else if (rawLoanType === 'weekly') {
            actualWeekly += paidAmount;
          } else {
            actualMonthly += paidAmount;
          }

          matchingPayments.push({
            paymentId: p.id,
            paidDate: pDate,
            customerName,
            loanNumber,
            loanType: rawLoanType.toUpperCase(),
            paidAmount,
            remark: p.remark || '-'
          });
        }

        // 3. Build sorted periodic rows
        const sortedDates = Array.from(periodMap.keys()).sort();
        const periodRows: PerformancePeriodRow[] = sortedDates.map(dateKey => {
          const entry = periodMap.get(dateKey)!;
          const diff = entry.actual - entry.expected;
          const rate = entry.expected > 0 
            ? Math.round((entry.actual / entry.expected) * 1000) / 10 
            : (entry.actual > 0 ? 100 : 0);

          return {
            periodLabel: dateKey,
            expectedAmount: entry.expected,
            actualCollected: entry.actual,
            difference: diff,
            collectionRate: rate
          };
        });

        // 4. Calculate total metrics
        const totalExpected = expectedDaily + expectedWeekly + expectedMonthly;
        const totalActual = actualDaily + actualWeekly + actualMonthly;
        const totalDifference = totalActual - totalExpected;
        const overallCollectionRate = totalExpected > 0 
          ? Math.round((totalActual / totalExpected) * 1000) / 10 
          : (totalActual > 0 ? 100 : 0);

        const dailyRate = expectedDaily > 0 ? Math.round((actualDaily / expectedDaily) * 1000) / 10 : (actualDaily > 0 ? 100 : 0);
        const weeklyRate = expectedWeekly > 0 ? Math.round((actualWeekly / expectedWeekly) * 1000) / 10 : (actualWeekly > 0 ? 100 : 0);
        const monthlyRate = expectedMonthly > 0 ? Math.round((actualMonthly / expectedMonthly) * 1000) / 10 : (actualMonthly > 0 ? 100 : 0);

        const selectedPeriod = `${fromDate} to ${toDate}`;

        return {
          summary: {
            selectedPeriod,
            totalExpected,
            totalActual,
            totalDifference,
            overallCollectionRate,
            daily: {
              expected: expectedDaily,
              actual: actualDaily,
              difference: actualDaily - expectedDaily,
              collectionRate: dailyRate
            },
            weekly: {
              expected: expectedWeekly,
              actual: actualWeekly,
              difference: actualWeekly - expectedWeekly,
              collectionRate: weeklyRate
            },
            monthly: {
              expected: expectedMonthly,
              actual: actualMonthly,
              difference: actualMonthly - expectedMonthly,
              collectionRate: monthlyRate
            }
          },
          periodRows,
          paymentRows: matchingPayments
        };
      })
    );
  }

  /**
   * Helper to generate exact installment dates sequentially for schedule obligations
   */
  private generateInstallmentDates(startDateStr: string, count: number, loanType: string): Date[] {
    const dates: Date[] = [];
    const base = parseCalendarDate(startDateStr);

    for (let i = 1; i <= count; i++) {
      const d = new Date(base);
      if (loanType === 'daily') {
        d.setDate(d.getDate() + i);
      } else if (loanType === 'weekly') {
        d.setDate(d.getDate() + (i * 7));
      } else {
        d.setMonth(d.getMonth() + i);
      }
      dates.push(d);
    }

    return dates;
  }

  /**
   * Helper to get Monday and Sunday bounds for the current calendar week
   */
  private getCurrentWeekBounds(date: Date): { startOfWeek: Date; endOfWeek: Date } {
    const day = date.getDay(); // 0 is Sunday, 1 is Monday
    const diffToMonday = date.getDate() - day + (day === 0 ? -6 : 1);

    const startOfWeek = new Date(date);
    startOfWeek.setDate(diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return { startOfWeek, endOfWeek };
  }
}
