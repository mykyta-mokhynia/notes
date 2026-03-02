import {
  Component,
  OnInit,
  output,
  viewChild,
  signal,
  HostListener,
  computed,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SpacesService, Space } from '../../core/api/spaces.service';
import { FoldersService } from '../../core/api/folders.service';
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
import { IconPageComponent } from '../icons/icon-page';
import { IconFolderComponent } from '../icons/icon-folder';
import { IconPlanetRingComponent } from '../icons/icon-planet-ring';
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
    IconPageComponent,
    IconFolderComponent,
    IconPlanetRingComponent,
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
  sectionExpanded = signal(true);
  expandedSpaceId = signal<number | null>(null);
  /** Whether the "Content" block is expanded (when a space is expanded). */
  contentExpanded = signal(true);
  selectedFolderId = signal<number | null>(null);
  showCreateSpaceModal = signal(false);
  createSpaceError = signal<string | null>(null);
  /** Which space has the content create popup open (folder/note). */
  contentCreateOpenSpaceId = signal<number | null>(null);
  /** Position for the content create dropdown (fixed overlay). */
  contentCreatePosition = signal<{ top: number; left: number } | null>(null);
  /** Which space has the context menu open. */
  spaceMenuOpenId = signal<number | null>(null);
  /** Position for the fixed context menu (viewport coordinates). */
  spaceMenuPosition = signal<{ top: number; left: number } | null>(null);
  /** Which space is being edited (modal open). */
  editSpaceId = signal<number | null>(null);
  editSpaceError = signal<string | null>(null);
  /** Which space is being deleted (modal open). */
  deleteSpaceId = signal<number | null>(null);

  folderTreeRef = viewChild(FolderTreeComponent);
  notesListRef = viewChild(NotesListComponent);

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
    public favouriteService: FavouriteService
  ) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target?.closest?.('.content-create-wrap') == null && target?.closest?.('.content-create-dropdown') == null) {
      this.closeContentCreate();
    }
    if (target?.closest?.('.space-menu-wrap') == null && target?.closest?.('.space-context-menu') == null) {
      this.closeSpaceMenu();
    }
  }

  ngOnInit(): void {
    this.loadSpaces();
    this.route.queryParamMap.subscribe((params) => {
      const folder = params.get('folder');
      if (folder) {
        const id = parseInt(folder, 10);
        if (!Number.isNaN(id)) this.selectedFolderId.set(id);
      }
      const space = params.get('space');
      if (space) {
        const id = parseInt(space, 10);
        if (!Number.isNaN(id)) this.expandedSpaceId.set(id);
      }
    });
  }

  loadSpaces(): void {
    this.spacesService.list().subscribe({
      next: (list) => this.spaces.set(list),
      error: () => {},
    });
  }

  toggleSection(): void {
    this.sectionExpanded.update((v) => !v);
  }

  toggleSpace(space: Space): void {
    this.expandedSpaceId.update((id) => (id === space.id ? null : space.id));
    if (this.expandedSpaceId() === space.id) {
      this.selectedFolderId.set(space.root_folder_id);
      this.contentExpanded.set(true);
      if (this.hasAboutNote(space)) this.selectNote.emit(space.about_note_id!);
    }
  }

  toggleContent(): void {
    this.contentExpanded.update((v) => !v);
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
    this.selectedFolderId.set(folderId);
  }

  onSelectNote(noteId: string): void {
    this.selectNote.emit(noteId);
  }

  openAboutNote(noteId: string): void {
    this.selectNote.emit(noteId);
  }

  toggleContentCreate(spaceId: number, event: Event): void {
    const btn = (event.target as HTMLElement).closest('button') as HTMLElement;
    const rect = btn?.getBoundingClientRect();
    if (this.contentCreateOpenSpaceId() === spaceId) {
      this.contentCreateOpenSpaceId.set(null);
      this.contentCreatePosition.set(null);
    } else {
      this.contentCreateOpenSpaceId.set(spaceId);
      this.contentCreatePosition.set(
        rect ? { top: rect.bottom + 4, left: rect.left } : null
      );
    }
  }

  closeContentCreate(): void {
    this.contentCreateOpenSpaceId.set(null);
    this.contentCreatePosition.set(null);
  }

  onCreateFolder(): void {
    const space = this.expandedSpace();
    const tree = this.folderTreeRef();
    if (space && tree) {
      tree.createFolder(this.selectedFolderId() ?? space.root_folder_id);
    }
    this.closeContentCreate();
  }

  onCreateNote(): void {
    const list = this.notesListRef();
    if (list) list.onCreateNote();
    this.closeContentCreate();
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
