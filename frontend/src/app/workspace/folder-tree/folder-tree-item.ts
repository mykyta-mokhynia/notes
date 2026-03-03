import { Component, input, output, signal, HostListener, forwardRef, inject, ViewChild, ElementRef } from '@angular/core';
import { Folder, FoldersService } from '../../core/api/folders.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { IconFolderComponent } from '../icons/icon-folder';
import { IconChevronRightComponent } from '../icons/icon-chevron-right';
import { IconChevronDownComponent } from '../icons/icon-chevron-down';
import { IconPlusComponent } from '../icons/icon-plus';
import { IconContentComponent } from '../icons/icon-content';
import { NotesListComponent } from '../notes-list/notes-list';

const DEFAULT_FOLDER_NAME = 'New folder';

@Component({
  selector: 'app-folder-tree-item',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    forwardRef(() => FolderTreeItemComponent),
    IconFolderComponent,
    IconChevronRightComponent,
    IconChevronDownComponent,
    IconPlusComponent,
    IconContentComponent,
    NotesListComponent,
  ],
  templateUrl: './folder-tree-item.html',
  styleUrl: './folder-tree-item.scss',
})
export class FolderTreeItemComponent {
  folder = input.required<Folder>();
  allFolders = input.required<Folder[]>();
  /** When set, the folder with this id (space root) shows "Content" if title is empty. */
  rootFolderId = input<number | null>(null);
  /** When set, the folder with this id is shown as selected. */
  selectedFolderId = input<number | null>(null);
  /** When set, show inline create row under this parent folder id. */
  creatingUnderParentId = input<number | null>(null);
  /** When set, the folder with this id shows its title in rename mode. */
  folderIdBeingRenamed = input<number | null>(null);
  /** Optional note id currently in rename mode (passed down from sidebar). */
  noteIdBeingRenamed = input<string | null>(null);

  folderClick = output<Folder>();
  selectNote = output<string>();
  createSubfolder = output<number>();
  createNoteInFolder = output<number>();
  noteRenamed = output<void>();
  folderDrop = output<{ folderId: number; newParentId: number | null }>();
  /** Emitted when + is clicked so parent can set creatingUnderParentId. */
  startCreating = output<number>();
  private foldersService = inject(FoldersService);
  private hostRef = inject(ElementRef<HTMLElement>);
  /** Emitted when a new folder is created under this folder. */
  folderCreated = output<Folder>();
  /** Emitted when this folder's title is renamed. */
  folderRenamed = output<{ folderId: number; newName: string }>();
  /** Emitted when current folder is expanded/collapsed from its own row click. */
  folderExpandedChange = output<{ folderId: number; expanded: boolean }>();
  /** Emitted when user cancels inline create. */
  cancelCreating = output<void>();
  /** Emitted when "Folder" is clicked in inline create: create folder with default name and show rename. */
  createFolderWithDefault = output<number>();

  expanded = signal(false);
  rowHovered = signal(false);
  createDropdownOpen = signal(false);
  createDropdownPosition = signal<{ top: number; left: number } | null>(null);
  /** Inline create under this folder. */
  inlineCreateName = '';
  /** Rename mode: value in the input. */
  renameTitle = '';

  hasChildren(): boolean {
    return this.getChildren(this.folder().id).length > 0;
  }

  getChildren(parentId: number): Folder[] {
    return this.allFolders().filter((f) => f.parent_id === parentId);
  }

  /** Display title: space root with empty title shows "Content". */
  getFolderTitle(): string {
    const f = this.folder();
    const rootId = this.rootFolderId();
    if (rootId != null && f.id === rootId && !(f.title?.trim())) return 'Content';
    return f.title ?? '';
  }

  onClick(): void {
    // Toggle on every click so collapse/expand is deterministic from first click.
    this.expanded.update((v) => !v);
    this.folderExpandedChange.emit({
      folderId: this.folder().id,
      expanded: this.expanded(),
    });
    this.folderClick.emit(this.folder());
  }

  toggleCreateDropdown(event: Event): void {
    event.stopPropagation();
    const btn = (event.target as HTMLElement).closest('button') as HTMLElement;
    const rect = btn?.getBoundingClientRect();
    if (this.createDropdownOpen()) {
      this.createDropdownOpen.set(false);
      this.createDropdownPosition.set(null);
    } else {
      this.createDropdownOpen.set(true);
      this.createDropdownPosition.set(rect ? { top: rect.bottom + 4, left: rect.left } : null);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (target && this.hostRef.nativeElement.contains(target)) return;
    this.createDropdownOpen.set(false);
    this.createDropdownPosition.set(null);
  }

  onCreateSubfolder(): void {
    this.createSubfolder.emit(this.folder().id);
    this.createDropdownOpen.set(false);
    this.createDropdownPosition.set(null);
  }

  onCreateNote(): void {
    this.createNoteInFolder.emit(this.folder().id);
    this.createDropdownOpen.set(false);
    this.createDropdownPosition.set(null);
  }

  onDrop(event: CdkDragDrop<{ parentId: number }, Folder>): void {
    const folder = event.item.data;
    const data = event.container.data;
    if (!folder || !data) return;
    this.folderDrop.emit({ folderId: folder.id, newParentId: data.parentId });
  }

  /** + clicked: start inline create under this folder. */
  onPlusClick(event: Event): void {
    event.stopPropagation();
    this.startCreating.emit(this.folder().id);
  }

  showInlineCreateHere(): boolean {
    const creating = this.creatingUnderParentId();
    return creating != null && Number(creating) === Number(this.folder().id);
  }

  isRenaming(): boolean {
    const renaming = this.folderIdBeingRenamed();
    return renaming != null && Number(renaming) === Number(this.folder().id);
  }

  submitInlineCreate(): void {
    const name = (this.inlineCreateName || DEFAULT_FOLDER_NAME).trim();
    this.foldersService.create(this.folder().id, name).subscribe({
      next: (created) => {
        this.folderCreated.emit(created);
        this.inlineCreateName = '';
      },
      error: () => alert('Failed to create folder'),
    });
  }

  cancelInlineCreate(): void {
    this.inlineCreateName = '';
    this.cancelCreating.emit();
  }

  onInlineCreateFolder(): void {
    this.createFolderWithDefault.emit(this.folder().id);
    this.cancelCreating.emit();
  }

  onInlineCreatePage(): void {
    this.createNoteInFolder.emit(this.folder().id);
    this.cancelCreating.emit();
  }

  submitRename(): void {
    const newName = (this.renameTitle || this.getFolderTitle()).trim();
    if (newName && newName !== this.folder().title) {
      this.foldersService.update(this.folder().id, { title: newName }).subscribe({
        next: () => this.folderRenamed.emit({ folderId: this.folder().id, newName }),
        error: () => alert('Failed to rename'),
      });
    } else {
      this.folderRenamed.emit({ folderId: this.folder().id, newName: this.folder().title });
    }
  }

  @ViewChild('renameInput') set renameInputRef(el: ElementRef<HTMLInputElement> | undefined) {
    if (el?.nativeElement && this.isRenaming()) {
      const initialTitle = this.getFolderTitle();
      setTimeout(() => {
        this.renameTitle = initialTitle;
        el.nativeElement.focus();
        el.nativeElement.select();
      }, 0);
    }
  }

  cancelRename(): void {
    this.renameTitle = this.folder().title;
    this.folderRenamed.emit({ folderId: this.folder().id, newName: this.folder().title });
  }
}
