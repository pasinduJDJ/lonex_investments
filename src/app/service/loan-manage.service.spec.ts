import { TestBed } from '@angular/core/testing';

import { LoanManageService } from './loan-manage.service';

describe('LoanManageService', () => {
  let service: LoanManageService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LoanManageService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
