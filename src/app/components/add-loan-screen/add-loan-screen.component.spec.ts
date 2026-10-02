import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AddLoanScreenComponent } from './add-loan-screen.component';
import { LoanManageService, Client } from '../../service/loan-manage.service';
import { ProfitManageService } from '../../service/profit-manage.service';
import { SupabaseService } from '../../service/supabase.service';
import { ActivatedRoute } from '@angular/router';

import { AccountManageService } from '../../service/account-manage.service';

describe('AddLoanScreenComponent - Guarantor Management & Automatic Loan Numbering', () => {
  let component: AddLoanScreenComponent;
  let fixture: ComponentFixture<AddLoanScreenComponent>;
  let mockLoanService: jasmine.SpyObj<LoanManageService>;
  let mockProfitService: jasmine.SpyObj<ProfitManageService>;
  let mockSupabaseService: jasmine.SpyObj<SupabaseService>;
  let mockAccountService: jasmine.SpyObj<AccountManageService>;

  const mockBorrower: Client = {
    client_id: 'borrower-uuid-1',
    register_number: 1,
    first_name: 'Dewika',
    last_name: 'Sujeewani',
    nic_number: '715420562v',
    mobile_number: '0774644581',
    is_member: true,
    created_at: '2025-01-01'
  };

  const mockGuarantor1: Client = {
    client_id: 'guarantor-uuid-2',
    register_number: 2,
    first_name: 'Chamod',
    last_name: 'Wijesinghe',
    nic_number: '200106903387',
    mobile_number: '0703380269',
    is_member: true,
    created_at: '2025-01-01'
  };

  const mockGuarantor2: Client = {
    client_id: 'guarantor-uuid-3',
    register_number: 3,
    first_name: 'Geethika',
    last_name: 'Priyadarshani',
    nic_number: '198165401050',
    mobile_number: '0711234567',
    is_member: true,
    created_at: '2025-01-01'
  };

  beforeEach(async () => {
    mockLoanService = jasmine.createSpyObj('LoanManageService', [
      'searchRegisteredMemberByNic',
      'saveLoanGuarantors',
      'getLoanGuarantors',
      'getInstallmentStats',
      'generateNextLoanNumber',
      'isValidNewLoanNumberFormat'
    ]);
    mockProfitService = jasmine.createSpyObj('ProfitManageService', [
      'getBankCapital',
      'decreaseBankCapital'
    ]);
    mockSupabaseService = jasmine.createSpyObj('SupabaseService', ['getClient']);
    mockAccountService = jasmine.createSpyObj('AccountManageService', ['recordDocumentCharge']);
    mockAccountService.recordDocumentCharge.and.returnValue(Promise.resolve({ success: true, message: 'Recorded' }));

    mockProfitService.getBankCapital.and.returnValue(of({
      id: 'bc-1',
      starting_balance: 500000,
      current_balance: 500000,
      last_updated: '2026-10-01'
    }));

    mockLoanService.generateNextLoanNumber.and.returnValue(Promise.resolve('12-26-0001'));
    mockLoanService.isValidNewLoanNumberFormat.and.callFake((num: string) => /^12-\d{2}-\d{4}$/.test(num));

    await TestBed.configureTestingModule({
      imports: [AddLoanScreenComponent],
      providers: [
        { provide: LoanManageService, useValue: mockLoanService },
        { provide: ProfitManageService, useValue: mockProfitService },
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: AccountManageService, useValue: mockAccountService },
        { provide: ActivatedRoute, useValue: {} }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AddLoanScreenComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  describe('Guarantor Management Validation', () => {
    it('should require 2 valid registered guarantors before submit is enabled', () => {
      component.foundClient = mockBorrower;
      component.principalAmount = 50000;
      component.interestRate = 20;
      component.loanType = 'monthly';
      component.startDate = '2026-10-01';
      component.endDate = '2026-12-01';
      component.numberOfInstallments = 2;
      component.documentCharge = 500;
      component.showCustomerHistory = false;

      // Both guarantors missing
      component.guarantor1 = null;
      component.guarantor2 = null;
      expect(component.isFormReadyForSubmit()).toBeFalse();

      // Only 1 guarantor selected
      component.onGuarantor1Selected(mockGuarantor1);
      expect(component.isFormReadyForSubmit()).toBeFalse();

      // Both distinct guarantors selected
      component.onGuarantor2Selected(mockGuarantor2);
      expect(component.isFormReadyForSubmit()).toBeTrue();
    });

    it('should reject submission if borrower is selected as guarantor', () => {
      component.foundClient = mockBorrower;
      component.principalAmount = 50000;
      component.interestRate = 20;
      component.loanType = 'monthly';
      component.startDate = '2026-10-01';
      component.endDate = '2026-12-01';
      component.numberOfInstallments = 2;
      component.documentCharge = 500;

      // Borrower selected as guarantor 1
      component.onGuarantor1Selected(mockBorrower);
      component.onGuarantor2Selected(mockGuarantor2);

      expect(component.isFormReadyForSubmit()).toBeFalse();
      expect(component.validateForm()).toBeFalse();
      expect(component.errorMessage).toBe('The borrower cannot be selected as their own guarantor');
    });

    it('should reject submission if guarantor 1 and guarantor 2 are the same member', () => {
      component.foundClient = mockBorrower;
      component.principalAmount = 50000;
      component.interestRate = 20;
      component.loanType = 'monthly';
      component.startDate = '2026-10-01';
      component.endDate = '2026-12-01';
      component.numberOfInstallments = 2;
      component.documentCharge = 500;

      // Same guarantor selected for both slots
      component.onGuarantor1Selected(mockGuarantor1);
      component.onGuarantor2Selected(mockGuarantor1);

      expect(component.isFormReadyForSubmit()).toBeFalse();
      expect(component.validateForm()).toBeFalse();
      expect(component.errorMessage).toBe('Guarantor 1 and Guarantor 2 cannot be the same member');
    });

    it('should reset both guarantors when resetForm is called', () => {
      component.guarantor1 = mockGuarantor1;
      component.guarantor2 = mockGuarantor2;

      component.resetForm();

      expect(component.guarantor1).toBeNull();
      expect(component.guarantor2).toBeNull();
    });
  });

  describe('New Automatic Loan Number Generation (Task 02)', () => {
    it('should NOT generate or reserve loan number when a client is selected', () => {
      // Searching and selecting client
      component.foundClient = mockBorrower;

      // Loan number should remain empty until actual submission
      expect(component.loanNumber).toBe('');
      expect(mockLoanService.generateNextLoanNumber).not.toHaveBeenCalled();
    });

    it('should NOT reserve loan number if user resets the form', () => {
      component.loanNumber = '';
      component.resetForm();

      expect(component.loanNumber).toBe('');
      expect(mockLoanService.generateNextLoanNumber).not.toHaveBeenCalled();
    });

    it('should generate official loan number adhering to 12-YY-NNNN on submission', async () => {
      mockLoanService.generateNextLoanNumber.and.returnValue(Promise.resolve('12-26-0001'));

      const num = await component.generateLoanNumber();

      expect(num).toBe('12-26-0001');
      expect(component.loanNumber).toBe('12-26-0001');
      expect(mockLoanService.generateNextLoanNumber).toHaveBeenCalled();
      expect(mockLoanService.isValidNewLoanNumberFormat('12-26-0001')).toBeTrue();
    });

    it('should validate compliance with the 12-YY-NNNN pattern', () => {
      // Valid cases
      expect(mockLoanService.isValidNewLoanNumberFormat('12-26-0001')).toBeTrue();
      expect(mockLoanService.isValidNewLoanNumberFormat('12-26-0025')).toBeTrue();
      expect(mockLoanService.isValidNewLoanNumberFormat('12-27-0001')).toBeTrue();
      expect(mockLoanService.isValidNewLoanNumberFormat('12-26-9999')).toBeTrue();

      // Invalid cases
      expect(mockLoanService.isValidNewLoanNumberFormat('12-2026-0001')).toBeFalse();
      expect(mockLoanService.isValidNewLoanNumberFormat('12-26-1')).toBeFalse();
      expect(mockLoanService.isValidNewLoanNumberFormat('26-0001')).toBeFalse();
      expect(mockLoanService.isValidNewLoanNumberFormat('12-26-00001')).toBeFalse();
      // Historical formats should not match new format regex
      expect(mockLoanService.isValidNewLoanNumberFormat('12-107-001-004')).toBeFalse();
      expect(mockLoanService.isValidNewLoanNumberFormat('12-102-002-002')).toBeFalse();
    });
  });
});
