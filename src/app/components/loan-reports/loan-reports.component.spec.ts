import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoanReportsComponent } from './loan-reports.component';
import { LoanReportService, LoanHistoryRow } from '../../service/loan-report.service';
import { ExcelExportService } from '../../service/excel-export.service';
import { LoanManageService } from '../../service/loan-manage.service';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

describe('LoanReportsComponent', () => {
  let component: LoanReportsComponent;
  let fixture: ComponentFixture<LoanReportsComponent>;
  let mockReportService: jasmine.SpyObj<LoanReportService>;
  let mockExcelService: jasmine.SpyObj<ExcelExportService>;
  let mockLoanService: jasmine.SpyObj<LoanManageService>;
  let router: Router;

  const mockLoanHistoryRow: LoanHistoryRow = {
    loanId: 'L1',
    loanNumber: 'LN-2026-001',
    clientId: 'C1',
    customerName: 'Sunil Perera',
    nicNumber: '851234567V',
    mobileNumber: '0771234567',
    loanDate: '2026-01-01',
    principalAmount: 100000,
    totalAmountDue: 120000,
    totalPaid: 40000,
    remainingAmount: 80000,
    installmentAmount: 10000,
    loanType: 'Monthly',
    paidInstallments: 4,
    remainingInstallments: 8,
    totalInstallments: 12,
    expectedEndDate: '2026-12-31',
    status: 'Active'
  };

  beforeEach(async () => {
    mockReportService = jasmine.createSpyObj('LoanReportService', [
      'getLoanHistoryReport',
      'getActiveLoansReport',
      'getCompletedLoansReport',
      'getOverdueLoansReport',
      'getRepaymentScheduleReport'
    ]);

    mockExcelService = jasmine.createSpyObj('ExcelExportService', [
      'exportSingleSheetReport',
      'exportMultiSheetReport',
      'generateFilename',
      'getTodayFormatted'
    ]);

    mockLoanService = jasmine.createSpyObj('LoanManageService', [
      'getAllLoans'
    ]);

    mockReportService.getLoanHistoryReport.and.returnValue(of({
      rows: [mockLoanHistoryRow],
      summary: {
        totalLoans: 1,
        totalPrincipal: 100000,
        totalDue: 120000,
        totalPaid: 40000,
        totalRemaining: 80000,
        activeCount: 1,
        completedCount: 0,
        overdueCount: 0
      }
    }));

    mockLoanService.getAllLoans.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [LoanReportsComponent],
      providers: [
        provideRouter([]),
        { provide: LoanReportService, useValue: mockReportService },
        { provide: ExcelExportService, useValue: mockExcelService },
        { provide: LoanManageService, useValue: mockLoanService },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of({
              get: (key: string) => key === 'type' ? 'loan-history' : null
            })
          }
        }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    fixture = TestBed.createComponent(LoanReportsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with loan-history report and load data', () => {
    expect(component.activeReportType).toBe('loan-history');
    expect(component.historyRows.length).toBe(1);
    expect(component.historySummary.totalLoans).toBe(1);
    expect(component.historySummary.totalPrincipal).toBe(100000);
  });

  it('should switch report type and navigate on switchReport', () => {
    mockReportService.getActiveLoansReport.and.returnValue(of({
      rows: [],
      summary: {
        totalActiveLoans: 0,
        totalPrincipal: 0,
        totalDue: 0,
        totalPaid: 0,
        totalOutstanding: 0,
        dueThisWeekCount: 0,
        dueThisWeekAmount: 0
      }
    }));

    component.switchReport('active-loans');
    expect(router.navigate).toHaveBeenCalledWith(['/loan/reports', 'active-loans']);
    expect(component.activeReportType).toBe('active-loans');

    component.loadActiveReport();
    expect(mockReportService.getActiveLoansReport).toHaveBeenCalled();
  });

  it('should trigger excel export for loan history with all filtered rows', () => {
    mockExcelService.getTodayFormatted.and.returnValue('2026-10-03');
    mockExcelService.generateFilename.and.returnValue('Loan_History_Report_2026-10-03.xlsx');

    component.exportHistoryToExcel();
    expect(mockExcelService.exportSingleSheetReport).toHaveBeenCalled();
  });

  it('should reset filters and reload data on resetHistoryFilters', () => {
    component.historySearch = 'something';
    component.historyStatus = 'completed';
    component.resetHistoryFilters();
    expect(component.historySearch).toBe('');
    expect(component.historyStatus).toBe('all');
    expect(mockReportService.getLoanHistoryReport).toHaveBeenCalledTimes(2); // init + reset
  });

  it('should handle pagination page changes correctly', () => {
    component.historyRows = new Array(35).fill(mockLoanHistoryRow);
    component.pageSize = 25;
    component.currentPage = 1;

    expect(component.paginatedHistoryRows.length).toBe(25);
    component.setPage(2);
    expect(component.currentPage).toBe(2);
    expect(component.paginatedHistoryRows.length).toBe(10);
  });
});
