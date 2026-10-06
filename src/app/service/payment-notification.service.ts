import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AnalysisService, formatLocalIsoDate } from './analysis.service';

/**
 * Frontend Read-Only Notification Model
 * Derived dynamically from active loans and repayment schedules for TODAY.
 * ZERO DATABASE WRITES.
 */
export interface DuePaymentNotification {
  loanId: string;
  loanNumber: string;
  clientId: string;
  customerName: string;
  customerMobile: string;
  expectedDate: string;
  expectedAmount: number;
  paidTowardObligation: number;
  remainingDue: number;
  loanType: string;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentNotificationService {
  private duePaymentsSubject = new BehaviorSubject<DuePaymentNotification[]>([]);
  public duePayments$ = this.duePaymentsSubject.asObservable();

  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$ = this.isLoadingSubject.asObservable();

  private errorSubject = new BehaviorSubject<string | null>(null);
  public error$ = this.errorSubject.asObservable();

  private lastLoadedDate: string = '';
  private lastFetchTime: number = 0;
  // Cache in-memory for 60 seconds unless explicitly forced or local day rolls over
  private readonly cacheDurationMs = 60000;

  constructor(private analysisService: AnalysisService) {}

  public get currentDuePayments(): DuePaymentNotification[] {
    return this.duePaymentsSubject.value;
  }

  public get currentDueCount(): number {
    return this.duePaymentsSubject.value.length;
  }

  /**
   * Loads or refreshes payments due today (100% READ-ONLY).
   * @param force If true, bypasses the in-memory time cache.
   */
  public loadDuePayments(force: boolean = false): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = formatLocalIsoDate(today);

    // Midnight / date rollover: auto-invalidate cache if local calendar day shifted
    if (this.lastLoadedDate && this.lastLoadedDate !== todayStr) {
      force = true;
    }

    const now = Date.now();
    if (!force && this.lastFetchTime > 0 && (now - this.lastFetchTime < this.cacheDurationMs)) {
      return;
    }

    this.isLoadingSubject.next(true);
    this.errorSubject.next(null);

    this.analysisService.loadAnalysisData().pipe(
      map(bundle => {
        const currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);
        const currentTodayStr = formatLocalIsoDate(currentDate);

        // Filter obligations due strictly today with remaining amount to be paid
        const dueTodayItems = (bundle.upcomingPayments || []).filter(item => {
          const isToday = item.expectedDate === currentTodayStr;
          const remainingDue = item.remainingDue !== undefined 
            ? item.remainingDue 
            : item.expectedInstalmentAmount;
          return isToday && remainingDue > 0;
        });

        return dueTodayItems.map(item => {
          const cleanMobile = item.customerMobile && item.customerMobile !== '-' ? item.customerMobile.trim() : '';
          const remainingDue = item.remainingDue !== undefined 
            ? item.remainingDue 
            : item.expectedInstalmentAmount;
          const paidToward = item.paidTowardObligation || 0;

          return {
            loanId: item.loanId,
            loanNumber: item.loanNumber,
            clientId: item.clientId,
            customerName: item.customerName || 'Unknown Customer',
            customerMobile: cleanMobile,
            expectedDate: item.expectedDate,
            expectedAmount: item.expectedInstalmentAmount,
            paidTowardObligation: paidToward,
            remainingDue: remainingDue,
            loanType: item.loanType || 'monthly'
          } as DuePaymentNotification;
        });
      }),
      catchError(err => {
        console.error('Failed to load due payments notifications:', err);
        this.errorSubject.next('Unable to load today\'s payments.');
        this.isLoadingSubject.next(false);
        return of([]);
      })
    ).subscribe(items => {
      this.duePaymentsSubject.next(items);
      this.lastLoadedDate = todayStr;
      this.lastFetchTime = Date.now();
      this.isLoadingSubject.next(false);
    });
  }

  /**
   * Explicitly refreshes due today payments.
   * Useful when opening the notification dropdown or after a successful payment.
   */
  public refresh(): void {
    this.loadDuePayments(true);
  }
}
