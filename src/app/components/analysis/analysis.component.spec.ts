import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AnalysisComponent } from './analysis.component';
import { AnalysisService, AnalysisDataBundle } from '../../service/analysis.service';
import { Router, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

describe('AnalysisComponent', () => {
  let component: AnalysisComponent;
  let fixture: ComponentFixture<AnalysisComponent>;
  let mockAnalysisService: jasmine.SpyObj<AnalysisService>;
  let mockRouter: jasmine.SpyObj<Router>;

  const mockBundle: AnalysisDataBundle = {
    kpis: {
      activeLoansCount: 5,
      completedLoansCount: 3,
      overdueLoansCount: 1,
      dueThisWeekCount: 2,
      dueThisWeekAmount: 12000,
      outstandingAmount: 250000,
      collectedThisMonth: 45000
    },
    latePayments: [
      {
        loanId: 'l1',
        loanNumber: '12-26-0001',
        clientId: 'c1',
        customerName: 'John Doe',
        customerMobile: '0771234567',
        loanType: 'monthly',
        expectedPaymentDate: '2026-09-15',
        expectedInstalmentAmount: 10000,
        paidInstallments: 1,
        expectedInstallmentsToDate: 2,
        totalInstallments: 5,
        overdueInstallments: 1,
        overdueAmount: 10000,
        daysLate: 16,
        remainingBalance: 40000,
        status: 'Overdue'
      }
    ],
    upcomingPayments: [
      {
        loanId: 'l2',
        loanNumber: '12-26-0002',
        clientId: 'c2',
        customerName: 'Jane Smith',
        customerMobile: '0719876543',
        loanType: 'weekly',
        expectedDate: '2026-10-02',
        expectedInstalmentAmount: 2500,
        remainingBalance: 25000,
        remainingInstallments: 10,
        status: 'Upcoming'
      }
    ],
    allLoans: [
      {
        loanId: 'l1',
        loanNumber: '12-26-0001',
        clientId: 'c1',
        customerName: 'John Doe',
        loanType: 'monthly',
        principal: 50000,
        totalDue: 60000,
        totalPaid: 20000,
        remaining: 40000,
        paidInstallments: 1,
        remainingInstallments: 4,
        progressPercent: 33,
        status: 'Overdue',
        startDate: '2026-08-01',
        expectedEndDate: '2026-12-01'
      },
      {
        loanId: 'l3',
        loanNumber: '12-26-0003',
        clientId: 'c3',
        customerName: 'Alice Brown',
        loanType: 'monthly',
        principal: 30000,
        totalDue: 36000,
        totalPaid: 36000,
        remaining: 0,
        paidInstallments: 6,
        remainingInstallments: 0,
        progressPercent: 100,
        status: 'Completed',
        startDate: '2026-01-01',
        expectedEndDate: '2026-06-01'
      }
    ],
    paymentActivity: [
      {
        paymentId: 'p1',
        paidDate: '2026-10-01',
        customerName: 'John Doe',
        loanNumber: '12-26-0001',
        amountPaid: 10000,
        remark: 'Bank transfer',
        recordedOn: '2026-10-01'
      }
    ]
  };

  beforeEach(async () => {
    mockAnalysisService = jasmine.createSpyObj('AnalysisService', ['loadAnalysisData']);
    mockAnalysisService.loadAnalysisData.and.returnValue(of(mockBundle));

    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [AnalysisComponent],
      providers: [
        { provide: AnalysisService, useValue: mockAnalysisService },
        { provide: Router, useValue: mockRouter },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: of({ tab: 'late_payments' })
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AnalysisComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load data on init', () => {
    expect(component).toBeTruthy();
    expect(mockAnalysisService.loadAnalysisData).toHaveBeenCalled();
    expect(component.bundle).toBeDefined();
    expect(component.bundle?.kpis.activeLoansCount).toBe(5);
  });

  it('should switch active tab and navigate with query parameter', () => {
    component.setActiveTab('upcoming_payments');
    expect(component.activeTab).toBe('upcoming_payments');
    expect(mockRouter.navigate).toHaveBeenCalled();
  });

  it('should filter late payments by search query', () => {
    component.lateSearch = 'John';
    expect(component.filteredLatePayments.length).toBe(1);

    component.lateSearch = 'NonExistent';
    expect(component.filteredLatePayments.length).toBe(0);
  });

  it('should filter loans by status', () => {
    component.setLoanFilter('completed');
    expect(component.filteredLoans.length).toBe(1);
    expect(component.filteredLoans[0].loanNumber).toBe('12-26-0003');

    component.setLoanFilter('overdue');
    expect(component.filteredLoans.length).toBe(1);
    expect(component.filteredLoans[0].loanNumber).toBe('12-26-0001');
  });

  it('should navigate to single-loan on viewLoan', () => {
    component.viewLoan('12-26-0001');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/single-loan', '12-26-0001']);
  });

  it('should navigate to add-payments on recordPayment', () => {
    component.recordPayment('12-26-0002');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/add-payments'], {
      queryParams: { loan_number: '12-26-0002' }
    });
  });
});
