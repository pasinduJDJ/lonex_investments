import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProfitsManageScreenComponent } from './profits-manage-screen.component';
import { ProfitManageService } from '../../service/profit-manage.service';
import { of } from 'rxjs';
import { ActivatedRoute } from '@angular/router';

describe('ProfitsManageScreenComponent', () => {
  let component: ProfitsManageScreenComponent;
  let fixture: ComponentFixture<ProfitsManageScreenComponent>;
  let mockProfitService: jasmine.SpyObj<ProfitManageService>;

  beforeEach(async () => {
    mockProfitService = jasmine.createSpyObj('ProfitManageService', [
      'getBankCapital',
      'getLatestPaymentsWithLoanNumber',
      'getLoansWithClientByDateRange',
      'getTotalDocumentCharges',
      'getInvestHistory',
      'getExpenses',
      'getTotalProfit',
      'debugTables'
    ]);

    mockProfitService.getBankCapital.and.returnValue(of({
      id: '1',
      starting_balance: 100000,
      current_balance: 88797,
      last_updated: '2026-09-25',
      remark: 'Initial balance'
    }));

    mockProfitService.getLatestPaymentsWithLoanNumber.and.returnValue(of([
      {
        id: 'p1',
        loan_id: 'l1',
        paid_amount: 15000,
        paid_date: '2026-09-20',
        created_at: '2026-09-20',
        loan_number: '12-26-0001'
      },
      {
        id: 'p2',
        loan_id: 'l2',
        paid_amount: 25000,
        paid_date: '2026-09-22',
        created_at: '2026-09-22',
        loan_number: '12-26-0002'
      }
    ]));

    mockProfitService.getLoansWithClientByDateRange.and.returnValue(of([
      {
        id: 'l1',
        loan_number: '12-26-0001',
        principal_amount: 50000,
        document_charge: 10000,
        total_paid: 70000,
        status: 'closed',
        start_date: '2026-01-01',
        end_date: '2026-06-01'
      }
    ]));

    mockProfitService.getTotalDocumentCharges.and.returnValue(of(21600));
    mockProfitService.getInvestHistory.and.returnValue(of([]));
    mockProfitService.getExpenses.and.returnValue(of([
      {
        id: 'e1',
        amount: 20000,
        expense_date: '2026-09-10',
        remark: 'Office rent',
        created_at: '2026-09-10'
      },
      {
        id: 'e2',
        amount: 5000,
        expense_date: '2026-09-15',
        remark: 'Utilities',
        created_at: '2026-09-15'
      }
    ]));

    mockProfitService.getTotalProfit.and.returnValue(of(141902));
    mockProfitService.debugTables.and.returnValue(of({ expenses: [], invest: [] }));

    await TestBed.configureTestingModule({
      imports: [ProfitsManageScreenComponent],
      providers: [
        { provide: ProfitManageService, useValue: mockProfitService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: () => null } }
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProfitsManageScreenComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load all financial data on init', () => {
    expect(component).toBeTruthy();
    expect(mockProfitService.getBankCapital).toHaveBeenCalled();
    expect(component.capital).toBe(88797);
    expect(component.totalDocumentCharges).toBe(21600);
  });

  it('should calculate Total Income from payment inflows', () => {
    // 15000 + 25000 = 40000
    expect(component.totalIncome).toBe(40000);
  });

  it('should calculate Total Expenses from recorded expenses', () => {
    // 20000 + 5000 = 25000
    expect(component.totalExpenses).toBe(25000);
  });

  it('should calculate Net Profit as loan profit minus total expenses', () => {
    // totalProfit (141902) - totalExpenses (25000) = 116902
    expect(component.netProfit).toBe(141902 - 25000);
    expect(component.isNetProfitPositive).toBeTrue();
  });

  it('should switch active tabs correctly', () => {
    component.setActiveTab('expenses');
    expect(component.activeTab).toBe('expenses');

    component.setActiveTab('capital');
    expect(component.activeTab).toBe('capital');
  });

  it('should reload performance metrics when date filter changes', () => {
    component.startDate = '2026-09-01';
    component.endDate = '2026-09-30';
    component.onDateRangeChange();

    expect(mockProfitService.getLatestPaymentsWithLoanNumber).toHaveBeenCalledWith('2026-09-01', '2026-09-30');
    expect(mockProfitService.getExpenses).toHaveBeenCalledWith('2026-09-01', '2026-09-30');
  });

  it('should reset date filter on clearDateFilter', () => {
    component.startDate = '2026-09-01';
    component.endDate = '2026-09-30';
    component.clearDateFilter();

    expect(component.startDate).toBe('');
    expect(component.endDate).toBe('');
    expect(mockProfitService.getLatestPaymentsWithLoanNumber).toHaveBeenCalledWith(undefined, undefined);
  });
});
