import { Component, input, output, signal, HostListener, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconChevronRightComponent } from '../icons/icon-chevron-right';

@Component({
  selector: 'app-sidebar-section',
  standalone: true,
  imports: [CommonModule, IconChevronRightComponent],
  template: `
    <button
      type="button"
      class="sidebar-section-header"
      [class.sidebar-section-header--panel]="panelMode()"
      (click)="onHeaderClick($event)"
    >
      <span class="sidebar-section-icon-wrap">
        <ng-content select="[sidebarSectionIcon]"></ng-content>
      </span>
      <span class="sidebar-section-title">{{ title() }}</span>
      @if (panelMode()) {
        <span class="sidebar-section-arrow sidebar-section-arrow--right" [class.expanded]="expanded()">
          <app-icon-chevron-right></app-icon-chevron-right>
        </span>
      } @else {
        <span class="sidebar-section-arrow" [class.expanded]="expanded()">▼</span>
      }
    </button>
    @if (panelMode()) {
      @if (expanded()) {
        <div
          class="sidebar-section-panel sidebar-section-panel--popover"
          [style.top.px]="panelTop()"
          [style.left.px]="panelLeft()"
        >
          <div class="sidebar-section-panel-inner">
            <ng-content></ng-content>
          </div>
        </div>
      }
    } @else {
      @if (expanded()) {
        <div class="sidebar-section-content">
          <ng-content></ng-content>
        </div>
      }
    }
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
      .sidebar-section-header {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.35rem;
        width: calc(100% + 2 * var(--sidebar-padding, 1rem));
        margin-left: calc(-1 * var(--sidebar-padding, 1rem));
        margin-right: calc(-1 * var(--sidebar-padding, 1rem));
        height: 2rem;
        padding: 0 var(--sidebar-padding, 1rem);
        border: none;
        background: none;
        cursor: pointer;
        font-size: 1.125rem;
        font-weight: 400;
        line-height: 1;
        letter-spacing: 0.02em;
        color: var(--text-color, #111);
        text-align: left;
        box-sizing: border-box;
        border-radius: 4px;
      }
      .sidebar-section-header:hover {
        color: var(--text-color, #111);
      }
      .sidebar-section-header:hover::before {
        content: '';
        position: absolute;
        inset: 2px;
        border-radius: 3px;
        background: var(--bg-hover, rgba(0, 0, 0, 0.06));
        pointer-events: none;
      }
      .sidebar-section-icon-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        width: 2rem;
        height: 2rem;
        color: inherit;
      }
      .sidebar-section-icon-wrap:empty {
        display: none;
      }
      .sidebar-section-title {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .sidebar-section-arrow {
        font-size: 0.6rem;
        transition: transform 0.15s ease;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        line-height: 0;
      }
      .sidebar-section-arrow.expanded {
        transform: rotate(-180deg);
      }
      .sidebar-section-arrow--right {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .sidebar-section-arrow svg {
        display: block;
      }
      .sidebar-section-arrow--right.expanded {
        transform: rotate(0deg);
      }
      .sidebar-section-content {
        margin-bottom: 0.5rem;
      }
      .sidebar-section-panel {
        position: fixed;
        z-index: 101;
        background: var(--bg-color, #fff);
        border: 1px solid var(--border-color, #e0e0e0);
        box-shadow: 4px 4px 16px rgba(0, 0, 0, 0.12);
        border-radius: 8px;
        animation: sidebar-section-panel-in 0.2s ease;
      }
      .sidebar-section-panel--popover {
        width: 280px;
        max-height: min(70vh, 400px);
        min-height: 80px;
      }
      .sidebar-section-panel-inner {
        height: 100%;
        overflow-y: auto;
        padding: 1rem;
      }
      @keyframes sidebar-section-panel-in {
        from {
          opacity: 0;
          transform: translateX(-8px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
    `,
  ],
})
export class SidebarSectionComponent {
  private hostRef = inject(ElementRef<HTMLElement>);

  title = input.required<string>();
  expanded = input<boolean>(true);
  /** When true, content opens in a panel to the right with chevron-right arrow. */
  panelMode = input<boolean>(false);
  toggle = output<void>();
  expandedChange = output<boolean>();

  panelTop = signal(0);
  panelLeft = signal(0);

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.panelMode() || !this.expanded()) return;
    const target = event.target as Node;
    if (this.hostRef.nativeElement.contains(target)) return;
    this.expandedChange.emit(false);
  }

  onHeaderClick(event: Event): void {
    if (this.panelMode()) {
      const el = (event.currentTarget as HTMLElement).getBoundingClientRect();
      this.panelTop.set(el.top);
      this.panelLeft.set(el.right);
    }
    this.expandedChange.emit(!this.expanded());
  }
}
