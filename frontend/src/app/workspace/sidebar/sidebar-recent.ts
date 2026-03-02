import { Component, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RecentService, RecentItem } from '../../core/sidebar/recent.service';
import { SidebarSectionComponent } from './sidebar-section';
import { IconRecentComponent } from '../icons/icon-recent';

@Component({
  selector: 'app-sidebar-recent',
  standalone: true,
  imports: [CommonModule, RouterLink, SidebarSectionComponent, IconRecentComponent],
  template: `
    <app-sidebar-section
      title="Recent"
      [panelMode]="true"
      [expanded]="expanded()"
      (expandedChange)="expanded.set($event)"
    >
      <span sidebarSectionIcon><app-icon-recent></app-icon-recent></span>
      @if (items().length === 0) {
        <p class="sidebar-empty">You don't have anything in recent.</p>
      } @else {
        <ul class="sidebar-list">
          @for (item of items(); track item.id) {
            <li>
              <a [routerLink]="['/home', 'notes', item.id]" class="sidebar-link" (click)="expanded.set(false)">{{ item.title }}</a>
            </li>
          }
        </ul>
      }
    </app-sidebar-section>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
      .sidebar-empty {
        margin: 0.5rem 0 0.25rem 0;
        font-size: 0.9375rem;
        color: var(--text-color, #111);
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
        min-height: 2rem;
        padding: 0;
        font-size: 0.8125rem;
        color: inherit;
        text-decoration: none;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .sidebar-link:hover {
        color: var(--focus-color, #1976d2);
      }
    `,
  ],
})
export class SidebarRecentComponent implements OnInit {
  expanded = signal(false);
  items = signal<RecentItem[]>([]);

  constructor(private recentService: RecentService) {
    this.recentService.refresh$.subscribe(() => this.items.set(this.recentService.getItems()));
  }

  ngOnInit(): void {
    this.items.set(this.recentService.getItems());
  }
}
