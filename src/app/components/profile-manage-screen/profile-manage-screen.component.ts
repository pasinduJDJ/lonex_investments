import { Component, OnInit } from '@angular/core';
import { SupabaseService } from '../../service/supabase.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ThemeService } from '../../service/theme.service';

@Component({
  selector: 'app-profile-manage-screen',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterModule],
  templateUrl: './profile-manage-screen.component.html',
  styleUrl: './profile-manage-screen.component.css'
})
export class ProfileManageScreenComponent implements OnInit {
  currentPassword = '';
  newPassword = '';
  loading = false;
  error = '';
  success = '';

  userEmail: string = 'admin@lonex.lk';
  userInitials: string = 'LX';
  activeTab: 'security' | 'preferences' | 'system' = 'security';
  
  showCurrentPassword = false;
  showNewPassword = false;

  constructor(
    private supabase: SupabaseService,
    public themeService: ThemeService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadUserData();
  }

  loadUserData(): void {
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

  setActiveTab(tab: 'security' | 'preferences' | 'system'): void {
    this.activeTab = tab;
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  async changePassword() {
    this.loading = true;
    this.error = '';
    this.success = '';
    
    // Re-authenticate user with current password
    const email = localStorage.getItem('userEmail') || this.userEmail || '';
    const { error: signInError } = await this.supabase.getClient().auth.signInWithPassword({
      email,
      password: this.currentPassword
    });
    
    if (signInError) {
      this.loading = false;
      this.error = 'Current password is incorrect. Please verify your credentials.';
      return;
    }
    
    // Update password
    const { error } = await this.supabase.getClient().auth.updateUser({ password: this.newPassword });
    this.loading = false;
    if (error) {
      this.error = error.message;
    } else {
      this.success = 'Password changed successfully!';
      this.currentPassword = '';
      this.newPassword = '';
    }
  }

  logout(): void {
    localStorage.setItem('userLog', 'false');
    localStorage.removeItem('userEmail');
    this.router.navigate(['/login']);
  }
}
