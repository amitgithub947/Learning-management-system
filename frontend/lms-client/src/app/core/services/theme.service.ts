import { Chart } from 'chart.js';
import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  readonly dark = signal(this.document.documentElement.dataset['theme'] === 'dark');

  constructor() {
    this.updateCharts(this.dark());
  }

  private updateCharts(dark: boolean) {
    Chart.defaults.color = dark ? '#b3bdd3' : '#73788b';
    Chart.defaults.borderColor = dark ? '#30394e' : '#e9ebf2';
    for (const chart of Object.values(Chart.instances)) {
      chart.options.color = Chart.defaults.color;
      chart.update('none');
    }
  }

  toggle() {
    const dark = !this.dark();
    this.dark.set(dark);
    this.updateCharts(dark);
    this.document.documentElement.dataset['theme'] = dark ? 'dark' : 'light';
    try {
      localStorage.setItem('learnwell-theme', dark ? 'dark' : 'light');
    } catch {
      /* Storage may be disabled. */
    }
  }
}
