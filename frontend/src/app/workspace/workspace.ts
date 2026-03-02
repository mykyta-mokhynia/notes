import { Component } from '@angular/core';
import { RouterOutlet, Router, ActivatedRoute } from '@angular/router';
import { SidebarAboutComponent } from './sidebar/sidebar-about';
import { SidebarRecentComponent } from './sidebar/sidebar-recent';
import { SidebarFavouriteComponent } from './sidebar/sidebar-favourite';
import { SidebarSpacesComponent } from './sidebar/sidebar-spaces';

@Component({
  selector: 'app-workspace',
  imports: [
    RouterOutlet,
    SidebarAboutComponent,
    SidebarRecentComponent,
    SidebarFavouriteComponent,
    SidebarSpacesComponent,
  ],
  templateUrl: './workspace.html',
  styleUrl: './workspace.scss',
})
export class WorkspaceComponent {
  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) {}

  onSelectNote(noteId: string): void {
    this.router.navigate(['notes', noteId], { relativeTo: this.route });
  }
}
