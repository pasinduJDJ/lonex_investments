import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { LoanWithClient } from './loan-manage.service';

export interface AnalysisKpis {
  activeLoansCount: number;
  completedLoansCount: number;
  overdueLoansCount: number;
  dueThisWeekCount: number;
  dueThisWeekAmount: number;
  outstandingAmount: number;
  collectedThisMonth: number;
}

export interface LatePaymentItem {
  loanId: string;
  loanNumber: string;
  clientId: string;
  customerName: string;
  customerMobile: string;
  loanType: string;
  expectedPaymentDate: string;
  expectedInstalmentAmount: number;
  paidInstallments: number;
  expectedInstallmentsToDate: number;
  totalInstallments: number;
  overdueInstallments: number;
  overdueAmount: number;
  daysLate: number;
  remainingBalance: number;
  status: 'Due Today' | 'Late' | 'Overdue';
}

export interface UpcomingPaymentItem {
  loanId: string;
  loanNumber: string;
  clientId: string;
  customerName: string;
  customerMobile: string;
  loanType: string;
  expectedDate: string;
  expectedInstalmentAmount: number;
  remainingBalance: number;
  remainingInstallments: number;
  status: 'Due Today' | 'Upcoming';
}

export interface LoanMonitoringItem {
  loanId: string;
  loanNumber: string;
  clientId: string;
  customerName: string;
  loanType: string;
  principal: number;
  totalDue: number;
  totalPaid: number;
  remaining: number;
  paidInstallments: number;
  remainingInstallments: number;
  progressPercent: number;
  status: 'Active' | 'Completed' | 'Overdue';
  startDate: string;
  expectedEndDate: string;
}

export interface PaymentActivityItem {
  paymentId: string;
  paidDate: string;
  customerName: string;
  loanNumber: string;
  amountPaid: number;
  remark?: string;
  recordedOn: string;
}

export interface AnalysisDataBundle {
  kpis: AnalysisKpis;
  latePayments: LatePaymentItem[];
  upcomingPayments: UpcomingPaymentItem[];
  allLoans: LoanMonitoringItem[];
  paymentActivity: PaymentActivityItem[];
}

export function parseCalendarDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const parts = dateStr.split('T')[0].split('-').map(Number);
  if (parts.length === 3) {
    return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  }
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function formatLocalIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

@Injectable({
  providedIn: 'root'
})
export class AnalysisService {

  constructor(private supabaseService: SupabaseService) {}

  /**
   * Loads all source data from Supabase and derives all operational analysis metrics
   */
  loadAnalysisData(): Observable<AnalysisDataBundle> {
    const supabase = this.supabaseService.getClient();

    return from(
      (async (): Promise<AnalysisDataBundle> => {
        // 1. Fetch all loans with clients
        const { data: loansData, error: loansError } = await supabase
          .from('loans')
          .select(`
            *,
            client:clients(*)
          `)
          .order('created_at', { ascending: false });

        if (loansError) {
          throw new Error('Error fetching loans for analysis: ' + loansError.message);
        }

        // 2. Fetch payments with loans and clients
        const { data: paymentsData, error: paymentsError } = await supabase
          .from('payments')
          .select(`
            *,
            loans(loan_number, client_id, clients(first_name, last_name, register_number))
          `)
          .order('paid_date', { ascending: false });

        if (paymentsError) {
          throw new Error('Error fetching payments for analysis: ' + paymentsError.message);
        }

        const loans: LoanWithClient[] = loansData || [];
        const payments: any[] = paymentsData || [];

        return this.deriveAnalysisBundle(loans, payments);
      })()
    ).pipe(
      catchError(err => {
        console.error('loadAnalysisData error:', err);
        throw err;
      })
    );
  }

