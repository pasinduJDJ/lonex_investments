import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuditLogComponent } from './audit-log.component';
import { AuditLogService } from '../../service/audit-log.service';

describe('AuditLogComponent', () => {
  let fixture: ComponentFixture<AuditLogComponent>;
  let component: AuditLogComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuditLogComponent],
      providers: [{
        provide: AuditLogService,
        useValue: { getLogs: () => Promise.resolve({ items: [], total: 0, page: 1, pageSize: 25 }) }
      }]
    }).compileComponents();
    fixture = TestBed.createComponent(AuditLogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and expose operation tabs', () => {
    expect(component).toBeTruthy();
    expect(component.operations).toContain('Finance');
  });
});
