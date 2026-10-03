import { Injectable } from '@angular/core';
import { Observable, from, map, catchError } from 'rxjs';
import { 
  AnalysisService, 
  AnalysisDataBundle,
  LatePaymentItem,
  UpcomingPaymentItem,
  LoanMonitoringItem,
  PaymentActivityItem,
  formatLocalIsoDate,
  parseCalendarDate
} from './analysis.service';
import { SupabaseService } from './supabase.service';
import { LoanWithClient } from './loan-manage.service';

export type DashboardPeriod = 
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'last_month'
  | 'last_3_months'
  | 'last_6_months'
  | 'this_year'
  | 'custom';

export type DashboardFrequency = 'all' | 'daily' | 'weekly' | 'monthly';

export interface DashboardFilterState {
  period: DashboardPeriod;
  dateFrom?: string;
  dateTo?: string;
  frequency: DashboardFrequency;
}

export interface DashboardKpis {
  activeLoansCount: number;
  activeOutstandingAmount: number;
  completedLoansCount: number;
  overdueLoansCount: number;
  overdueAmount: number;
  outstandingAmount: number;
  collectedAmount: number;
  paymentCount: number;
  expectedCollection: number;
  collectionRate: number | null;
}

export interface ChartSeriesData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    fill?: boolean;
    tension?: number;
    borderWidth?: number;
    meta?: any[];
  }[];
}

export interface PortfolioDistributionData {
  labels: string[];
  counts: number[];
  percentages: number[];
  amounts: number[];
}

export interface FrequencyDistributionData {
  labels: string[];
  counts: number[];
  percentages: number[];
  amounts: number[];
}

export interface CollectionPerformanceData {
  labels: string[];
  expected: number[];
  actual: number[];
  differences: number[];
  rates: (number | null)[];
}

export interface IssuanceTrendData {
  labels: string[];
  amounts: number[];
  counts: number[];
}

export interface DashboardBundle {
  kpis: DashboardKpis;
  collectionTrend: ChartSeriesData;
  portfolioDistribution: PortfolioDistributionData;
  collectionPerformance: CollectionPerformanceData;
  frequencyDistribution: FrequencyDistributionData;
  issuanceTrend: IssuanceTrendData;
  needsAttention: LatePaymentItem[];
  upcomingCollections: UpcomingPaymentItem[];
  recentPayments: PaymentActivityItem[];
  filterRange: { from: string; to: string };
}

@Injectable({
  providedIn: 'root'
})
export class AnalysisDashboardService {

  constructor(
    private analysisService: AnalysisService,
    private supabaseService: SupabaseService
  ) {}

  /**
   * Resolves a DashboardPeriod into concrete start and end dates (YYYY-MM-DD)
   */
  resolveDateRange(period: DashboardPeriod, customFrom?: string, customTo?: string): { from: string; to: string } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pad = (n: number) => n.toString().padStart(2, '0');
    const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (period === 'custom' && customFrom && customTo) {
      return { from: customFrom, to: customTo };
    }

