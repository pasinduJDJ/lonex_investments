import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProfitsManageScreenComponent } from './profits-manage-screen.component';

describe('ProfitsManageScreenComponent', () => {
  let component: ProfitsManageScreenComponent;
  let fixture: ComponentFixture<ProfitsManageScreenComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfitsManageScreenComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProfitsManageScreenComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
