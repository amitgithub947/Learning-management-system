import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AssignmentService } from '../../../core/services/assignment.service';
import { CourseWorkspaceService } from '../../../core/services/course-workspace.service';
import { AuthService } from '../../../core/auth/auth.service';
import { CourseChoice } from '../../../core/models/advanced';
import { ErrorComponent, uiHelpers } from '../../../shared/components/ui';
import { IconComponent } from '../../../shared/components/icon';
import { errorMessage } from '../../../core/interceptors/error.interceptor';
@Component({
  imports: [ReactiveFormsModule, RouterLink, ErrorComponent, IconComponent],
  template: `<div class="breadcrumbs">
      <a [routerLink]="base + '/assignments'">Assignments</a><span>/</span
      >{{ id ? 'Edit' : 'Create' }}
    </div>
    <div class="page-heading">
      <span class="eyebrow">MAKE PRACTICE MEANINGFUL</span>
      <h1>{{ id ? 'Refine the assignment.' : 'A new opportunity to apply it.' }}</h1>
      <p>Set a clear brief, a realistic deadline, and transparent passing criteria.</p>
    </div>
    @if (loadError()) {
      <app-error [message]="loadError()" (retry)="load()" />
    } @else {
      <section class="panel editor-panel">
        <form [formGroup]="form" (ngSubmit)="save()" class="form-stack">
          <label
            >Course<select formControlName="courseId">
              @for (c of choices(); track c.courseId) {
                <option [value]="c.courseId">{{ c.title }}</option>
              }
            </select></label
          ><label
            >Assignment title<input
              formControlName="title"
              maxlength="200"
              placeholder="A practical, focused challenge" /></label
          ><label
            >Instructions<textarea
              formControlName="description"
              rows="7"
              placeholder="Explain the task, expected answer, and grading criteria."
            ></textarea>
          </label>
          <div class="form-columns">
            <label
              >Due date and time<input type="datetime-local" formControlName="dueDate" /><small
                >Shown in your local time. Stored in UTC.</small
              ></label
            ><label
              >Maximum marks<input
                type="number"
                formControlName="maximumMarks"
                min="0.01"
                max="100000"
                step="0.01"
            /></label>
          </div>
          <div class="form-columns">
            <label
              >Passing percentage<input
                type="number"
                formControlName="passingPercentage"
                min="1"
                max="100"
                step="0.01" /></label
            ><label class="checkbox-row"
              ><input type="checkbox" formControlName="isRequired" />Required for course
              completion</label
            >
          </div>
          @if (form.touched && form.invalid) {
            <div class="form-error">
              Complete all fields. Choose a future deadline, positive marks, and a passing
              percentage from 1 to 100.
            </div>
          }
          @if (error()) {
            <div class="form-error" role="alert">{{ error() }}</div>
          }
          <p class="form-hint">
            Grading criteria become fixed once submissions exist. Issued certificates lock the
            course curriculum.
          </p>
          <div class="form-actions">
            <a
              class="btn btn-secondary"
              [routerLink]="base + '/assignments'"
              [queryParams]="{ courseId: form.controls.courseId.value }"
              >Cancel</a
            ><button class="btn btn-primary" [disabled]="busy() || loading()">
              {{ busy() ? 'Saving…' : 'Save assignment' }}<app-icon name="arrow" />
            </button>
          </div>
        </form>
      </section>
    }`,
})
export class AssignmentEditor {
  private api = inject(AssignmentService);
  private workspace = inject(CourseWorkspaceService);
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private ui = uiHelpers();
  id = this.route.snapshot.paramMap.get('id');
  base = '/' + inject(AuthService).user()!.role.toLowerCase();
  choices = signal<CourseChoice[]>([]);
  loading = signal(true);
  busy = signal(false);
  error = signal('');
  loadError = signal('');
  form = this.fb.nonNullable.group({
    courseId: [this.route.snapshot.queryParamMap.get('courseId') || '', Validators.required],
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', [Validators.required, Validators.maxLength(10000)]],
    dueDate: [
      '',
      (c: AbstractControl) =>
        !c.value || new Date(c.value).getTime() <= Date.now() ? { future: true } : null,
    ],
    maximumMarks: [100, [Validators.required, Validators.min(0.01), Validators.max(100000)]],
    passingPercentage: [50, [Validators.required, Validators.min(1), Validators.max(100)]],
    isRequired: [true],
  });
  constructor() {
    void this.load();
  }
  async load() {
    this.loading.set(true);
    this.loadError.set('');
    try {
      this.choices.set(await this.workspace.choices());
      if (this.id) {
        const a = await firstValueFrom(this.api.get(this.id));
        const date = new Date(a.dueDate);
        const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        this.form.patchValue({ ...a, dueDate: local });
        this.form.controls.courseId.disable();
      } else if (!this.form.controls.courseId.value)
        this.form.controls.courseId.setValue(this.choices()[0]?.courseId || '');
    } catch (e) {
      this.loadError.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
  async save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const v = this.form.getRawValue();
      const body = { ...v, dueDate: new Date(v.dueDate).toISOString() };
      const a = await firstValueFrom(
        this.id ? this.api.update(this.id, body) : this.api.create(body),
      );
      this.ui.toast('Assignment saved.');
      await this.router.navigate([this.base + '/assignments', a.assignmentId]);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
