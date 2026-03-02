import { Component } from '@angular/core';

@Component({
  selector: 'app-icon-ellipsis',
  standalone: true,
  template: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M96 320C124.7 320 148 343.3 148 372C148 400.7 124.7 424 96 424C67.3 424 44 400.7 44 372C44 343.3 67.3 320 96 320zM320 320C348.7 320 372 343.3 372 372C372 400.7 348.7 424 320 424C291.3 424 268 400.7 268 372C268 343.3 291.3 320 320 320zM544 320C572.7 320 596 343.3 596 372C596 400.7 572.7 424 544 424C515.3 424 492 400.7 492 372C492 343.3 515.3 320 544 320z"/>
    </svg>
  `,
})
export class IconEllipsisComponent {}
