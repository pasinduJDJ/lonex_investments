import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuditLogComponent } from './audit-log.component';
import { AuditLogService } from '../../service/audit-log.service';
import { ExcelExportService } from '../../service/excel-export.service';

describe('AuditLogComponent', () => {
  let fixture: ComponentFixture<AuditLogComponent>;
  let component: AuditLogComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuditLogComponent],
      providers: [
        { provide: AuditLogService, useValue: { isConfigured: () => false, getLogs: jasmine.createSpy(), getAllMatchingLogs: jasmine.createSpy() } },
        { provide: ExcelExportService, useValue: jasmine.createSpyObj('ExcelExportService', ['exportMultiSheetReport', 'generateFilename']) }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(AuditLogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create in inactive configuration state', () => {
    expect(component).toBeTruthy();
    expect(component.items).toEqual([]);
  });

  it('should reset all filters', () => {
    component.selectedModule = 'Finance';
    component.search = 'cash';
    component.clearFilters();
    expect(component.selectedModule).toBe('All');
    expect(component.search).toBe('');
  });
});
