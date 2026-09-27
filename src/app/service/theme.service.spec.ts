import { TestBed } from '@angular/core/testing';
import { ThemeService, ThemeMode } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-bs-theme');
    document.documentElement.classList.remove('theme-dark', 'theme-light');

    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with default light theme or saved preference', () => {
    expect(['light', 'dark']).toContain(service.currentTheme);
  });

  it('should switch theme and update root attributes and localStorage', () => {
    service.setTheme('dark');
    expect(service.currentTheme).toBe('dark');
    expect(service.isDarkMode()).toBeTrue();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark');
    expect(document.documentElement.classList.contains('theme-dark')).toBeTrue();
    expect(localStorage.getItem(ThemeService.STORAGE_KEY)).toBe('dark');

    service.setTheme('light');
    expect(service.currentTheme).toBe('light');
    expect(service.isDarkMode()).toBeFalse();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('light');
    expect(document.documentElement.classList.contains('theme-light')).toBeTrue();
    expect(localStorage.getItem(ThemeService.STORAGE_KEY)).toBe('light');
  });

  it('should toggle theme between light and dark', () => {
    service.setTheme('light');
    const toggled = service.toggleTheme();
    expect(toggled).toBe('dark');
    expect(service.currentTheme).toBe('dark');

    const toggledBack = service.toggleTheme();
    expect(toggledBack).toBe('light');
    expect(service.currentTheme).toBe('light');
  });
});
