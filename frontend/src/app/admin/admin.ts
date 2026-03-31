import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AdminCommentSummary,
  AdminService,
  AdminUserSummary,
} from '../core/api/admin.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="admin-page">
      <div class="admin-card">
        <header class="admin-header">
          <h1>Admin panel</h1>
          <p>Review users and moderate recent comments.</p>
        </header>

        @if (loading()) {
          <p class="admin-state">Loading admin data…</p>
        } @else if (error()) {
          <p class="admin-state admin-state--error">{{ error() }}</p>
        } @else {
          <section class="admin-section">
            <div class="admin-section-header">
              <h2>Users</h2>
              <span>{{ users().length }}</span>
            </div>
            <div class="admin-grid">
              @for (user of users(); track user.id) {
                <article class="admin-user-card">
                  <div
                    class="admin-avatar"
                    [style.background]="user.avatar_color || '#5B8DEF'"
                  >
                    {{ user.avatar_initials || (user.nickname || user.email || 'NA').slice(0, 2).toUpperCase() }}
                  </div>
                  <div class="admin-user-body">
                    <strong>{{ user.nickname || user.email || 'Guest' }}</strong>
                    <span>{{ user.role }}</span>
                    <span>{{ user.email || 'No email' }}</span>
                    <span>
                      {{ user.has_password ? 'Password' : 'No password' }} /
                      {{ user.has_google ? 'Google linked' : 'No Google' }}
                    </span>
                  </div>
                </article>
              }
            </div>
          </section>

          <section class="admin-section">
            <div class="admin-section-header">
              <h2>Recent comments</h2>
              <span>{{ comments().length }}</span>
            </div>
            @if (comments().length === 0) {
              <p class="admin-state">No comments yet.</p>
            } @else {
              <div class="admin-comments">
                @for (comment of comments(); track comment.id) {
                  <article class="admin-comment-card">
                    <div
                      class="admin-avatar"
                      [style.background]="comment.avatar_color"
                    >
                      {{ comment.avatar_initials }}
                    </div>
                    <div class="admin-comment-body">
                      <div class="admin-comment-meta">
                        <strong>{{ comment.nickname }}</strong>
                        <span>{{ comment.author_role }}</span>
                        <a [routerLink]="['/home/notes', comment.note_id]">
                          {{ comment.note_title }}
                        </a>
                        <span>{{ comment.created_at | date:'short' }}</span>
                      </div>
                      <p>{{ comment.content }}</p>
                    </div>
                    <button type="button" (click)="deleteComment(comment)">
                      Delete
                    </button>
                  </article>
                }
              </div>
            }
          </section>
        }
      </div>
    </section>
  `,
  styles: [
    `
      .admin-page {
        display: flex;
        justify-content: center;
        padding: 2rem;
        box-sizing: border-box;
      }
      .admin-card {
        width: min(100%, 920px);
        border: 1px solid var(--border-color, #e0e0e0);
        border-radius: 12px;
        background: var(--bg-color, #fff);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
        overflow: hidden;
      }
      .admin-header,
      .admin-section {
        padding: 1.5rem;
      }
      .admin-section + .admin-section {
        border-top: 1px solid var(--border-color, #ececec);
      }
      h1,
      h2 {
        margin: 0 0 0.5rem;
      }
      .admin-header p,
      .admin-state {
        margin: 0;
        color: var(--text-muted, #666);
      }
      .admin-state {
        padding: 1.5rem;
      }
      .admin-state--error {
        color: var(--error-color, #c00);
      }
      .admin-section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
      }
      .admin-grid,
      .admin-comments {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .admin-user-card,
      .admin-comment-card {
        display: flex;
        gap: 0.75rem;
        align-items: flex-start;
        padding: 0.9rem 1rem;
        border: 1px solid var(--border-color, #ececec);
        border-radius: 10px;
      }
      .admin-avatar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        border-radius: 999px;
        color: #fff;
        font-size: 0.75rem;
        font-weight: 700;
        flex-shrink: 0;
      }
      .admin-user-body,
      .admin-comment-body {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        min-width: 0;
        flex: 1;
      }
      .admin-user-body span,
      .admin-comment-meta span {
        color: var(--text-muted, #666);
        font-size: 0.82rem;
      }
      .admin-comment-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
      }
      .admin-comment-meta a {
        color: var(--focus-color, #1976d2);
        text-decoration: none;
      }
      .admin-comment-meta a:hover {
        text-decoration: underline;
      }
      .admin-comment-body p {
        margin: 0.2rem 0 0;
        white-space: pre-wrap;
      }
      button {
        padding: 0.45rem 0.8rem;
        border: 1px solid rgba(204, 0, 0, 0.25);
        border-radius: 6px;
        background: transparent;
        color: var(--danger-color, #c00);
        cursor: pointer;
      }
    `,
  ],
})
export class AdminComponent {
  readonly users = signal<AdminUserSummary[]>([]);
  readonly comments = signal<AdminCommentSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  constructor(private adminService: AdminService) {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.adminService.listUsers().subscribe({
      next: (users) => {
        this.users.set(users);
        this.adminService.listComments().subscribe({
          next: (comments) => {
            this.comments.set(comments);
            this.loading.set(false);
          },
          error: (err) => {
            this.error.set(err?.error?.error ?? 'Could not load comments');
            this.loading.set(false);
          },
        });
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? 'Could not load users');
        this.loading.set(false);
      },
    });
  }

  deleteComment(comment: AdminCommentSummary): void {
    this.adminService.deleteComment(comment.id).subscribe({
      next: () => {
        this.comments.update((list) => list.filter((item) => item.id !== comment.id));
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? 'Could not delete comment');
      },
    });
  }
}
