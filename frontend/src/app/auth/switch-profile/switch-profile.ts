import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, BrowserProfile } from '../../core/auth/auth.service';
import { authErrorMessage } from '../../core/auth/auth-error-message';

@Component({
  selector: 'app-switch-profile',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="switch-profile-page">
      <div class="switch-profile-card">
        <header class="switch-profile-header">
          <h1>Switch profile</h1>
          <p>Choose a saved profile or add another one through the login page.</p>
        </header>

        @if (message()) {
          <p class="switch-profile-message">{{ message() }}</p>
        }

        @if (auth.browserProfiles().length) {
          <div class="switch-profile-list">
            @for (profile of auth.browserProfiles(); track profile.profile_key) {
              <button
                type="button"
                class="switch-profile-item"
                [class.switch-profile-item--active]="isActiveProfile(profile.profile_key)"
                [disabled]="loading()"
                (click)="switchToProfile(profile.profile_key)"
              >
                <span
                  class="switch-profile-item__avatar"
                  [style.background]="profile.avatar_color || '#5B8DEF'"
                >
                  {{ profile.avatar_initials || profileLabel(profile).slice(0, 2).toUpperCase() }}
                </span>
                <span class="switch-profile-item__text">
                  <span class="switch-profile-item__name">{{ profileLabel(profile) }}</span>
                  <span class="switch-profile-item__email">{{ profile.email || 'No email' }}</span>
                </span>
                <span class="switch-profile-item__status">
                  @if (selectedProfileKey() === profile.profile_key && loading()) {
                    Opening…
                  } @else {
                    {{ profileStatus(profile.profile_key) }}
                  }
                </span>
              </button>
            }
          </div>
        } @else {
          <p class="switch-profile-empty">No saved profiles in this browser yet.</p>
        }

        <div class="switch-profile-actions">
          <button type="button" class="switch-profile-action" (click)="openAddAnotherProfile()">
            <span class="switch-profile-action__icon" aria-hidden="true">
              <svg viewBox="0 0 640 640" focusable="false">
                <path d="M285.7 368C384.2 368 464 447.8 464 546.3C464 562.7 450.7 576 434.3 576L77.7 576C61.3 576 48 562.7 48 546.3C48 447.8 127.8 368 226.3 368L285.7 368zM528 144C541.3 144 552 154.7 552 168L552 216L600 216C613.3 216 624 226.7 624 240C624 253.3 613.3 264 600 264L552 264L552 312C552 325.3 541.3 336 528 336C514.7 336 504 325.3 504 312L504 264L456 264C442.7 264 432 253.3 432 240C432 226.7 442.7 216 456 216L504 216L504 168C504 154.7 514.7 144 528 144zM256 312C189.7 312 136 258.3 136 192C136 125.7 189.7 72 256 72C322.3 72 376 125.7 376 192C376 258.3 322.3 312 256 312z"/>
              </svg>
            </span>
            <span class="switch-profile-action__label">Add another profile</span>
          </button>
          <button
            type="button"
            class="switch-profile-action"
            [disabled]="loading()"
            (click)="clearBrowserSessions()"
          >
            <span class="switch-profile-action__icon" aria-hidden="true">
              <svg viewBox="0 0 640 640" focusable="false">
                <path d="M496 272C418.5 272 351.7 317.9 321.4 384L320 384L256 384C208.6 384 167.1 409.8 145 448.2C180.2 487.4 231.2 512 288 512C295.4 512 302.6 511.6 309.7 510.8C315.2 532.7 324.5 553.2 336.8 571.4C321 574.4 304.7 576 288 576C146.6 576 32 461.4 32 320C32 178.6 146.6 64 288 64C414.8 64 520.1 156.2 540.4 277.2C526.1 273.8 511.3 272 496 272zM288 336C327.8 336 360 303.8 360 264C360 224.2 327.8 192 288 192C248.2 192 216 224.2 216 264C216 303.8 248.2 336 288 336zM496 320C575.5 320 640 384.5 640 464C640 543.5 575.5 608 496 608C416.5 608 352 543.5 352 464C352 384.5 416.5 320 496 320zM555.3 427.3C561.5 421.1 561.5 410.9 555.3 404.7C549.1 398.5 538.9 398.5 532.7 404.7L496 441.4L459.3 404.7C453.1 398.5 442.9 398.5 436.7 404.7C430.5 410.9 430.5 421.1 436.7 427.3L473.4 464L436.7 500.7C430.5 506.9 430.5 517.1 436.7 523.3C442.9 529.5 453.1 529.5 459.3 523.3L496 486.6L532.7 523.3C538.9 529.5 549.1 529.5 555.3 523.3C561.5 517.1 561.5 506.9 555.3 500.7L518.6 464L555.3 427.3z"/>
              </svg>
            </span>
            <span class="switch-profile-action__label">
              @if (loading() && clearingSessions()) {
                Clearing…
              } @else {
                Delete all sessions in browser
              }
            </span>
          </button>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .switch-profile-page {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        min-height: 100%;
        padding: 2rem;
        box-sizing: border-box;
      }
      .switch-profile-card {
        width: min(100%, 420px);
        padding: 1.5rem;
        border: 1px solid var(--border-color, #e0e0e0);
        border-radius: 12px;
        background: var(--bg-color, #fff);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
      }
      .switch-profile-header h1 {
        margin: 0;
        font-size: 1.35rem;
      }
      .switch-profile-header p,
      .switch-profile-empty,
      .switch-profile-message {
        margin: 0.5rem 0 0;
        color: var(--text-muted, #666);
        line-height: 1.45;
      }
      .switch-profile-list {
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
        margin-top: 1.25rem;
      }
      .switch-profile-item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        width: 100%;
        padding: 0.8rem 0.9rem;
        border: 1px solid var(--border-color, #e0e0e0);
        border-radius: 10px;
        background: transparent;
        text-align: left;
        cursor: pointer;
      }
      .switch-profile-item:hover,
      .switch-profile-action:hover {
        background: var(--hover-bg, #f3f4f6);
      }
      .switch-profile-item--active {
        border-color: var(--focus-color, #1976d2);
      }
      .switch-profile-item__avatar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2.15rem;
        height: 2.15rem;
        border-radius: 999px;
        color: #fff;
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: uppercase;
        flex: 0 0 2.15rem;
      }
      .switch-profile-item__text {
        display: flex;
        flex-direction: column;
        min-width: 0;
        flex: 1;
      }
      .switch-profile-item__name {
        font-size: 0.95rem;
        font-weight: 600;
      }
      .switch-profile-item__email {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--text-muted, #666);
        font-size: 0.82rem;
      }
      .switch-profile-item__status {
        color: var(--text-muted, #666);
        font-size: 0.8rem;
        white-space: nowrap;
      }
      .switch-profile-actions {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        margin-top: 1.5rem;
      }
      .switch-profile-action {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        width: 100%;
        padding: 0.8rem 0.9rem;
        border: 1px solid var(--border-color, #ddd);
        border-radius: 10px;
        background: transparent;
        color: var(--text-color, #111);
        font-size: 0.92rem;
        text-align: left;
        cursor: pointer;
      }
      .switch-profile-action__icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1rem;
        height: 1rem;
        flex: 0 0 1rem;
      }
      .switch-profile-action__icon svg {
        width: 100%;
        height: 100%;
        fill: currentColor;
      }
      .switch-profile-action__label {
        flex: 1;
      }
      button:disabled {
        opacity: 0.65;
        cursor: not-allowed;
      }
    `,
  ],
})
export class SwitchProfileComponent {
  readonly loading = signal(false);
  readonly clearingSessions = signal(false);
  readonly message = signal<string | null>(null);
  readonly selectedProfileKey = signal<string | null>(null);

  constructor(
    public auth: AuthService,
    private router: Router
  ) {
    this.auth.initialize();
    this.auth.reloadBrowserProfiles().subscribe();
  }

  isActiveProfile(profileKey: string): boolean {
    return this.auth.activeProfileKey() === profileKey;
  }

  profileStatus(profileKey: string): string {
    if (this.isActiveProfile(profileKey) && this.auth.isAuthenticated()) {
      return 'Current';
    }
    if (!this.auth.isAuthenticated()) {
      return 'Logged Out';
    }
    return 'Open';
  }

  profileLabel(profile: BrowserProfile): string {
    return profile.nickname || profile.email || 'Profile';
  }

  switchToProfile(profileKey: string): void {
    if (this.loading()) return;
    if (this.isActiveProfile(profileKey) && this.auth.isAuthenticated()) {
      void this.router.navigate([this.auth.needsOnboarding() ? '/onboarding' : '/home']);
      return;
    }

    this.loading.set(true);
    this.clearingSessions.set(false);
    this.message.set(null);
    this.selectedProfileKey.set(profileKey);
    this.auth.switchToProfile(profileKey).subscribe({
      next: (user) => {
        this.loading.set(false);
        this.selectedProfileKey.set(null);
        void this.router.navigate([user.profile_completed ? '/home' : '/onboarding']);
      },
      error: (err) => {
        this.loading.set(false);
        this.selectedProfileKey.set(null);
        this.auth.reloadBrowserProfiles().subscribe();
        this.message.set(
          authErrorMessage(err?.error?.error ?? err?.message, 'Could not switch profile')
        );
      },
    });
  }

  openAddAnotherProfile(): void {
    void this.router.navigate(['/login'], { queryParams: { addAccount: '1' } });
  }

  clearBrowserSessions(): void {
    if (this.loading()) return;
    const confirmed = window.confirm(
      'Delete all saved browser sessions? This will sign out every saved profile on this device.'
    );
    if (!confirmed) return;

    this.loading.set(true);
    this.clearingSessions.set(true);
    this.message.set(null);
    this.selectedProfileKey.set(null);
    this.auth.clearBrowserProfiles().subscribe({
      next: () => {
        this.loading.set(false);
        this.clearingSessions.set(false);
        this.message.set('All browser sessions were removed.');
      },
      error: (err) => {
        this.loading.set(false);
        this.clearingSessions.set(false);
        this.message.set(
          authErrorMessage(err?.error?.error ?? err?.message, 'Could not clear browser sessions')
        );
      },
    });
  }
}
