import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { CourseService } from '../../core/services/course.service';
import { IconComponent } from '../../shared/components/icon';
import { ErrorComponent, uiHelpers } from '../../shared/components/ui';
import { errorMessage } from '../../core/interceptors/error.interceptor';
@Component({
  imports: [ReactiveFormsModule, RouterLink, IconComponent, ErrorComponent],
  template: `<div class="breadcrumbs">
      <a [routerLink]="base">My courses</a><span>/</span>{{ id ? 'Edit course' : 'Create course' }}
    </div>
    <div class="page-heading">
      <span class="eyebrow">SHARE WHAT YOU KNOW</span>
      <h1>{{ id ? 'Make it even better.' : 'Every great course starts with an idea.' }}</h1>
      <p>Give your learners a clear path to their next possibility.</p>
    </div>
    @if (loadError()) {
      <app-error [message]="loadError()" (retry)="load()" />
    } @else {
      <div class="editor-grid">
        <section class="panel">
          <form [formGroup]="form" (ngSubmit)="save()" class="form-stack">
            <label
              >Course title <span class="required">*</span
              ><input
                formControlName="title"
                placeholder="Give your course a clear, memorable name"
                maxlength="200"
              />
              @if (invalid('title')) {
                <small class="field-error"
                  >A course title is required (up to 200 characters).</small
                >
              }</label
            ><label
              >Description <span class="required">*</span
              ><textarea
                formControlName="description"
                rows="7"
                placeholder="What will learners discover? What will they be able to do?"
                maxlength="10000"
              ></textarea>
              @if (invalid('description')) {
                <small class="field-error">Describe your course (up to 10,000 characters).</small>
              }
            </label>
            <div class="form-columns">
              <label
                >Category <span class="required">*</span
                ><input
                  formControlName="category"
                  list="course-categories"
                  placeholder="e.g. Development"
                  maxlength="100"
                /><datalist id="course-categories">
                  @for (category of categories(); track category) {
                    <option [value]="category"></option>
                  }
                </datalist>
                @if (invalid('category')) {
                  <small class="field-error">Add a category (up to 100 characters).</small>
                }</label
              ><label
                >Course status<input [value]="status()" disabled /><small>{{
                  id
                    ? 'Publish from course management after reviewing your lessons.'
                    : 'New courses start as drafts. Add lessons before publishing.'
                }}</small></label
              >
            </div>
            <label
              >Thumbnail URL<input
                formControlName="thumbnailUrl"
                type="url"
                placeholder="https://example.com/your-course-image.jpg"
              />
              @if (invalid('thumbnailUrl')) {
                <small class="field-error"
                  >Use a valid absolute HTTP(S) image URL, up to 2048 characters.</small
                >
              }
            </label>
            @if (error()) {
              <div role="alert" class="form-error">{{ error() }}</div>
            }
            <div class="form-actions">
              <a class="btn btn-secondary" [routerLink]="base">Cancel</a
              ><button class="btn btn-primary" [disabled]="busy() || loading()">
                {{ busy() ? 'Saving…' : id ? 'Save changes' : 'Create course'
                }}<app-icon name="arrow" />
              </button>
            </div>
          </form>
        </section>
        <aside class="panel editor-tip">
          <span class="icon-tile"><app-icon name="spark" /></span>
          <h3>A clear promise goes a long way.</h3>
          <p>
            Tell learners what they’ll be able to do after your course. Keep your title focused and
            your description practical.
          </p>
          <hr />
          <h4>Your course, step by step</h4>
          <p><span class="step-dot">1</span>Start with the essentials</p>
          <p><span class="step-dot">2</span>Add your lessons</p>
          <p><span class="step-dot">3</span>Publish when you’re ready</p>
        </aside>
      </div>
    }`,
})
export class CourseEditor {
  private api = inject(CourseService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private ui = uiHelpers();
  id = inject(ActivatedRoute).snapshot.paramMap.get('id');
  base = inject(AuthService).user()?.role === 'Admin' ? '/admin/courses' : '/trainer/courses';
  busy = signal(false);
  loading = signal(false);
  error = signal('');
  loadError = signal('');
  status = signal('Draft');
  categories = signal<string[]>([]);
  form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', [Validators.required, Validators.maxLength(10000)]],
    category: ['', [Validators.required, Validators.maxLength(100)]],
    thumbnailUrl: ['', [Validators.maxLength(2048), Validators.pattern(/^https?:\/\/[^\s]+$/)]],
  });
  constructor() {
    void firstValueFrom(this.api.categories())
      .then((c) => this.categories.set(c))
      .catch(() => {});
    if (this.id) void this.load();
  }
  invalid(name: string) {
    const c = this.form.get(name);
    return c?.invalid && c.touched;
  }
  async load() {
    this.loading.set(true);
    this.loadError.set('');
    try {
      const c = await firstValueFrom(this.api.get(this.id!));
      this.form.patchValue({ ...c, thumbnailUrl: c.thumbnailUrl || '' });
      this.status.set(c.status);
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
      const body = { ...v, thumbnailUrl: v.thumbnailUrl.trim() || null };
      const course = await firstValueFrom(
        this.id ? this.api.update(this.id, body) : this.api.create(body),
      );
      this.ui.toast(this.id ? 'Course updated.' : 'Your course is ready for its first lesson.');
      await this.router.navigate(this.id ? [this.base] : [this.base, course.courseId, 'lessons']);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
