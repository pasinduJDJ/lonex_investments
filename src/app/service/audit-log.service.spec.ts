import { TestBed } from '@angular/core/testing';
import { AuditLogService } from './audit-log.service';
import { SupabaseService } from './supabase.service';

describe('AuditLogService', () => {
  let service: AuditLogService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuditLogService,
        { provide: SupabaseService, useValue: { getClient: jasmine.createSpy('getClient') } }
      ]
    });
    service = TestBed.inject(AuditLogService);
  });

  it('should create unique idempotency keys', () => {
    expect(service.createIdempotencyKey('payment')).not.toBe(service.createIdempotencyKey('payment'));
  });
});
