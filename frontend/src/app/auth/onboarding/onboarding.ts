import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="onboarding-page">
      <div class="onboarding-card">
        <h1>Finish your profile</h1>
        <p>
          Choose the nickname that will be shown in your profile and future comments.
        </p>

        <form (ngSubmit)="submit()" class="onboarding-form">
          <label for="nickname">Nickname</label>
          <input
            id="nickname"
            type="text"
            [(ngModel)]="nickname"
            name="nickname"
            autocomplete="nickname"
            autofocus
          />

          @if (error()) {
            <p class="onboarding-error">{{ error() }}</p>
          }

          <button type="submit" [disabled]="loading() || nickname.trim().length < 2">
            @if (loading()) {
              Saving…
            } @else {
              Continue
            }
          </button>
        </form>
      </div>
    </section>
  `,
  styles: [
    `
      .onboarding-page {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        min-height: 100%;
        padding: 2rem;
        box-sizing: border-box;
      }
      .onboarding-card {
        width: min(100%, 360px);
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
      .onboarding-form {
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
      .onboarding-error {
        margin: 0;
        color: var(--error-color, #c62828);
        font-size: 0.8125rem;
      }
    `,
  ],
})
export class OnboardingComponent {
  nickname = '';
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor(
    private auth: AuthService,
    private router: Router
  ) {
    this.auth.initialize();
  }

  submit(): void {
    if (this.loading()) return;
    const nickname = this.nickname.trim();
    if (nickname.length < 2) return;

    this.loading.set(true);
    this.error.set(null);
    this.auth.completeOnboarding(nickname).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/home']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error ?? err?.message ?? 'Could not save profile');
      },
    });
  }
}
