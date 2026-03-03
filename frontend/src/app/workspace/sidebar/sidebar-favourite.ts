import { Component, signal, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { forkJoin } from 'rxjs';
import { FavouriteService } from '../../core/sidebar/favourite.service';
import { FoldersService, Folder } from '../../core/api/folders.service';
import { NotesService, Note } from '../../core/api/notes.service';
import { SpacesService, Space } from '../../core/api/spaces.service';
import { SidebarSectionComponent } from './sidebar-section';
import { IconStarFullComponent } from '../icons/icon-star-full';
import { IconPlanetRingComponent } from '../icons/icon-planet-ring';
import { IconFolderComponent } from '../icons/icon-folder';
import { IconContentComponent } from '../icons/icon-content';

@Component({
  selector: 'app-sidebar-favourite',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    SidebarSectionComponent,
    IconStarFullComponent,
    IconPlanetRingComponent,
    IconFolderComponent,
    IconContentComponent,
  ],
  providers: [DatePipe],
  template: `
    <app-sidebar-section
      title="Favourite"
      [panelMode]="true"
      [expanded]="expanded()"
      (expandedChange)="expanded.set($event)"
    >
      <span sidebarSectionIcon><app-icon-star-full></app-icon-star-full></span>
      <div class="sidebar-section-body" sidebarSectionContent>
        @if (folders().length === 0 && notes().length === 0 && spaces().length === 0) {
          <div class="fav-empty">
            <p class="sidebar-empty">Nothing in favourites yet.</p>
            <p class="sidebar-empty-hint">Star spaces, folders or pages in the sidebar — they’ll show up here for quick access.</p>
          </div>
        } @else {
          <div class="fav-header">
            <h2 class="fav-title">Favourite</h2>
            <p class="fav-subtitle">Quick access to your starred items.</p>
            <div class="fav-title-line"></div>
          </div>
          @if (spaces().length > 0) {
            <div class="fav-group">
              <p class="fav-group-label">Spaces</p>
              <div class="fav-group-line"></div>
              <ul class="sidebar-list">
                @for (s of spaces(); track s.id) {
                  <li>
                    <a [routerLink]="['/home']" [queryParams]="{ space: s.id }" class="sidebar-link sidebar-link--with-meta" (click)="expanded.set(false)">
                      <span class="sidebar-link-icon"><app-icon-planet-ring></app-icon-planet-ring></span>
                      <span class="sidebar-link-text">
                        <span class="sidebar-link-title">{{ s.name }}</span>
                        @if (s.note_count !== undefined) {
                          <span class="sidebar-link-meta">{{ s.note_count }} {{ s.note_count === 1 ? 'note' : 'notes' }}</span>
                        }
                      </span>
                    </a>
                  </li>
                }
              </ul>
            </div>
          }
          @if (folders().length > 0) {
            <div class="fav-group">
              <p class="fav-group-label">Folders</p>
              <div class="fav-group-line"></div>
              <ul class="sidebar-list">
                @for (f of folders(); track f.id) {
                  <li>
                    <a [routerLink]="['/home']" [queryParams]="{ folder: f.id }" class="sidebar-link" (click)="expanded.set(false)">
                      <span class="sidebar-link-icon"><app-icon-folder></app-icon-folder></span>
                      <span class="sidebar-link-text">
                        <span class="sidebar-link-title">{{ f.title }}</span>
                      </span>
                    </a>
                  </li>
                }
              </ul>
            </div>
          }
          @if (notes().length > 0) {
            <div class="fav-group">
              <p class="fav-group-label">Pages</p>
              <div class="fav-group-line"></div>
              <ul class="sidebar-list">
                @for (n of notes(); track n.id) {
                  <li>
                    <a [routerLink]="['/home', 'notes', n.id]" class="sidebar-link sidebar-link--with-meta" (click)="expanded.set(false)">
                      <span class="sidebar-link-icon"><app-icon-content></app-icon-content></span>
                      <span class="sidebar-link-text">
                        <span class="sidebar-link-title">{{ n.title }}</span>
                        <span class="sidebar-link-meta">{{ getPageMeta(n) }}</span>
                      </span>
                    </a>
                  </li>
                }
              </ul>
            </div>
          }
        }
      </div>
    </app-sidebar-section>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
      .sidebar-section-body {
        min-height: 2.5rem;
      }
      .fav-empty {
        padding: 0.25rem 0;
      }
      .sidebar-empty {
        margin: 0;
        font-size: 0.9375rem;
        color: var(--text-color, #111);
      }
      .sidebar-empty-hint {
        margin: 0.35rem 0 0 0;
        font-size: 0.8125rem;
        color: var(--text-muted, #666);
      }
      .fav-header {
        margin-bottom: 0.75rem;
      }
      .fav-title {
        font-size: 1rem;
        font-weight: 700;
        margin: 0 0 0.2rem 0;
        color: var(--text-color, #111);
      }
      .fav-subtitle {
        margin: 0 0 0.35rem 0;
        font-size: 0.8125rem;
        color: var(--text-muted, #666);
      }
      .fav-title-line {
        height: 1px;
        background: var(--border-color, #e0e0e0);
      }
      .fav-group {
        margin-bottom: 0.75rem;
      }
      .fav-group:last-child {
        margin-bottom: 0;
      }
      .fav-group-label {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        color: var(--text-muted, #666);
        margin: 0 0 0.25rem 0;
      }
      .fav-group-line {
        height: 1px;
        background: var(--border-color, #e0e0e0);
        margin-bottom: 0.35rem;
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
        gap: 0.5rem;
        min-height: 2rem;
        padding: 0.25rem 0;
        width: 100%;
        box-sizing: border-box;
        font-size: 0.8125rem;
        color: inherit;
        text-decoration: none;
        overflow: hidden;
      }
      .sidebar-link:hover {
        color: var(--focus-color, #1976d2);
      }
      .sidebar-link:hover .sidebar-link-meta {
        color: var(--focus-color, #1976d2);
      }
      .sidebar-link-icon {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-muted, #666);
      }
      .sidebar-link:hover .sidebar-link-icon {
        color: inherit;
      }
      .sidebar-link-text {
        min-width: 0;
      }
      .sidebar-link-title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .sidebar-link--with-meta .sidebar-link-text {
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
        min-width: 0;
      }
      .sidebar-link-meta {
        font-size: 0.7rem;
        color: var(--text-muted, #666);
      }
    `,
  ],
})
export class SidebarFavouriteComponent implements OnInit {
  private datePipe = inject(DatePipe);
  expanded = signal(false);
  spaces = signal<Space[]>([]);
  folders = signal<Folder[]>([]);
  notes = signal<Note[]>([]);

