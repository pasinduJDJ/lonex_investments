import { TestBed } from '@angular/core/testing';
import { ExcelExportService } from './excel-export.service';

describe('ExcelExportService', () => {
  let service: ExcelExportService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ExcelExportService]
    });
    service = TestBed.inject(ExcelExportService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should generate valid date-stamped filename', () => {
    const filename = service.generateFilename('Customer_Master_Report');
    expect(filename).toContain('Customer_Master_Report_');
    expect(filename).toMatch(/\.xlsx$/);
  });

  it('should generate filename with clean suffix', () => {
    const filename = service.generateFilename('Customer_Statement', '901234567V');
    expect(filename).toContain('Customer_Statement_901234567V_');
    expect(filename).toMatch(/\.xlsx$/);
  });

  it('should correctly format valid dates to DD/MM/YYYY', () => {
    expect(service.formatDate('2026-10-03')).toBe('03/10/2026');
    expect(service.formatDate(null)).toBe('-');
    expect(service.formatDate('')).toBe('-');
  });

  it('should format today date properly', () => {
    const today = service.getTodayFormatted();
    expect(today).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });
});
