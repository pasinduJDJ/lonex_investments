import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CustomerReportsComponent } from './customer-reports.component';
import { CustomerReportService } from '../../service/customer-report.service';
import { ExcelExportService } from '../../service/excel-export.service';
import { LoanManageService } from '../../service/loan-manage.service';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

describe('CustomerReportsComponent', () => {
  let component: CustomerReportsComponent;
  let fixture: ComponentFixture<CustomerReportsComponent>;
  let mockReportService: jasmine.SpyObj<CustomerReportService>;
  let mockExcelService: jasmine.SpyObj<ExcelExportService>;
  let mockLoanService: jasmine.SpyObj<LoanManageService>;
  let router: Router;

  beforeEach(async () => {
    mockReportService = jasmine.createSpyObj('CustomerReportService', [
      'getCustomerMasterReport',
      'getCustomerLoanSummaryReport',
      'getCustomerStatement',
      'getGuarantorReport'
    ]);

    mockExcelService = jasmine.createSpyObj('ExcelExportService', [
      'exportSingleSheetReport',
      'exportMultiSheetReport',
      'generateFilename',
      'getTodayFormatted'
    ]);

    mockLoanService = jasmine.createSpyObj('LoanManageService', [
      'getAllClients'
    ]);

    mockReportService.getCustomerMasterReport.and.returnValue(of({
      rows: [
        {
          clientId: 'c1',
          memberId: '#0001',
          registerNumber: 1,
          fullName: 'Test Customer',
          nicNumber: '901234567V',
          mobileNumber: '0771234567',
          homeNumber: '-',
          fullAddress: 'Colombo',
          registrationDate: '2026-01-01',
          membershipStatus: 'Member',
          groupName: 'Group A'
        }
      ],
      summary: { totalCustomers: 1, totalMembers: 1, totalNonMembers: 0 }
    }));

    mockLoanService.getAllClients.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [CustomerReportsComponent],
      providers: [
        provideRouter([]),
        { provide: CustomerReportService, useValue: mockReportService },
        { provide: ExcelExportService, useValue: mockExcelService },
        { provide: LoanManageService, useValue: mockLoanService },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of({
              get: (key: string) => key === 'type' ? 'customer-master' : null
            })
          }
        }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    fixture = TestBed.createComponent(CustomerReportsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with customer-master report and load data', () => {
    expect(component.activeReportType).toBe('customer-master');
    expect(component.masterRows.length).toBe(1);
    expect(component.masterSummary.totalCustomers).toBe(1);
    expect(mockReportService.getCustomerMasterReport).toHaveBeenCalled();
  });

  it('should switch report type and navigate', () => {
    component.switchReport('loan-summary');
    expect(router.navigate).toHaveBeenCalledWith(['/member/reports', 'loan-summary']);
  });

  it('should paginate rows correctly', () => {
    component.pageSize = 25;
    component.currentPage = 1;
    expect(component.paginatedMasterRows.length).toBe(1);
    expect(component.totalPages).toBe(1);
  });

  it('should invoke Excel export for customer master', () => {
    mockExcelService.generateFilename.and.returnValue('Customer_Master_Report_2026-10-03.xlsx');
    component.exportMasterToExcel();
    expect(mockExcelService.exportSingleSheetReport).toHaveBeenCalled();
  });
});
