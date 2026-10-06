import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoginComponent } from './login.component';
import { SupabaseService } from '../../service/supabase.service';
import { Router } from '@angular/router';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let mockSupabase: any;
  let mockRouter: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    mockSupabase = {
      getClient: jasmine.createSpy('getClient').and.returnValue({
        auth: {
          signInWithPassword: jasmine.createSpy('signInWithPassword').and.returnValue(Promise.resolve({ error: null }))
        }
      })
    };

    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: Router, useValue: mockRouter }
      ]
    })
      .compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.showPassword).toBeFalse();
  });

  it('should toggle password visibility', () => {
    expect(component.showPassword).toBeFalse();
    component.togglePasswordVisibility();
    expect(component.showPassword).toBeTrue();
    component.togglePasswordVisibility();
    expect(component.showPassword).toBeFalse();
  });

  it('should handle successful login', async () => {
    component.email = 'test@lonex.com';
    component.password = 'password123';
    await component.login();

    expect(mockSupabase.getClient().auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'test@lonex.com',
      password: 'password123'
    });
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/home']);
    expect(localStorage.getItem('userLog')).toBe('true');
  });

  it('should display error message on failed login', async () => {
    mockSupabase.getClient().auth.signInWithPassword.and.returnValue(Promise.resolve({
      error: { message: 'Invalid login credentials' }
    }));

    component.email = 'wrong@lonex.com';
    component.password = 'wrongpass';
    await component.login();

    expect(component.error).toBe('Invalid login credentials');
    expect(component.loading).toBeFalse();
  });
});
