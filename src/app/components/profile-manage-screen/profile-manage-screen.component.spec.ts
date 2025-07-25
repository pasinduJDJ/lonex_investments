import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProfileManageScreenComponent } from './profile-manage-screen.component';

describe('ProfileManageScreenComponent', () => {
  let component: ProfileManageScreenComponent;
  let fixture: ComponentFixture<ProfileManageScreenComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileManageScreenComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProfileManageScreenComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
