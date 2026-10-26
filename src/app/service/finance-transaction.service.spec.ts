import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { FinanceTransactionService } from './finance-transaction.service';
import { SupabaseService } from './supabase.service';
import { AccountManageService } from './account-manage.service';

describe('FinanceTransactionService', () => {
  let service: FinanceTransactionService;
  let mockSupabaseService: any;
  let mockAccountService: jasmine.SpyObj<AccountManageService>;

  const mockLoans = [
    {
      id: 'loan-1',
      loan_number: '12-105-001-010',
      principal_amount: 50000,
      document_charge: 600,
      start_date: '2026-10-05',
      created_at: '2026-10-05T08:00:00Z',
      status: 'active',
      client: { first_name: 'Sunil', last_name: 'Perera' }
    },
    {
      id: 'loan-2',
      loan_number: '12-105-001-011',
      principal_amount: 30000,
      document_charge: 600,
      start_date: '2026-10-05',
      created_at: '2026-10-05T09:00:00Z',
      status: 'active',
      client: { first_name: 'Kamal', last_name: 'Silva' }
    },
    {
      id: 'loan-3-zero-charge',
      loan_number: '12-105-001-012',
      principal_amount: 20000,
      document_charge: 0,
      start_date: '2026-10-06',
      created_at: '2026-10-06T10:00:00Z',
      status: 'active',
      client: { first_name: 'Nimal', last_name: 'Fernando' }
    },
    {
      id: 'loan-4-cancelled',
      loan_number: '12-105-001-013',
      principal_amount: 40000,
      document_charge: 600,
      start_date: '2026-10-07',
      created_at: '2026-10-07T11:00:00Z',
      status: 'cancelled',
      client: { first_name: 'Ruwan', last_name: 'Gunasekara' }
    },
    {
      id: 'loan-5-has-explicit-tx',
      loan_number: '12-105-001-014',
      principal_amount: 60000,
      document_charge: 600,
      start_date: '2026-10-08',
      created_at: '2026-10-08T12:00:00Z',
      status: 'active',
      client: { first_name: 'Ajith', last_name: 'Perera' }
    }
  ];

  const mockExplicitAccountTxs = [
    {
      id: 'tx-explicit-1',
      transaction_type: 'DOCUMENT_CHARGE',
      source_account: null,
      destination_account: 'ASSETS_CASH',
      amount: 600,
      transaction_date: '2026-10-08',
      description: 'Explicit Document Charge for loan 12-105-001-014',
      reference: '12-105-001-014',
      created_at: '2026-10-08T12:05:00Z'
    }
  ];

  beforeEach(() => {
    mockAccountService = jasmine.createSpyObj('AccountManageService', ['getAccountTransactions']);
    mockAccountService.getAccountTransactions.and.returnValue(of(mockExplicitAccountTxs as any));

    const mockSupabaseClient = {
      from: (table: string) => {
        if (table === 'loans') {
          return {
            select: () => ({
              order: () => Promise.resolve({ data: mockLoans, error: null })
            })
          };
        }
        if (table === 'payments') {
          return {
            select: () => ({
              order: () => Promise.resolve({ data: [], error: null })
            })
          };
        }
        if (table === 'invest') {
          return {
            select: () => ({
              order: () => Promise.resolve({ data: [], error: null })
            })
          };
        }
        if (table === 'expenses') {
          return {
            select: () => ({
              order: () => Promise.resolve({ data: [], error: null })
            })
          };
        }
        return {
          select: () => ({
            order: () => Promise.resolve({ data: [], error: null })
          })
        };
      }
    };

    mockSupabaseService = {
      getClient: () => mockSupabaseClient
    };

    TestBed.configureTestingModule({
      providers: [
        FinanceTransactionService,
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: AccountManageService, useValue: mockAccountService }
      ]
    });

    service = TestBed.inject(FinanceTransactionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should derive historical Document Charge transactions from authoritative loan records', (done) => {
    service.loadAllTransactions().subscribe(txs => {
      const docCharges = txs.filter(t => t.type === 'Document Charge');
      
      // loan-1: derived
      // loan-2: derived
      // loan-3-zero-charge: skipped (charge = 0)
      // loan-4-cancelled: skipped (status = cancelled)
      // loan-5: has explicit tx in account_transactions (DC-tx-explicit-1)
      // Total Document Charge transactions should be 3: 2 derived + 1 explicit
      expect(docCharges.length).toBe(3);

      const loan1Charge = docCharges.find(t => t.relatedLoanNumber === '12-105-001-010');
      expect(loan1Charge).toBeDefined();
      expect(loan1Charge?.id).toBe('DOC-loan-1');
      expect(loan1Charge?.date).toBe('2026-10-05');
      expect(loan1Charge?.moneyIn).toBe(600);
      expect(loan1Charge?.moneyOut).toBeNull();
      expect(loan1Charge?.sourceAccount).toBe('Assets / Cash');
      expect(loan1Charge?.status).toBe('Collected');
      expect(loan1Charge?.description).toContain('Sunil Perera');

      done();
    });
  });

  it('should keep two distinct entries for two different loans with identical charge and date', (done) => {
    service.loadAllTransactions().subscribe(txs => {
      const docCharges = txs.filter(t => t.type === 'Document Charge');
      const loan1 = docCharges.find(t => t.reference === '12-105-001-010');
      const loan2 = docCharges.find(t => t.reference === '12-105-001-011');

      expect(loan1).toBeDefined();
      expect(loan2).toBeDefined();
      expect(loan1?.id).not.toBe(loan2?.id);
      expect(loan1?.moneyIn).toBe(600);
      expect(loan2?.moneyIn).toBe(600);
      expect(loan1?.date).toBe('2026-10-05');
      expect(loan2?.date).toBe('2026-10-05');

      done();
    });
  });

  it('should prevent duplicates when an explicit Document Charge transaction exists', (done) => {
    service.loadAllTransactions().subscribe(txs => {
      const docChargesForLoan5 = txs.filter(t => 
        t.type === 'Document Charge' && 
        (t.reference === '12-105-001-014' || t.relatedLoanNumber === '12-105-001-014')
      );

      // Exactly ONE transaction for loan 5, using the authoritative explicit transaction
      expect(docChargesForLoan5.length).toBe(1);
      expect(docChargesForLoan5[0].id).toBe('DC-tx-explicit-1');
      expect(docChargesForLoan5[0].sourceAccount).toBe('Assets / Cash');
      expect(docChargesForLoan5[0].moneyIn).toBe(600);

      done();
    });
  });

  it('should not derive Document Charges for zero-charge or cancelled loans', (done) => {
    service.loadAllTransactions().subscribe(txs => {
      const zeroCharge = txs.find(t => t.type === 'Document Charge' && t.reference === '12-105-001-012');
      const cancelledLoan = txs.find(t => t.type === 'Document Charge' && t.reference === '12-105-001-013');

      expect(zeroCharge).toBeUndefined();
      expect(cancelledLoan).toBeUndefined();

      done();
    });
  });

  it('should calculate transaction summary accurately including Document Charges', () => {
    const sampleTxs: any[] = [
      { type: 'Loan Disbursement', moneyIn: null, moneyOut: 50000 },
      { type: 'Document Charge', moneyIn: 600, moneyOut: null },
      { type: 'Loan Repayment', moneyIn: 5000, moneyOut: null }
    ];

    const summary = service.calculateSummary(sampleTxs);
    expect(summary.totalMoneyIn).toBe(5600);
    expect(summary.totalMoneyOut).toBe(50000);
    expect(summary.netMovement).toBe(5600 - 50000);
    expect(summary.totalCount).toBe(3);
  });
});
