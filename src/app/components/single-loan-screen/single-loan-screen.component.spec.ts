import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { SingleLoanScreenComponent } from './single-loan-screen.component';
import { LoanManageService, LoanWithClient, LoanRescheduleHistory } from '../../service/loan-manage.service';
import { SupabaseService } from '../../service/supabase.service';
import { ActivatedRoute } from '@angular/router';

describe('SingleLoanScreenComponent - Early Loan Settlement / Future Instalment Rescheduling', () => {
  let component: SingleLoanScreenComponent;
  let fixture: ComponentFixture<SingleLoanScreenComponent>;
  let mockLoanService: jasmine.SpyObj<LoanManageService>;
  let mockSupabaseService: jasmine.SpyObj<SupabaseService>;

  const mockActiveLoan: LoanWithClient = {
    id: 'test-loan-uuid-1',
    client_id: 'client-uuid-1',
    loan_number: '101',
    principal_amount: 100000,
    total_amount_due: 120000,
    interest_rate: 20,
    document_charge: 1000,
    installments: 12,
    loan_type: 'monthly',
    start_date: '2026-01-01',
    end_date: '2026-12-01',
    status: 'active',
    remaining_amount: 50000,
    total_paid: 70000,
    created_at: '2026-01-01',
    client: {
      client_id: 'client-uuid-1',
      register_number: 1,
      first_name: 'Sunil',
      last_name: 'Perera',
      nic_number: '198012345678',
      mobile_number: '0771234567',
      is_member: true,
      created_at: '2026-01-01'
    }
  };

  const mockHistoryList: LoanRescheduleHistory[] = [
    {
      id: 'history-1',
      loan_id: 'test-loan-uuid-1',
      old_installment_amount: 10000,
      new_installment_amount: 12500,
      old_remaining_installments: 5,
      new_remaining_installments: 4,
      old_end_date: '2026-12-01',
      new_end_date: '2026-10-01',
      remaining_balance: 50000,
      changed_by: 'Admin',
      notes: 'Customer request for faster settlement',
      reschedule_date: '2026-06-01T10:00:00Z',
      created_at: '2026-06-01T10:00:00Z'
    }
  ];

  beforeEach(async () => {
    mockLoanService = jasmine.createSpyObj('LoanManageService', [
      'getLoanByNumber',
      'getPaymentsForLoan',
      'getLoanGuarantors',
      'getLoanRescheduleHistory',
      'rescheduleLoan',
      'getInstallmentStats',
      'completeLoan'
    ]);

    mockSupabaseService = jasmine.createSpyObj('SupabaseService', ['getClient']);

    mockLoanService.getLoanByNumber.and.returnValue(of(mockActiveLoan));
    mockLoanService.getPaymentsForLoan.and.returnValue(of([]));
    mockLoanService.getLoanGuarantors.and.returnValue(of([]));
    mockLoanService.getLoanRescheduleHistory.and.returnValue(of([]));
    mockLoanService.getInstallmentStats.and.returnValue(Promise.resolve({
      expected: 12,
      paid: 7,
      remaining: 5,
      totalPaid: 70000,
      installmentAmount: 10000
    }));

    await TestBed.configureTestingModule({
      imports: [SingleLoanScreenComponent],
      providers: [
        provideRouter([]),
        { provide: LoanManageService, useValue: mockLoanService },
        { provide: SupabaseService, useValue: mockSupabaseService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => key === 'loan_number' ? '101' : null
              }
            }
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SingleLoanScreenComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  describe('Eligibility for Early Settlement', () => {
    it('should be eligible when loan is active and has remaining balance > 0', () => {
      expect(component.isEligibleForEarlySettlement(mockActiveLoan)).toBeTrue();
    });

    it('should NOT be eligible when loan status is closed', () => {
      const closedLoan: LoanWithClient = { ...mockActiveLoan, status: 'closed' };
      expect(component.isEligibleForEarlySettlement(closedLoan)).toBeFalse();
    });

    it('should NOT be eligible when loan remaining amount is 0', () => {
      const zeroBalanceLoan: LoanWithClient = { ...mockActiveLoan, remaining_amount: 0 };
      expect(component.isEligibleForEarlySettlement(zeroBalanceLoan)).toBeFalse();
    });
  });

  describe('Modal Initialization and Current Terms', () => {
    it('should initialize modal with current loan state and valid defaults', () => {
      component.openEarlySettlementModal(mockActiveLoan);

      expect(component.showSettlementModal).toBeTrue();
      expect(component.currentLoan).toEqual(mockActiveLoan);
      expect(component.currentRemainingBalance).toBe(50000);
      expect(component.currentPaidInstallments).toBe(7);
      expect(component.currentRemainingInstallments).toBe(5);
      expect(component.newRemainingPeriod).toBe(5);
      expect(component.newInstallmentAmount).toBe(10000);
      expect(component.previewFutureSchedule.length).toBe(5);
    });

    it('should reset modal state when closed', () => {
      component.openEarlySettlementModal(mockActiveLoan);
      component.closeEarlySettlementModal();

      expect(component.showSettlementModal).toBeFalse();
      expect(component.settlementErrorMessage).toBe('');
    });
  });

  describe('Financial Consistency & Preview Generation', () => {
    beforeEach(() => {
      component.openEarlySettlementModal(mockActiveLoan);
    });

    it('should validate reschedule terms properly', () => {
      component.newRemainingPeriod = 4;
      component.newInstallmentAmount = 12500;
      expect(component.isRescheduleValid()).toBeTrue();

      component.newRemainingPeriod = 0;
      expect(component.isRescheduleValid()).toBeFalse();

      component.newRemainingPeriod = 4;
      component.newInstallmentAmount = 0;
      expect(component.isRescheduleValid()).toBeFalse();

      component.newInstallmentAmount = -500;
      expect(component.isRescheduleValid()).toBeFalse();
    });

    it('should calculate 100% balanced preview when amount * period equals balance exactly', () => {
      // 50,000 / 4 = 12,500
      component.newRemainingPeriod = 4;
      component.newInstallmentAmount = 12500;
      component.recalculatePreview();

      expect(component.isFinalInstallmentAdjusted).toBeFalse();
      expect(component.previewFutureSchedule.length).toBe(4);
      expect(component.previewFutureSchedule[0].installmentNumber).toBe(8);
      expect(component.previewFutureSchedule[3].installmentNumber).toBe(11);
      expect(component.previewFutureSchedule[3].amount).toBe(12500);
    });

    it('should adjust the final installment when amount * period does not reconcile perfectly', () => {
      // 50,000 / 3 = 16,666.67. User enters 16,000 for 3 periods.
      // 2 installments of 16,000 = 32,000.
      // Final 3rd installment must be 50,000 - 32,000 = 18,000.
      component.newRemainingPeriod = 3;
      component.newInstallmentAmount = 16000;
      component.recalculatePreview();

      expect(component.isFinalInstallmentAdjusted).toBeTrue();
      expect(component.previewFutureSchedule.length).toBe(3);
      expect(component.previewFutureSchedule[0].amount).toBe(16000);
      expect(component.previewFutureSchedule[1].amount).toBe(16000);
      expect(component.previewFutureSchedule[2].amount).toBe(18000);
      expect(component.previewFutureSchedule[2].isAdjusted).toBeTrue();
    });

    it('should auto-balance installment amount when autoCalculateAmount is triggered', () => {
      component.newRemainingPeriod = 4;
      component.autoCalculateAmount();

      expect(component.newInstallmentAmount).toBe(12500);
      expect(component.isFinalInstallmentAdjusted).toBeFalse();
    });
  });

  describe('Early Settlement Execution', () => {
    beforeEach(() => {
      component.openEarlySettlementModal(mockActiveLoan);
      component.newRemainingPeriod = 4;
      component.newInstallmentAmount = 12500;
      component.settlementNotes = 'Early settlement agreement';
      component.recalculatePreview();
    });

    it('should execute reschedule atomically via loanService', () => {
      mockLoanService.rescheduleLoan.and.returnValue(of({ success: true }));
      mockLoanService.getLoanRescheduleHistory.and.returnValue(of(mockHistoryList));

      component.confirmEarlySettlement();

      expect(mockLoanService.rescheduleLoan).toHaveBeenCalledWith('test-loan-uuid-1', jasmine.objectContaining({
        newInstallmentAmount: 12500,
        newRemainingInstallments: 4,
        newTotalInstallments: 11, // 7 paid + 4 remaining
        remainingBalance: 50000,
        notes: 'Early settlement agreement'
      }));

      expect(component.showSettlementModal).toBeFalse();
      expect(component.showSuccessMsg).toBeTrue();
    });

    it('should display error message when reschedule service call fails', () => {
      mockLoanService.rescheduleLoan.and.returnValue(of({
        success: false,
        error: { message: 'Database connection failed' }
      }));

      component.confirmEarlySettlement();

      expect(component.settlementErrorMessage).toBe('Database connection failed');
      expect(component.showSettlementModal).toBeTrue();
    });
  });

  describe('Reschedule History Tab Integration', () => {
    it('should load reschedule history on startup', () => {
      mockLoanService.getLoanRescheduleHistory.and.returnValue(of(mockHistoryList));
      component.loadRescheduleHistory('test-loan-uuid-1');

      expect(mockLoanService.getLoanRescheduleHistory).toHaveBeenCalledWith('test-loan-uuid-1');
      expect(component.rescheduleHistory.length).toBe(1);
      expect(component.rescheduleHistory[0].new_installment_amount).toBe(12500);
    });
  });
});
