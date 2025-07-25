import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoanManageScreenComponent } from './loan-manage-screen.component';

describe('LoanManageScreenComponent', () => {
  let component: LoanManageScreenComponent;
  let fixture: ComponentFixture<LoanManageScreenComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoanManageScreenComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoanManageScreenComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