  /**
   * Pure derivation of all operational metrics, KPIs, and tables from loans & payments
   */
  deriveAnalysisBundle(loans: LoanWithClient[], payments: any[]): AnalysisDataBundle {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { startOfWeek, endOfWeek } = this.getCurrentWeekBounds(today);

    let activeLoansCount = 0;
    let completedLoansCount = 0;
    let overdueLoansCount = 0;
    let dueThisWeekCount = 0;
    let dueThisWeekAmount = 0;
    let outstandingAmount = 0;

    const latePayments: LatePaymentItem[] = [];
    const upcomingPayments: UpcomingPaymentItem[] = [];
    const allLoans: LoanMonitoringItem[] = [];

    // Process each loan
    for (const loan of loans) {
      const isCompleted = loan.status === 'closed' || loan.remaining_amount <= 0;
      const customerName = loan.client 
        ? `${loan.client.first_name || ''} ${loan.client.last_name || ''}`.trim() 
        : 'Unknown Customer';
      const customerMobile = loan.client?.mobile_number || loan.client?.home_number || '-';

      // Total installments
      const totalInstallments = loan.installments && loan.installments > 0
        ? loan.installments
        : this.calculateDefaultInstallments(loan.start_date, loan.end_date, loan.loan_type);

      const installmentAmount = Math.max(1, Math.round(loan.total_amount_due / totalInstallments));
      const paidInstallments = Math.floor(loan.total_paid / installmentAmount);
      const remainingInstallments = Math.max(0, totalInstallments - paidInstallments);
      const progressPercent = Math.min(100, Math.round((loan.total_paid / loan.total_amount_due) * 100));

      // Calculate schedule installment dates
      const installmentDueDates = this.generateInstallmentDueDates(
        loan.start_date,
        totalInstallments,
        loan.loan_type
      );

      // Expected installments up to today
      let expectedInstallmentsToDate = 0;
      for (const d of installmentDueDates) {
        if (d <= today) {
          expectedInstallmentsToDate++;
        }
      }

      const isOverdue = !isCompleted && expectedInstallmentsToDate > paidInstallments;

      if (isCompleted) {
        completedLoansCount++;
      } else {
        activeLoansCount++;
        outstandingAmount += (loan.remaining_amount || 0);

        if (isOverdue) {
          overdueLoansCount++;

          const overdueInstallments = expectedInstallmentsToDate - paidInstallments;
          const overdueAmount = Math.min(loan.remaining_amount, overdueInstallments * installmentAmount);
          const oldestUnpaidDate = installmentDueDates[paidInstallments] || today;
          const timeDiff = today.getTime() - oldestUnpaidDate.getTime();
          const daysLate = Math.max(0, Math.floor(timeDiff / (1000 * 3600 * 24)));

          let status: 'Due Today' | 'Late' | 'Overdue' = 'Overdue';
          if (daysLate === 0) {
            status = 'Due Today';
          } else if (daysLate <= 7) {
            status = 'Late';
          }

          latePayments.push({
            loanId: loan.id,
            loanNumber: loan.loan_number,
            clientId: loan.client_id,
            customerName,
            customerMobile,
            loanType: loan.loan_type,
            expectedPaymentDate: formatLocalIsoDate(oldestUnpaidDate),
            expectedInstalmentAmount: installmentAmount,
            paidInstallments,
            expectedInstallmentsToDate,
            totalInstallments,
            overdueInstallments,
            overdueAmount,
            daysLate,
            remainingBalance: loan.remaining_amount,
            status
          });
        }

        // Upcoming Next Installment check
        if (paidInstallments < totalInstallments) {
          const nextDueDate = installmentDueDates[paidInstallments];
          if (nextDueDate) {
            // Check if due this week for KPI
            if (nextDueDate >= startOfWeek && nextDueDate <= endOfWeek) {
              dueThisWeekCount++;
              dueThisWeekAmount += installmentAmount;
            }

            // Push to upcoming payments list
            const dateDiff = Math.floor((nextDueDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
            const paymentStatus: 'Due Today' | 'Upcoming' = dateDiff === 0 ? 'Due Today' : 'Upcoming';

            upcomingPayments.push({
              loanId: loan.id,
              loanNumber: loan.loan_number,
              clientId: loan.client_id,
              customerName,
              customerMobile,
              loanType: loan.loan_type,
              expectedDate: formatLocalIsoDate(nextDueDate),
              expectedInstalmentAmount: installmentAmount,
              remainingBalance: loan.remaining_amount,
              remainingInstallments,
              status: paymentStatus
            });
          }
        }
      }

      // Monitoring Item
      let monitoringStatus: 'Active' | 'Completed' | 'Overdue' = 'Active';
      if (isCompleted) {
        monitoringStatus = 'Completed';
      } else if (isOverdue) {
        monitoringStatus = 'Overdue';
      }

      allLoans.push({
        loanId: loan.id,
        loanNumber: loan.loan_number,
        clientId: loan.client_id,
        customerName,
        loanType: loan.loan_type,
        principal: loan.principal_amount,
        totalDue: loan.total_amount_due,
        totalPaid: loan.total_paid,
        remaining: loan.remaining_amount,
        paidInstallments,
        remainingInstallments,
        progressPercent,
        status: monitoringStatus,
        startDate: loan.start_date,
        expectedEndDate: loan.end_date
      });
    }

    // Sort late payments: highest days late first
    latePayments.sort((a, b) => b.daysLate - a.daysLate);

    // Sort upcoming payments: nearest expected date first
    upcomingPayments.sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));

    // Calculate collected this month from payments
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    let collectedThisMonth = 0;

    const paymentActivity: PaymentActivityItem[] = [];

    for (const p of payments) {
      const pDate = p.paid_date ? new Date(p.paid_date) : null;
      if (pDate && pDate.getFullYear() === currentYear && pDate.getMonth() === currentMonth) {
        collectedThisMonth += (p.paid_amount || 0);
      }

      const clientObj = p.loans?.clients;
      const cName = clientObj
        ? `${clientObj.first_name || ''} ${clientObj.last_name || ''}`.trim()
        : 'Customer';

      paymentActivity.push({
        paymentId: p.id,
        paidDate: p.paid_date,
        customerName: cName,
        loanNumber: p.loans?.loan_number || 'N/A',
        amountPaid: p.paid_amount || 0,
        remark: p.remark || '-',
        recordedOn: p.created_at ? p.created_at.split('T')[0] : p.paid_date
      });
    }

    const kpis: AnalysisKpis = {
      activeLoansCount,
      completedLoansCount,
      overdueLoansCount,
      dueThisWeekCount,
      dueThisWeekAmount,
      outstandingAmount,
      collectedThisMonth
    };

    return {
      kpis,
      latePayments,
      upcomingPayments,
      allLoans,
      paymentActivity
    };
  }

