import { Component, signal } from '@angular/core';
import { Router, RouterOutlet, RouterLink } from '@angular/router';
import { SearchBarComponent } from './search-bar/search-bar';
import { AuthService } from './core/auth/auth.service';

type AppTheme = 'light' | 'dark';
type ThemePreference = AppTheme | 'system';

const THEME_STORAGE_KEY = 'notes-theme';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, SearchBarComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly profileMenuOpen = signal(false);
  readonly themeModalOpen = signal(false);
  readonly theme = signal<AppTheme>('light');
  readonly themePreference = signal<ThemePreference>('system');

  constructor(
    public auth: AuthService,
    private router: Router
  ) {
    this.auth.initialize();
    this.initializeTheme();
  }

  isCenteredAuthPage(): boolean {
    const url = this.router.url.split('?')[0];
    return (
      url === '/login' ||
      url === '/switch-profile' ||
      url === '/account' ||
      url === '/forgot-password' ||
      url === '/reset-password' ||
      url === '/onboarding'
    );
  }

  isModalAuthPage(): boolean {
    const url = this.router.url.split('?')[0];
    return url === '/login' || url === '/switch-profile';
  }

  toggleProfileMenu(): void {
    this.profileMenuOpen.update((value) => {
      if (value) {
        this.themeModalOpen.set(false);
      }
      return !value;
    });
  }

  closeProfileMenu(): void {
    this.profileMenuOpen.set(false);
    this.themeModalOpen.set(false);
  }

  openAccount(): void {
    this.closeProfileMenu();
    void this.router.navigate(['/account']);
  }

  openProfileSwitcher(): void {
    this.closeProfileMenu();
    this.navigateToProfileScreen('switch-profile');
  }

  openThemeModal(): void {
    this.themeModalOpen.update((value) => !value);
  }

  closeThemeModal(): void {
    this.themeModalOpen.set(false);
  }

  setTheme(theme: ThemePreference): void {
    this.themePreference.set(theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    this.applyTheme(theme);
  }

  isThemeSelected(theme: ThemePreference): boolean {
    return this.themePreference() === theme;
  }

  logout(): void {
    this.closeProfileMenu();
    this.auth.logout().subscribe(() => {
      void this.router.navigate(['/login']);
    });
  }

  viewerLabel(): string {
    const user = this.auth.user();
    return user?.nickname || user?.email || 'Guest';
  }

  viewerEmail(): string {
    return this.auth.user()?.email || 'No email';
  }

  viewerInitials(): string {
    return this.auth.user()?.avatar_initials || this.viewerLabel().slice(0, 2).toUpperCase();
  }

  viewerAvatarStyle(): string | null {
    const color = this.auth.user()?.avatar_color;
    return color ? `background:${color}` : null;
  }

  private initializeTheme(): void {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    const preference: ThemePreference =
      stored === 'light' || stored === 'dark' || stored === 'system'
        ? stored
        : 'system';

    this.themePreference.set(preference);
    this.applyTheme(preference);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', () => {
      if (this.themePreference() === 'system') {
        this.applyTheme('system');
      }
    });
  }

  private applyTheme(preference: ThemePreference): void {
    const resolvedTheme: AppTheme =
      preference === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : preference;

    this.theme.set(resolvedTheme);
    document.documentElement.dataset['theme'] = resolvedTheme;
  }

  private navigateToProfileScreen(
    path: 'login' | 'switch-profile',
    queryParams?: Record<string, string>
  ): void {
    if (!this.auth.isGuest()) {
      void this.router.navigate([`/${path}`], { queryParams });
      return;
    }

    const confirmed = window.confirm(
      'Switching away from guest will delete the current guest session from this browser. Continue?'
    );
    if (!confirmed) {
      return;
    }

    this.auth.logout().subscribe(() => {
      void this.router.navigate([`/${path}`], { queryParams });
    });
  }
}
