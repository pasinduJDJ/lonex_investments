import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../service/theme.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent {
  constructor(
    private router: Router,
    public themeService: ThemeService
  ) {}

  toggleTheme() {
    this.themeService.toggleTheme();
  }

  logout() {
    localStorage.setItem('userLog', 'false');
    localStorage.removeItem('userEmail');
    this.router.navigate(['/login']);
  }
}
