import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
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
import { 
  AnalysisDashboardService, 
  DashboardBundle, 
  DashboardFilterState, 
  DashboardPeriod, 
  DashboardFrequency 
} from '../../service/analysis-dashboard.service';
import { ThemeService, ThemeMode } from '../../service/theme.service';

import {
  Chart,
  LineController,
  BarController,
  DoughnutController,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

Chart.register(
  LineController,
  BarController,
  DoughnutController,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export type AnalysisTab = 'dashboard' | 'late_payments' | 'upcoming_payments' | 'loans' | 'payment_activity';
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
export class AnalysisComponent implements OnInit, OnDestroy, AfterViewInit {
  readonly Math = Math;
  isLoading: boolean = true;
  isRefreshing: boolean = false;
  isDashboardLoading: boolean = false;
  errorMessage: string = '';
  bundle: AnalysisDataBundle | null = null;
  dashboardBundle: DashboardBundle | null = null;

  // Active Tab & View Mode
  activeTab: AnalysisTab = 'dashboard';
  isOperationalView: boolean = false;

  // Dashboard Global Filters
  dashboardPeriod: DashboardPeriod = 'this_month';
  dashboardCustomFrom: string = '';
  dashboardCustomTo: string = '';
  dashboardFrequency: DashboardFrequency = 'all';
  issuanceMetric: 'amount' | 'count' = 'amount';

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

  // Chart Instances
  private collectionTrendChart: Chart | null = null;
  private portfolioStatusChart: Chart | null = null;
  private collectionPerformanceChart: Chart | null = null;
  private frequencyDistributionChart: Chart | null = null;
  private issuanceTrendChart: Chart | null = null;

  private routeEventsSub!: Subscription;
  private queryParamsSub!: Subscription;
  private themeSub!: Subscription;

  constructor(
    private analysisService: AnalysisService,
    private dashboardService: AnalysisDashboardService,
    private themeService: ThemeService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Listen for route navigation events (e.g. switching between /analysis and /analysis/operational)
    if (this.router && this.router.events) {
      this.routeEventsSub = this.router.events
        .pipe(filter(event => event instanceof NavigationEnd))
        .subscribe(() => {
          this.syncViewAndTab();
        });
    }

    // Listen to query parameters updates
    if (this.route && this.route.queryParams) {
      this.queryParamsSub = this.route.queryParams.subscribe(() => {
        this.syncViewAndTab();
      });
    }

    // Theme changes dynamically update charts
    this.themeSub = this.themeService.theme$.subscribe(() => {
      if (!this.isOperationalView && this.activeTab === 'dashboard') {
        setTimeout(() => this.renderCharts(), 100);
      }
    });

    this.syncViewAndTab();
    this.loadData();
  }

  ngAfterViewInit(): void {
    if (!this.isOperationalView && this.activeTab === 'dashboard' && this.dashboardBundle) {
      setTimeout(() => this.renderCharts(), 200);
    }
  }

  ngOnDestroy(): void {
    if (this.routeEventsSub) this.routeEventsSub.unsubscribe();
    if (this.queryParamsSub) this.queryParamsSub.unsubscribe();
    if (this.themeSub) this.themeSub.unsubscribe();
    this.destroyCharts();
  }

  public syncViewAndTab(): void {
    const currentUrl = (this.router && this.router.url) ? this.router.url : '/analysis';
    const path = currentUrl.split('?')[0];
    this.isOperationalView = path.startsWith('/analysis/operational');

    const tabParam = (this.route && this.route.snapshot && this.route.snapshot.queryParams) 
      ? (this.route.snapshot.queryParams['tab'] as AnalysisTab)
      : null;

    if (this.isOperationalView) {
      if (tabParam && ['late_payments', 'upcoming_payments', 'loans', 'payment_activity'].includes(tabParam)) {
        this.activeTab = tabParam;
      } else {
        this.activeTab = 'late_payments';
      }
      this.destroyCharts();
    } else {
      this.activeTab = 'dashboard';
      if (this.dashboardBundle) {
        setTimeout(() => this.renderCharts(), 150);
      }
    }
  }

  loadData(): void {
    this.isLoading = true;
    this.errorMessage = '';

    // Load operational data and dashboard metrics in parallel
    this.loadDashboardData();

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

  loadDashboardData(): void {
    this.isDashboardLoading = true;
    const filterState: DashboardFilterState = {
      period: this.dashboardPeriod,
      dateFrom: this.dashboardPeriod === 'custom' ? this.dashboardCustomFrom : undefined,
      dateTo: this.dashboardPeriod === 'custom' ? this.dashboardCustomTo : undefined,
      frequency: this.dashboardFrequency
    };

    this.dashboardService.loadDashboard(filterState).subscribe({
      next: (bundle) => {
        this.dashboardBundle = bundle;
        this.isDashboardLoading = false;
        if (!this.isOperationalView && this.activeTab === 'dashboard') {
          setTimeout(() => this.renderCharts(), 100);
        }
      },
      error: (err) => {
        console.error('Failed to load dashboard bundle:', err);
        this.isDashboardLoading = false;
      }
    });
  }

  refreshData(): void {
    this.isRefreshing = true;
    this.loadData();
  }

  setActiveTab(tab: AnalysisTab): void {
    if (tab === 'dashboard') {
      this.router.navigate(['/analysis']);
      return;
    }
    this.activeTab = tab;
    this.router.navigate(['/analysis/operational'], {
      queryParams: { tab }
    });
    this.destroyCharts();
  }

  // ==========================================
  // DASHBOARD FILTER HANDLERS
  // ==========================================
  onDashboardFilterChange(): void {
    this.loadDashboardData();
  }

  resetDashboardFilters(): void {
    this.dashboardPeriod = 'this_month';
    this.dashboardCustomFrom = '';
    this.dashboardCustomTo = '';
    this.dashboardFrequency = 'all';
    this.issuanceMetric = 'amount';
    this.loadDashboardData();
  }

  toggleIssuanceMetric(metric: 'amount' | 'count'): void {
    this.issuanceMetric = metric;
    this.renderIssuanceTrendChart();
  }

  // Drill-down Click Handlers
  navigateToActiveLoans(): void {
    this.loanFilter = 'active';
    this.setActiveTab('loans');
  }

  navigateToCompletedLoans(): void {
    this.loanFilter = 'completed';
    this.setActiveTab('loans');
  }

  navigateToOverdueLoans(): void {
    this.setActiveTab('late_payments');
  }

  navigateToOutstanding(): void {
    this.setActiveTab('loans');
  }

  navigateToCollected(): void {
    this.setActiveTab('payment_activity');
  }

  navigateToExpected(): void {
    this.setActiveTab('upcoming_payments');
  }

  // ==========================================
  // CHART RENDERING (Chart.js)
  // ==========================================
  renderCharts(): void {
    if (!this.dashboardBundle) return;

    this.renderCollectionTrendChart();
    this.renderPortfolioStatusChart();
    this.renderCollectionPerformanceChart();
    this.renderFrequencyDistributionChart();
    this.renderIssuanceTrendChart();
  }

  private destroyCharts(): void {
    if (this.collectionTrendChart) { this.collectionTrendChart.destroy(); this.collectionTrendChart = null; }
    if (this.portfolioStatusChart) { this.portfolioStatusChart.destroy(); this.portfolioStatusChart = null; }
    if (this.collectionPerformanceChart) { this.collectionPerformanceChart.destroy(); this.collectionPerformanceChart = null; }
    if (this.frequencyDistributionChart) { this.frequencyDistributionChart.destroy(); this.frequencyDistributionChart = null; }
    if (this.issuanceTrendChart) { this.issuanceTrendChart.destroy(); this.issuanceTrendChart = null; }
  }

  // 1. Collection Trend (Line Chart)
  private renderCollectionTrendChart(): void {
    const canvas = document.getElementById('collectionTrendCanvas') as HTMLCanvasElement;
    if (!canvas || !this.dashboardBundle) return;
    if (this.collectionTrendChart) this.collectionTrendChart.destroy();

    const isDark = this.themeService.isDarkMode();
    const data = this.dashboardBundle.collectionTrend;

    this.collectionTrendChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [
          {
            label: 'Customer Repayments (Rs.)',
            data: data.datasets[0].data,
            borderColor: '#D4A437',
            backgroundColor: isDark ? 'rgba(212, 164, 55, 0.15)' : 'rgba(212, 164, 55, 0.12)',
            fill: true,
            tension: 0.35,
            borderWidth: 2.5,
            pointBackgroundColor: '#D4A437',
            pointRadius: data.labels.length > 30 ? 0 : 3,
            pointHoverRadius: 5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: isDark ? '#24262B' : '#ffffff',
            borderColor: isDark ? '#383B40' : '#cbd5e1',
            borderWidth: 1,
            titleColor: isDark ? '#ffffff' : '#0f172a',
            bodyColor: isDark ? '#cbd5e1' : '#334155',
            padding: 10,
            callbacks: {
              label: (ctx) => {
                const val = (ctx.raw as number) || 0;
                const counts = data.datasets[0].meta || [];
                const count = counts[ctx.dataIndex] || 0;
                return [
                  ` Collected: Rs. ${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
                  ` Payments: ${count} transactions`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)' },
            ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { size: 11 } }
          },
          y: {
            grid: { color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)' },
            ticks: {
              color: isDark ? '#94a3b8' : '#64748b',
              font: { size: 11 },
              callback: (val) => 'Rs. ' + Number(val).toLocaleString()
            }
          }
        }
      }
    });
  }

  // 2. Loan Portfolio Status (Donut Chart)
  private renderPortfolioStatusChart(): void {
    const canvas = document.getElementById('portfolioStatusCanvas') as HTMLCanvasElement;
    if (!canvas || !this.dashboardBundle) return;
    if (this.portfolioStatusChart) this.portfolioStatusChart.destroy();

    const isDark = this.themeService.isDarkMode();
    const data = this.dashboardBundle.portfolioDistribution;

    this.portfolioStatusChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: data.labels,
        datasets: [
          {
            data: data.counts,
            backgroundColor: ['#159A74', '#D9534F', '#64748B'],
            borderColor: isDark ? '#24262B' : '#ffffff',
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: isDark ? '#cbd5e1' : '#475569',
              font: { size: 11, weight: 'bold' },
              padding: 12
            }
          },
          tooltip: {
            backgroundColor: isDark ? '#24262B' : '#ffffff',
            borderColor: isDark ? '#383B40' : '#cbd5e1',
            borderWidth: 1,
            titleColor: isDark ? '#ffffff' : '#0f172a',
            bodyColor: isDark ? '#cbd5e1' : '#334155',
            callbacks: {
              label: (ctx) => {
                const idx = ctx.dataIndex;
                const count = data.counts[idx];
                const pct = data.percentages[idx];
                const amt = data.amounts[idx];
                const lines = [` ${data.labels[idx]}: ${count} loans (${pct}%)`];
                if (amt > 0) {
                  lines.push(` Balance: Rs. ${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
                }
                return lines;
              }
            }
          }
        }
      }
    });
  }

  // 3. Expected vs Actual Collection (Grouped Bar Chart)
  private renderCollectionPerformanceChart(): void {
    const canvas = document.getElementById('collectionPerformanceCanvas') as HTMLCanvasElement;
    if (!canvas || !this.dashboardBundle) return;
    if (this.collectionPerformanceChart) this.collectionPerformanceChart.destroy();

    const isDark = this.themeService.isDarkMode();
    const data = this.dashboardBundle.collectionPerformance;

    this.collectionPerformanceChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [
          {
            label: 'Expected Obligations',
            data: data.expected,
            backgroundColor: isDark ? 'rgba(56, 189, 248, 0.75)' : '#0284c7',
            borderRadius: 4
          },
          {
            label: 'Actual Collected',
            data: data.actual,
            backgroundColor: isDark ? 'rgba(21, 154, 116, 0.85)' : '#159A74',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: isDark ? '#cbd5e1' : '#475569',
              font: { size: 11, weight: 'bold' }
            }
          },
          tooltip: {
            backgroundColor: isDark ? '#24262B' : '#ffffff',
            borderColor: isDark ? '#383B40' : '#cbd5e1',
            borderWidth: 1,
            titleColor: isDark ? '#ffffff' : '#0f172a',
            bodyColor: isDark ? '#cbd5e1' : '#334155',
            callbacks: {
              label: (ctx) => {
                const idx = ctx.dataIndex;
                const exp = data.expected[idx] || 0;
                const act = data.actual[idx] || 0;
                const diff = data.differences[idx] || 0;
                const rate = data.rates[idx];
                return [
                  ` Expected: Rs. ${exp.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
                  ` Actual: Rs. ${act.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
                  ` Difference: Rs. ${diff.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
                  ` Collection Rate: ${rate !== null ? rate + '%' : 'N/A'}`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)' },
            ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { size: 11 } }
          },
          y: {
            grid: { color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)' },
            ticks: {
              color: isDark ? '#94a3b8' : '#64748b',
              font: { size: 11 },
              callback: (val) => 'Rs. ' + Number(val).toLocaleString()
            }
          }
        }
      }
    });
  }

  // 4. Loan Frequency Distribution (Donut Chart)
  private renderFrequencyDistributionChart(): void {
    const canvas = document.getElementById('frequencyDistributionCanvas') as HTMLCanvasElement;
    if (!canvas || !this.dashboardBundle) return;
    if (this.frequencyDistributionChart) this.frequencyDistributionChart.destroy();

    const isDark = this.themeService.isDarkMode();
    const data = this.dashboardBundle.frequencyDistribution;

    this.frequencyDistributionChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: data.labels,
        datasets: [
          {
            data: data.counts,
            backgroundColor: ['#D4A437', '#38BDF8', '#818CF8'],
            borderColor: isDark ? '#24262B' : '#ffffff',
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: isDark ? '#cbd5e1' : '#475569',
              font: { size: 11, weight: 'bold' },
              padding: 12
            }
          },
          tooltip: {
            backgroundColor: isDark ? '#24262B' : '#ffffff',
            borderColor: isDark ? '#383B40' : '#cbd5e1',
            borderWidth: 1,
            titleColor: isDark ? '#ffffff' : '#0f172a',
            bodyColor: isDark ? '#cbd5e1' : '#334155',
            callbacks: {
              label: (ctx) => {
                const idx = ctx.dataIndex;
                const count = data.counts[idx];
                const pct = data.percentages[idx];
                const amt = data.amounts[idx];
                return [
                  ` ${data.labels[idx]}: ${count} loans (${pct}%)`,
                  ` Active Bal: Rs. ${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                ];
              }
            }
          }
        }
      }
    });
  }

  // 5. Loan Issuance Trend (Bar Chart with Toggle)
  private renderIssuanceTrendChart(): void {
    const canvas = document.getElementById('issuanceTrendCanvas') as HTMLCanvasElement;
    if (!canvas || !this.dashboardBundle) return;
    if (this.issuanceTrendChart) this.issuanceTrendChart.destroy();

    const isDark = this.themeService.isDarkMode();
    const data = this.dashboardBundle.issuanceTrend;
    const isAmount = this.issuanceMetric === 'amount';

    this.issuanceTrendChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [
          {
            label: isAmount ? 'Total Loan Amount (Rs.)' : 'Loans Issued (Count)',
            data: isAmount ? data.amounts : data.counts,
            backgroundColor: isDark ? 'rgba(212, 164, 55, 0.85)' : '#D4A437',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: isDark ? '#24262B' : '#ffffff',
            borderColor: isDark ? '#383B40' : '#cbd5e1',
            borderWidth: 1,
            titleColor: isDark ? '#ffffff' : '#0f172a',
            bodyColor: isDark ? '#cbd5e1' : '#334155',
            callbacks: {
              label: (ctx) => {
                const idx = ctx.dataIndex;
                const amt = data.amounts[idx] || 0;
                const count = data.counts[idx] || 0;
                return [
                  ` Loans Issued: ${count}`,
                  ` Total Principal: Rs. ${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)' },
            ticks: { color: isDark ? '#94a3b8' : '#64748b', font: { size: 11 } }
          },
          y: {
            grid: { color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)' },
            ticks: {
              color: isDark ? '#94a3b8' : '#64748b',
              font: { size: 11 },
              callback: (val) => isAmount ? ('Rs. ' + Number(val).toLocaleString()) : Number(val).toString()
            }
          }
        }
      }
    });
  }

  // ==========================================
  // TAB 1: LATE PAYMENTS FILTERING & PAGINATION
  // ==========================================
  get filteredLatePayments(): LatePaymentItem[] {
    if (!this.bundle) return [];
    let list = this.bundle.latePayments;

    if (this.lateSearch.trim()) {
      const q = this.lateSearch.toLowerCase().trim();
      list = list.filter(item => 
        item.loanNumber.toLowerCase().includes(q) ||
        item.customerName.toLowerCase().includes(q) ||
        item.loanType.toLowerCase().includes(q) ||
        item.customerMobile.toLowerCase().includes(q)
      );
    }

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

    const day = now.getDay();
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
