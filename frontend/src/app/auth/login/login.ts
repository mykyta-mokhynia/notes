import {
  AfterViewInit,
  AfterViewChecked,
  Component,
  ElementRef,
  ViewChild,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { GoogleAuthService } from '../../core/auth/google-auth.service';
import { authErrorMessage } from '../../core/auth/auth-error-message';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="login-page">
      <div class="login-card">
        <div class="login-tabs">
          <button
            type="button"
            class="login-tab"
            [class.login-tab--active]="mode() === 'signin'"
            (click)="setMode('signin')"
          >
            Sign in
          </button>
          <button
            type="button"
            class="login-tab"
            [class.login-tab--active]="mode() === 'signup'"
            (click)="setMode('signup')"
          >
            Sign up
          </button>
        </div>

        <h1 class="login-title">
          {{ title() }}
        </h1>

        <p class="login-subtitle">
          {{ subtitle() }}
        </p>

        <form class="login-form" autocomplete="on" (ngSubmit)="submit()">
          <label class="login-label" for="email">Email</label>
          <input
            id="email"
            type="email"
            class="login-input"
            [(ngModel)]="email"
            name="email"
            autocomplete="username"
            inputmode="email"
            autofocus
          />

          <label class="login-label" for="password">Password</label>
          <input
            id="password"
            type="password"
            class="login-input"
            [(ngModel)]="password"
            name="password"
            [attr.autocomplete]="mode() === 'signup' ? 'new-password' : 'current-password'"
          />

          @if (error()) {
            <p class="login-error">{{ error() }}</p>
          }

          <div class="login-actions">
            <button
              type="submit"
              class="login-btn"
              [disabled]="loading() || !email.trim() || !password.trim()"
            >
              @if (loading()) {
                Working…
              } @else {
                {{ mode() === 'signup' ? 'Create account' : 'Sign in' }}
              }
            </button>
          </div>
        </form>

        @if (googleAvailable()) {
          <div class="google-divider"><span>or</span></div>
          <div #googleButtonHost class="google-button-host"></div>
        }

        <button
          type="button"
          class="guest-btn"
          [disabled]="loading()"
          (click)="continueAsGuest()"
        >
          Continue as guest
        </button>

        <a routerLink="/forgot-password" class="login-link">Forgot password?</a>
      </div>
    </section>
  `,
  styles: [
    `
      .login-page {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        min-height: 100%;
        padding: 2rem;
        box-sizing: border-box;
      }
      .login-card {
        width: min(100%, 360px);
        padding: 1.5rem;
        border: 1px solid var(--border-color, #e0e0e0);
        border-radius: 10px;
        background: var(--bg-color, #fff);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
      }
      .login-tabs {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.5rem;
        margin-bottom: 1rem;
      }
      .login-tab {
        padding: 0.55rem 0.75rem;
        border: 1px solid var(--border-color, #e0e0e0);
        border-radius: 999px;
        background: transparent;
        cursor: pointer;
      }
      .login-tab--active {
        border-color: var(--focus-color, #1976d2);
        color: var(--focus-color, #1976d2);
        font-weight: 600;
      }
      .login-title {
        margin: 0 0 0.5rem;
        font-size: 1.25rem;
      }
      .login-subtitle {
        margin: 0 0 1rem;
        color: var(--text-muted, #666);
        font-size: 0.9rem;
        line-height: 1.4;
      }
      .login-form {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .login-label {
        font-size: 0.8125rem;
        font-weight: 500;
      }
      .login-input {
        padding: 0.6rem 0.75rem;
        border: 1px solid var(--border-color, #e0e0e0);
        border-radius: 6px;
        font-size: 0.9375rem;
      }
      .login-error {
        margin: 0.25rem 0 0;
        font-size: 0.8125rem;
        color: var(--error-color, #c62828);
      }
      .login-actions {
        margin-top: 0.75rem;
      }
      .login-btn {
        width: 100%;
        padding: 0.55rem 0.9rem;
        border: none;
        border-radius: 6px;
        background: var(--focus-color, #1976d2);
        color: #fff;
        font-size: 0.875rem;
        cursor: pointer;
      }
      .login-btn:disabled {
        opacity: 0.65;
        cursor: not-allowed;
      }
      .guest-btn {
        width: 100%;
        margin-top: 0.75rem;
        min-height: 40px;
        padding: 0.625rem 0.9rem;
        border: 1px solid #d9dce1;
        border-radius: 999px;
        background: #fff;
        color: #3c4043;
        font-size: 0.875rem;
        font-weight: 500;
        line-height: 1.2;
        cursor: pointer;
      }
      .guest-btn:hover {
        background: #f8f9fa;
      }
      .google-divider {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-top: 1rem;
        color: var(--text-muted, #666);
        font-size: 0.8rem;
      }
      .google-divider::before,
      .google-divider::after {
        content: '';
        flex: 1;
        height: 1px;
        background: var(--border-color, #e0e0e0);
      }
      .google-button-host {
        margin-top: 0.75rem;
        min-height: 40px;
      }
      .login-link {
        display: inline-block;
        margin-top: 0.75rem;
        color: var(--focus-color, #1976d2);
        text-decoration: none;
        font-size: 0.875rem;
      }
      .login-link:hover {
        text-decoration: underline;
      }
    `,
  ],
})
export class LoginComponent implements AfterViewInit, AfterViewChecked {
  @ViewChild('googleButtonHost') googleButtonHost?: ElementRef<HTMLDivElement>;

  email = '';
  password = '';
  readonly mode = signal<'signin' | 'signup'>('signin');
  readonly addAccountMode = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly googleButtonAttempted = signal(false);
  readonly title = computed(() => {
    if (this.addAccountMode()) {
      return 'Add another account';
    }
    return this.mode() === 'signup' ? 'Create your account' : 'Welcome back';
  });
  readonly subtitle = computed(() => {
    if (this.mode() === 'signup') {
      return 'Create a persistent account. You will choose a nickname on first login.';
    }
    if (this.addAccountMode()) {
      return 'Sign in to another account and keep your saved browser profiles available.';
    }
    return 'Sign in with your email and continue where you left off.';
  });

  constructor(
    public auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private googleAuth: GoogleAuthService
  ) {
    const queryParams = this.route.snapshot.queryParamMap;
    this.addAccountMode.set(queryParams.get('addAccount') === '1');
    this.auth.initialize();
  }

  get googleConfigured(): boolean {
    return this.googleAuth.isConfigured();
  }

  googleAvailable(): boolean {
    return this.googleConfigured && this.auth.googleAuthEnabled() === true;
  }

  ngAfterViewInit(): void {
    this.scheduleGoogleButtonRender();
  }

  ngAfterViewChecked(): void {
    this.scheduleGoogleButtonRender();
  }

  setMode(mode: 'signin' | 'signup'): void {
    this.mode.set(mode);
    this.error.set(null);
  }

  submit(): void {
    if (this.loading()) return;
    const email = this.email.trim();
    const password = this.password;
    if (!email || !password) return;
    const profileKey =
      this.addAccountMode() || !this.auth.isAuthenticated()
        ? this.auth.createProfileKey()
        : this.auth.activeProfileKey();
    if (!profileKey) return;

    this.loading.set(true);
    this.error.set(null);
    const request =
      this.mode() === 'signup'
        ? this.auth.register(email, password)
        : this.auth.login(email, password, profileKey);

    request.subscribe({
      next: (user) => {
        this.loading.set(false);
        this.router.navigate([user.profile_completed ? '/home' : '/onboarding']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(authErrorMessage(err?.error?.error ?? err?.message, 'Authentication failed'));
      },
    });
  }

  continueAsGuest(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    this.auth.continueAsGuest(this.auth.createProfileKey()).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/home']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(authErrorMessage(err?.error?.error ?? err?.message, 'Guest login failed'));
      },
    });
  }

  private async setupGoogleButton(): Promise<void> {
    const host = this.googleButtonHost?.nativeElement;
    if (!host) return;
    this.googleButtonAttempted.set(true);
    const rendered = await this.googleAuth.renderButton(host, (credential) => {
      this.loginWithGoogle(credential);
    });
    if (!rendered) {
      this.error.set('Google sign in is unavailable right now.');
    }
  }

  private scheduleGoogleButtonRender(): void {
    if (!this.googleAvailable() || this.googleButtonAttempted()) return;
    queueMicrotask(() => {
      void this.setupGoogleButton();
    });
  }

  private loginWithGoogle(credential: string): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    this.auth.loginWithGoogle(credential, this.auth.createProfileKey()).subscribe({
      next: (user) => {
        this.loading.set(false);
        this.router.navigate([user.profile_completed ? '/home' : '/onboarding']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(authErrorMessage(err?.error?.error ?? err?.message, 'Google sign in failed'));
      },
    });
  }
}
