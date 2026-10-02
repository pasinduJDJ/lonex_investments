import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { 
  AnalysisService, 
  AnalysisDataBundle, 
  AnalysisKpis,
  LatePaymentItem, 
  UpcomingPaymentItem, 
  LoanMonitoringItem, 
  PaymentActivityItem,
  formatLocalIsoDate
} from '../../service/analysis.service';

export type AnalysisTab = 'late_payments' | 'upcoming_payments' | 'loans' | 'payment_activity';
export type UpcomingFilter = 'today' | 'this_week' | 'next_week';
export type LoanFilter = 'all' | 'active' | 'completed' | 'overdue';
export type LateStatusFilter = 'all' | 'Due Today' | 'Late' | 'Overdue';

@Component({
  selector: 'app-analysis',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './analysis.component.html',
  styleUrl: './analysis.component.css'
})
export class AnalysisComponent implements OnInit {
  isLoading: boolean = true;
  isRefreshing: boolean = false;
  errorMessage: string = '';
  bundle: AnalysisDataBundle | null = null;

  // Active Tab
  activeTab: AnalysisTab = 'late_payments';

  // Tab 1 Filters: Late Payments
  lateSearch: string = '';
  lateStatusFilter: LateStatusFilter = 'all';
  latePage: number = 1;
  latePageSize: number = 10;

  // Tab 2 Filters: Upcoming Payments
  upcomingFilter: UpcomingFilter = 'this_week';
  upcomingSearch: string = '';
  upcomingPage: number = 1;
  upcomingPageSize: number = 10;

  // Tab 3 Filters: Loan Monitoring
  loanFilter: LoanFilter = 'active';
  loanSearch: string = '';
  loanPage: number = 1;
  loanPageSize: number = 10;

  // Tab 4 Filters: Payment Activity
  paymentSearch: string = '';
  paymentDateFrom: string = '';
  paymentDateTo: string = '';
  paymentPage: number = 1;
  paymentPageSize: number = 10;

  constructor(
    private analysisService: AnalysisService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Read initial tab from query parameter if present
    this.route.queryParams.subscribe(params => {
      const tabParam = params['tab'] as AnalysisTab;
      if (tabParam && ['late_payments', 'upcoming_payments', 'loans', 'payment_activity'].includes(tabParam)) {
        this.activeTab = tabParam;
      }
    });

    this.loadData();
  }

  loadData(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.analysisService.loadAnalysisData().subscribe({
      next: (bundle) => {
        this.bundle = bundle;
        this.isLoading = false;
        this.isRefreshing = false;
      },
      error: (err) => {
        console.error('Failed to load analysis data:', err);
        this.errorMessage = 'Failed to load operational analysis data. Please check connection and try again.';
        this.isLoading = false;
        this.isRefreshing = false;
      }
    });
  }

  refreshData(): void {
    this.isRefreshing = true;
    this.loadData();
  }

