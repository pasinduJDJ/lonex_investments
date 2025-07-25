import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddMemberScreenComponent } from './add-member-screen.component';

describe('AddMemberScreenComponent', () => {
  let component: AddMemberScreenComponent;
  let fixture: ComponentFixture<AddMemberScreenComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddMemberScreenComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddMemberScreenComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
