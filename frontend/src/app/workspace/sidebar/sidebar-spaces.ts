import {
  Component,
  OnInit,
  output,
  viewChildren,
  signal,
  HostListener,
  computed,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { SpacesService, Space } from '../../core/api/spaces.service';
import { FoldersService, type Folder } from '../../core/api/folders.service';
import { NotesService } from '../../core/api/notes.service';
import { FolderTreeComponent } from '../folder-tree/folder-tree';
import { NotesListComponent } from '../notes-list/notes-list';
import { IconPlusComponent } from '../icons/icon-plus';
import { IconChevronRightComponent } from '../icons/icon-chevron-right';
import { IconChevronDownComponent } from '../icons/icon-chevron-down';
import { IconContentComponent } from '../icons/icon-content';
import { IconAboutComponent } from '../icons/icon-about';
import { IconEllipsisComponent } from '../icons/icon-ellipsis';
import { IconEditComponent } from '../icons/icon-edit';
import { IconTrashComponent } from '../icons/icon-trash';
import { IconStarEmptyComponent } from '../icons/icon-star-empty';
import { IconStarFullComponent } from '../icons/icon-star-full';
import { IconPlanetRingComponent } from '../icons/icon-planet-ring';
import { IconEyeSlashComponent } from '../icons/icon-eye-slash';
import { IconEyeComponent } from '../icons/icon-eye';
import { IconFolderComponent } from '../icons/icon-folder';
import { CreateSpaceModalComponent } from './create-space-modal/create-space-modal';
import { EditSpaceModalComponent } from './edit-space-modal/edit-space-modal';
import { DeleteSpaceModalComponent } from './delete-space-modal/delete-space-modal';
import { FavouriteService } from '../../core/sidebar/favourite.service';

@Component({
  selector: 'app-sidebar-spaces',
  standalone: true,
  imports: [
    CommonModule,
    FolderTreeComponent,
    NotesListComponent,
    IconPlusComponent,
    IconChevronRightComponent,
    IconChevronDownComponent,
    IconContentComponent,
    IconAboutComponent,
    IconEllipsisComponent,
    IconEditComponent,
    IconTrashComponent,
    IconStarEmptyComponent,
    IconStarFullComponent,
    IconPlanetRingComponent,
    IconEyeSlashComponent,
    IconEyeComponent,
    IconFolderComponent,
    CreateSpaceModalComponent,
    EditSpaceModalComponent,
    DeleteSpaceModalComponent,
  ],
  templateUrl: './sidebar-spaces.html',
  styleUrl: './sidebar-spaces.scss',
})
export class SidebarSpacesComponent implements OnInit {
  selectNote = output<string>();

  spaces = signal<Space[]>([]);
  folders = signal<Folder[]>([]);
  sectionExpanded = signal(true);
  expandedSpaceId = signal<number | null>(null);
  /** Whether the "Content" block is expanded (when a space is expanded). */
  contentExpanded = signal(true);
  selectedFolderId = signal<number | null>(null);
  /** When set, this folder's title is in rename mode (input focused, selected). */
  folderIdBeingRenamed = signal<number | null>(null);
  /** When set, this note is shown in rename mode in the notes list. */
  noteIdBeingRenamed = signal<string | null>(null);
  /** Which space has the content create dropdown open. */
  contentCreateOpenSpaceId = signal<number | null>(null);
  /** Position for the content create dropdown (fixed overlay). */
  contentCreatePosition = signal<{ top: number; left: number } | null>(null);
  /** Parent folder for current Content create dropdown action (space root). */
  contentCreateParentFolderId = signal<number | null>(null);
  showCreateSpaceModal = signal(false);
  createSpaceError = signal<string | null>(null);
  /** Which space has the context menu open. */
  spaceMenuOpenId = signal<number | null>(null);
  /** Position for the fixed context menu (viewport coordinates). */
  spaceMenuPosition = signal<{ top: number; left: number } | null>(null);
  /** Which space is being edited (modal open). */
  editSpaceId = signal<number | null>(null);
  editSpaceError = signal<string | null>(null);
  /** Which space is being deleted (modal open). */
  deleteSpaceId = signal<number | null>(null);

  /** All folder trees (one per expanded space); use the one matching current space for create. */
  folderTreeRefs = viewChildren(FolderTreeComponent);
  notesListRefs = viewChildren(NotesListComponent);
  private queryFolderId: number | null = null;
  private querySpaceId: number | null = null;

  expandedSpace = computed(() => {
    const id = this.expandedSpaceId();
    return id ? this.spaces().find((s) => s.id === id) ?? null : null;
  });

  showEditSpaceModal = computed(() => {
    const id = this.editSpaceId();
    return id ? this.spaces().find((s) => s.id === id) ?? null : null;
  });

  showDeleteSpaceModal = computed(() => {
    const id = this.deleteSpaceId();
    return id ? this.spaces().find((s) => s.id === id) ?? null : null;
  });

  /** Space for the open context menu (used by fixed overlay). */
  spaceForMenu = computed(() => {
    const id = this.spaceMenuOpenId();
    return id ? this.spaces().find((s) => s.id === id) ?? null : null;
  });

  /** Only show About row when space has a real about note (new spaces have null). */
  hasAboutNote(space: Space): boolean {
    const id = space.about_note_id;
    return id != null && id !== '';
  }

  constructor(
    private spacesService: SpacesService,
    private foldersService: FoldersService,
    private notesService: NotesService,
    private route: ActivatedRoute,
    private router: Router,
    public favouriteService: FavouriteService
  ) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const isContentCreate = target?.closest?.('.content-create-wrap') != null || target?.closest?.('.content-create-dropdown') != null;
    if (!isContentCreate) {
      this.closeContentCreate();
    }
    const isSpaceMenu = target?.closest?.('.space-menu-wrap') != null || target?.closest?.('.space-context-menu') != null;
    if (!isSpaceMenu) {
      this.closeSpaceMenu();
    }
  }

  ngOnInit(): void {
    this.loadSidebarData();
    this.route.queryParamMap.subscribe((params) => {
      const folderParam = params.get('folder');
      const spaceParam = params.get('space');
      this.queryFolderId = folderParam ? parseInt(folderParam, 10) : null;
      if (this.queryFolderId != null && Number.isNaN(this.queryFolderId)) {
        this.queryFolderId = null;
      }
      this.querySpaceId = spaceParam ? parseInt(spaceParam, 10) : null;
      if (this.querySpaceId != null && Number.isNaN(this.querySpaceId)) {
        this.querySpaceId = null;
      }
      this.applySelectionFromQuery();
    });
  }

  /** Update URL query params to match current selection so refresh/share link works. */
  private updateUrlFromSelection(): void {
    const spaceId = this.expandedSpaceId();
    const space = spaceId != null ? this.spaces().find((s) => s.id === spaceId) ?? null : null;
    const folderId = space ? this.getActiveFolderId(space) : null;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { space: spaceId ?? null, folder: folderId ?? null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** Find space that contains the given folder (folder is root or descendant of space root). */
  private findSpaceIdForFolderId(
    folderId: number,
    folders: Folder[],
    spaces: Space[]
  ): number | null {
    let current = folders.find((f) => f.id === folderId);
    while (current) {
      if (current.parent_id === null) {
        const space = spaces.find((s) => s.root_folder_id === current!.id);
        return space?.id ?? null;
      }
      current = folders.find((f) => f.id === current!.parent_id);
    }
    return null;
  }

  private loadSidebarData(): void {
    forkJoin({
      spaces: this.spacesService.list(),
      folders: this.foldersService.getTree(),
    }).subscribe({
      next: ({ spaces, folders }) => {
        this.spaces.set(spaces);
        this.folders.set(folders);
        this.applySelectionFromQuery();
      },
      error: () => {},
    });
  }

  private refreshFolders(): void {
    this.foldersService.getTree().subscribe({
      next: (list) => this.folders.set(list),
      error: () => {},
    });
  }

  private applySelectionFromQuery(): void {
    const spaces = this.spaces();
    const folders = this.folders();
    if (spaces.length === 0 || folders.length === 0) return;

    if (this.queryFolderId != null) {
      const spaceIdForFolder = this.findSpaceIdForFolderId(
        this.queryFolderId,
        folders,
        spaces
      );
      if (spaceIdForFolder != null) {
        this.expandedSpaceId.set(spaceIdForFolder);
        this.selectedFolderId.set(this.queryFolderId);
        return;
      }
    }

    if (this.querySpaceId != null) {
      const space = spaces.find((s) => s.id === this.querySpaceId);
      if (space) {
        this.expandedSpaceId.set(space.id);
        this.selectedFolderId.set(space.root_folder_id);
        return;
      }
    }

    const currentSpace = this.expandedSpace();
    if (currentSpace && !this.isFolderInSpace(this.selectedFolderId(), currentSpace.id)) {
      this.selectedFolderId.set(currentSpace.root_folder_id);
    }
  }

  toggleSection(): void {
    this.sectionExpanded.update((v) => !v);
  }

  toggleSpace(space: Space): void {
    const nextId = this.expandedSpaceId() === space.id ? null : space.id;
    this.expandedSpaceId.set(nextId);
    if (nextId === space.id) {
      this.selectedFolderId.set(space.root_folder_id);
      this.contentExpanded.set(true);
      this.updateUrlFromSelection();
      if (this.hasAboutNote(space)) this.selectNote.emit(space.about_note_id!);
    } else {
      this.updateUrlFromSelection();
    }
  }

  toggleContent(space: Space): void {
    this.selectedFolderId.set(space.root_folder_id);
    this.contentExpanded.update((v) => !v);
    this.updateUrlFromSelection();
  }

  getActiveFolderId(space: Space): number {
    const selected = this.selectedFolderId();
    if (this.isFolderInSpace(selected, space.id)) {
      return selected!;
    }
    return space.root_folder_id;
  }

  private isFolderInSpace(folderId: number | null, spaceId: number): boolean {
    if (folderId == null) return false;
    const folderMap = new Map(this.folders().map((f) => [f.id, f]));
    const space = this.spaces().find((s) => s.id === spaceId);
    if (!space) return false;

    let current = folderMap.get(folderId) ?? null;
    while (current) {
      if (current.id === space.root_folder_id) return true;
      if (current.parent_id == null) return false;
      current = folderMap.get(current.parent_id) ?? null;
    }
    return false;
  }

  openCreateSpaceModal(): void {
    this.createSpaceError.set(null);
    this.showCreateSpaceModal.set(true);
  }

  onCreateSpaceName(name: string): void {
    this.createSpaceError.set(null);
    this.spacesService.create(name).subscribe({
      next: (space) => {
        this.showCreateSpaceModal.set(false);
        this.spaces.update((list) => [...list, space]);
        this.expandedSpaceId.set(space.id);
        this.selectedFolderId.set(space.root_folder_id);
        this.contentExpanded.set(true);
        this.refreshFolders();
        if (this.hasAboutNote(space)) this.selectNote.emit(space.about_note_id!);
      },
      error: (err) => {
        const msg =
          err?.error?.error ?? err?.message ?? err?.statusText;
        let text = typeof msg === 'string' ? msg : 'Failed to create space';
        if (
          typeof msg === 'string' &&
          (msg.includes('about_note_id') || msg.includes('null value'))
        ) {
          text += ' Run migrations: cd backend && npm run migrate';
        }
        this.createSpaceError.set(text);
      },
    });
  }

  closeCreateSpaceModal(): void {
    this.showCreateSpaceModal.set(false);
    this.createSpaceError.set(null);
  }

  onSelectFolder(folderId: number | null): void {
    const expanded = this.expandedSpaceId();
    if (expanded != null && !this.isFolderInSpace(folderId, expanded)) {
      return;
    }
    this.selectedFolderId.set(folderId);
    this.updateUrlFromSelection();
  }

  onSelectNote(noteId: string): void {
    this.selectNote.emit(noteId);
  }

  openAboutNote(noteId: string): void {
    this.selectNote.emit(noteId);
  }

  toggleContentCreate(space: Space, event: Event): void {
    const btn = (event.target as HTMLElement).closest('button') as HTMLElement;
    const rect = btn?.getBoundingClientRect();
    if (this.contentCreateOpenSpaceId() === space.id) {
      this.closeContentCreate();
    } else {
      this.contentCreateOpenSpaceId.set(space.id);
      this.contentCreateParentFolderId.set(space.root_folder_id);
      this.contentCreatePosition.set(
        rect ? { top: rect.bottom + 4, left: rect.left } : null
      );
    }
  }

  closeContentCreate(): void {
    this.contentCreateOpenSpaceId.set(null);
    this.contentCreatePosition.set(null);
    this.contentCreateParentFolderId.set(null);
  }

  private readonly defaultFolderName = 'folder';

  onCreateFolder(): void {
    const parentId = this.contentCreateParentFolderId();
    if (parentId == null) return;
    this.foldersService.create(parentId, this.defaultFolderName).subscribe({
      next: (created) => {
        this.closeContentCreate();
        const trees = this.folderTreeRefs();
        const expanded = this.expandedSpace();
        const tree = expanded
          ? trees.find((t) => Number(t.getRootFolderId()) === Number(expanded.root_folder_id))
          : trees[0];
        tree?.refresh();
        this.refreshFolders();
        this.onFolderCreated(created);
      },
      error: () => alert('Failed to create folder'),
    });
  }

  private readonly defaultNoteTitle = 'note';

  onCreateNote(): void {
    const folderId = this.contentCreateParentFolderId();
    if (folderId == null) return;
    this.notesService.create(folderId, this.defaultNoteTitle).subscribe({
      next: (created) => {
        this.closeContentCreate();
        this.selectedFolderId.set(folderId);
        this.refreshNotesListForFolder(folderId);
        this.noteIdBeingRenamed.set(created.id);
        this.selectNote.emit(created.id);
      },
      error: () => alert('Failed to create page'),
    });
  }

  onFolderCreated(created: Folder): void {
    // Keep parent folder selected so its existing content stays visible.
    this.selectedFolderId.set(created.parent_id ?? created.id);
    this.folderIdBeingRenamed.set(created.id);
    this.updateUrlFromSelection();
  }

  onFolderRenamed(_payload: { folderId: number; newName: string }): void {
    this.folderIdBeingRenamed.set(null);
  }

  onNoteRenamed(): void {
    this.noteIdBeingRenamed.set(null);
  }

  onCreateNoteInFolder(folderId: number): void {
    this.notesService.create(folderId, this.defaultNoteTitle).subscribe({
      next: (created) => {
        this.selectedFolderId.set(folderId);
        this.refreshNotesListForFolder(folderId);
        this.noteIdBeingRenamed.set(created.id);
        this.selectNote.emit(created.id);
      },
      error: () => alert('Failed to create note'),
    });
  }

  private refreshNotesListForFolder(folderId: number): void {
    const refs = this.notesListRefs();
    for (const ref of refs) {
      if (Number(ref.folderId()) === Number(folderId)) {
        ref.refresh(folderId);
      }
    }
  }

  toggleSpaceMenu(spaceId: number, event: Event): void {
    event.stopPropagation();
    const btn = (event.target as HTMLElement).closest('button') as HTMLElement;
    const rect = btn?.getBoundingClientRect();
    if (this.spaceMenuOpenId() === spaceId) {
      this.spaceMenuOpenId.set(null);
      this.spaceMenuPosition.set(null);
    } else {
      this.spaceMenuOpenId.set(spaceId);
      this.spaceMenuPosition.set(
        rect ? { top: rect.bottom + 4, left: rect.left } : null
      );
    }
  }

  onEditSpace(space: Space): void {
    this.spaceMenuOpenId.set(null);
    this.spaceMenuPosition.set(null);
    this.editSpaceError.set(null);
    this.editSpaceId.set(space.id);
  }

  onToggleVisibility(space: Space): void {
    const next = space.visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC';
    this.spacesService.update(space.id, { visibility: next }).subscribe({
      next: (updated) => {
        this.spaces.update((list) => list.map((s) => (s.id === updated.id ? updated : s)));
        this.spaceMenuOpenId.set(null);
        this.spaceMenuPosition.set(null);
      },
      error: () => {},
    });
  }

  onToggleFavourite(spaceId: number): void {
    this.favouriteService.toggleSpace(spaceId);
    this.spaceMenuOpenId.set(null);
    this.spaceMenuPosition.set(null);
  }

  onDeleteSpace(space: Space): void {
    this.spaceMenuOpenId.set(null);
    this.spaceMenuPosition.set(null);
    this.deleteSpaceId.set(space.id);
  }

  closeSpaceMenu(): void {
    this.spaceMenuOpenId.set(null);
    this.spaceMenuPosition.set(null);
  }

  onUpdateSpaceName(name: string): void {
    const id = this.editSpaceId();
    if (id == null) return;
    this.editSpaceError.set(null);
    this.spacesService.update(id, { name: name.trim() }).subscribe({
      next: (updated) => {
        this.spaces.update((list) => list.map((s) => (s.id === updated.id ? updated : s)));
        this.editSpaceId.set(null);
      },
      error: () => this.editSpaceError.set('Failed to update space'),
    });
  }

  closeEditSpaceModal(): void {
    this.editSpaceId.set(null);
    this.editSpaceError.set(null);
  }

  onConfirmDeleteSpace(): void {
    const id = this.deleteSpaceId();
    if (id == null) return;
    this.spacesService.delete(id).subscribe({
      next: () => {
        this.spaces.update((list) => list.filter((s) => s.id !== id));
        this.refreshFolders();
        if (this.expandedSpaceId() === id) this.expandedSpaceId.set(null);
        this.deleteSpaceId.set(null);
      },
      error: () => {},
    });
  }

  closeDeleteSpaceModal(): void {
    this.deleteSpaceId.set(null);
  }
}
