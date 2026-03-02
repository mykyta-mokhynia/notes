import { Component, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SearchService, SearchHit } from '../core/api/search.service';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './search-bar.html',
  styleUrl: './search-bar.scss',
})
export class SearchBarComponent {
  searchQuery = signal('');
  results = signal<SearchHit[]>([]);
  loading = signal(false);
  open = signal(false);
  private searchTerm$ = new Subject<string>();

  constructor(private searchService: SearchService) {
    this.searchTerm$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((q) => {
          this.loading.set(true);
          return this.searchService.search(q);
        })
      )
      .subscribe({
        next: (hits) => {
          this.results.set(hits);
          this.loading.set(false);
          this.open.set(true);
        },
        error: () => this.loading.set(false),
      });
  }

  onInput(e: Event): void {
    const q = (e.target as HTMLInputElement).value;
    this.searchQuery.set(q);
    if (q.trim().length >= 2) {
      this.searchTerm$.next(q.trim());
    } else {
      this.results.set([]);
      this.open.set(q.length > 0);
    }
  }

  noteUrl(noteId: string): string[] {
    return ['/home', 'notes', noteId];
  }

  noteQueryParams(noteId: string): { q?: string } {
    const q = this.searchQuery().trim();
    return q ? { q } : {};
  }

  close(): void {
    this.open.set(false);
  }

  trackById(_: number, hit: SearchHit): string | number {
    return hit.type === 'folder' ? hit.id : hit.id;
  }
}
