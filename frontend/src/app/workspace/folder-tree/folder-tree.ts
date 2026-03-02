import { Component, OnInit, output, input } from '@angular/core';
import { FoldersService, Folder } from '../../core/api/folders.service';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { FolderTreeItemComponent } from './folder-tree-item';
import { FolderDragService } from '../drag/folder-drag.service';

/** Delay before showing loading message (avoids flicker on fast loads). */
const LOADING_MESSAGE_DELAY_MS = 180;

@Component({
  selector: 'app-folder-tree',
  standalone: true,
  imports: [CommonModule, DragDropModule, FolderTreeItemComponent],
  templateUrl: './folder-tree.html',
  styleUrl: './folder-tree.scss',
})
export class FolderTreeComponent implements OnInit {
  selectFolder = output<number | null>();
  /** When false, the "New folder" button is hidden (e.g. when using shared Create dropdown). */
  showCreateButton = input<boolean>(true);
  /** When set, only show this folder and its descendants (for space-scoped tree). */
  rootFolderId = input<number | null>(null);

  folders: Folder[] = [];
  loading = true;
  /** Only true after LOADING_MESSAGE_DELAY_MS so fast loads don't flash "Loading…". */
  showLoadingMessage = false;
  error: string | null = null;
  private loadingDelayId: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private foldersService: FoldersService,
    private folderDragService: FolderDragService
  ) {
    this.folderDragService.moveDone.subscribe(() =>
      this.foldersService.getTree().subscribe((list) => (this.folders = list))
    );
  }

  ngOnInit(): void {
    this.loadingDelayId = setTimeout(() => {
      this.loadingDelayId = null;
      this.showLoadingMessage = true;
    }, LOADING_MESSAGE_DELAY_MS);
    this.foldersService.getTree().subscribe({
      next: (list: Folder[]) => {
        this.clearLoadingDelay();
        this.folders = list;
        this.loading = false;
        this.showLoadingMessage = false;
      },
      error: (err: { message?: string }) => {
        this.clearLoadingDelay();
        this.error = err?.message ?? 'Failed to load folders';
        this.loading = false;
        this.showLoadingMessage = false;
      },
    });
  }

  private clearLoadingDelay(): void {
    if (this.loadingDelayId != null) {
      clearTimeout(this.loadingDelayId);
      this.loadingDelayId = null;
    }
  }

  /** Folders visible in current view (all or scoped to rootFolderId). */
  getVisibleFolders(): Folder[] {
    const rootId = this.rootFolderId();
    if (rootId == null) return this.folders;
    const root = this.folders.find((f) => f.id === rootId);
    if (!root) return [];
    const rootPath = root.path ?? `f${root.id}`;
    return this.folders.filter(
      (f) =>
        f.id === rootId ||
        (f.path != null && (f.path === rootPath || f.path.startsWith(rootPath + '.')))
    );
  }

  getRootFolders(): Folder[] {
    const rootId = this.rootFolderId();
    if (rootId != null) {
      const f = this.getVisibleFolders().find((x) => x.id === rootId);
      return f ? [f] : [];
    }
    return this.folders.filter((f) => f.parent_id === null);
  }

  /** Top-level folders to show in the tree. When scoped to a space, show only children of the root (root itself is hidden). */
  getTopLevelFolders(): Folder[] {
    const rootId = this.rootFolderId();
    if (rootId != null) return this.getChildren(rootId);
    return this.getRootFolders();
  }

  onRootDrop(event: CdkDragDrop<{ parentId: null }, Folder>): void {
    const folder = event.item?.data;
    if (!folder) return;
    const rootId = this.rootFolderId();
    this.folderDragService.scheduleMove(folder.id, rootId ?? null);
  }

  getChildren(parentId: number): Folder[] {
    return this.getVisibleFolders().filter((f) => f.parent_id === parentId);
  }

  onFolderClick(folder: Folder): void {
    this.selectFolder.emit(folder.id);
  }

  /** Public for workspace Create dropdown. */
  createFolder(parentId: number | null): void {
    const title = prompt('Folder name');
    if (!title?.trim()) return;
    this.foldersService.create(parentId, title.trim()).subscribe({
      next: (created: Folder) => {
        this.folders = [...this.folders, created];
        this.selectFolder.emit(created.id);
      },
      error: () => alert('Failed to create folder'),
    });
  }

  onFolderDrop(event: { folderId: number; newParentId: number | null }): void {
    this.folderDragService.scheduleMove(event.folderId, event.newParentId);
  }
}
