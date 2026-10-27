import { Component, inject } from '@angular/core';
import { ThemeService } from '../../core/services/theme.service';
import { IconComponent } from './icon';

@Component({
  selector: 'app-theme-toggle',
  imports: [IconComponent],
  template: `<button
    class="theme-toggle"
    type="button"
    [attr.aria-pressed]="theme.dark()"
    [attr.aria-label]="theme.dark() ? 'Switch to light mode' : 'Switch to dark mode'"
    [title]="theme.dark() ? 'Switch to light mode' : 'Switch to dark mode'"
    (click)="theme.toggle()"
  >
    <app-icon [name]="theme.dark() ? 'sun' : 'moon'" />
    <span>{{ theme.dark() ? 'Light mode' : 'Dark mode' }}</span>
  </button>`,
})
export class ThemeToggle {
  readonly theme = inject(ThemeService);
}
