import { Component } from '@angular/core';
import { SupabaseService } from '../../service/supabase.service';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  email = '';
  password = '';
  error = '';
  loading = false;

  constructor(private supabase: SupabaseService, private router: Router) {
    localStorage.setItem('userLog', 'false');
  }

  async login() {
    this.loading = true;
    this.error = '';
    const { error } = await this.supabase.getClient().auth.signInWithPassword({
      email: this.email,
      password: this.password
    });
    this.loading = false;
    if (error) {
      this.error = error.message;
    } else {
      localStorage.setItem('userEmail', this.email);
      localStorage.setItem('userLog', 'true');
      this.router.navigate(['/home']);
    }
  }
}
