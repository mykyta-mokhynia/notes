import { Component, output, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-create-space-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop" (click)="close()"></div>
    <div class="modal-box" role="dialog" aria-label="Create space">
      <h3 class="modal-title">New space</h3>
      <form (ngSubmit)="submit()" class="modal-form">
        <label class="modal-label" for="space-name">Name</label>
        <input
          id="space-name"
          type="text"
          class="modal-input"
          [(ngModel)]="name"
          name="name"
          placeholder="e.g. Jira, TypeScript"
          autofocus
        />
        @if (error(); as err) {
          <p class="modal-error">{{ err }}</p>
        }
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" (click)="close()">Cancel</button>
          <button type="submit" class="btn btn-primary" [disabled]="!name.trim()">Create</button>
        </div>
      </form>
    </div>
  `,
  styles: [
    `
      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.4);
        z-index: 100;
      }
      .modal-box {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: var(--bg-color, #fff);
        border-radius: 8px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        padding: 1.25rem;
        min-width: 280px;
        z-index: 101;
      }
      .modal-title {
        margin: 0 0 1rem 0;
        font-size: 1rem;
        font-weight: 600;
      }
      .modal-form {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .modal-label {
        font-size: 0.8125rem;
        font-weight: 500;
      }
      .modal-input {
        padding: 0.5rem 0.6rem;
        font-size: 0.875rem;
        border: 1px solid var(--border-color, #e0e0e0);
        border-radius: 4px;
      }
      .modal-error {
        margin: 0;
        font-size: 0.8125rem;
        color: var(--error-color, #c62828);
      }
      .modal-actions {
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;
        margin-top: 0.75rem;
      }
      .btn {
        padding: 0.4rem 0.75rem;
        font-size: 0.8125rem;
        border-radius: 4px;
        cursor: pointer;
        border: 1px solid transparent;
      }
      .btn-secondary {
        background: var(--bg-muted, #f0f0f0);
        color: var(--text-color, #111);
      }
      .btn-primary {
        background: var(--focus-color, #1976d2);
        color: #fff;
      }
      .btn-primary:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    `,
  ],
})
export class CreateSpaceModalComponent {
  name = '';
  /** Set by parent when API create fails */
  error = input<string | null>(null);

  /** Emits the space name when user submits; parent creates via API. */
  create = output<string>();
  closed = output<void>();

  close(): void {
    this.closed.emit();
  }

  submit(): void {
    const n = this.name.trim();
    if (!n) return;
    this.create.emit(n);
  }
}