  constructor(
    private favouriteService: FavouriteService,
    private foldersService: FoldersService,
    private notesService: NotesService,
    private spacesService: SpacesService
  ) {
    this.favouriteService.refresh$.subscribe(() => this.load());
  }

  ngOnInit(): void {
    this.load();
  }

  getPageMeta(n: Note): string {
    const visited = this.favouriteService.getNoteLastVisited(n.id);
    const date = visited != null ? visited : n.updated_at;
    const formatted = this.datePipe.transform(date, 'short') ?? '';
    return visited != null ? `Visited ${formatted}` : `Updated ${formatted}`;
  }

  private load(): void {
    const fav = this.favouriteService.getFavourites();
    if (fav.spaceIds.length > 0) {
      this.spacesService.list().subscribe((all) => {
        this.spaces.set(all.filter((s) => fav.spaceIds.includes(s.id)));
      });
    } else {
      this.spaces.set([]);
    }
    if (fav.folderIds.length > 0) {
      this.foldersService.getTree().subscribe((all) => {
        this.folders.set(all.filter((f) => fav.folderIds.includes(f.id)));
      });
    } else {
      this.folders.set([]);
    }
    const noteRequests = fav.noteIds.map((id) => this.notesService.get(id));
    if (noteRequests.length > 0) {
      forkJoin(noteRequests).subscribe((list) => this.notes.set(list));
    } else {
      this.notes.set([]);
    }
  }
}
