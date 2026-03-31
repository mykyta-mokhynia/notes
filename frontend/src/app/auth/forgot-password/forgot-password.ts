import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService, ForgotPasswordResponse } from '../../core/auth/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="reset-page">
      <div class="reset-card">
        <h1>Forgot password</h1>
        <p>
          Enter your email and we will send password reset instructions.
        </p>

        <form class="reset-form" (ngSubmit)="submit()">
          <label for="email">Email</label>
          <input
            id="email"
            type="email"
            [(ngModel)]="email"
            name="email"
            autocomplete="email"
            autofocus
          />

          @if (error()) {
            <p class="reset-error">{{ error() }}</p>
          }

          @if (success()) {
            <p class="reset-success">
              If an account exists for this email, password reset instructions have been sent.
            </p>
          }

          @if (previewUrl()) {
            <p class="reset-preview-label">Development preview link:</p>
            <a [href]="previewUrl()" class="reset-preview-link">{{ previewUrl() }}</a>
          }

          <button type="submit" [disabled]="loading() || !email.trim()">
            @if (loading()) {
              Sending…
            } @else {
              Send reset link
            }
          </button>
        </form>

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
      .reset-success {
        margin: 0;
        color: #2e7d32;
        font-size: 0.8125rem;
      }
      .reset-preview-label {
        margin: 0.25rem 0 0;
        font-size: 0.8125rem;
        color: var(--text-muted, #666);
      }
      .reset-preview-link,
      .reset-link {
        color: var(--focus-color, #1976d2);
        text-decoration: none;
        font-size: 0.875rem;
        word-break: break-word;
      }
      .reset-preview-link:hover,
      .reset-link:hover {
        text-decoration: underline;
      }
      .reset-link {
        display: inline-block;
        margin-top: 1rem;
      }
    `,
  ],
})
export class ForgotPasswordComponent {
  email = '';
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal(false);
  readonly previewUrl = signal<string | null>(null);

  constructor(private auth: AuthService) {
    this.auth.initialize();
  }

  submit(): void {
    if (this.loading()) return;
    const email = this.email.trim();
    if (!email) return;

    this.loading.set(true);
    this.error.set(null);
    this.success.set(false);
    this.previewUrl.set(null);

    this.auth.requestPasswordReset(email).subscribe({
      next: (response: ForgotPasswordResponse | null) => {
        this.loading.set(false);
        this.success.set(true);
        this.previewUrl.set(response?.reset_url ?? null);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error ?? err?.message ?? 'Could not start reset flow');
      },
    });
  }
}
