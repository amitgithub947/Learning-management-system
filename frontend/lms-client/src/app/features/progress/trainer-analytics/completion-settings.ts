import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CompletionService } from '../../../core/services/completion.service';
import { CourseNav } from '../../../shared/components/course-nav';
import { IconComponent } from '../../../shared/components/icon';
import { ErrorComponent, SkeletonComponent, uiHelpers } from '../../../shared/components/ui';
import { errorMessage } from '../../../core/interceptors/error.interceptor';
@Component({
  imports: [ReactiveFormsModule, CourseNav, IconComponent, ErrorComponent, SkeletonComponent],
  template: `<div class="page-heading">
      <span class="eyebrow">MAKE THE FINISH LINE CLEAR</span>
      <h1>Course completion rules</h1>
      <p>Define what learners must achieve before receiving their certificate.</p>
    </div>
    <app-course-nav [courseId]="id" />
    @if (loading()) {
      <app-skeleton />
    } @else if (loadError()) {
      <app-error [message]="loadError()" (retry)="load()" />
    } @else {
      <section class="panel editor-panel">
        <form [formGroup]="form" (ngSubmit)="save()" class="form-stack">
          <label class="completion-rule"
            ><input type="checkbox" formControlName="requireLessons" />
            <div>
              <strong>Required lessons must be completed</strong>
              <p>Every lesson marked as required must have a saved completion record.</p>
            </div></label
          ><label class="completion-rule"
            ><input type="checkbox" formControlName="requireAssignments" />
            <div>
              <strong>Required assignments must be passed</strong>
              <p>
                Each required assignment needs a graded submission meeting its passing percentage.
              </p>
            </div></label
          ><label class="completion-rule"
            ><input type="checkbox" formControlName="requireQuizzes" />
            <div>
              <strong>Required quizzes must be passed</strong>
              <p>
                At least one submitted attempt must pass each required quiz. Required draft quizzes
                also block completion until published and passed.
              </p>
            </div></label
          >
          <p class="form-hint">
            Enable at least one rule. A course must contain at least one required activity before it
            can be completed. Existing enrollments are recalculated after changes. The curriculum
            locks after its first certificate is issued.
          </p>
          @if (error()) {
            <div class="form-error" role="alert">{{ error() }}</div>
          }
          <button class="btn btn-primary" [disabled]="busy()">
            {{ busy() ? 'Saving…' : 'Save completion rules' }}<app-icon name="check" />
          </button>
        </form>
      </section>
    }`,
})
export class CompletionSettingsPage {
  private api = inject(CompletionService);
  private ui = uiHelpers();
  id = inject(ActivatedRoute).snapshot.paramMap.get('id')!;
  loading = signal(true);
  busy = signal(false);
  loadError = signal('');
  error = signal('');
  form = inject(FormBuilder).nonNullable.group({
    requireLessons: true,
    requireAssignments: true,
    requireQuizzes: true,
  });
  constructor() {
    void this.load();
  }
  async load() {
    this.loading.set(true);
    this.loadError.set('');
    try {
      this.form.patchValue(await firstValueFrom(this.api.settings(this.id)));
    } catch (e) {
      this.loadError.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
  async save() {
    const value = this.form.getRawValue();
    if (!value.requireLessons && !value.requireAssignments && !value.requireQuizzes) {
      this.error.set('Enable at least one completion rule.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.api.saveSettings(this.id, value));
      this.ui.toast('Completion requirements saved and enrollments recalculated.');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
