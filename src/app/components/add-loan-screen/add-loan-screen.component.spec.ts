import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddLoanScreenComponent } from './add-loan-screen.component';

describe('AddLoanScreenComponent', () => {
  let component: AddLoanScreenComponent;
  let fixture: ComponentFixture<AddLoanScreenComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddLoanScreenComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddLoanScreenComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
