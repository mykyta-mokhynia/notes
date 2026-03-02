import { Component, Input, OnInit, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NotesService, Note } from '../../../core/api/notes.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-note-reference-card',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './note-reference-card.html',
  styleUrl: './note-reference-card.scss',
})
export class NoteReferenceCardComponent implements OnInit {
  @Input() targetNoteId = '';
  @Input() display: 'card' | 'inline' = 'card';
  @Input() blockData: Record<string, unknown> = {};
  contentChange = output<Record<string, unknown>>();

  targetNote = null as Note | null;
  loading = true;
  editId = '';

  constructor(private notesService: NotesService) {}

  ngOnInit(): void {
    if (!this.targetNoteId) return;
    this.notesService.get(this.targetNoteId).subscribe({
      next: (n) => {
        this.targetNote = n;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  setTarget(): void {
    const id = this.editId.trim();
    if (!id) return;
    this.contentChange.emit({ ...this.blockData, target_note_id: id });
  }
}
