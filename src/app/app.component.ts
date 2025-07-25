import { Component } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { HeaderComponent } from './shared/header/header.component';
import { FooterComponent } from "./shared/footer/footer.component";
import { filter } from 'rxjs/operators';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'lonex_investments';
  currentUrl = '';

  constructor(private router: Router) {
    this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe((event: any) => {
      this.currentUrl = event.urlAfterRedirects;
    });
  }

  get isLoginRoute(): boolean {
    return this.currentUrl === '/login' || this.currentUrl === '' || this.currentUrl === '/';
  }
}
