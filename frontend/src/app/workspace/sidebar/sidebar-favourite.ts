import { Component, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { FavouriteService } from '../../core/sidebar/favourite.service';
import { FoldersService, Folder } from '../../core/api/folders.service';
import { NotesService, Note } from '../../core/api/notes.service';
import { SpacesService, Space } from '../../core/api/spaces.service';
import { SidebarSectionComponent } from './sidebar-section';
import { IconStarFullComponent } from '../icons/icon-star-full';

@Component({
  selector: 'app-sidebar-favourite',
  standalone: true,
  imports: [CommonModule, RouterLink, SidebarSectionComponent, IconStarFullComponent],
  template: `
    <app-sidebar-section
      title="Favourite"
      [panelMode]="true"
      [expanded]="expanded()"
      (expandedChange)="expanded.set($event)"
    >
      <span sidebarSectionIcon><app-icon-star-full></app-icon-star-full></span>
      @if (folders().length === 0 && notes().length === 0 && spaces().length === 0) {
        <p class="sidebar-empty">You don't have anything in favourite.</p>
      } @else {
        <ul class="sidebar-list">
          @for (s of spaces(); track s.id) {
            <li>
              <a [routerLink]="['/home']" [queryParams]="{ space: s.id }" class="sidebar-link" (click)="expanded.set(false)">◇ {{ s.name }}</a>
            </li>
          }
          @for (f of folders(); track f.id) {
            <li>
              <a [routerLink]="['/home']" [queryParams]="{ folder: f.id }" class="sidebar-link" (click)="expanded.set(false)">📁 {{ f.title }}</a>
            </li>
          }
          @for (n of notes(); track n.id) {
            <li>
              <a [routerLink]="['/home', 'notes', n.id]" class="sidebar-link" (click)="expanded.set(false)">📄 {{ n.title }}</a>
            </li>
          }
        </ul>
      }
    </app-sidebar-section>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
      .sidebar-empty {
        margin: 0.5rem 0 0.25rem 0;
        font-size: 0.9375rem;
        color: var(--text-color, #111);
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
        min-height: 2rem;
        padding: 0;
        font-size: 0.8125rem;
        color: inherit;
        text-decoration: none;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .sidebar-link:hover {
        color: var(--focus-color, #1976d2);
      }
    `,
  ],
})
export class SidebarFavouriteComponent implements OnInit {
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
