import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

export interface LauncherModule {
  id: string;
  name: string;
  route: string;
  icon: string;
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
      accentClass: 'odoo-app-customers'
    },
    {
      id: 'finance',
      name: 'Finance',
      route: '/profit',
      icon: 'bi-wallet2',
      accentClass: 'odoo-app-finance'
    },
    {
      id: 'loans',
      name: 'Loans',
      route: '/loan',
      icon: 'bi-cash-coin',
      accentClass: 'odoo-app-loans'
    },
    {
      id: 'settings',
      name: 'Settings',
      route: '/profile',
      icon: 'bi-gear-fill',
      accentClass: 'odoo-app-settings'
    }
  ];

  constructor(private router: Router) {}

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }
}
