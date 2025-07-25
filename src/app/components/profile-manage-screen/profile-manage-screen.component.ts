import { Component } from '@angular/core';
import { SupabaseService } from '../../service/supabase.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-profile-manage-screen',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './profile-manage-screen.component.html',
  styleUrl: './profile-manage-screen.component.css'
})
export class ProfileManageScreenComponent {
  currentPassword = '';
  newPassword = '';
  loading = false;
  error = '';
  success = '';

  constructor(private supabase: SupabaseService) {}

  async changePassword() {
    this.loading = true;
    this.error = '';
    this.success = '';
    // Re-authenticate user with current password
    const email = localStorage.getItem('userEmail') || '';
    const { error: signInError } = await this.supabase.getClient().auth.signInWithPassword({
      email,
      password: this.currentPassword
    });
    if (signInError) {
      this.loading = false;
      this.error = 'Current password is incorrect.';
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
}
