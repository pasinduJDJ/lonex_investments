import { TestBed } from '@angular/core/testing';
import { AuditLogService } from './audit-log.service';
import { SupabaseService } from './supabase.service';

describe('AuditLogService', () => {
  let service: AuditLogService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuditLogService,
        {
          provide: SupabaseService,
          useValue: { getClient: () => ({ auth: { getSession: async () => ({ data: { session: null }, error: null }) } }) }
        }
      ]
    });
    service = TestBed.inject(AuditLogService);
  });

  it('should be created', () => expect(service).toBeTruthy());

  it('should generate different idempotency keys', () => {
    expect(service.createIdempotencyKey()).not.toBe(service.createIdempotencyKey());
  });

  it('should not throw when best-effort logging is unavailable', async () => {
    const result = await service.logActivity({
      action: 'Member Created',
      module: 'Members',
      recordReference: '000001',
      description: 'Member 000001 created.'
    });
    expect(result).toBeFalse();
  });
});
