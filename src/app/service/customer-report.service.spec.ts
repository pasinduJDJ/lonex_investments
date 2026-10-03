import { TestBed } from '@angular/core/testing';
import { CustomerReportService } from './customer-report.service';
import { SupabaseService } from './supabase.service';
import { Client } from './loan-manage.service';

describe('CustomerReportService', () => {
  let service: CustomerReportService;
  let mockSupabaseService: jasmine.SpyObj<SupabaseService>;

  const mockClients: Client[] = [
    {
      client_id: 'c1',
      register_number: 1,
      first_name: 'Kamal',
      last_name: 'Perera',
      nic_number: '851234567V',
      mobile_number: '0771234567',
      street_address: '123 Main St',
      town_one: 'Colombo',
      town_two: 'Pannipitiya',
      group: 'Group A',
      is_member: true,
      created_at: '2026-01-10T10:00:00Z',
      first_guarantor_name: 'Nimal Silva',
      first_guarantor_nic: '901234567V',
      first_guarantor_tp: '0719876543'
    },
    {
      client_id: 'c2',
      register_number: 2,
      first_name: 'Nimal',
      last_name: 'Silva',
      nic_number: '901234567V',
      mobile_number: '0719876543',
      street_address: '45 Lake Rd',
      town_one: 'Kandy',
      group: 'Group B',
      is_member: false,
      created_at: '2026-02-15T10:00:00Z'
    }
  ];

  beforeEach(() => {
    mockSupabaseService = jasmine.createSpyObj('SupabaseService', ['getClient']);

    TestBed.configureTestingModule({
      providers: [
        CustomerReportService,
        { provide: SupabaseService, useValue: mockSupabaseService }
      ]
    });

    service = TestBed.inject(CustomerReportService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should format member IDs as #0001', () => {
    expect(service.formatMemberId(1)).toBe('#0001');
    expect(service.formatMemberId(42)).toBe('#0042');
    expect(service.formatMemberId(null)).toBe('-');
    expect(service.formatMemberId(undefined)).toBe('-');
  });

  it('should format clean customer address from available columns', () => {
    const formatted = service.formatAddress(mockClients[0]);
    expect(formatted).toContain('123 Main St');
    expect(formatted).toContain('Colombo');
  });

  it('should return Customer Master report with correct summary', (done) => {
    const fakeQueryBuilder: any = {
      select: jasmine.createSpy('select').and.returnValue({
        order: jasmine.createSpy('order').and.resolveTo({ data: mockClients, error: null })
      })
    };

    mockSupabaseService.getClient.and.returnValue({
      from: jasmine.createSpy('from').and.returnValue(fakeQueryBuilder)
    } as any);

    service.getCustomerMasterReport().subscribe({
      next: ({ rows, summary }) => {
        expect(rows.length).toBe(2);
        expect(summary.totalCustomers).toBe(2);
        expect(summary.totalMembers).toBe(1);
        expect(summary.totalNonMembers).toBe(1);
        expect(rows[0].fullName).toBe('Kamal Perera');
        expect(rows[0].membershipStatus).toBe('Member');
        done();
      },
      error: done.fail
    });
  });

  it('should filter Customer Master by search query in memory', (done) => {
    const fakeQueryBuilder: any = {
      select: jasmine.createSpy('select').and.returnValue({
        order: jasmine.createSpy('order').and.resolveTo({ data: mockClients, error: null })
      })
    };

    mockSupabaseService.getClient.and.returnValue({
      from: jasmine.createSpy('from').and.returnValue(fakeQueryBuilder)
    } as any);

    service.getCustomerMasterReport({ search: 'Silva' }).subscribe({
      next: ({ rows, summary }) => {
        expect(rows.length).toBe(1);
        expect(rows[0].fullName).toBe('Nimal Silva');
        expect(summary.totalCustomers).toBe(1);
        done();
      },
      error: done.fail
    });
  });
});
