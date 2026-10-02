import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';

export interface BreadcrumbItem {
  label: string;
  url?: string;
  active?: boolean;
}

export interface ModuleNavTab {
  label: string;
  url: string;
  icon?: string;
  isPrimary?: boolean;
}

@Component({
  selector: 'app-module-nav',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './module-nav.component.html',
  styleUrl: './module-nav.component.css'
})
export class ModuleNavComponent implements OnInit, OnDestroy {
  currentUrl: string = '';
  moduleTitle: string = '';
  moduleIcon: string = '';
  breadcrumbs: BreadcrumbItem[] = [];
  navTabs: ModuleNavTab[] = [];

  private routerSub!: Subscription;

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.currentUrl = this.router.url;
    this.updateModuleNav(this.currentUrl);

    this.routerSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.currentUrl = event.urlAfterRedirects;
        this.updateModuleNav(this.currentUrl);
      });
  }

  ngOnDestroy(): void {
    if (this.routerSub) {
      this.routerSub.unsubscribe();
    }
  }

  private updateModuleNav(url: string): void {
    if (url.startsWith('/member') || url.startsWith('/add-member') || url.startsWith('/single-member')) {
      this.moduleTitle = 'Customers';
      this.moduleIcon = 'bi-people-fill';
      this.navTabs = [
        { label: 'All Customers', url: '/member', icon: 'bi-people' },
        { label: 'Add Customer', url: '/add-member', icon: 'bi-person-plus', isPrimary: true }
      ];
      this.breadcrumbs = [
        { label: 'Home', url: '/home' },
        { label: 'Customers', url: url === '/member' ? undefined : '/member', active: url === '/member' }
      ];
      if (url.startsWith('/add-member')) {
        this.breadcrumbs.push({ label: 'Add New Customer', active: true });
      } else if (url.startsWith('/single-member')) {
        const parts = url.split('/');
        const id = parts[parts.length - 1];
        this.breadcrumbs.push({ label: `Customer #${id}`, active: true });
      }
    } else if (url.startsWith('/loan') || url.startsWith('/add-loan') || url.startsWith('/single-loan') || url.startsWith('/add-payments')) {
      this.moduleTitle = 'Loans';
      this.moduleIcon = 'bi-cash-coin';
      this.navTabs = [
        { label: 'All Loans', url: '/loan', icon: 'bi-card-list' },
        { label: 'Issue Loan', url: '/add-loan', icon: 'bi-plus-circle', isPrimary: true },
        { label: 'Add Payment', url: '/add-payments', icon: 'bi-cash-stack' }
      ];
      this.breadcrumbs = [
        { label: 'Home', url: '/home' },
        { label: 'Loans', url: url === '/loan' ? undefined : '/loan', active: url === '/loan' }
      ];
      if (url.startsWith('/add-loan')) {
        this.breadcrumbs.push({ label: 'Issue New Loan', active: true });
      } else if (url.startsWith('/single-loan')) {
        const parts = url.split('/');
        const loanNum = parts[parts.length - 1];
        this.breadcrumbs.push({ label: `Loan #${loanNum}`, active: true });
      } else if (url.startsWith('/add-payments')) {
        this.breadcrumbs.push({ label: 'Record Repayment', active: true });
      }
    } else if (url.startsWith('/profit')) {
      this.moduleTitle = 'Finance';
      this.moduleIcon = 'bi-wallet2';
      this.navTabs = [
        { label: 'Profits & Capital', url: '/profit', icon: 'bi-graph-up-arrow' }
      ];
      this.breadcrumbs = [
        { label: 'Home', url: '/home' },
        { label: 'Finance', active: true }
      ];
    } else if (url.startsWith('/profile')) {
      this.moduleTitle = 'Settings';
      this.moduleIcon = 'bi-gear-fill';
      this.navTabs = [
        { label: 'Profile & Security', url: '/profile', icon: 'bi-shield-lock' }
      ];
      this.breadcrumbs = [
        { label: 'Home', url: '/home' },
        { label: 'Settings', active: true }
      ];
    } else if (url.startsWith('/analysis')) {
      this.moduleTitle = 'Analysis';
      this.moduleIcon = 'bi-bar-chart-line-fill';
      this.navTabs = [
        { label: 'Operational Overview', url: '/analysis', icon: 'bi-grid-1x2-fill' }
      ];
      this.breadcrumbs = [
        { label: 'Home', url: '/home' },
        { label: 'Analysis', active: true }
      ];
    } else {
      this.moduleTitle = '';
      this.moduleIcon = '';
      this.breadcrumbs = [];
      this.navTabs = [];
    }
  }

  isTabActive(tabUrl: string): boolean {
    return this.currentUrl === tabUrl;
  }
}
