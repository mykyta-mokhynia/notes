import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-sidebar-about',
  standalone: true,
  imports: [RouterLink],
  template: `
    <a
      [routerLink]="aboutLink()"
      class="sidebar-about"
      routerLinkActive="active"
    >
      About App
    </a>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
      .sidebar-about {
        position: relative;
        display: flex;
        align-items: center;
        width: calc(100% + 2 * var(--sidebar-padding, 1rem));
        margin-left: calc(-1 * var(--sidebar-padding, 1rem));
        margin-right: calc(-1 * var(--sidebar-padding, 1rem));
        height: 2rem;
        padding: 0 var(--sidebar-padding, 1rem);
        font-size: 0.875rem;
        font-weight: 500;
        line-height: 1;
        color: inherit;
        text-decoration: none;
        border-bottom: 1px solid var(--border-color, #eee);
        margin-bottom: 0.5rem;
        box-sizing: border-box;
        border-radius: 4px;
      }
      .sidebar-about:hover {
        color: var(--focus-color, #1976d2);
      }
      .sidebar-about:hover::before {
        content: '';
        position: absolute;
        inset: 2px;
        border-radius: 3px;
        background: var(--bg-hover, rgba(0, 0, 0, 0.06));
        pointer-events: none;
      }
      .sidebar-about.active {
        color: var(--focus-color, #1976d2);
      }
    `,
  ],
})
export class SidebarAboutComponent {
  aboutLink(): string[] {
    const id = (environment as { aboutNoteId?: string }).aboutNoteId;
    if (id) return ['/home', 'notes', id];
    return ['/home'];
  }
}
