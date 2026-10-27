import { Component, input } from '@angular/core';
const paths: Record<string, string> = {
  moon: 'M21 13a9 9 0 0 1-10-10 9 9 0 1 0 10 10',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5L19 19 M5 19l1.5-1.5 M17.5 6.5L19 5',
  book: 'M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4z M20 4h-5a2 2 0 0 0-2 2v15a4 4 0 0 1 4-2h3z',
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  users:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  chart: 'M4 3v18h17 M8 16v-5 M13 16V7 M18 16v-8',
  search: 'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  arrow: 'M4 12h16 M14 6l6 6-6 6',
  check: 'M5 12l4 4L19 6',
  play: 'M9 5l11 7-11 7z',
  clock: 'M12 8v4l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  plus: 'M12 5v14 M5 12h14',
  edit: 'M16 3l5 5-12 12H4v-5z M14 5l5 5',
  trash: 'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
  close: 'M6 6l12 12 M6 18L18 6',
  menu: 'M3 6h18 M3 12h18 M3 18h18',
  chevron: 'M9 5l7 7-7 7',
  logout: 'M9 21H4V3h5 M12 12h10 M18 8l4 4-4 4',
  settings:
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2',
  shield: 'M12 2l9 4v6c0 6-9 10-9 10S3 18 3 12V6z M8 12l3 3 5-6',
  spark: 'M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z',
  code: 'M8 7l-5 5 5 5 M16 7l5 5-5 5 M14 3l-4 18',
  trophy: 'M8 3h8v8a4 4 0 0 1-8 0z M8 5H3v3a5 5 0 0 0 5 5 M16 5h5v3a5 5 0 0 1-5 5 M12 15v6 M8 21h8',
  mail: 'M3 5h18v14H3z M3 5l9 8 9-8',
  lock: 'M5 10h14v11H5z M8 10V6a4 4 0 0 1 8 0v4',
  globe:
    'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M2 12h20 M12 2a20 20 0 0 1 0 20 20 20 0 0 1 0-20',
  help: 'M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5 M12 17h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
};
@Component({
  selector: 'app-icon',
  template: `<svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path [attr.d]="paths[name()] || paths['book']" />
  </svg>`,
  styles: `
    :host {
      display: inline-flex;
      flex-shrink: 0;
      vertical-align: middle;
    }
  `,
})
export class IconComponent {
  name = input('book');
  protected paths = paths;
}
