import { Component } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { SearchBarComponent } from './search-bar/search-bar';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, SearchBarComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
