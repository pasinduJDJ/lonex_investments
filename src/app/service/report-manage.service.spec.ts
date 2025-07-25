import { TestBed } from '@angular/core/testing';

import { ReportManageService } from './report-manage.service';

describe('ReportManageService', () => {
  let service: ReportManageService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ReportManageService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
