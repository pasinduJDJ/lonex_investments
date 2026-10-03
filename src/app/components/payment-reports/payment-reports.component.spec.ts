import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PaymentReportsComponent } from './payment-reports.component';
import { PaymentReportService, PaymentHistoryRow } from '../../service/payment-report.service';
import { ExcelExportService } from '../../service/excel-export.service';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

describe('PaymentReportsComponent', () => {
  let component: PaymentReportsComponent;
  let fixture: ComponentFixture<PaymentReportsComponent>;
  let mockReportService: jasmine.SpyObj<PaymentReportService>;
  let mockExcelService: jasmine.SpyObj<ExcelExportService>;
  let router: Router;

  const mockPaymentHistoryRow: PaymentHistoryRow = {
    paymentId: 'P1',
    paidDate: '2026-02-01',
    customerName: 'Sunil Perera',
    nicNumber: '851234567V',
    mobileNumber: '0771234567',
    loanNumber: 'LN-2026-001',
    loanType: 'MONTHLY',
    loanStatus: 'Active',
    paidAmount: 20000,
    remark: 'Payment 1',
    recordedDate: '2026-02-01'
  };

  beforeEach(async () => {
    mockReportService = jasmine.createSpyObj('PaymentReportService', [
      'getPaymentHistoryReport',
      'getDelayedPaymentsReport',
      'getCollectionReport',
      'getUpcomingPaymentsReport',
      'getPaymentPerformanceReport'
    ]);

    mockExcelService = jasmine.createSpyObj('ExcelExportService', [
      'exportSingleSheetReport',
      'exportMultiSheetReport',
      'generateFilename',
      'getTodayFormatted'
    ]);

    mockReportService.getPaymentHistoryReport.and.returnValue(of({
      rows: [mockPaymentHistoryRow],
      summary: {
        totalPayments: 1,
        totalCollected: 20000,
        averagePayment: 20000
      }
    }));

    await TestBed.configureTestingModule({
      imports: [PaymentReportsComponent],
      providers: [
        provideRouter([]),
        { provide: PaymentReportService, useValue: mockReportService },
        { provide: ExcelExportService, useValue: mockExcelService },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of({
              get: (key: string) => key === 'type' ? 'payment-history' : null
            })
          }
        }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    fixture = TestBed.createComponent(PaymentReportsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with payment-history report and load data', () => {
    expect(component.activeReportType).toBe('payment-history');
    expect(component.historyRows.length).toBe(1);
    expect(component.historySummary.totalPayments).toBe(1);
    expect(component.historySummary.totalCollected).toBe(20000);
  });

  it('should switch report type and navigate on switchReport', () => {
    mockReportService.getDelayedPaymentsReport.and.returnValue(of({
      rows: [],
      summary: {
        totalDelayedObligations: 0,
        totalOverdueAmount: 0,
        affectedCustomers: 0,
        affectedLoans: 0,
        count1To7Days: 0,
        count8To30Days: 0,
        count31PlusDays: 0
      }
    }));

    component.switchReport('delayed-payments');
    expect(router.navigate).toHaveBeenCalledWith(['/analysis/reports', 'delayed-payments']);
    expect(component.activeReportType).toBe('delayed-payments');

    component.loadActiveReport();
    expect(mockReportService.getDelayedPaymentsReport).toHaveBeenCalled();
  });

  it('should reset filters and reload data on resetHistoryFilters', () => {
    component.historySearch = 'test query';
    component.historyLoanType = 'weekly';
    component.resetHistoryFilters();
    expect(component.historySearch).toBe('');
    expect(component.historyLoanType).toBe('all');
    expect(mockReportService.getPaymentHistoryReport).toHaveBeenCalledTimes(2); // init + reset
  });

  it('should trigger single-sheet Excel export for payment history', () => {
    mockExcelService.getTodayFormatted.and.returnValue('2026-10-03');
    component.exportPaymentHistoryToExcel();
    expect(mockExcelService.exportSingleSheetReport).toHaveBeenCalled();
  });

  it('should trigger multi-sheet Excel export for collection report', () => {
    mockExcelService.getTodayFormatted.and.returnValue('2026-10-03');
    component.collectionRows = [
      {
        paymentId: 'P1',
        paidDate: '2026-02-01',
        customerName: 'Sunil',
        nicNumber: '851234567V',
        mobileNumber: '0771234567',
        loanNumber: 'LN-2026-001',
        loanType: 'MONTHLY',
        paidAmount: 20000,
        remark: '-',
        recordedDate: '2026-02-01'
      }
    ];
    component.exportCollectionToExcel();
    expect(mockExcelService.exportMultiSheetReport).toHaveBeenCalled();
  });

  it('should handle pagination page changes correctly', () => {
    component.historyRows = new Array(35).fill(mockPaymentHistoryRow);
    component.pageSize = 25;
    component.currentPage = 1;

    expect(component.paginatedHistoryRows.length).toBe(25);
    component.setPage(2);
    expect(component.currentPage).toBe(2);
    expect(component.paginatedHistoryRows.length).toBe(10);
  });
});
