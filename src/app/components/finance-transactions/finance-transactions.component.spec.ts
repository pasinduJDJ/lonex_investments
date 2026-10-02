import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FinanceTransactionsComponent } from './finance-transactions.component';
import { FinanceTransactionService, FinanceTransaction } from '../../service/finance-transaction.service';
import { Router, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

describe('FinanceTransactionsComponent', () => {
  let component: FinanceTransactionsComponent;
  let fixture: ComponentFixture<FinanceTransactionsComponent>;
  let mockService: jasmine.SpyObj<FinanceTransactionService>;
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
      id: 'DEP-1',
      date: '2026-09-25',
      reference: 'DEP-001',
      type: 'Capital Deposit',
      description: 'Shareholder deposit',
      sourceAccount: 'Bank Capital',
      moneyIn: 100000,
      moneyOut: null,
      status: 'Deposited'
    },
    {
      id: 'EXP-1',
      date: '2026-09-28',
      reference: 'EXP-001',
      type: 'Expense',
      description: 'Office electricity',
      sourceAccount: 'Bank Capital',
      moneyIn: null,
      moneyOut: 12500,
      status: 'Paid'
    }
  ];

  beforeEach(async () => {
    mockService = jasmine.createSpyObj('FinanceTransactionService', ['loadAllTransactions', 'calculateSummary']);
    mockService.loadAllTransactions.and.returnValue(of(mockTransactions));
    mockService.calculateSummary.and.callFake((list: FinanceTransaction[]) => {
      let totalMoneyIn = 0;
      let totalMoneyOut = 0;
      for (const t of list) {
        if (t.moneyIn) totalMoneyIn += t.moneyIn;
        if (t.moneyOut) totalMoneyOut += t.moneyOut;
      }
      return {
        totalMoneyIn,
        totalMoneyOut,
        netMovement: totalMoneyIn - totalMoneyOut,
        totalCount: list.length
      };
    });

    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [FinanceTransactionsComponent],
      providers: [
        { provide: FinanceTransactionService, useValue: mockService },
        { provide: Router, useValue: mockRouter },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: () => null } }
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(FinanceTransactionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load all transactions on init', () => {
    expect(component).toBeTruthy();
    expect(mockService.loadAllTransactions).toHaveBeenCalled();
    expect(component.allTransactions.length).toBe(4);
  });

  it('should calculate Money In, Money Out, and Net Movement accurately', () => {
    // Money In: 10000 (Repayment) + 100000 (Deposit) = 110000
    // Money Out: 50000 (Disbursement) + 12500 (Expense) = 62500
    // Net Movement: 110000 - 62500 = 47500
    const summary = component.summary;
    expect(summary.totalMoneyIn).toBe(110000);
    expect(summary.totalMoneyOut).toBe(62500);
    expect(summary.netMovement).toBe(47500);
  });

  it('should filter transactions by type', () => {
    component.onTypeChange('Loan Disbursement');
    expect(component.filteredTransactions.length).toBe(1);
    expect(component.filteredTransactions[0].type).toBe('Loan Disbursement');

    component.onTypeChange('Expense');
    expect(component.filteredTransactions.length).toBe(1);
    expect(component.filteredTransactions[0].type).toBe('Expense');
  });

  it('should filter transactions by global search query', () => {
    component.searchQuery = 'electricity';
    expect(component.filteredTransactions.length).toBe(1);
    expect(component.filteredTransactions[0].id).toBe('EXP-1');

    component.searchQuery = '12-26-0001';
    expect(component.filteredTransactions.length).toBe(2);
  });

  it('should filter transactions by custom date range', () => {
    component.dateFrom = '2026-10-01';
    component.dateTo = '2026-10-05';
    expect(component.filteredTransactions.length).toBe(2);
  });

  it('should reset all filters on resetFilters()', () => {
    component.searchQuery = 'electricity';
    component.selectedType = 'Expense';
    component.dateFrom = '2026-10-01';
    component.resetFilters();

    expect(component.searchQuery).toBe('');
    expect(component.selectedType).toBe('All');
    expect(component.dateFrom).toBe('');
    expect(component.filteredTransactions.length).toBe(4);
  });

  it('should navigate to single-loan on viewLoan', () => {
    component.viewLoan('12-26-0001');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/single-loan', '12-26-0001']);
  });
});
