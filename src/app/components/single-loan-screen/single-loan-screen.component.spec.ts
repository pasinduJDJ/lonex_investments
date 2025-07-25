import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SingleLoanScreenComponent } from './single-loan-screen.component';

describe('SingleLoanScreenComponent', () => {
  let component: SingleLoanScreenComponent;
  let fixture: ComponentFixture<SingleLoanScreenComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SingleLoanScreenComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SingleLoanScreenComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
