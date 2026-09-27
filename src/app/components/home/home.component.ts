import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

export interface LauncherModule {
  id: string;
  name: string;
  route: string;
  icon: string;
  description: string;
  accentClass: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {
  readonly modules: LauncherModule[] = [
    {
      id: 'customers',
      name: 'Customers',
      route: '/member',
      icon: 'bi-people-fill',
      description: 'Client directory, registration & guarantor records',
      accentClass: 'accent-customers'
    },
    {
      id: 'finance',
      name: 'Finance',
      route: '/profit',
      icon: 'bi-wallet2',
      description: 'Bank capital, expenses, investments & profit tracking',
      accentClass: 'accent-finance'
    },
    {
      id: 'loans',
      name: 'Loans',
      route: '/loan',
      icon: 'bi-cash-coin',
      description: 'Daily, weekly & monthly loans and repayments',
      accentClass: 'accent-loans'
    },
    {
      id: 'settings',
      name: 'Settings',
      route: '/profile',
      icon: 'bi-gear-fill',
      description: 'User profile, security credentials & configuration',
      accentClass: 'accent-settings'
    }
  ];

  constructor(private router: Router) {}

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }
}
