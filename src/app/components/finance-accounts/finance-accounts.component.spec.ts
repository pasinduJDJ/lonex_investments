import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FinanceAccountsComponent } from './finance-accounts.component';
import { AccountManageService } from '../../service/account-manage.service';
import { FinanceTransactionService, FinanceTransaction } from '../../service/finance-transaction.service';
import { Router, ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';

describe('FinanceAccountsComponent', () => {
  let component: FinanceAccountsComponent;
  let fixture: ComponentFixture<FinanceAccountsComponent>;
  let mockAccountService: jasmine.SpyObj<AccountManageService>;
  let mockFinanceTxService: jasmine.SpyObj<FinanceTransactionService>;
  let mockRouter: jasmine.SpyObj<Router>;

  const mockTransactions: FinanceTransaction[] = [
    {
      id: 'DISB-1',
      date: '2026-10-01',
      reference: '12-26-0001',
      type: 'Loan Disbursement',
      description: 'Loan disbursed to John Doe',
      sourceAccount: 'Bank Capital',
      moneyIn: null,
      moneyOut: 50000,
      status: 'Disbursed',
      relatedLoanNumber: '12-26-0001'
    },
    {
      id: 'PAY-1',
      date: '2026-10-02',
      reference: '12-26-0001',
      type: 'Loan Repayment',
      description: 'Repayment received from John Doe',
      sourceAccount: 'Bank Capital',
      moneyIn: 10000,
      moneyOut: null,
      status: 'Received',
      relatedLoanNumber: '12-26-0001'
    },
    {
      id: 'CI-1',
      date: '2026-10-03',
      reference: 'CI-2026-0001',
      type: 'Cash In',
      description: 'Manual cash addition',
      sourceAccount: 'Bank Capital',
      moneyIn: 25000,
      moneyOut: null,
      status: 'Posted'
    },
    {
      id: 'TR-1',
      date: '2026-10-03',
      reference: 'TR-2026-0001',
      type: 'Transfer',
      description: 'Transfer: Bank Capital → Assets / Cash',
      sourceAccount: 'Bank Capital → Assets / Cash',
      moneyIn: null,
      moneyOut: null,
      transferAmount: 15000,
      status: 'Transferred'
    }
  ];

  beforeEach(async () => {
    mockAccountService = jasmine.createSpyObj('AccountManageService', [
      'getAccountsSummary',
      'recordCashIn',
      'recordCashOut',
      'recordTransfer'
    ]);

    mockAccountService.getAccountsSummary.and.returnValue(of([
      {
        type: 'BANK_CAPITAL',
        name: 'Bank Capital',
        subtitle: 'Available bank liquidity',
        balance: 100000,
        status: 'Active',
        icon: 'bi-bank',
        accentClass: 'border-emerald text-emerald'
      },
      {
        type: 'ASSETS_CASH',
        name: 'Assets / Cash',
        subtitle: 'Available cash and documented assets',
        balance: 45000,
        status: 'Active',
        icon: 'bi-safe2',
        accentClass: 'border-gold text-gold'
      }
    ]));

    mockFinanceTxService = jasmine.createSpyObj('FinanceTransactionService', ['loadAllTransactions']);
    mockFinanceTxService.loadAllTransactions.and.returnValue(of(mockTransactions));

    await TestBed.configureTestingModule({
      imports: [FinanceAccountsComponent],
      providers: [
        provideRouter([]),
        { provide: AccountManageService, useValue: mockAccountService },
        { provide: FinanceTransactionService, useValue: mockFinanceTxService }
      ]
    }).compileComponents();

    mockRouter = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    spyOn(mockRouter, 'navigate');

    fixture = TestBed.createComponent(FinanceAccountsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load account balances and activity on init', () => {
    expect(component).toBeTruthy();
    expect(mockAccountService.getAccountsSummary).toHaveBeenCalled();
    expect(mockFinanceTxService.loadAllTransactions).toHaveBeenCalled();
    expect(component.bankCapitalBalance).toBe(100000);
    expect(component.assetsBalance).toBe(45000);
    expect(component.allTransactions.length).toBe(4);
  });

  it('should filter activity by account type', () => {
    component.setAccountFilter('BANK_CAPITAL');
    expect(component.selectedAccountFilter).toBe('BANK_CAPITAL');
    // Transactions involving Bank Capital
    expect(component.filteredActivity.length).toBeGreaterThan(0);

    component.setAccountFilter('ASSETS_CASH');
    expect(component.selectedAccountFilter).toBe('ASSETS_CASH');
    // Transfer transaction involves Assets
    expect(component.filteredActivity.some(t => t.type === 'Transfer')).toBeTrue();
  });

  it('should calculate live balance projections correctly for Cash In', () => {
    component.cashInForm.patchValue({
      destinationAccount: 'BANK_CAPITAL',
      amount: 25000
    });
    // Current Bank Capital is 100,000 + 25,000 = 125,000
    expect(component.cashInProjectedBalance).toBe(125000);
  });

  it('should calculate live balance projections correctly for Cash Out', () => {
    component.cashOutForm.patchValue({
      sourceAccount: 'BANK_CAPITAL',
      amount: 30000
    });
    // Current Bank Capital is 100,000 - 30,000 = 70,000
    expect(component.cashOutProjectedBalance).toBe(70000);
  });

  it('should reject Cash Out when amount exceeds available balance', () => {
    component.cashOutForm.patchValue({
      sourceAccount: 'BANK_CAPITAL',
      amount: 150000, // exceeds 100,000
      transactionDate: '2026-10-03',
      description: 'Excessive withdrawal'
    });

    component.submitCashOut();
    expect(component.errorMessage).toContain('Insufficient balance');
    expect(component.showConfirmModal).toBeFalse();
  });

  it('should reject Transfer when source and destination are the same', () => {
    component.transferForm.patchValue({
      fromAccount: 'BANK_CAPITAL',
      toAccount: 'BANK_CAPITAL',
      amount: 10000,
      transactionDate: '2026-10-03',
      description: 'Invalid transfer'
    });

    component.submitTransfer();
    expect(component.errorMessage).toContain('cannot be the same');
    expect(component.showConfirmModal).toBeFalse();
  });

  it('should reject Transfer when amount exceeds source available balance', () => {
    component.transferForm.patchValue({
      fromAccount: 'ASSETS_CASH',
      toAccount: 'BANK_CAPITAL',
      amount: 60000, // exceeds Assets balance of 45,000
      transactionDate: '2026-10-03',
      description: 'Excessive transfer'
    });

    component.submitTransfer();
    expect(component.errorMessage).toContain('Insufficient balance in Assets / Cash');
    expect(component.showConfirmModal).toBeFalse();
  });

  it('should stage valid Transfer and prompt confirmation dialog', () => {
    component.transferForm.patchValue({
      fromAccount: 'BANK_CAPITAL',
      toAccount: 'ASSETS_CASH',
      amount: 20000,
      transactionDate: '2026-10-03',
      description: 'Operational reserve transfer',
      reference: 'TR-TEST-1'
    });

    component.submitTransfer();
    expect(component.showConfirmModal).toBeTrue();
    expect(component.stagedAction).toBeTruthy();
    expect(component.stagedAction?.amount).toBe(20000);
    expect(component.stagedAction?.fromAccountName).toBe('Bank Capital');
    expect(component.stagedAction?.toAccountName).toBe('Assets / Cash');
  });
});
