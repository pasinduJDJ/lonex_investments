import { TestBed } from '@angular/core/testing';
import { PaymentReportService } from './payment-report.service';
import { SupabaseService } from './supabase.service';
import { AnalysisService } from './analysis.service';

describe('PaymentReportService', () => {
  let service: PaymentReportService;
  let mockSupabaseService: jasmine.SpyObj<SupabaseService>;
  let mockAnalysisService: jasmine.SpyObj<AnalysisService>;

  const mockLoans: any[] = [
    {
      id: 'L1',
      loan_number: 'LN-2026-001',
      client_id: 'C1',
      client: {
        first_name: 'Sunil',
        last_name: 'Perera',
        nic_number: '851234567V',
        mobile_number: '0771234567'
      },
      principal_amount: 100000,
      total_amount_due: 120000,
      installment_amount: 10000,
      installments: 12,
      loan_type: 'monthly',
      total_paid: 40000,
      remaining_amount: 80000,
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      status: 'active'
    },
    {
      id: 'L2',
      loan_number: 'LN-2026-002',
      client_id: 'C2',
      client: {
        first_name: 'Nimal',
        last_name: 'Silva',
        nic_number: '901234567V',
        mobile_number: '0719876543'
      },
      principal_amount: 50000,
      total_amount_due: 60000,
      installment_amount: 5000,
      installments: 12,
      loan_type: 'weekly',
      total_paid: 60000,
      remaining_amount: 0,
      start_date: '2025-06-01',
      end_date: '2025-09-01',
      status: 'closed'
    }
  ];

  const mockPayments: any[] = [
    {
      id: 'P1',
      loan_id: 'L1',
      paid_amount: 20000,
      paid_date: '2026-02-01',
      created_at: '2026-02-01T10:00:00Z',
      remark: 'First installment payment',
      loans: {
        loan_number: 'LN-2026-001',
        loan_type: 'monthly',
        status: 'active',
        client_id: 'C1',
        clients: {
          first_name: 'Sunil',
          last_name: 'Perera',
          nic_number: '851234567V',
          mobile_number: '0771234567'
        }
      }
    },
    {
      id: 'P2',
      loan_id: 'L1',
      paid_amount: 20000,
      paid_date: '2026-02-15',
      created_at: '2026-02-15T10:00:00Z',
      remark: 'Second installment payment',
      loans: {
        loan_number: 'LN-2026-001',
        loan_type: 'monthly',
        status: 'active',
        client_id: 'C1',
        clients: {
          first_name: 'Sunil',
          last_name: 'Perera',
          nic_number: '851234567V',
          mobile_number: '0771234567'
        }
      }
    }
  ];

  beforeEach(() => {
    mockSupabaseService = jasmine.createSpyObj('SupabaseService', ['getClient']);
    mockAnalysisService = jasmine.createSpyObj('AnalysisService', ['deriveAnalysisBundle']);

    const createQueryChain = (resolvedData: any) => ({
      select: jasmine.createSpy('select').and.returnValue({
        order: jasmine.createSpy('order').and.resolveTo({ data: resolvedData, error: null }),
        eq: jasmine.createSpy('eq').and.returnValue({
          order: jasmine.createSpy('order').and.resolveTo({ data: resolvedData, error: null }),
          single: jasmine.createSpy('single').and.resolveTo({ data: resolvedData, error: null })
        })
      })
    });

    mockSupabaseService.getClient.and.returnValue({
      from: (table: string) => {
        if (table === 'loans') {
          return createQueryChain(mockLoans);
        } else if (table === 'payments') {
          return createQueryChain(mockPayments);
        }
        return createQueryChain([]);
      }
    } as any);

    mockAnalysisService.deriveAnalysisBundle.and.returnValue({
      kpis: {} as any,
      latePayments: [
        {
          loanId: 'L1',
          loanNumber: 'LN-2026-001',
          clientId: 'C1',
          customerName: 'Sunil Perera',
          customerMobile: '0771234567',
          loanType: 'monthly',
          expectedPaymentDate: '2026-03-01',
          expectedInstalmentAmount: 10000,
          paidInstallments: 4,
          expectedInstallmentsToDate: 5,
          totalInstallments: 12,
          overdueInstallments: 1,
          overdueAmount: 10000,
          daysLate: 15,
          remainingBalance: 80000,
          status: 'Overdue'
        }
      ],
      upcomingPayments: [
        {
          loanId: 'L1',
          loanNumber: 'LN-2026-001',
          clientId: 'C1',
          customerName: 'Sunil Perera',
          customerMobile: '0771234567',
          loanType: 'monthly',
          expectedDate: '2026-04-01',
          expectedInstalmentAmount: 10000,
          remainingBalance: 80000,
          remainingInstallments: 8,
          status: 'Upcoming'
        }
      ],
      allLoans: [],
      paymentActivity: []
    });

    TestBed.configureTestingModule({
      providers: [
        PaymentReportService,
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: AnalysisService, useValue: mockAnalysisService }
      ]
    });

    service = TestBed.inject(PaymentReportService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Report 01: Payment History Report', () => {
    it('should return all recorded payment transactions with accurate summary', (done) => {
      service.getPaymentHistoryReport().subscribe({
        next: ({ rows, summary }) => {
          expect(rows.length).toBe(2);
          expect(summary.totalPayments).toBe(2);
          expect(summary.totalCollected).toBe(40000);
          expect(summary.averagePayment).toBe(20000);
          expect(rows[0].customerName).toBe('Sunil Perera');
          expect(rows[0].nicNumber).toBe('851234567V');
          expect(rows[0].paidAmount).toBe(20000);
          done();
        },
        error: done.fail
      });
    });

    it('should filter payments by payment date range', (done) => {
      service.getPaymentHistoryReport({ dateFrom: '2026-02-10', dateTo: '2026-02-20' }).subscribe({
        next: ({ rows, summary }) => {
          expect(rows.length).toBe(1);
          expect(rows[0].paidDate).toBe('2026-02-15');
          expect(summary.totalCollected).toBe(20000);
          done();
        },
        error: done.fail
      });
    });

    it('should filter payments by search term', (done) => {
      service.getPaymentHistoryReport({ search: 'Second' }).subscribe({
        next: ({ rows, summary }) => {
          expect(rows.length).toBe(1);
          expect(rows[0].remark).toContain('Second');
          done();
        },
        error: done.fail
      });
    });
  });

  describe('Report 02: Delayed Payment Report', () => {
    it('should reuse AnalysisService latePayments and compute overdue metrics', (done) => {
      service.getDelayedPaymentsReport().subscribe({
        next: ({ rows, summary }) => {
          expect(mockAnalysisService.deriveAnalysisBundle).toHaveBeenCalled();
          expect(rows.length).toBe(1);
          expect(rows[0].loanNumber).toBe('LN-2026-001');
          expect(rows[0].overdueAmount).toBe(10000);
          expect(rows[0].daysLate).toBe(15);
          expect(summary.totalDelayedObligations).toBe(1);
          expect(summary.totalOverdueAmount).toBe(10000);
          expect(summary.affectedCustomers).toBe(1);
          expect(summary.count8To30Days).toBe(1);
          done();
        },
        error: done.fail
      });
    });
  });

  describe('Report 03: Collection Report', () => {
    it('should return actual collections with exact reconciling frequency breakdown', (done) => {
      service.getCollectionReport().subscribe({
        next: ({ rows, summary }) => {
          expect(rows.length).toBe(2);
          expect(summary.totalCollected).toBe(40000);
          expect(summary.transactionCount).toBe(2);
          expect(summary.customersPaid).toBe(1);
          expect(summary.loansPaid).toBe(1);
          expect(summary.monthlyCollections).toBe(40000);
          expect(summary.dailyCollections).toBe(0);
          expect(summary.weeklyCollections).toBe(0);
          // Reconcile breakdown sum
          expect(summary.dailyCollections + summary.weeklyCollections + summary.monthlyCollections)
            .toBe(summary.totalCollected);
          done();
        },
        error: done.fail
      });
    });
  });

  describe('Report 04: Upcoming Payments Report', () => {
    it('should return upcoming obligations with frequency breakdown', (done) => {
      service.getUpcomingPaymentsReport({ quickPeriod: 'custom', dateFrom: '2026-04-01', dateTo: '2026-04-30' }).subscribe({
        next: ({ rows, summary }) => {
          expect(rows.length).toBe(1);
          expect(rows[0].expectedDate).toBe('2026-04-01');
          expect(rows[0].expectedAmount).toBe(10000);
          expect(summary.expectedPaymentCount).toBe(1);
          expect(summary.totalExpectedCollection).toBe(10000);
          expect(summary.monthlyExpected).toBe(10000);
          expect(summary.dailyExpected + summary.weeklyExpected + summary.monthlyExpected)
            .toBe(summary.totalExpectedCollection);
          done();
        },
        error: done.fail
      });
    });
  });

  describe('Report 05: Payment Performance Report', () => {
    it('should compare expected schedule obligations vs actual payment collections', (done) => {
      service.getPaymentPerformanceReport({ dateFrom: '2026-02-01', dateTo: '2026-02-28' }).subscribe({
        next: (data) => {
          expect(data).toBeTruthy();
          expect(data.summary).toBeTruthy();
          // Actual recorded in Feb 2026 is 40,000
          expect(data.summary.totalActual).toBe(40000);
          // Month 2 expected from loan L1 (start 2026-01-01) is 10,000 on 2026-02-01
          expect(data.summary.totalExpected).toBeGreaterThan(0);
          expect(data.summary.overallCollectionRate).toBeGreaterThan(0);
          expect(data.paymentRows.length).toBe(2);
          done();
        },
        error: done.fail
      });
    });
  });
});