    switch (period) {
      case 'today': {
        const dStr = toIso(today);
        return { from: dStr, to: dStr };
      }
      case 'this_week': {
        const day = today.getDay(); // 0 is Sun, 1 is Mon
        const diffToMon = day === 0 ? -6 : 1 - day;
        const mon = new Date(today);
        mon.setDate(today.getDate() + diffToMon);
        const sun = new Date(mon);
        sun.setDate(mon.getDate() + 6);
        return { from: toIso(mon), to: toIso(sun) };
      }
      case 'this_month': {
        const first = new Date(today.getFullYear(), today.getMonth(), 1);
        const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return { from: toIso(first), to: toIso(last) };
      }
      case 'last_month': {
        const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const last = new Date(today.getFullYear(), today.getMonth(), 0);
        return { from: toIso(first), to: toIso(last) };
      }
      case 'last_3_months': {
        const first = new Date(today.getFullYear(), today.getMonth() - 2, 1);
        const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return { from: toIso(first), to: toIso(last) };
      }
      case 'last_6_months': {
        const first = new Date(today.getFullYear(), today.getMonth() - 5, 1);
        const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return { from: toIso(first), to: toIso(last) };
      }
      case 'this_year': {
        const first = new Date(today.getFullYear(), 0, 1);
        const last = new Date(today.getFullYear(), 11, 31);
        return { from: toIso(first), to: toIso(last) };
      }
      default: {
        const first = new Date(today.getFullYear(), today.getMonth(), 1);
        const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return { from: toIso(first), to: toIso(last) };
      }
    }
  }

  /**
   * Main entry point: Loads authoritative raw data and computes all management dashboard metrics
   */
  loadDashboard(filters: DashboardFilterState): Observable<DashboardBundle> {
    const supabase = this.supabaseService.getClient();

    return from(
      Promise.all([
        supabase
          .from('loans')
          .select(`
            *,
            client:clients(*)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('payments')
          .select(`
            *,
            loans(loan_number, loan_type, client_id, clients(first_name, last_name, register_number, mobile_number))
          `)
          .order('paid_date', { ascending: false })
      ])
    ).pipe(
      map(([loansRes, paymentsRes]) => {
        if (loansRes.error) throw new Error('Error loading loans: ' + loansRes.error.message);
        if (paymentsRes.error) throw new Error('Error loading payments: ' + paymentsRes.error.message);

        const loans: LoanWithClient[] = loansRes.data || [];
        const payments: any[] = paymentsRes.data || [];

        return this.computeDashboardBundle(loans, payments, filters);
      }),
      catchError(err => {
        console.error('loadDashboard failed:', err);
        throw err;
      })
    );
  }

  /**
   * Pure in-memory transformation of loans and payments into dashboard KPIs, charts, and tables
   */
  computeDashboardBundle(loans: LoanWithClient[], payments: any[], filters: DashboardFilterState): DashboardBundle {
    const dateRange = this.resolveDateRange(filters.period, filters.dateFrom, filters.dateTo);
    const freqFilter = filters.frequency.toLowerCase();

    // 1. Filter Loans by Frequency (Current Portfolio State)
    const matchingLoans = loans.filter(l => {
      if (freqFilter !== 'all' && (l.loan_type || '').toLowerCase() !== freqFilter) {
        return false;
      }
      return true;
    });

    // 2. Derive base analysis bundle using the single source of truth from AnalysisService
    const analysisBundle: AnalysisDataBundle = this.analysisService.deriveAnalysisBundle(matchingLoans, payments);

    // 3. Compute Current Position KPIs
    let activeLoansCount = 0;
    let activeOutstandingAmount = 0;
    let completedLoansCount = 0;
    let overdueLoansCount = 0;
    let overdueAmount = 0;
    let outstandingAmount = 0;

    const overdueLoanIds = new Set<string>();

    for (const late of analysisBundle.latePayments) {
      overdueLoanIds.add(late.loanId);
      overdueLoansCount++;
      overdueAmount += late.overdueAmount;
    }

    for (const loan of matchingLoans) {
      const isCompleted = loan.status === 'closed' || loan.remaining_amount <= 0;
      if (isCompleted) {
        completedLoansCount++;
      } else {
        activeLoansCount++;
        const rem = loan.remaining_amount || 0;
        activeOutstandingAmount += rem;
        outstandingAmount += rem;
      }
    }

    // 4. Compute Period Activity (Collected & Expected within Date Range)
    let collectedAmount = 0;
    let paymentCount = 0;
    const periodPayments: any[] = [];

    for (const p of payments) {
      const pLoan = p.loans;
      const loanType = (pLoan?.loan_type || '').toLowerCase();
      if (freqFilter !== 'all' && loanType !== freqFilter) {
        continue;
      }

      const pDate = p.paid_date;
      if (pDate && pDate >= dateRange.from && pDate <= dateRange.to) {
        const amt = Number(p.paid_amount) || 0;
        collectedAmount += amt;
        paymentCount++;
        periodPayments.push(p);
      }
    }

    // Expected collection in period (from effective repayment schedules of active loans)
    let expectedCollection = 0;
    const scheduleByPeriodKey = new Map<string, { expected: number; actual: number }>();

    for (const loan of matchingLoans) {
      const totalInstallments = loan.installments && loan.installments > 0
        ? loan.installments
        : this.analysisService.calculateDefaultInstallments(loan.start_date, loan.end_date, loan.loan_type);

      const installmentAmt = Math.max(1, Math.round(loan.total_amount_due / totalInstallments));
      const dueDates = this.analysisService.generateInstallmentDueDates(loan.start_date, totalInstallments, loan.loan_type);

      for (const d of dueDates) {
        const dStr = formatLocalIsoDate(d);
        if (dStr >= dateRange.from && dStr <= dateRange.to) {
          expectedCollection += installmentAmt;

          const key = this.getGroupingKey(dStr, filters.period);
          if (!scheduleByPeriodKey.has(key)) {
            scheduleByPeriodKey.set(key, { expected: 0, actual: 0 });
          }
          scheduleByPeriodKey.get(key)!.expected += installmentAmt;
        }
      }
    }

    const collectionRate = expectedCollection > 0
      ? Math.min(999, Math.round((collectedAmount / expectedCollection) * 1000) / 10)
      : null;

    const kpis: DashboardKpis = {
      activeLoansCount,
      activeOutstandingAmount,
      completedLoansCount,
      overdueLoansCount,
      overdueAmount,
      outstandingAmount,
      collectedAmount,
      paymentCount,
      expectedCollection,
      collectionRate
    };

    // 5. Build Chart 01: Collection Trend (Daily/Weekly/Monthly)
    const collectionTrend = this.buildCollectionTrend(periodPayments, dateRange, filters.period);

    // 6. Build Chart 02: Loan Portfolio Status (On Track, Overdue, Completed)
    const onTrackActiveCount = Math.max(0, activeLoansCount - overdueLoansCount);
    const totalPortfolio = onTrackActiveCount + overdueLoansCount + completedLoansCount;

    const portfolioDistribution: PortfolioDistributionData = {
      labels: ['Active (On Track)', 'Overdue', 'Completed'],
      counts: [onTrackActiveCount, overdueLoansCount, completedLoansCount],
      percentages: totalPortfolio > 0 ? [
        Math.round((onTrackActiveCount / totalPortfolio) * 1000) / 10,
        Math.round((overdueLoansCount / totalPortfolio) * 1000) / 10,
        Math.round((completedLoansCount / totalPortfolio) * 1000) / 10
      ] : [0, 0, 0],
      amounts: [
        Math.max(0, activeOutstandingAmount - overdueAmount),
        overdueAmount,
        0
      ]
    };

    // 7. Build Chart 03: Expected vs Actual Collection
    const collectionPerformance = this.buildCollectionPerformance(
      periodPayments,
      scheduleByPeriodKey,
      dateRange,
      filters.period
    );

    // 8. Build Chart 04: Loan Frequency Distribution (Active Loans)
    const frequencyDistribution = this.buildFrequencyDistribution(matchingLoans);

    // 9. Build Chart 05: Loan Issuance Trend (within date range)
    const issuanceTrend = this.buildIssuanceTrend(matchingLoans, dateRange, filters.period);

    // 10. Management Attention Tables (5 to 10 rows preview)
    const needsAttention = analysisBundle.latePayments.slice(0, 10);
    const upcomingCollections = analysisBundle.upcomingPayments
      .filter(u => u.expectedDate >= formatLocalIsoDate(new Date()))
      .slice(0, 10);
    const recentPayments = analysisBundle.paymentActivity.slice(0, 10);

    return {
      kpis,
      collectionTrend,
      portfolioDistribution,
      collectionPerformance,
      frequencyDistribution,
      issuanceTrend,
      needsAttention,
      upcomingCollections,
      recentPayments,
      filterRange: dateRange
    };
  }

  // --------------------------------------------------------------------------
  // Chart Helper: Collection Trend
  // --------------------------------------------------------------------------
  private buildCollectionTrend(
    payments: any[], 
    dateRange: { from: string; to: string }, 
    period: DashboardPeriod
  ): ChartSeriesData {
    const buckets = new Map<string, { amount: number; count: number }>();

    // Seed continuous labels for readability
    const seedKeys = this.generatePeriodLabels(dateRange, period);
    for (const k of seedKeys) {
      buckets.set(k, { amount: 0, count: 0 });
    }

    for (const p of payments) {
      const pDate = p.paid_date;
      if (!pDate) continue;
      const key = this.getGroupingKey(pDate, period);
      if (!buckets.has(key)) {
        buckets.set(key, { amount: 0, count: 0 });
      }
      const b = buckets.get(key)!;
      b.amount += (Number(p.paid_amount) || 0);
      b.count += 1;
    }

    const labels = Array.from(buckets.keys());
    const amounts = labels.map(k => buckets.get(k)!.amount);
    const counts = labels.map(k => buckets.get(k)!.count);

    return {
      labels,
      datasets: [
        {
          label: 'Customer Repayments (Rs.)',
          data: amounts,
          borderColor: '#D4A437',
          backgroundColor: 'rgba(212, 164, 55, 0.12)',
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          meta: counts
        }
      ]
    };
  }

  // --------------------------------------------------------------------------
  // Chart Helper: Expected vs Actual Collection
  // --------------------------------------------------------------------------
  private buildCollectionPerformance(
    payments: any[],
    scheduleMap: Map<string, { expected: number; actual: number }>,
    dateRange: { from: string; to: string },
    period: DashboardPeriod
  ): CollectionPerformanceData {
    const seedKeys = this.generatePeriodLabels(dateRange, period);
    const merged = new Map<string, { expected: number; actual: number }>();

    for (const k of seedKeys) {
      merged.set(k, { expected: 0, actual: 0 });
    }

    // Merge scheduled expected
    for (const [key, val] of scheduleMap.entries()) {
      if (!merged.has(key)) merged.set(key, { expected: 0, actual: 0 });
      merged.get(key)!.expected += val.expected;
    }

    // Merge actual payments
    for (const p of payments) {
      const pDate = p.paid_date;
      if (!pDate) continue;
      const key = this.getGroupingKey(pDate, period);
      if (!merged.has(key)) merged.set(key, { expected: 0, actual: 0 });
      merged.get(key)!.actual += (Number(p.paid_amount) || 0);
    }

    const labels = Array.from(merged.keys());
    const expected = labels.map(k => merged.get(k)!.expected);
    const actual = labels.map(k => merged.get(k)!.actual);
    const differences = labels.map(k => merged.get(k)!.actual - merged.get(k)!.expected);
    const rates = labels.map(k => {
      const exp = merged.get(k)!.expected;
      const act = merged.get(k)!.actual;
      return exp > 0 ? Math.round((act / exp) * 1000) / 10 : null;
    });

    return {
      labels,
      expected,
      actual,
      differences,
      rates
    };
  }

  // --------------------------------------------------------------------------
  // Chart Helper: Loan Frequency Distribution
  // --------------------------------------------------------------------------
  private buildFrequencyDistribution(loans: LoanWithClient[]): FrequencyDistributionData {
    let dailyCount = 0;
    let dailyAmount = 0;
    let weeklyCount = 0;
    let weeklyAmount = 0;
    let monthlyCount = 0;
    let monthlyAmount = 0;

    for (const loan of loans) {
      if (loan.status === 'closed' || loan.remaining_amount <= 0) continue;

      const f = (loan.loan_type || '').toLowerCase();
      const rem = loan.remaining_amount || 0;

      if (f === 'daily') {
        dailyCount++;
        dailyAmount += rem;
      } else if (f === 'weekly') {
        weeklyCount++;
        weeklyAmount += rem;
      } else if (f === 'monthly') {
        monthlyCount++;
        monthlyAmount += rem;
      }
    }

    const totalActive = dailyCount + weeklyCount + monthlyCount;

    return {
      labels: ['Daily', 'Weekly', 'Monthly'],
      counts: [dailyCount, weeklyCount, monthlyCount],
      percentages: totalActive > 0 ? [
        Math.round((dailyCount / totalActive) * 1000) / 10,
        Math.round((weeklyCount / totalActive) * 1000) / 10,
        Math.round((monthlyCount / totalActive) * 1000) / 10
      ] : [0, 0, 0],
      amounts: [dailyAmount, weeklyAmount, monthlyAmount]
    };
  }

  // --------------------------------------------------------------------------
  // Chart Helper: Loan Issuance Trend
  // --------------------------------------------------------------------------
  private buildIssuanceTrend(
    loans: LoanWithClient[],
    dateRange: { from: string; to: string },
    period: DashboardPeriod
  ): IssuanceTrendData {
    const buckets = new Map<string, { amount: number; count: number }>();
    const seedKeys = this.generatePeriodLabels(dateRange, period);

    for (const k of seedKeys) {
      buckets.set(k, { amount: 0, count: 0 });
    }

    for (const loan of loans) {
      const issueDate = loan.start_date || (loan.created_at ? loan.created_at.split('T')[0] : '');
      if (issueDate >= dateRange.from && issueDate <= dateRange.to) {
        const key = this.getGroupingKey(issueDate, period);
        if (!buckets.has(key)) {
          buckets.set(key, { amount: 0, count: 0 });
        }
        const b = buckets.get(key)!;
        b.amount += (Number(loan.principal_amount) || 0);
        b.count += 1;
      }
    }

    const labels = Array.from(buckets.keys());
    const amounts = labels.map(k => buckets.get(k)!.amount);
    const counts = labels.map(k => buckets.get(k)!.count);

    return {
      labels,
      amounts,
      counts
    };
  }

  // --------------------------------------------------------------------------
  // Time Grouping & Label Utilities
  // --------------------------------------------------------------------------
  private getGroupingKey(dateStr: string, period: DashboardPeriod): string {
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;

    // Monthly grouping for longer periods
    if (period === 'last_6_months' || period === 'this_year') {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const mIdx = parseInt(parts[1], 10) - 1;
      return `${monthNames[mIdx]} ${parts[0].slice(2)}`;
    }

    // Weekly grouping for 3 months
    if (period === 'last_3_months') {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      const weekNum = Math.ceil(d.getDate() / 7);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${monthNames[d.getMonth()]} W${weekNum}`;
    }

    // Daily grouping (DD/MM) for this week / this month
    return `${parts[2]}/${parts[1]}`;
  }

  private generatePeriodLabels(dateRange: { from: string; to: string }, period: DashboardPeriod): string[] {
    const labels: string[] = [];
    const fromDate = parseCalendarDate(dateRange.from);
    const toDate = parseCalendarDate(dateRange.to);

    if (fromDate > toDate) return [];

    const curr = new Date(fromDate);
    const seen = new Set<string>();

    while (curr <= toDate) {
      const dStr = formatLocalIsoDate(curr);
      const key = this.getGroupingKey(dStr, period);
      if (!seen.has(key)) {
        seen.add(key);
        labels.push(key);
      }

      if (period === 'last_6_months' || period === 'this_year') {
        curr.setMonth(curr.getMonth() + 1);
        curr.setDate(1);
      } else if (period === 'last_3_months') {
        curr.setDate(curr.getDate() + 7);
      } else {
        curr.setDate(curr.getDate() + 1);
      }
    }

    return labels;
  }
}
