import { TestBed } from '@angular/core/testing';
import { LoanReportService } from './loan-report.service';
import { SupabaseService } from './supabase.service';
import { AnalysisService } from './analysis.service';
import { LoanManageService } from './loan-manage.service';
import { of } from 'rxjs';

describe('LoanReportService', () => {
  let service: LoanReportService;
  let mockSupabaseService: jasmine.SpyObj<SupabaseService>;
  let mockAnalysisService: jasmine.SpyObj<AnalysisService>;
  let mockLoanManageService: jasmine.SpyObj<LoanManageService>;

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
      amount: 40000,
      paid_date: '2026-02-01',
      created_at: '2026-02-01T10:00:00Z',
      remark: 'Payment 1'
    },
    {
      id: 'P2',
      loan_id: 'L2',
      amount: 60000,
      paid_date: '2025-08-25',
      created_at: '2025-08-25T10:00:00Z',
      remark: 'Full settlement'
    }
  ];

  beforeEach(() => {
    mockSupabaseService = jasmine.createSpyObj('SupabaseService', ['getClient']);
    mockAnalysisService = jasmine.createSpyObj('AnalysisService', ['deriveAnalysisBundle']);
    mockLoanManageService = jasmine.createSpyObj('LoanManageService', ['getAllLoans']);

    // Default mock query builder for read-only supabase queries
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
        } else if (table === 'loan_reschedule_history') {
          return createQueryChain([]);
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
          loanType: 'Monthly',
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
      upcomingPayments: [],
      allLoans: [],
      paymentActivity: []
    });

    TestBed.configureTestingModule({
      providers: [
        LoanReportService,
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: AnalysisService, useValue: mockAnalysisService },
        { provide: LoanManageService, useValue: mockLoanManageService }
      ]
    });

    service = TestBed.inject(LoanReportService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Loan History Report', () => {
    it('should return loan history report with correct summary metrics', (done) => {
      service.getLoanHistoryReport().subscribe({
        next: ({ rows, summary }) => {
          expect(rows.length).toBe(2);
          expect(summary.totalLoans).toBe(2);
          expect(summary.totalPrincipal).toBe(150000);
          expect(summary.totalPaid).toBe(100000);
          expect(summary.totalRemaining).toBe(80000);
          expect(summary.completedCount).toBe(1);
          done();
        },
        error: done.fail
      });
    });

    it('should filter by authoritative start_date period', (done) => {
      service.getLoanHistoryReport({ dateFrom: '2026-01-01', dateTo: '2026-01-31' }).subscribe({
        next: ({ rows, summary }) => {
          expect(rows.length).toBe(1);
          expect(rows[0].loanNumber).toBe('LN-2026-001');
          expect(summary.totalLoans).toBe(1);
          done();
        },
        error: done.fail
      });
    });

    it('should filter by search query (customer name, NIC, loan number)', (done) => {
      service.getLoanHistoryReport({ search: 'Nimal' }).subscribe({
        next: ({ rows }) => {
          expect(rows.length).toBe(1);
          expect(rows[0].customerName).toBe('Nimal Silva');
          done();
        },
        error: done.fail
      });
    });
  });

  describe('Active Loans Report', () => {
    it('should return only active loans (not closed and remaining > 0)', (done) => {
      service.getActiveLoansReport().subscribe({
        next: ({ rows, summary }) => {
          expect(rows.length).toBe(1);
          expect(rows[0].loanNumber).toBe('LN-2026-001');
          expect(summary.totalActiveLoans).toBe(1);
          expect(summary.totalOutstanding).toBe(80000);
          expect(summary.totalPaid).toBe(40000);
          done();
        },
        error: done.fail
      });
    });
  });

  describe('Completed Loans Report', () => {
    it('should return only completed loans and calculate completion date from payments', (done) => {
      service.getCompletedLoansReport().subscribe({
        next: ({ rows, summary }) => {
          expect(rows.length).toBe(1);
          expect(rows[0].loanNumber).toBe('LN-2026-002');
          expect(rows[0].completionDate).toBe('2025-08-25');
          expect(summary.totalCompletedLoans).toBe(1);
          expect(summary.totalPrincipal).toBe(50000);
          expect(summary.totalCollected).toBe(60000);
          done();
        },
        error: done.fail
      });
    });
  });

  describe('Delayed / Overdue Loans Report', () => {
    it('should reuse AnalysisService latePayments logic directly', (done) => {
      service.getOverdueLoansReport().subscribe({
        next: ({ rows, summary }) => {
          expect(mockAnalysisService.deriveAnalysisBundle).toHaveBeenCalled();
          expect(rows.length).toBe(1);
          expect(rows[0].loanNumber).toBe('LN-2026-001');
          expect(rows[0].overdueAmount).toBe(10000);
          expect(rows[0].daysLate).toBe(15);
          expect(summary.totalOverdueLoans).toBe(1);
          expect(summary.totalOverdueAmount).toBe(10000);
          expect(summary.count8To30Days).toBe(1);
          done();
        },
        error: done.fail
      });
    });

    it('should filter overdue loans by severity range', (done) => {
      service.getOverdueLoansReport({ severity: '1-7' }).subscribe({
        next: ({ rows, summary }) => {
          expect(rows.length).toBe(0);
          expect(summary.totalOverdueLoans).toBe(0);
          done();
        },
        error: done.fail
      });
    });
  });

  describe('Repayment Schedule Report', () => {
    it('should build effective schedule and match payments correctly', (done) => {
      const singleLoan = mockLoans[0];
      const singleQueryChain: any = {
        select: jasmine.createSpy('select').and.returnValue({
          eq: jasmine.createSpy('eq').and.returnValue({
            single: jasmine.createSpy('single').and.resolveTo({ data: singleLoan, error: null }),
            order: jasmine.createSpy('order').and.resolveTo({
              data: [mockPayments[0]],
              error: null
            })
          })
        })
      };

      mockSupabaseService.getClient.and.returnValue({
        from: (table: string) => singleQueryChain
      } as any);

      service.getRepaymentScheduleReport('L1').subscribe({
        next: (report) => {
          expect(report).toBeTruthy();
          expect(report!.loanNumber).toBe('LN-2026-001');
          expect(report!.scheduleRows.length).toBe(12);
          expect(report!.payments.length).toBe(1);
          // 40000 paid with 10000 installment -> 4 instalments Paid
          expect(report!.scheduleRows[0].status).toBe('Paid');
          expect(report!.scheduleRows[1].status).toBe('Paid');
          expect(report!.scheduleRows[2].status).toBe('Paid');
          expect(report!.scheduleRows[3].status).toBe('Paid');
          done();
        },
        error: done.fail
      });
    });
  });
});
