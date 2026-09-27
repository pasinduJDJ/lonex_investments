import { Injectable, signal, computed } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type ThemeMode = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  public static readonly STORAGE_KEY = 'lonex_theme_mode';

  private themeSubject: BehaviorSubject<ThemeMode>;
  public theme$: Observable<ThemeMode>;

  // Angular Signal for reactive bindings in templates
  public currentThemeSignal = signal<ThemeMode>('light');
  public isDark = computed(() => this.currentThemeSignal() === 'dark');

  constructor() {
    const initialTheme = this.resolveInitialTheme();
    this.themeSubject = new BehaviorSubject<ThemeMode>(initialTheme);
    this.theme$ = this.themeSubject.asObservable();
    this.currentThemeSignal.set(initialTheme);

    this.applyTheme(initialTheme);
    this.listenToSystemChanges();
  }

  /**
   * Determine initial theme preference from localStorage or OS setting.
   */
  private resolveInitialTheme(): ThemeMode {
    if (typeof window === 'undefined' || !window.localStorage) {
      return 'light';
    }

    try {
      const saved = localStorage.getItem(ThemeService.STORAGE_KEY) as ThemeMode | null;
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }

      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    } catch {
      // In case localStorage is blocked in certain sandbox environments
      return 'light';
    }

    return 'light';
  }

  /**
   * Sets the active theme ('light' | 'dark'), saves to localStorage, and updates DOM attributes.
   */
  public setTheme(theme: ThemeMode): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(ThemeService.STORAGE_KEY, theme);
      }
    } catch (e) {
      console.warn('Unable to persist theme to localStorage', e);
    }

    this.themeSubject.next(theme);
    this.currentThemeSignal.set(theme);
    this.applyTheme(theme);
  }

  /**
   * Toggles between light and dark themes.
   * Returns the newly active theme.
   */
  public toggleTheme(): ThemeMode {
    const nextTheme: ThemeMode = this.currentThemeSignal() === 'light' ? 'dark' : 'light';
    this.setTheme(nextTheme);
    return nextTheme;
  }

  /**
   * Gets current active theme string.
   */
  public get currentTheme(): ThemeMode {
    return this.currentThemeSignal();
  }

  /**
   * Returns boolean true if active theme is dark mode.
   */
  public isDarkMode(): boolean {
    return this.currentThemeSignal() === 'dark';
  }

  /**
   * Applies CSS data attributes and utility classes to root HTML element.
   */
  private applyTheme(theme: ThemeMode): void {
    if (typeof document === 'undefined') {
      return;
    }

    const root = document.documentElement;
    const body = document.body;

    // Set standard data-theme and Bootstrap 5 data-bs-theme
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-bs-theme', theme);

    if (theme === 'dark') {
      root.classList.add('theme-dark');
      root.classList.remove('theme-light');
      if (body) {
        body.classList.add('theme-dark');
        body.classList.remove('theme-light');
      }
    } else {
      root.classList.add('theme-light');
      root.classList.remove('theme-dark');
      if (body) {
        body.classList.add('theme-light');
        body.classList.remove('theme-dark');
      }
    }
  }

  /**
   * Syncs theme when OS appearance mode changes, unless user explicitly selected one.
   */
  private listenToSystemChanges(): void {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    try {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', (e) => {
        const saved = localStorage.getItem(ThemeService.STORAGE_KEY);
        if (!saved) {
          this.setTheme(e.matches ? 'dark' : 'light');
        }
      });
    } catch {
      // Ignore unsupported browsers
    }
  }
}
