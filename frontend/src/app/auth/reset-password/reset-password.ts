import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="reset-page">
      <div class="reset-card">
        <h1>Reset password</h1>
        <p>
          Choose a new password for your account.
        </p>

        @if (!token()) {
          <p class="reset-error">Reset token is missing. Open the link from your email again.</p>
        } @else {
          <form class="reset-form" (ngSubmit)="submit()">
            <label for="password">New password</label>
            <input
              id="password"
              type="password"
              [(ngModel)]="password"
              name="password"
              autocomplete="new-password"
              autofocus
            />

            <label for="confirmPassword">Confirm password</label>
            <input
              id="confirmPassword"
              type="password"
              [(ngModel)]="confirmPassword"
              name="confirmPassword"
              autocomplete="new-password"
            />

            @if (error()) {
              <p class="reset-error">{{ error() }}</p>
            }

            <button type="submit" [disabled]="loading() || !canSubmit()">
              @if (loading()) {
                Saving…
              } @else {
                Update password
              }
            </button>
          </form>
        }

        <a routerLink="/login" class="reset-link">Back to sign in</a>
      </div>
    </section>
  `,
  styles: [
    `
      .reset-page {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        min-height: 100%;
        padding: 2rem;
        box-sizing: border-box;
      }
      .reset-card {
        width: min(100%, 380px);
        padding: 1.5rem;
        border: 1px solid var(--border-color, #e0e0e0);
        border-radius: 10px;
        background: var(--bg-color, #fff);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
      }
      h1 {
        margin: 0 0 0.5rem;
        font-size: 1.25rem;
      }
      p {
        margin: 0 0 1rem;
        color: var(--text-muted, #666);
        font-size: 0.9rem;
        line-height: 1.4;
      }
      .reset-form {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
      }
      label {
        font-size: 0.8125rem;
        font-weight: 500;
      }
      input {
        padding: 0.6rem 0.75rem;
        border: 1px solid var(--border-color, #e0e0e0);
        border-radius: 6px;
        font-size: 0.9375rem;
      }
      button {
        margin-top: 0.5rem;
        padding: 0.55rem 0.9rem;
        border: none;
        border-radius: 6px;
        background: var(--focus-color, #1976d2);
        color: #fff;
        cursor: pointer;
      }
      button:disabled {
        opacity: 0.65;
        cursor: not-allowed;
      }
      .reset-error {
        margin: 0;
        color: var(--error-color, #c62828);
        font-size: 0.8125rem;
      }
      .reset-link {
        display: inline-block;
        margin-top: 1rem;
        color: var(--focus-color, #1976d2);
        text-decoration: none;
        font-size: 0.875rem;
      }
      .reset-link:hover {
        text-decoration: underline;
      }
    `,
  ],
})
export class ResetPasswordComponent {
  password = '';
  confirmPassword = '';
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly token = signal('');
  readonly canSubmit = computed(
    () =>
      this.password.length >= 8 &&
      this.password === this.confirmPassword &&
      !!this.token().trim()
  );

  constructor(
    route: ActivatedRoute,
    private auth: AuthService,
    private router: Router
  ) {
    this.auth.initialize();
    this.token.set(route.snapshot.queryParamMap.get('token') ?? '');
  }

  submit(): void {
    if (this.loading() || !this.canSubmit()) return;

    this.loading.set(true);
    this.error.set(null);
    this.auth.resetPassword(this.token().trim(), this.password).subscribe({
      next: (user) => {
        this.loading.set(false);
        this.router.navigate([user.profile_completed ? '/home' : '/onboarding']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error ?? err?.message ?? 'Could not reset password');
      },
    });
  }
}
