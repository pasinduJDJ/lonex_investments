import { TestBed } from '@angular/core/testing';

import { ProfitManageService } from './profit-manage.service';

describe('ProfitManageService', () => {
  let service: ProfitManageService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProfitManageService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
