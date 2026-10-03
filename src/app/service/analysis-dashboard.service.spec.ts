import { TestBed } from '@angular/core/testing';
import { AnalysisDashboardService, DashboardFilterState } from './analysis-dashboard.service';
import { AnalysisService, formatLocalIsoDate } from './analysis.service';
import { SupabaseService } from './supabase.service';
import { LoanWithClient } from './loan-manage.service';

describe('AnalysisDashboardService', () => {
  let service: AnalysisDashboardService;
  let analysisService: AnalysisService;
  let mockSupabase: jasmine.SpyObj<SupabaseService>;

  const todayStr = formatLocalIsoDate(new Date());

  const mockLoans: LoanWithClient[] = [
    {
      id: 'L1',
      loan_number: 'LN-001',
      client_id: 'C1',
      loan_type: 'daily',
      principal_amount: 50000,
      interest_rate: 10,
      document_charge: 1000,
      total_amount_due: 55000,
      total_paid: 20000,
      remaining_amount: 35000,
      status: 'active',
      start_date: todayStr,
      end_date: todayStr,
      created_at: todayStr,
      client: {
        client_id: 'C1',
        first_name: 'Sunil',
        last_name: 'Perera',
        mobile_number: '0771234567'
      } as any
    },
    {
      id: 'L2',
      loan_number: 'LN-002',
      client_id: 'C2',
      loan_type: 'weekly',
      principal_amount: 100000,
      interest_rate: 10,
      document_charge: 2000,
      total_amount_due: 110000,
      total_paid: 110000,
      remaining_amount: 0,
      status: 'closed',
      start_date: '2026-01-01',
      end_date: '2026-03-01',
      created_at: '2026-01-01',
      client: {
        client_id: 'C2',
        first_name: 'Nimal',
        last_name: 'Silva',
        mobile_number: '0719876543'
      } as any
    }
  ];

  const mockPayments = [
    {
      id: 'P1',
      paid_date: todayStr,
      paid_amount: 5000,
      loans: {
        loan_number: 'LN-001',
        loan_type: 'DAILY',
        clients: { first_name: 'Sunil', last_name: 'Perera' }
      }
    }
  ];

  beforeEach(() => {
    mockSupabase = jasmine.createSpyObj('SupabaseService', ['getClient']);

    TestBed.configureTestingModule({
      providers: [
        AnalysisDashboardService,
        AnalysisService,
        { provide: SupabaseService, useValue: mockSupabase }
      ]
    });

    service = TestBed.inject(AnalysisDashboardService);
    analysisService = TestBed.inject(AnalysisService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should correctly resolve date ranges for this_month and today', () => {
    const todayRange = service.resolveDateRange('today');
    expect(todayRange.from).toBe(todayStr);
    expect(todayRange.to).toBe(todayStr);

    const monthRange = service.resolveDateRange('this_month');
    expect(monthRange.from.endsWith('-01')).toBeTrue();
    expect(monthRange.from <= monthRange.to).toBeTrue();
  });

  it('should compute dashboard bundle with mutually exclusive portfolio status counts', () => {
    const filters: DashboardFilterState = {
      period: 'this_month',
      frequency: 'all'
    };

    const bundle = service.computeDashboardBundle(mockLoans, mockPayments, filters);

    // Verify KPIs
    expect(bundle.kpis.activeLoansCount).toBe(1);
    expect(bundle.kpis.completedLoansCount).toBe(1);
    expect(bundle.kpis.outstandingAmount).toBe(35000);
    expect(bundle.kpis.collectedAmount).toBe(5000);
    expect(bundle.kpis.paymentCount).toBe(1);

    // Verify Portfolio Distribution: On Track + Overdue + Completed = Total
    const dist = bundle.portfolioDistribution;
    const sum = dist.counts[0] + dist.counts[1] + dist.counts[2];
    expect(sum).toBe(2);
    expect(dist.labels).toEqual(['Active (On Track)', 'Overdue', 'Completed']);
  });

  it('should filter dashboard by loan frequency', () => {
    const filtersDaily: DashboardFilterState = {
      period: 'this_month',
      frequency: 'daily'
    };

    const bundle = service.computeDashboardBundle(mockLoans, mockPayments, filtersDaily);
    expect(bundle.kpis.activeLoansCount).toBe(1);
    expect(bundle.kpis.completedLoansCount).toBe(0); // L2 was weekly

    const filtersWeekly: DashboardFilterState = {
      period: 'this_month',
      frequency: 'weekly'
    };

    const bundleWeekly = service.computeDashboardBundle(mockLoans, mockPayments, filtersWeekly);
    expect(bundleWeekly.kpis.activeLoansCount).toBe(0);
    expect(bundleWeekly.kpis.completedLoansCount).toBe(1);
  });
});
