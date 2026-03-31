import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { RecentItem, RecentService, MAX_RECENT_ITEMS } from '../../core/sidebar/recent.service';
import { groupRecentByDate } from '../../core/sidebar/recent-grouping';
import { IconContentComponent } from '../icons/icon-content';

@Component({
  selector: 'app-recent-pages',
  standalone: true,
  imports: [CommonModule, RouterLink, IconContentComponent],
  template: `
    <section class="recent-page">
      <header class="recent-page-header">
        <h1 class="recent-page-title">Recent pages</h1>
        <p class="recent-page-subtitle">Showing up to {{ maxItems }} recently opened pages.</p>
      </header>

      @if (items().length === 0) {
        <p class="recent-empty">You don't have anything in recent.</p>
      } @else {
        @let groups = grouped();

        @if (groups.today.length > 0) {
          <div class="recent-group">
            <p class="recent-group-label">Today</p>
            <ul class="recent-list">
              @for (item of groups.today; track item.id) {
                <li>
                  <a [routerLink]="['/home', 'notes', item.id]" class="recent-link">
                    <span class="recent-link-icon"><app-icon-content></app-icon-content></span>
                    <span class="recent-link-text">
                      <span class="recent-link-title">{{ item.title }}</span>
                      <span class="recent-link-date">{{ item.openedAt | date:'medium' }}</span>
                    </span>
                  </a>
                </li>
              }
            </ul>
          </div>
        }

        @if (groups.lastWeek.length > 0) {
          <div class="recent-group">
            <p class="recent-group-label">Last week</p>
            <ul class="recent-list">
              @for (item of groups.lastWeek; track item.id) {
                <li>
                  <a [routerLink]="['/home', 'notes', item.id]" class="recent-link">
                    <span class="recent-link-icon"><app-icon-content></app-icon-content></span>
                    <span class="recent-link-text">
                      <span class="recent-link-title">{{ item.title }}</span>
                      <span class="recent-link-date">{{ item.openedAt | date:'medium' }}</span>
                    </span>
                  </a>
                </li>
              }
            </ul>
          </div>
        }

        @if (groups.lastMonth.length > 0) {
          <div class="recent-group">
            <p class="recent-group-label">Last month</p>
            <ul class="recent-list">
              @for (item of groups.lastMonth; track item.id) {
                <li>
                  <a [routerLink]="['/home', 'notes', item.id]" class="recent-link">
                    <span class="recent-link-icon"><app-icon-content></app-icon-content></span>
                    <span class="recent-link-text">
                      <span class="recent-link-title">{{ item.title }}</span>
                      <span class="recent-link-date">{{ item.openedAt | date:'medium' }}</span>
                    </span>
                  </a>
                </li>
              }
            </ul>
          </div>
        }

        @if (groups.older.length > 0) {
          <div class="recent-group">
            <p class="recent-group-label">Older</p>
            <ul class="recent-list">
              @for (item of groups.older; track item.id) {
                <li>
                  <a [routerLink]="['/home', 'notes', item.id]" class="recent-link">
                    <span class="recent-link-icon"><app-icon-content></app-icon-content></span>
                    <span class="recent-link-text">
                      <span class="recent-link-title">{{ item.title }}</span>
                      <span class="recent-link-date">{{ item.openedAt | date:'medium' }}</span>
                    </span>
                  </a>
                </li>
              }
            </ul>
          </div>
        }
      }
    </section>
  `,
  styles: [
    `
      .recent-page {
        max-width: 980px;
        padding: 1.25rem 1.5rem 2rem;
        margin: 0 auto;
      }
      .recent-page-header {
        margin-bottom: 1rem;
      }
      .recent-page-title {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--text-color, #111);
      }
      .recent-page-subtitle {
        margin: 0.35rem 0 0;
        font-size: 0.875rem;
        color: var(--text-muted, #666);
      }
      .recent-empty {
        margin: 0;
        color: var(--text-muted, #666);
      }
      .recent-group {
        margin-bottom: 1.25rem;
      }
      .recent-group:last-child {
        margin-bottom: 0;
      }
      .recent-group-label {
        margin: 0 0 0.45rem;
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        color: var(--text-muted, #666);
      }
      .recent-list {
        list-style: none;
        margin: 0;
        padding: 0;
        border: 1px solid var(--border-color, #e0e0e0);
        border-radius: 10px;
        overflow: hidden;
      }
      .recent-list li + li {
        border-top: 1px solid var(--border-color, #e0e0e0);
      }
      .recent-link {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        min-height: 2.75rem;
        padding: 0.5rem 0.75rem;
        color: inherit;
        text-decoration: none;
      }
      .recent-link:hover {
        background: var(--bg-hover, rgba(0, 0, 0, 0.05));
      }
      .recent-link-icon {
        flex-shrink: 0;
        color: var(--text-muted, #666);
      }
      .recent-link-text {
        min-width: 0;
        display: flex;
        flex-direction: column;
      }
      .recent-link-title {
        font-size: 0.95rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .recent-link-date {
        font-size: 0.75rem;
        color: var(--text-muted, #666);
      }
    `,
  ],
})
export class RecentPagesComponent implements OnInit {
  readonly maxItems = MAX_RECENT_ITEMS;
  readonly items = signal<RecentItem[]>([]);
  readonly grouped = computed(() => groupRecentByDate(this.items()));

  constructor(private recentService: RecentService) {}

  ngOnInit(): void {
    this.items.set(this.recentService.getItems(MAX_RECENT_ITEMS));
  }
}
