import {
  AfterViewInit,
  AfterViewChecked,
  Component,
  ElementRef,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { GoogleAuthService } from '../../core/auth/google-auth.service';
import { authErrorMessage } from '../../core/auth/auth-error-message';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="account-page">
      <div class="account-card">
        <header class="account-header">
          <h1>Account</h1>
          <p>Manage your public profile, password, and Google connection.</p>
        </header>

        <section class="account-section">
          <h2>Profile</h2>
          <form class="account-form" (ngSubmit)="saveProfile()">
            <label for="nickname">Nickname</label>
            <input
              id="nickname"
              type="text"
              [(ngModel)]="nickname"
              name="nickname"
              autocomplete="nickname"
            />

            @if (profileMessage()) {
              <p class="account-message">{{ profileMessage() }}</p>
            }

            <button type="submit" [disabled]="profileLoading() || nickname.trim().length < 2">
              @if (profileLoading()) {
                Saving…
              } @else {
                Save profile
              }
            </button>
          </form>
        </section>

        <section class="account-section">
          <h2>Security</h2>
          <form class="account-form" (ngSubmit)="savePassword()">
            @if (auth.user()?.has_password) {
              <label for="currentPassword">Current password</label>
              <input
                id="currentPassword"
                type="password"
                [(ngModel)]="currentPassword"
                name="currentPassword"
                autocomplete="current-password"
              />
            }

            <label for="newPassword">
              {{ auth.user()?.has_password ? 'New password' : 'Create password' }}
            </label>
            <input
              id="newPassword"
              type="password"
              [(ngModel)]="newPassword"
              name="newPassword"
              autocomplete="new-password"
            />

            <label for="confirmPassword">Confirm password</label>
            <input
              id="confirmPassword"
              type="password"
              [(ngModel)]="confirmPassword"
              name="confirmPassword"
              autocomplete="new-password"
            />

            @if (passwordMessage()) {
              <p class="account-message">{{ passwordMessage() }}</p>
            }

            <button
              type="submit"
              [disabled]="passwordLoading() || !canSubmitPassword()"
            >
              @if (passwordLoading()) {
                Updating…
              } @else {
                {{ auth.user()?.has_password ? 'Update password' : 'Set password' }}
              }
            </button>
          </form>

        </section>

        <section class="account-section">
          <h2>Google</h2>
          @if (googleMessage()) {
            <p class="account-message">{{ googleMessage() }}</p>
          }

          @if (auth.user()?.has_google) {
            <p class="account-copy">Your account is linked to Google.</p>
            <button
              type="button"
              class="account-secondary"
              [disabled]="googleLoading()"
              (click)="unlinkGoogle()"
            >
              Unlink Google
            </button>
            @if (!auth.user()?.has_password) {
              <p class="account-copy">
                Create a password before unlinking Google.
              </p>
            }
          } @else if (googleAvailable()) {
            <p class="account-copy">
              Link your Google account to sign in without entering a password.
            </p>
            <div #googleButtonHost class="google-button-host"></div>
          } @else {
            <p class="account-copy">
              {{ googleStatusMessage() }}
            </p>
          }
        </section>
      </div>
    </section>
  `,
  styles: [
    `
      .account-page {
        display: flex;
        justify-content: center;
        width: 100%;
        padding: 2rem;
        box-sizing: border-box;
      }
      .account-card {
        width: min(100%, 640px);
        border: 1px solid var(--border-color, #e0e0e0);
        border-radius: 12px;
        background: var(--bg-color, #fff);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
        overflow: hidden;
      }
      .account-header,
      .account-section {
        padding: 1.5rem;
      }
      .account-section + .account-section {
        border-top: 1px solid var(--border-color, #ececec);
      }
      h1,
      h2 {
        margin: 0 0 0.5rem;
      }
      .account-header p,
      .account-copy {
        margin: 0;
        color: var(--text-muted, #666);
        line-height: 1.5;
      }
      .account-form {
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
      }
      label {
        font-size: 0.8125rem;
        font-weight: 500;
      }
      input {
        padding: 0.65rem 0.8rem;
        border: 1px solid var(--border-color, #ddd);
        border-radius: 8px;
        font-size: 0.9375rem;
      }
      button {
        width: fit-content;
        margin-top: 0.35rem;
        padding: 0.55rem 0.9rem;
        border: none;
        border-radius: 8px;
        background: var(--focus-color, #1976d2);
        color: #fff;
        cursor: pointer;
      }
      button:disabled {
        opacity: 0.65;
        cursor: not-allowed;
      }
      .account-secondary {
        background: transparent;
        color: var(--text-color, #111);
        border: 1px solid var(--border-color, #ddd);
      }
      .account-message {
        margin: 0;
        font-size: 0.85rem;
        color: var(--text-muted, #666);
      }
      .google-button-host {
        margin-top: 0.9rem;
        min-height: 40px;
      }
    `,
  ],
})
export class AccountComponent implements AfterViewInit, AfterViewChecked {
  @ViewChild('googleButtonHost') googleButtonHost?: ElementRef<HTMLDivElement>;

  protected readonly auth = inject(AuthService);

  nickname = this.auth.user()?.nickname ?? '';
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  readonly googleConfigured = inject(GoogleAuthService).isConfigured();
  readonly profileLoading = signal(false);
  readonly passwordLoading = signal(false);
  readonly googleLoading = signal(false);
  readonly googleButtonAttempted = signal(false);
  readonly profileMessage = signal<string | null>(null);
  readonly passwordMessage = signal<string | null>(null);
  readonly googleMessage = signal<string | null>(null);

  private readonly googleAuth = inject(GoogleAuthService);

  ngAfterViewInit(): void {
    this.scheduleGoogleButtonRender();
  }

  ngAfterViewChecked(): void {
    this.scheduleGoogleButtonRender();
  }

  googleAvailable(): boolean {
    return this.googleConfigured && this.auth.googleAuthEnabled() === true;
  }

  googleStatusMessage(): string {
    const backendConfigured = this.auth.googleAuthEnabled();
    if (this.googleButtonAttempted() && !this.auth.user()?.has_google) {
      return 'Google sign in is configured but the Google Identity script could not be loaded.';
    }
    if (this.googleConfigured && backendConfigured === false) {
      return 'Google client ID is set in the frontend, but Google sign in is disabled on the server.';
    }
    if (!this.googleConfigured && backendConfigured === true) {
      return 'Google sign in is enabled on the server, but the frontend environment is missing the Google client ID.';
    }
    if (backendConfigured === null) {
      return 'Checking Google sign-in availability...';
    }
    return 'Google sign in will appear here when the Google client ID is configured in both frontend and backend.';
  }

  saveProfile(): void {
    const nickname = this.nickname.trim();
    if (nickname.length < 2 || this.profileLoading()) return;

    this.profileLoading.set(true);
    this.profileMessage.set(null);
    this.auth.updateProfile(nickname).subscribe({
      next: () => {
        this.profileLoading.set(false);
        this.nickname = this.auth.user()?.nickname ?? nickname;
        this.profileMessage.set('Profile updated.');
      },
      error: (err) => {
        this.profileLoading.set(false);
        this.profileMessage.set(authErrorMessage(err?.error?.error, 'Could not update profile'));
      },
    });
  }

  canSubmitPassword(): boolean {
    return (
      this.newPassword.length >= 8 &&
      this.newPassword === this.confirmPassword &&
      (!this.auth.user()?.has_password || !!this.currentPassword)
    );
  }

  savePassword(): void {
    if (!this.canSubmitPassword() || this.passwordLoading()) return;

    this.passwordLoading.set(true);
    this.passwordMessage.set(null);
    this.auth
      .updatePassword(
        this.newPassword,
        this.auth.user()?.has_password ? this.currentPassword : undefined
      )
      .subscribe({
        next: () => {
          this.passwordLoading.set(false);
          this.currentPassword = '';
          this.newPassword = '';
          this.confirmPassword = '';
          this.passwordMessage.set('Password updated. Other sessions were signed out.');
        },
        error: (err) => {
          this.passwordLoading.set(false);
          this.passwordMessage.set(
            authErrorMessage(err?.error?.error, 'Could not update password')
          );
        },
      });
  }

  unlinkGoogle(): void {
    if (this.googleLoading()) return;
    this.googleLoading.set(true);
    this.googleMessage.set(null);
    this.auth.unlinkGoogleAccount().subscribe({
      next: () => {
        this.googleLoading.set(false);
        this.googleMessage.set('Google account unlinked.');
        this.googleButtonAttempted.set(false);
        queueMicrotask(() => {
          void this.setupGoogleButton();
        });
      },
      error: (err) => {
        this.googleLoading.set(false);
        this.googleMessage.set(authErrorMessage(err?.error?.error, 'Could not unlink Google'));
      },
    });
  }

  private async setupGoogleButton(): Promise<void> {
    const host = this.googleButtonHost?.nativeElement;
    if (!host || this.auth.user()?.has_google || !this.googleAvailable()) return;

    this.googleButtonAttempted.set(true);
    const rendered = await this.googleAuth.renderButton(host, (credential) => {
      this.linkGoogle(credential);
    });
    if (!rendered) {
      this.googleMessage.set('Google sign in is unavailable right now.');
    }
  }

  private linkGoogle(credential: string): void {
    if (this.googleLoading()) return;
    this.googleLoading.set(true);
    this.googleMessage.set(null);
    this.auth.linkGoogleAccount(credential).subscribe({
      next: () => {
        this.googleLoading.set(false);
        this.googleMessage.set('Google account linked.');
      },
      error: (err) => {
        this.googleLoading.set(false);
        this.googleMessage.set(authErrorMessage(err?.error?.error, 'Could not link Google'));
      },
    });
  }

  private scheduleGoogleButtonRender(): void {
    if (!this.googleAvailable() || this.auth.user()?.has_google || this.googleButtonAttempted()) {
      return;
    }
    queueMicrotask(() => {
      void this.setupGoogleButton();
    });
  }
}
