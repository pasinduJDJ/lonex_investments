import { Component, OnInit, OnDestroy, HostListener, ElementRef } from '@angular/core';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';

export interface BreadcrumbItem {
  label: string;
  url?: string;
  active?: boolean;
}

export interface ModuleNavTabChild {
  label: string;
  url: string;
  icon?: string;
}

export interface ModuleNavTab {
  label: string;
  url: string;
  icon?: string;
  isPrimary?: boolean;
  isDropdown?: boolean;
  children?: ModuleNavTabChild[];
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
  openDropdownTabUrl: string | null = null;

  private routerSub!: Subscription;

  constructor(
    private router: Router,
    private elementRef: ElementRef
  ) {}

  ngOnInit(): void {
    this.currentUrl = this.router.url;
    this.updateModuleNav(this.currentUrl);

    this.routerSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.currentUrl = event.urlAfterRedirects;
        this.updateModuleNav(this.currentUrl);
        this.openDropdownTabUrl = null;
      });
  }

  ngOnDestroy(): void {
    if (this.routerSub) {
      this.routerSub.unsubscribe();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.openDropdownTabUrl = null;
    }
  }

  toggleDropdown(tab: ModuleNavTab, event: MouseEvent): void {
    event.stopPropagation();
    if (this.openDropdownTabUrl === tab.url) {
      this.openDropdownTabUrl = null;
    } else {
      this.openDropdownTabUrl = tab.url;
    }
  }

  closeDropdown(): void {
    this.openDropdownTabUrl = null;
  }

  private updateModuleNav(url: string): void {
    if (url.startsWith('/member') || url.startsWith('/add-member') || url.startsWith('/single-member')) {
      this.moduleTitle = 'Customers';
      this.moduleIcon = 'bi-people-fill';
      this.navTabs = [
        { label: 'All Customers', url: '/member', icon: 'bi-people' },
        { label: 'Add Customer', url: '/add-member', icon: 'bi-person-plus', isPrimary: true },
        {
          label: 'Reports',
          url: '/member/reports',
          icon: 'bi-file-earmark-spreadsheet',
          isDropdown: true,
          children: [
            { label: 'Customer Master Report', url: '/member/reports/customer-master', icon: 'bi-person-lines-fill' },
            { label: 'Customer Loan Summary', url: '/member/reports/loan-summary', icon: 'bi-cash-stack' },
            { label: 'Customer Statement', url: '/member/reports/statement', icon: 'bi-person-badge' },
            { label: 'Guarantor Report', url: '/member/reports/guarantor', icon: 'bi-shield-check' }
          ]
        }
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
      } else if (url.startsWith('/member/reports')) {
        this.breadcrumbs.push({ label: 'Reports', url: '/member/reports', active: false });
        if (url.includes('customer-master')) {
          this.breadcrumbs.push({ label: 'Customer Master Report', active: true });
        } else if (url.includes('loan-summary')) {
          this.breadcrumbs.push({ label: 'Customer Loan Summary', active: true });
        } else if (url.includes('statement')) {
          this.breadcrumbs.push({ label: 'Customer Statement', active: true });
        } else if (url.includes('guarantor')) {
          this.breadcrumbs.push({ label: 'Guarantor Report', active: true });
        }
      }
    } else if (url.startsWith('/loan') || url.startsWith('/add-loan') || url.startsWith('/single-loan') || url.startsWith('/add-payments')) {
      this.moduleTitle = 'Loans';
      this.moduleIcon = 'bi-cash-coin';
      this.navTabs = [
        { label: 'All Loans', url: '/loan', icon: 'bi-card-list' },
        { label: 'Issue Loan', url: '/add-loan', icon: 'bi-plus-circle', isPrimary: true },
        { label: 'Add Payment', url: '/add-payments', icon: 'bi-cash-stack' },
        {
          label: 'Reports',
          url: '/loan/reports',
          icon: 'bi-file-earmark-spreadsheet',
          isDropdown: true,
          children: [
            { label: 'Loan History Report', url: '/loan/reports/loan-history', icon: 'bi-clock-history' },
            { label: 'Active Loans Report', url: '/loan/reports/active-loans', icon: 'bi-lightning-charge' },
            { label: 'Completed Loans Report', url: '/loan/reports/completed-loans', icon: 'bi-check2-circle' },
            { label: 'Delayed / Overdue Loans Report', url: '/loan/reports/overdue-loans', icon: 'bi-exclamation-triangle' },
            { label: 'Repayment Schedule Report', url: '/loan/reports/repayment-schedule', icon: 'bi-calendar-week' }
          ]
        }
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
      } else if (url.startsWith('/loan/reports')) {
        this.breadcrumbs.push({ label: 'Reports', url: '/loan/reports/loan-history', active: false });
        if (url.includes('loan-history')) {
          this.breadcrumbs.push({ label: 'Loan History Report', active: true });
        } else if (url.includes('active-loans')) {
          this.breadcrumbs.push({ label: 'Active Loans Report', active: true });
        } else if (url.includes('completed-loans')) {
          this.breadcrumbs.push({ label: 'Completed Loans Report', active: true });
        } else if (url.includes('overdue-loans')) {
          this.breadcrumbs.push({ label: 'Delayed / Overdue Loans Report', active: true });
        } else if (url.includes('repayment-schedule')) {
          this.breadcrumbs.push({ label: 'Repayment Schedule Report', active: true });
        }
      }
    } else if (url.startsWith('/profit') || url.startsWith('/transactions') || url.startsWith('/accounts') || url.startsWith('/finance')) {
      this.moduleTitle = 'Finance';
      this.moduleIcon = 'bi-wallet2';
      this.navTabs = [
        { label: 'Overview', url: '/profit', icon: 'bi-grid-1x2-fill' },
        { label: 'Transactions', url: '/transactions', icon: 'bi-journal-text' },
        { label: 'Accounts', url: '/accounts', icon: 'bi-bank2' },
        {
          label: 'Reports',
          url: '/finance/reports',
          icon: 'bi-file-earmark-spreadsheet',
          isDropdown: true,
          children: [
            { label: 'Account History Report', url: '/finance/reports/account-history', icon: 'bi-bank' },
            { label: 'Transaction History Report', url: '/finance/reports/transaction-history', icon: 'bi-journal-text' },
            { label: 'Income & Expense Report', url: '/finance/reports/income-expense', icon: 'bi-graph-up-arrow' },
            { label: 'Capital History Report', url: '/finance/reports/capital-history', icon: 'bi-cash-stack' },
            { label: 'Expense Report', url: '/finance/reports/expense', icon: 'bi-receipt' },
            { label: 'Cash / Account Movement Report', url: '/finance/reports/cash-movement', icon: 'bi-arrow-left-right' }
          ]
        }
      ];
      this.breadcrumbs = [
        { label: 'Home', url: '/home' },
        { label: 'Finance', url: url === '/profit' ? undefined : '/profit', active: url === '/profit' }
      ];
      if (url.startsWith('/transactions')) {
        this.breadcrumbs.push({ label: 'Transactions', active: true });
      } else if (url.startsWith('/accounts')) {
        this.breadcrumbs.push({ label: 'Accounts', active: true });
      } else if (url.startsWith('/finance/reports') || url.startsWith('/profit/reports')) {
        this.breadcrumbs.push({ label: 'Reports', url: '/finance/reports/account-history', active: false });
        if (url.includes('account-history')) {
          this.breadcrumbs.push({ label: 'Account History Report', active: true });
        } else if (url.includes('transaction-history')) {
          this.breadcrumbs.push({ label: 'Transaction History Report', active: true });
        } else if (url.includes('income-expense')) {
          this.breadcrumbs.push({ label: 'Income & Expense Report', active: true });
        } else if (url.includes('capital-history')) {
          this.breadcrumbs.push({ label: 'Capital History Report', active: true });
        } else if (url.includes('expense')) {
          this.breadcrumbs.push({ label: 'Expense Report', active: true });
        } else if (url.includes('cash-movement')) {
          this.breadcrumbs.push({ label: 'Cash / Account Movement Report', active: true });
        }
      }
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
        { label: 'Management Dashboard', url: '/analysis', icon: 'bi-speedometer2' },
        { label: 'Operational Overview', url: '/analysis/operational', icon: 'bi-grid-1x2-fill' },
        {
          label: 'Reports',
          url: '/analysis/reports',
          icon: 'bi-file-earmark-spreadsheet',
          isDropdown: true,
          children: [
            { label: 'Payment History Report', url: '/analysis/reports/payment-history', icon: 'bi-clock-history' },
            { label: 'Delayed Payment Report', url: '/analysis/reports/delayed-payments', icon: 'bi-exclamation-triangle' },
            { label: 'Collection Report', url: '/analysis/reports/collection', icon: 'bi-cash-coin' },
            { label: 'Upcoming Payments Report', url: '/analysis/reports/upcoming-payments', icon: 'bi-calendar-check' },
            { label: 'Payment Performance Report', url: '/analysis/reports/payment-performance', icon: 'bi-graph-up-arrow' }
          ]
        }
      ];
      this.breadcrumbs = [
        { label: 'Home', url: '/home' },
        { label: 'Analysis', url: '/analysis' }
      ];
      if (url.startsWith('/analysis/operational')) {
        this.breadcrumbs.push({ label: 'Operational Overview', active: true });
      } else if (url.startsWith('/analysis/reports')) {
        this.breadcrumbs.push({ label: 'Reports', url: '/analysis/reports/payment-history', active: false });
        if (url.includes('payment-history')) {
          this.breadcrumbs.push({ label: 'Payment History Report', active: true });
        } else if (url.includes('delayed-payments')) {
          this.breadcrumbs.push({ label: 'Delayed Payment Report', active: true });
        } else if (url.includes('collection')) {
          this.breadcrumbs.push({ label: 'Collection Report', active: true });
        } else if (url.includes('upcoming-payments')) {
          this.breadcrumbs.push({ label: 'Upcoming Payments Report', active: true });
        } else if (url.includes('payment-performance')) {
          this.breadcrumbs.push({ label: 'Payment Performance Report', active: true });
        }
      } else {
        this.breadcrumbs.push({ label: 'Management Dashboard', active: true });
      }
    } else {
      this.moduleTitle = '';
      this.moduleIcon = '';
      this.breadcrumbs = [];
      this.navTabs = [];
    }
  }

  isTabActive(tab: ModuleNavTab): boolean {
    const currentPath = this.currentUrl.split('?')[0];
    if (tab.isDropdown && tab.children) {
      return tab.children.some(c => currentPath.startsWith(c.url));
    }
    return currentPath === tab.url;
  }
}
