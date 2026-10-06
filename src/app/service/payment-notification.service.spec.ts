import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PaymentNotificationService, DuePaymentNotification } from './payment-notification.service';
import { AnalysisService, AnalysisDataBundle, formatLocalIsoDate } from './analysis.service';

describe('PaymentNotificationService', () => {
  let service: PaymentNotificationService;
  let mockAnalysisService: jasmine.SpyObj<AnalysisService>;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = formatLocalIsoDate(today);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatLocalIsoDate(tomorrow);

  const mockBundle: AnalysisDataBundle = {
    kpis: {
      activeLoansCount: 3,
      completedLoansCount: 1,
      overdueLoansCount: 0,
      dueThisWeekCount: 2,
      dueThisWeekAmount: 10000,
      outstandingAmount: 150000,
      collectedThisMonth: 20000
    },
    latePayments: [],
    upcomingPayments: [
      {
        loanId: 'l1',
        loanNumber: '12-26-0001',
        clientId: 'c1',
        customerName: 'Nimal Perera',
        customerMobile: '0771234567',
        loanType: 'monthly',
        expectedDate: todayStr,
        expectedInstalmentAmount: 5000,
        paidTowardObligation: 0,
        remainingDue: 5000,
        remainingBalance: 50000,
        remainingInstallments: 10,
        status: 'Due Today'
      },
      {
        loanId: 'l2',
        loanNumber: '12-26-0002',
        clientId: 'c2',
        customerName: 'Sunil Silva',
        customerMobile: '0719876543',
        loanType: 'weekly',
        expectedDate: todayStr,
        expectedInstalmentAmount: 5000,
        paidTowardObligation: 2000,
        remainingDue: 3000,
        remainingBalance: 30000,
        remainingInstallments: 6,
        status: 'Due Today'
      },
      {
        loanId: 'l3',
        loanNumber: '12-26-0003',
        clientId: 'c3',
        customerName: 'Kamal Bandara',
        customerMobile: '0781112233',
        loanType: 'daily',
        expectedDate: tomorrowStr,
        expectedInstalmentAmount: 1000,
        paidTowardObligation: 0,
        remainingDue: 1000,
        remainingBalance: 15000,
        remainingInstallments: 15,
        status: 'Upcoming'
      }
    ],
    allLoans: [],
    paymentActivity: []
  };

  beforeEach(() => {
    mockAnalysisService = jasmine.createSpyObj('AnalysisService', ['loadAnalysisData']);
    mockAnalysisService.loadAnalysisData.and.returnValue(of(mockBundle));

    TestBed.configureTestingModule({
      providers: [
        PaymentNotificationService,
        { provide: AnalysisService, useValue: mockAnalysisService }
      ]
    });

    service = TestBed.inject(PaymentNotificationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should load and filter payments due strictly TODAY', (done) => {
    service.loadDuePayments(true);

    service.duePayments$.subscribe(items => {
      if (items.length > 0) {
        expect(items.length).toBe(2);
        expect(items[0].loanNumber).toBe('12-26-0001');
        expect(items[0].remainingDue).toBe(5000);

        expect(items[1].loanNumber).toBe('12-26-0002');
        expect(items[1].remainingDue).toBe(3000); // Partial payment handled
        done();
      }
    });
  });

  it('should exclude future obligations (e.g. due tomorrow)', (done) => {
    service.loadDuePayments(true);

    service.duePayments$.subscribe(items => {
      if (items.length > 0) {
        const tomorrowItem = items.find(i => i.loanNumber === '12-26-0003');
        expect(tomorrowItem).toBeUndefined();
        done();
      }
    });
  });

  it('should use in-memory cache on subsequent calls within cache duration', () => {
    service.loadDuePayments(true);
    expect(mockAnalysisService.loadAnalysisData).toHaveBeenCalledTimes(1);

    // Call again without force
    service.loadDuePayments(false);
    expect(mockAnalysisService.loadAnalysisData).toHaveBeenCalledTimes(1);

    // Call refresh (force = true)
    service.refresh();
    expect(mockAnalysisService.loadAnalysisData).toHaveBeenCalledTimes(2);
  });

  it('should handle errors gracefully without crashing', (done) => {
    mockAnalysisService.loadAnalysisData.and.returnValue(throwError(() => new Error('Network error')));

    service.loadDuePayments(true);

    service.error$.subscribe(err => {
      if (err) {
        expect(err).toBe("Unable to load today's payments.");
        expect(service.currentDueCount).toBe(0);
        done();
      }
    });
  });
});
