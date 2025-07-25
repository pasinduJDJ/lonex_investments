import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MembersManageScreenComponent } from './members-manage-screen.component';

describe('MembersManageScreenComponent', () => {
  let component: MembersManageScreenComponent;
  let fixture: ComponentFixture<MembersManageScreenComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MembersManageScreenComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MembersManageScreenComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
