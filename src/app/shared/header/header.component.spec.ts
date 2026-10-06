import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, BehaviorSubject } from 'rxjs';
import { HeaderComponent } from './header.component';
import { PaymentNotificationService, DuePaymentNotification } from '../../service/payment-notification.service';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;
  let router: Router;
  let mockNotificationService: any;
  let duePaymentsSubject: BehaviorSubject<DuePaymentNotification[]>;
  let isLoadingSubject: BehaviorSubject<boolean>;
  let errorSubject: BehaviorSubject<string | null>;

  const mockDueItems: DuePaymentNotification[] = [
    {
      loanId: 'l1',
      loanNumber: '12-26-0045',
      clientId: 'c1',
      customerName: 'Nimal Perera',
      customerMobile: '0771234567',
      expectedDate: '2026-10-06',
      expectedAmount: 5000,
      paidTowardObligation: 0,
      remainingDue: 5000,
      loanType: 'monthly'
    }
  ];

  beforeEach(async () => {
    duePaymentsSubject = new BehaviorSubject<DuePaymentNotification[]>([]);
    isLoadingSubject = new BehaviorSubject<boolean>(false);
    errorSubject = new BehaviorSubject<string | null>(null);

    mockNotificationService = {
      duePayments$: duePaymentsSubject.asObservable(),
      isLoading$: isLoadingSubject.asObservable(),
      error$: errorSubject.asObservable(),
      loadDuePayments: jasmine.createSpy('loadDuePayments'),
      refresh: jasmine.createSpy('refresh')
    };

    await TestBed.configureTestingModule({
      imports: [HeaderComponent, RouterTestingModule],
      providers: [
        { provide: PaymentNotificationService, useValue: mockNotificationService }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should update dueCount and unreadNotificationsCount from service', () => {
    duePaymentsSubject.next(mockDueItems);
    expect(component.dueCount).toBe(1);
    expect(component.unreadNotificationsCount).toBe(1);
    expect(component.duePayments.length).toBe(1);
  });

  it('should toggle notifications dropdown and refresh on open', () => {
    expect(component.isNotificationsOpen).toBeFalse();

    component.toggleNotifications();
    expect(component.isNotificationsOpen).toBeTrue();
    expect(mockNotificationService.loadDuePayments).toHaveBeenCalledWith(true);

    component.toggleNotifications();
    expect(component.isNotificationsOpen).toBeFalse();
  });

  it('should navigate to loan detail on viewLoan', () => {
    component.isNotificationsOpen = true;
    component.viewLoan('12-26-0045');

    expect(component.isNotificationsOpen).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/single-loan', '12-26-0045']);
  });

  it('should navigate to add-payments with preselected loan on addPayment', () => {
    component.isNotificationsOpen = true;
    component.addPayment('12-26-0045');

    expect(component.isNotificationsOpen).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/add-payments'], {
      queryParams: { loan_number: '12-26-0045' }
    });
  });

  it('should navigate to operational upcoming payments on viewAllDuePayments', () => {
    component.isNotificationsOpen = true;
    component.viewAllDuePayments();

    expect(component.isNotificationsOpen).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/analysis/operational'], {
      queryParams: { tab: 'upcoming_payments', filter: 'today' }
    });
  });

  it('should close dropdowns on escape key', () => {
    component.isNotificationsOpen = true;
    component.onEscapeKey();
    expect(component.isNotificationsOpen).toBeFalse();
  });
});
