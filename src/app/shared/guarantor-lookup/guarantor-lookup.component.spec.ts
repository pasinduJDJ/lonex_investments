import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { GuarantorLookupComponent } from './guarantor-lookup.component';
import { LoanManageService, Client } from '../../service/loan-manage.service';
import { ActivatedRoute } from '@angular/router';

describe('GuarantorLookupComponent', () => {
  let component: GuarantorLookupComponent;
  let fixture: ComponentFixture<GuarantorLookupComponent>;
  let mockLoanService: jasmine.SpyObj<LoanManageService>;

  const mockBorrower: Client = {
    client_id: 'client-borrower-1',
    register_number: 1,
    first_name: 'Dewika',
    last_name: 'Sujeewani',
    nic_number: '715420562v',
    mobile_number: '0774644581',
    is_member: true,
    created_at: '2025-01-01'
  };

  const mockGuarantor1: Client = {
    client_id: 'client-guarantor-2',
    register_number: 2,
    first_name: 'Chamod',
    last_name: 'Wijesinghe',
    nic_number: '200106903387',
    mobile_number: '0703380269',
    is_member: true,
    created_at: '2025-01-01'
  };

  const mockGuarantor2: Client = {
    client_id: 'client-guarantor-3',
    register_number: 3,
    first_name: 'Geethika',
    last_name: 'Priyadarshani',
    nic_number: '198165401050',
    mobile_number: '0711234567',
    is_member: true,
    created_at: '2025-01-01'
  };

  beforeEach(async () => {
    mockLoanService = jasmine.createSpyObj('LoanManageService', ['searchRegisteredMemberByNic']);

    await TestBed.configureTestingModule({
      imports: [GuarantorLookupComponent],
      providers: [
        { provide: LoanManageService, useValue: mockLoanService },
        { provide: ActivatedRoute, useValue: {} }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(GuarantorLookupComponent);
    component = fixture.componentInstance;
    component.guarantorOrder = 1;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should reject empty NIC input with validation error', () => {
    component.nicInput = '   ';
    component.onSearch();
    expect(component.errorMessage).toBe('Please enter a Guarantor NIC number.');
    expect(mockLoanService.searchRegisteredMemberByNic).not.toHaveBeenCalled();
  });

  it('should reject invalid NIC format (e.g. 123)', () => {
    component.nicInput = '123';
    component.onSearch();
    expect(component.errorMessage).toContain('Invalid NIC format');
    expect(mockLoanService.searchRegisteredMemberByNic).not.toHaveBeenCalled();
  });

  it('should show error and register action when NIC is not registered', () => {
    mockLoanService.searchRegisteredMemberByNic.and.returnValue(of(null));

    component.nicInput = '999999999V';
    component.onSearch();

    expect(mockLoanService.searchRegisteredMemberByNic).toHaveBeenCalledWith('999999999V');
    expect(component.errorMessage).toBe('No registered member found for this NIC.');
    expect(component.isUnregistered).toBeTrue();
    expect(component.selectedGuarantor).toBeNull();
  });

  it('should reject when borrower is selected as their own guarantor', () => {
    component.borrowerId = mockBorrower.client_id;
    mockLoanService.searchRegisteredMemberByNic.and.returnValue(of(mockBorrower));

    component.nicInput = mockBorrower.nic_number;
    component.onSearch();

    expect(component.errorMessage).toBe('The borrower cannot be selected as their own guarantor.');
    expect(component.selectedGuarantor).toBeNull();
  });

  it('should reject duplicate guarantor when other guarantor is already selected', () => {
    component.guarantorOrder = 2;
    component.borrowerId = mockBorrower.client_id;
    component.otherGuarantorId = mockGuarantor1.client_id;

    mockLoanService.searchRegisteredMemberByNic.and.returnValue(of(mockGuarantor1));

    component.nicInput = mockGuarantor1.nic_number;
    component.onSearch();

    expect(component.errorMessage).toBe('This member has already been selected as a guarantor.');
    expect(component.selectedGuarantor).toBeNull();
  });

  it('should successfully select a registered member and emit guarantorSelected event', () => {
    spyOn(component.guarantorSelected, 'emit');
    mockLoanService.searchRegisteredMemberByNic.and.returnValue(of(mockGuarantor1));

    component.nicInput = '200106903387';
    component.onSearch();

    expect(component.selectedGuarantor).toEqual(mockGuarantor1);
    expect(component.errorMessage).toBe('');
    expect(component.isUnregistered).toBeFalse();
    expect(component.guarantorSelected.emit).toHaveBeenCalledWith(mockGuarantor1);
    expect(component.formatMemberId(mockGuarantor1.register_number)).toBe('#0002');
  });

  it('should reset state and emit null when onClear is called', () => {
    component.selectedGuarantor = mockGuarantor1;
    component.nicInput = mockGuarantor1.nic_number;
    spyOn(component.guarantorSelected, 'emit');

    component.onClear();

    expect(component.selectedGuarantor).toBeNull();
    expect(component.nicInput).toBe('');
    expect(component.guarantorSelected.emit).toHaveBeenCalledWith(null);
  });
});
