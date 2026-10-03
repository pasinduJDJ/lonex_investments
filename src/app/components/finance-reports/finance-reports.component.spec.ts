import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FinanceReportsComponent } from './finance-reports.component';
import { FinanceReportService, AccountHistoryRow } from '../../service/finance-report.service';
import { ExcelExportService } from '../../service/excel-export.service';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';

describe('FinanceReportsComponent', () => {
  let component: FinanceReportsComponent;
  let fixture: ComponentFixture<FinanceReportsComponent>;
  let mockFinanceReportService: jasmine.SpyObj<FinanceReportService>;
  let mockExcelService: jasmine.SpyObj<ExcelExportService>;

  const mockAccountRow: AccountHistoryRow = {
    date: '2026-03-01',
    reference: 'DEP-001',
    type: 'Capital Deposit',
    description: 'Owner capital addition',
    moneyIn: 100000,
    moneyOut: null,
    status: 'Deposited',
    sourceAccount: 'Bank Capital'
  };

  beforeEach(async () => {
    mockFinanceReportService = jasmine.createSpyObj('FinanceReportService', [
      'getAccountHistoryReport',
      'getTransactionHistoryReport',
      'getIncomeExpenseReport',
      'getCapitalHistoryReport',
      'getExpenseReport',
      'getCashMovementReport'
    ]);

    mockExcelService = jasmine.createSpyObj('ExcelExportService', [
      'exportSingleSheetReport',
      'exportMultiSheetReport',
      'getTodayFormatted'
    ]);

    mockFinanceReportService.getAccountHistoryReport.and.returnValue(of({
      rows: [mockAccountRow],
      summary: {
        accountName: 'Bank Capital',
        currentBalance: 91517,
        totalMoneyIn: 100000,
        totalMoneyOut: 0,
        netMovement: 100000,
        transactionCount: 1,
        limitationNote: ''
      }
    }));

    await TestBed.configureTestingModule({
      imports: [FinanceReportsComponent],
      providers: [
        provideRouter([]),
        { provide: FinanceReportService, useValue: mockFinanceReportService },
        { provide: ExcelExportService, useValue: mockExcelService },
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({ type: 'account-history' })
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(FinanceReportsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with account-history active by default', () => {
    expect(component.activeReportType).toBe('account-history');
    expect(mockFinanceReportService.getAccountHistoryReport).toHaveBeenCalled();
    expect(component.accountRows.length).toBe(1);
    expect(component.accountSummary.currentBalance).toBe(91517);
  });

  it('should reset filters and reload active report', () => {
    component.accountSearch = 'test';
    component.resetFilters();
    expect(component.accountSearch).toBe('');
    expect(mockFinanceReportService.getAccountHistoryReport).toHaveBeenCalledTimes(2);
  });

  it('should call ExcelExportService on export', () => {
    component.exportReportToExcel();
    expect(mockExcelService.exportMultiSheetReport).toHaveBeenCalled();
  });
});