  setActiveTab(tab: AnalysisTab): void {
    this.activeTab = tab;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge'
    });
  }

  // ==========================================
  // TAB 1: LATE PAYMENTS FILTERING & PAGINATION
  // ==========================================
  get filteredLatePayments(): LatePaymentItem[] {
    if (!this.bundle) return [];
    let list = this.bundle.latePayments;

    // Search query
    if (this.lateSearch.trim()) {
      const q = this.lateSearch.toLowerCase().trim();
      list = list.filter(item => 
        item.loanNumber.toLowerCase().includes(q) ||
        item.customerName.toLowerCase().includes(q) ||
        item.loanType.toLowerCase().includes(q) ||
        item.customerMobile.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (this.lateStatusFilter !== 'all') {
      list = list.filter(item => item.status === this.lateStatusFilter);
    }

    return list;
  }

  get paginatedLatePayments(): LatePaymentItem[] {
    const start = (this.latePage - 1) * this.latePageSize;
    return this.filteredLatePayments.slice(start, start + this.latePageSize);
  }

  get totalLatePages(): number {
    return Math.max(1, Math.ceil(this.filteredLatePayments.length / this.latePageSize));
  }

  onLateSearchChange(): void {
    this.latePage = 1;
  }

  setLateStatusFilter(status: LateStatusFilter): void {
    this.lateStatusFilter = status;
    this.latePage = 1;
  }

  // ==========================================
  // TAB 2: UPCOMING PAYMENTS FILTERING & PAGINATION
  // ==========================================
  get filteredUpcomingPayments(): UpcomingPaymentItem[] {
    if (!this.bundle) return [];
    let list = this.bundle.upcomingPayments;

    const { todayStr, thisWeekStartStr, thisWeekEndStr, nextWeekStartStr, nextWeekEndStr } = this.getDateBounds();

    if (this.upcomingFilter === 'today') {
      list = list.filter(item => item.expectedDate === todayStr);
    } else if (this.upcomingFilter === 'this_week') {
      list = list.filter(item => item.expectedDate >= thisWeekStartStr && item.expectedDate <= thisWeekEndStr);
    } else if (this.upcomingFilter === 'next_week') {
      list = list.filter(item => item.expectedDate >= nextWeekStartStr && item.expectedDate <= nextWeekEndStr);
    }

    if (this.upcomingSearch.trim()) {
      const q = this.upcomingSearch.toLowerCase().trim();
      list = list.filter(item => 
        item.loanNumber.toLowerCase().includes(q) ||
        item.customerName.toLowerCase().includes(q) ||
        item.customerMobile.toLowerCase().includes(q) ||
        item.loanType.toLowerCase().includes(q)
      );
    }

    return list;
  }

  get paginatedUpcomingPayments(): UpcomingPaymentItem[] {
    const start = (this.upcomingPage - 1) * this.upcomingPageSize;
    return this.filteredUpcomingPayments.slice(start, start + this.upcomingPageSize);
  }

  get totalUpcomingPages(): number {
    return Math.max(1, Math.ceil(this.filteredUpcomingPayments.length / this.upcomingPageSize));
  }

  setUpcomingFilter(f: UpcomingFilter): void {
    this.upcomingFilter = f;
    this.upcomingPage = 1;
  }

  onUpcomingSearchChange(): void {
    this.upcomingPage = 1;
  }

  // ==========================================
  // TAB 3: LOANS MONITORING FILTERING & PAGINATION
  // ==========================================
  get filteredLoans(): LoanMonitoringItem[] {
    if (!this.bundle) return [];
    let list = this.bundle.allLoans;

    if (this.loanFilter === 'active') {
      list = list.filter(item => item.status === 'Active' || item.status === 'Overdue');
    } else if (this.loanFilter === 'completed') {
      list = list.filter(item => item.status === 'Completed');
    } else if (this.loanFilter === 'overdue') {
      list = list.filter(item => item.status === 'Overdue');
    }

    if (this.loanSearch.trim()) {
      const q = this.loanSearch.toLowerCase().trim();
      list = list.filter(item => 
        item.loanNumber.toLowerCase().includes(q) ||
        item.customerName.toLowerCase().includes(q) ||
        item.loanType.toLowerCase().includes(q)
      );
    }

    return list;
  }

  get paginatedLoans(): LoanMonitoringItem[] {
    const start = (this.loanPage - 1) * this.loanPageSize;
    return this.filteredLoans.slice(start, start + this.loanPageSize);
  }

  get totalLoanPages(): number {
    return Math.max(1, Math.ceil(this.filteredLoans.length / this.loanPageSize));
  }

  setLoanFilter(f: LoanFilter): void {
    this.loanFilter = f;
    this.loanPage = 1;
  }

  onLoanSearchChange(): void {
    this.loanPage = 1;
  }

  // ==========================================
  // TAB 4: PAYMENT ACTIVITY FILTERING & PAGINATION
  // ==========================================
  get filteredPaymentActivity(): PaymentActivityItem[] {
    if (!this.bundle) return [];
    let list = this.bundle.paymentActivity;

    if (this.paymentSearch.trim()) {
      const q = this.paymentSearch.toLowerCase().trim();
      list = list.filter(item => 
        item.loanNumber.toLowerCase().includes(q) ||
        item.customerName.toLowerCase().includes(q) ||
        (item.remark && item.remark.toLowerCase().includes(q))
      );
    }

    if (this.paymentDateFrom) {
      list = list.filter(item => item.paidDate >= this.paymentDateFrom);
    }

    if (this.paymentDateTo) {
      list = list.filter(item => item.paidDate <= this.paymentDateTo);
    }

    return list;
  }

  get paginatedPaymentActivity(): PaymentActivityItem[] {
    const start = (this.paymentPage - 1) * this.paymentPageSize;
    return this.filteredPaymentActivity.slice(start, start + this.paymentPageSize);
  }

  get totalPaymentPages(): number {
    return Math.max(1, Math.ceil(this.filteredPaymentActivity.length / this.paymentPageSize));
  }

  onPaymentFilterChange(): void {
    this.paymentPage = 1;
  }

  clearPaymentDateFilter(): void {
    this.paymentDateFrom = '';
    this.paymentDateTo = '';
    this.paymentPage = 1;
  }

  // ==========================================
  // NAVIGATION & ACTIONS
  // ==========================================
  viewLoan(loanNumber: string): void {
    if (!loanNumber || loanNumber === 'N/A') return;
    this.router.navigate(['/single-loan', loanNumber]);
  }

  recordPayment(loanNumber: string): void {
    if (!loanNumber || loanNumber === 'N/A') return;
    this.router.navigate(['/add-payments'], { queryParams: { loan_number: loanNumber } });
  }

  // ==========================================
  // DATE BOUND HELPERS
  // ==========================================
  private getDateBounds(): {
    todayStr: string;
    thisWeekStartStr: string;
    thisWeekEndStr: string;
    nextWeekStartStr: string;
    nextWeekEndStr: string;
  } {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const todayStr = formatLocalIsoDate(now);

    const day = now.getDay(); // 0 is Sun, 1 is Mon
    const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);

    const thisMon = new Date(now);
    thisMon.setDate(diffToMonday);
    const thisSun = new Date(thisMon);
    thisSun.setDate(thisMon.getDate() + 6);

    const nextMon = new Date(thisMon);
    nextMon.setDate(thisMon.getDate() + 7);
    const nextSun = new Date(nextMon);
    nextSun.setDate(nextMon.getDate() + 6);

    return {
      todayStr,
      thisWeekStartStr: formatLocalIsoDate(thisMon),
      thisWeekEndStr: formatLocalIsoDate(thisSun),
      nextWeekStartStr: formatLocalIsoDate(nextMon),
      nextWeekEndStr: formatLocalIsoDate(nextSun)
    };
  }
}
