import { Component, OnInit, OnDestroy, HostListener, ElementRef } from '@angular/core';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../service/theme.service';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent implements OnInit, OnDestroy {
  currentUrl: string = '';
  activeModuleTitle: string = '';
  userEmail: string = 'admin@lonex.lk';
  userInitials: string = 'LX';
  
  isUserDropdownOpen: boolean = false;
  isNotificationsOpen: boolean = false;
  unreadNotificationsCount: number = 0; // Note: Notifications backend integration pending in Stage 2

  private routerSub!: Subscription;

  constructor(
    private router: Router,
    public themeService: ThemeService,
    private elementRef: ElementRef
  ) {}

  ngOnInit(): void {
    this.currentUrl = this.router.url;
    this.updateActiveModule(this.currentUrl);
    this.loadUserData();

    this.routerSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.currentUrl = event.urlAfterRedirects;
        this.updateActiveModule(this.currentUrl);
        this.isUserDropdownOpen = false;
        this.isNotificationsOpen = false;
      });
  }

  ngOnDestroy(): void {
    if (this.routerSub) {
      this.routerSub.unsubscribe();
    }
  }

  private loadUserData(): void {
    const email = localStorage.getItem('userEmail');
    if (email && email.trim().length > 0) {
      this.userEmail = email;
      const parts = email.split('@')[0].split(/[._-]/);
      if (parts.length >= 2) {
        this.userInitials = (parts[0][0] + parts[1][0]).toUpperCase();
      } else {
        this.userInitials = email.slice(0, 2).toUpperCase();
      }
    } else {
      this.userEmail = 'admin@lonex.lk';
      this.userInitials = 'LX';
    }
  }

  private updateActiveModule(url: string): void {
    if (url.startsWith('/member') || url.startsWith('/add-member') || url.startsWith('/single-member')) {
      this.activeModuleTitle = 'Customers';
    } else if (url.startsWith('/loan') || url.startsWith('/add-loan') || url.startsWith('/single-loan') || url.startsWith('/add-payments')) {
      this.activeModuleTitle = 'Loans';
    } else if (url.startsWith('/profit')) {
      this.activeModuleTitle = 'Finance';
    } else if (url.startsWith('/profile')) {
      this.activeModuleTitle = 'Settings';
    } else {
      this.activeModuleTitle = '';
    }
  }

  get isHome(): boolean {
    return this.currentUrl === '/home' || this.currentUrl === '/';
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  toggleUserDropdown(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.isUserDropdownOpen = !this.isUserDropdownOpen;
    if (this.isUserDropdownOpen) {
      this.isNotificationsOpen = false;
    }
  }

  toggleNotifications(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.isNotificationsOpen = !this.isNotificationsOpen;
    if (this.isNotificationsOpen) {
      this.isUserDropdownOpen = false;
    }
  }

  closeDropdowns(): void {
    this.isUserDropdownOpen = false;
    this.isNotificationsOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.closeDropdowns();
    }
  }

  logout(): void {
    this.closeDropdowns();
    localStorage.setItem('userLog', 'false');
    localStorage.removeItem('userEmail');
    this.router.navigate(['/login']);
  }
}
