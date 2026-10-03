import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { FinanceReportService } from './finance-report.service';
import { SupabaseService } from './supabase.service';
import { FinanceTransactionService, FinanceTransaction } from './finance-transaction.service';
import { AccountManageService } from './account-manage.service';
import { ProfitManageService } from './profit-manage.service';

describe('FinanceReportService', () => {
  let service: FinanceReportService;
  let mockFinanceTxService: jasmine.SpyObj<FinanceTransactionService>;
  let mockAccountService: jasmine.SpyObj<AccountManageService>;
  let mockProfitService: jasmine.SpyObj<ProfitManageService>;
  let mockSupabaseService: jasmine.SpyObj<SupabaseService>;

  const mockTransactions: FinanceTransaction[] = [
    {
      id: 'DEP-1',
      date: '2026-03-01',
      reference: 'DEP-001',
      type: 'Capital Deposit',
      description: 'Owner capital addition',
      sourceAccount: 'Bank Capital',
      moneyIn: 100000,
      moneyOut: null,
      status: 'Deposited'
    },
    {
      id: 'DISB-1',
      date: '2026-03-05',
      reference: 'LN-001',
      type: 'Loan Disbursement',
      description: 'Disbursement to Kamal',
      sourceAccount: 'Bank Capital',
      moneyIn: null,
      moneyOut: 50000,
      status: 'Disbursed',
      relatedLoanNumber: 'LN-001'
    },
    {
      id: 'PAY-1',
      date: '2026-03-10',
      reference: 'LN-001',
      type: 'Loan Repayment',
      description: 'Weekly collection',
      sourceAccount: 'Bank Capital',
      moneyIn: 5500,
      moneyOut: null,
      status: 'Received',
      relatedLoanNumber: 'LN-001'
    },
    {
      id: 'EXP-1',
      date: '2026-03-12',
      reference: 'EXP-001',
      type: 'Expense',
      description: 'Office stationery',
      sourceAccount: 'Bank Capital',
      moneyIn: null,
      moneyOut: 3000,
      status: 'Paid'
    },
    {
      id: 'DC-1',
      date: '2026-03-05',
      reference: 'LN-001',
      type: 'Document Charge',
      description: 'Document fee for LN-001',
      sourceAccount: 'Assets / Cash',
      moneyIn: 1500,
      moneyOut: null,
      status: 'Collected',
      relatedLoanNumber: 'LN-001'
    },
    {
      id: 'TR-1',
      date: '2026-03-15',
      reference: 'TR-001',
      type: 'Transfer',
      description: 'Transfer Bank Capital → Assets / Cash',
      sourceAccount: 'Bank Capital → Assets / Cash',
      moneyIn: null,
      moneyOut: null,
      transferAmount: 20000,
      status: 'Transferred'
    }
  ];

  beforeEach(() => {
    mockFinanceTxService = jasmine.createSpyObj('FinanceTransactionService', ['loadAllTransactions']);
    mockAccountService = jasmine.createSpyObj('AccountManageService', ['getAccountsSummary']);
    mockProfitService = jasmine.createSpyObj('ProfitManageService', ['getInvestHistory', 'getExpenses']);
    mockSupabaseService = jasmine.createSpyObj('SupabaseService', ['getClient']);

    mockFinanceTxService.loadAllTransactions.and.returnValue(of(mockTransactions));
    mockAccountService.getAccountsSummary.and.returnValue(of([
      {
        type: 'BANK_CAPITAL',
        name: 'Bank Capital',
        subtitle: 'Bank liquidity',
        balance: 91517,
        status: 'Active',
        icon: 'bi-bank',
        accentClass: ''
      },
      {
        type: 'ASSETS_CASH',
        name: 'Assets / Cash',
        subtitle: 'Cash assets',
        balance: 21600,
        status: 'Active',
        icon: 'bi-safe2',
        accentClass: ''
      }
    ]));

    TestBed.configureTestingModule({
      providers: [
        FinanceReportService,
        { provide: FinanceTransactionService, useValue: mockFinanceTxService },
        { provide: AccountManageService, useValue: mockAccountService },
        { provide: ProfitManageService, useValue: mockProfitService },
        { provide: SupabaseService, useValue: mockSupabaseService }
      ]
    });

    service = TestBed.inject(FinanceReportService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should calculate Bank Capital account history movements accurately', (done) => {
    service.getAccountHistoryReport({ account: 'BANK_CAPITAL' }).subscribe(res => {
      expect(res.summary.accountName).toBe('Bank Capital');
      expect(res.summary.currentBalance).toBe(91517);
      // Inflows: Deposit 100,000 + Repayment 5,500 = 105,500
      expect(res.summary.totalMoneyIn).toBe(105500);
      // Outflows: Disb 50,000 + Exp 3,000 + Transfer Out 20,000 = 73,000
      expect(res.summary.totalMoneyOut).toBe(73000);
      expect(res.summary.netMovement).toBe(105500 - 73000);
      done();
    });
  });

  it('should calculate Assets / Cash account history movements accurately', (done) => {
    service.getAccountHistoryReport({ account: 'ASSETS_CASH' }).subscribe(res => {
      expect(res.summary.accountName).toBe('Assets / Cash');
      expect(res.summary.currentBalance).toBe(21600);
      // Inflows: Doc charge 1,500 + Transfer In 20,000 = 21,500
      expect(res.summary.totalMoneyIn).toBe(21500);
      expect(res.summary.totalMoneyOut).toBe(0);
      expect(res.summary.netMovement).toBe(21500);
      done();
    });
  });

  it('should isolate internal transfers from company-wide net external movement in Cash Movement report', (done) => {
    service.getCashMovementReport({}).subscribe(res => {
      // Company external in: Deposit 100,000 + Repayment 5,500 + Doc Charge 1,500 = 107,000
      expect(res.summary.companyExternalIn).toBe(107000);
      // Company external out: Disb 50,000 + Exp 3,000 = 53,000
      expect(res.summary.companyExternalOut).toBe(53000);
      // Company net external movement = 107,000 - 53,000 = 54,000
      expect(res.summary.companyExternalNet).toBe(54000);
      // Internal transfer volume = 20,000
      expect(res.summary.internalTransfersVolume).toBe(20000);
      done();
    });
  });

  it('should filter transaction history by search term and transaction type', (done) => {
    service.getTransactionHistoryReport({ transactionType: 'Expense' }).subscribe(res => {
      expect(res.rows.length).toBe(1);
      expect(res.rows[0].reference).toBe('EXP-001');
      expect(res.summary.totalMoneyOut).toBe(3000);
      done();
    });
  });
});
