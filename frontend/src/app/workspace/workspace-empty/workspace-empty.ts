import { Component } from '@angular/core';

@Component({
  selector: 'app-workspace-empty',
  standalone: true,
  template: `
    <div class="empty-state">
      <p>Select a folder in the sidebar, then select or create a note.</p>
    </div>
  `,
  styles: [
    `
      .empty-state {
        padding: 3rem 2rem;
        text-align: center;
        color: var(--text-muted, #666);
        font-size: 0.9375rem;
      }
    `,
  ],
})
export class WorkspaceEmptyComponent {}
