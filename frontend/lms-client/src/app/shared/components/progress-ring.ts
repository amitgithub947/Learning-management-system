import { Component, computed, input } from '@angular/core';
@Component({
  selector: 'app-progress-ring',
  template: `<div
    class="progress-ring"
    role="img"
    [attr.aria-label]="value() + ' percent complete'"
    [style.background]="background()"
  >
    <div>
      <strong>{{ value() }}<small>%</small></strong
      ><span>{{ label() }}</span>
    </div>
  </div>`,
})
export class ProgressRing {
  value = input(0);
  label = input('lessons complete');
  background = computed(
    () =>
      `conic-gradient(#5360eb ${Math.max(0, Math.min(100, this.value())) * 3.6}deg,#edf0fb 0deg)`,
  );
}
