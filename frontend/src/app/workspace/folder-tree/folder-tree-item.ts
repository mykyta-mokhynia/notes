import { Component, input, output } from '@angular/core';
import { Folder } from '../../core/api/folders.service';
import { FavouriteService } from '../../core/sidebar/favourite.service';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-folder-tree-item',
  standalone: true,
  imports: [CommonModule, DragDropModule, FolderTreeItemComponent],
  templateUrl: './folder-tree-item.html',
  styleUrl: './folder-tree-item.scss',
})
export class FolderTreeItemComponent {
  folder = input.required<Folder>();
  allFolders = input.required<Folder[]>();

  folderClick = output<Folder>();
  createSubfolder = output<number>();
  folderDrop = output<{ folderId: number; newParentId: number | null }>();

  constructor(public favouriteService: FavouriteService) {}

  getChildren(parentId: number): Folder[] {
    return this.allFolders().filter((f) => f.parent_id === parentId);
  }

  onClick(): void {
    this.folderClick.emit(this.folder());
  }

  onAddChild(e: Event): void {
    e.stopPropagation();
    this.createSubfolder.emit(this.folder().id);
  }

  onToggleFavourite(e: Event): void {
    e.stopPropagation();
    this.favouriteService.toggleFolder(this.folder().id);
  }

  onDrop(event: CdkDragDrop<{ parentId: number }, Folder>): void {
    const folder = event.item.data;
    const data = event.container.data;
    if (!folder || !data) return;
    this.folderDrop.emit({ folderId: folder.id, newParentId: data.parentId });
  }
}
