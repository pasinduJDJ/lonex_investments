import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SingleMemberScreenComponent } from './single-member-screen.component';

describe('SingleMemberScreenComponent', () => {
  let component: SingleMemberScreenComponent;
  let fixture: ComponentFixture<SingleMemberScreenComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SingleMemberScreenComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SingleMemberScreenComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