  /**
   * Helper to generate exact installment due dates sequentially
   */
  public generateInstallmentDueDates(
    startDateStr: string,
    installmentsCount: number,
    loanType: 'daily' | 'weekly' | 'monthly'
  ): Date[] {
    const dates: Date[] = [];
    const base = parseCalendarDate(startDateStr);

    for (let i = 1; i <= installmentsCount; i++) {
      const d = new Date(base);
      if (loanType === 'daily') {
        d.setDate(d.getDate() + i);
      } else if (loanType === 'weekly') {
        d.setDate(d.getDate() + (i * 7));
      } else if (loanType === 'monthly') {
        d.setMonth(d.getMonth() + i);
      }
      dates.push(d);
    }

    return dates;
  }

  /**
   * Fallback for legacy loans without installments column populated
   */
  public calculateDefaultInstallments(
    startDateStr: string,
    endDateStr: string,
    loanType: 'daily' | 'weekly' | 'monthly'
  ): number {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const timeDiff = end.getTime() - start.getTime();
    const daysDiff = Math.max(1, Math.ceil(timeDiff / (1000 * 3600 * 24)));

    if (loanType === 'daily') {
      return daysDiff;
    } else if (loanType === 'weekly') {
      return Math.max(1, Math.ceil(daysDiff / 7));
    } else {
      const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      return Math.max(1, months);
    }
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
