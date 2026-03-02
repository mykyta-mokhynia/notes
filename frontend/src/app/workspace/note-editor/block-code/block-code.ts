import { Component, input, output } from '@angular/core';
import { NoteBlock } from '../../../core/api/notes.service';

@Component({
  selector: 'app-block-code',
  standalone: true,
  templateUrl: './block-code.html',
  styleUrl: './block-code.scss',
})
export class BlockCodeComponent {
  block = input.required<NoteBlock>();
  contentChange = output<Record<string, unknown>>();

  get rawCode(): string {
    const data = this.block().data;
    if (data && typeof data['raw_code'] === 'string') return data['raw_code'];
    return '';
  }

  onInput(e: Event): void {
    const value = (e.target as HTMLTextAreaElement).value;
    this.contentChange.emit({ ...this.block().data, raw_code: value });
  }
}
