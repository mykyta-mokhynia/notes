import { Component, signal, OnInit, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RecentService, RecentItem } from '../../core/sidebar/recent.service';
import { SidebarSectionComponent } from './sidebar-section';
import { IconRecentComponent } from '../icons/icon-recent';
import { IconContentComponent } from '../icons/icon-content';

function groupByDate(items: RecentItem[]): { today: RecentItem[]; lastWeek: RecentItem[]; lastMonth: RecentItem[] } {
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();
  const lastWeekMs = todayMs - 7 * 24 * 60 * 60 * 1000;
  const lastMonthMs = todayMs - 30 * 24 * 60 * 60 * 1000;

  const today: RecentItem[] = [];
  const lastWeek: RecentItem[] = [];
  const lastMonth: RecentItem[] = [];

  for (const item of items) {
    if (item.openedAt >= todayMs) today.push(item);
    else if (item.openedAt >= lastWeekMs) lastWeek.push(item);
    else if (item.openedAt >= lastMonthMs) lastMonth.push(item);
  }

  return { today, lastWeek, lastMonth };
}

@Component({
  selector: 'app-sidebar-recent',
  standalone: true,
  imports: [CommonModule, RouterLink, SidebarSectionComponent, IconRecentComponent, IconContentComponent],
  template: `
    <app-sidebar-section
      title="Recent"
      [panelMode]="true"
      [expanded]="expanded()"
      (expandedChange)="expanded.set($event)"
    >
      <span sidebarSectionIcon><app-icon-recent></app-icon-recent></span>
      <div class="sidebar-section-body" sidebarSectionContent>
        @if (items().length === 0) {
          <p class="sidebar-empty">You don't have anything in recent.</p>
        } @else {
          <div class="recent-header">
            <h2 class="recent-title">Recent</h2>
            <p class="recent-subtitle">Recently opened pages.</p>
            <div class="recent-title-line"></div>
          </div>
          @let groups = grouped();
          @if (groups.today.length > 0) {
            <div class="recent-group">
              <p class="recent-group-label">Today</p>
              <div class="recent-group-line"></div>
              <ul class="sidebar-list">
                @for (item of groups.today; track item.id) {
                  <li>
                    <a [routerLink]="['/home', 'notes', item.id]" class="sidebar-link" (click)="expanded.set(false)">
                      <span class="sidebar-link-icon"><app-icon-content></app-icon-content></span>
                      <span class="sidebar-link-text">
                        <span class="sidebar-link-title">{{ item.title }}</span>
                        <span class="sidebar-link-date">{{ item.openedAt | date:'short' }}</span>
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
              <div class="recent-group-line"></div>
              <ul class="sidebar-list">
                @for (item of groups.lastWeek; track item.id) {
                  <li>
                    <a [routerLink]="['/home', 'notes', item.id]" class="sidebar-link" (click)="expanded.set(false)">
                      <span class="sidebar-link-icon"><app-icon-content></app-icon-content></span>
                      <span class="sidebar-link-text">
                        <span class="sidebar-link-title">{{ item.title }}</span>
                        <span class="sidebar-link-date">{{ item.openedAt | date:'short' }}</span>
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
              <div class="recent-group-line"></div>
              <ul class="sidebar-list">
                @for (item of groups.lastMonth; track item.id) {
                  <li>
                    <a [routerLink]="['/home', 'notes', item.id]" class="sidebar-link" (click)="expanded.set(false)">
                      <span class="sidebar-link-icon"><app-icon-content></app-icon-content></span>
                      <span class="sidebar-link-text">
                        <span class="sidebar-link-title">{{ item.title }}</span>
                        <span class="sidebar-link-date">{{ item.openedAt | date:'short' }}</span>
                      </span>
                    </a>
                  </li>
                }
              </ul>
            </div>
          }
        }
      </div>
    </app-sidebar-section>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
      .sidebar-section-body {
        min-height: 2.5rem;
      }
      .sidebar-empty {
        margin: 0;
        padding: 0.5rem 0 0.25rem 0;
        font-size: 0.9375rem;
        color: var(--text-color, #111);
      }
      .recent-header {
        margin-bottom: 0.75rem;
      }
      .recent-title {
        font-size: 1rem;
        font-weight: 700;
        margin: 0 0 0.2rem 0;
        color: var(--text-color, #111);
      }
      .recent-subtitle {
        margin: 0 0 0.35rem 0;
        font-size: 0.8125rem;
        color: var(--text-muted, #666);
      }
      .recent-title-line {
        height: 1px;
        background: var(--border-color, #e0e0e0);
      }
      .recent-group {
        margin-bottom: 0.75rem;
      }
      .recent-group:last-child {
        margin-bottom: 0;
      }
      .recent-group-label {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        color: var(--text-muted, #666);
        margin: 0 0 0.25rem 0;
      }
      .recent-group-line {
        height: 1px;
        background: var(--border-color, #e0e0e0);
        margin-bottom: 0.35rem;
      }
      .sidebar-list {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .sidebar-list li {
        margin: 0;
      }
      .sidebar-link {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-height: 2rem;
        padding: 0.25rem 0;
        font-size: 0.8125rem;
        color: inherit;
        text-decoration: none;
        overflow: hidden;
      }
      .sidebar-link:hover {
        color: var(--focus-color, #1976d2);
      }
      .sidebar-link:hover .sidebar-link-date {
        color: var(--focus-color, #1976d2);
      }
      .sidebar-link-icon {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-muted, #666);
      }
      .sidebar-link:hover .sidebar-link-icon {
        color: inherit;
      }
      .sidebar-link-text {
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
        min-width: 0;
      }
      .sidebar-link-title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .sidebar-link-date {
        font-size: 0.7rem;
        color: var(--text-muted, #666);
      }
    `,
  ],
})
export class SidebarRecentComponent implements OnInit {
  expanded = signal(false);
  items = signal<RecentItem[]>([]);
  grouped = computed(() => groupByDate(this.items()));

  constructor(private recentService: RecentService) {
    this.recentService.refresh$.subscribe(() => this.items.set(this.recentService.getItems()));
  }

  ngOnInit(): void {
    this.items.set(this.recentService.getItems());
  }
}
