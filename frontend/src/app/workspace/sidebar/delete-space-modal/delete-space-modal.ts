import { Component, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-delete-space-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop" (click)="close()"></div>
    <div class="modal-box" role="dialog" aria-label="Delete space">
      <h3 class="modal-title">Delete space</h3>
      <p class="modal-text">Type <strong>delete</strong> to confirm.</p>
      <form (ngSubmit)="submit()" class="modal-form">
        <input
          id="delete-confirm"
          type="text"
          class="modal-input"
          [(ngModel)]="confirmText"
          name="confirm"
          placeholder="delete"
          autocomplete="off"
        />
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" (click)="close()">Cancel</button>
          <button type="submit" class="btn btn-danger" [disabled]="confirmText.trim().toLowerCase() !== 'delete'">
            Delete
          </button>
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
        margin: 0 0 0.5rem 0;
        font-size: 1rem;
        font-weight: 600;
      }
      .modal-text {
        margin: 0 0 0.75rem 0;
        font-size: 0.875rem;
        color: var(--text-muted, #666);
      }
      .modal-form {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .modal-input {
        padding: 0.5rem 0.6rem;
        font-size: 0.875rem;
        border: 1px solid var(--border-color, #e0e0e0);
        border-radius: 4px;
      }
      .modal-actions {
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;
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
      .btn-danger {
        background: transparent;
        color: var(--error-color, #c62828);
        border-color: var(--error-color, #c62828);
      }
      .btn-danger:hover:not(:disabled) {
        background: var(--error-color, #c62828);
        color: #fff;
      }
      .btn-danger:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `,
  ],
})
export class DeleteSpaceModalComponent {
  confirmText = '';

  confirm = output<void>();
  closed = output<void>();

  close(): void {
    this.closed.emit();
  }

  submit(): void {
    if (this.confirmText.trim().toLowerCase() !== 'delete') return;
    this.confirm.emit();
  }
}
