import { CourseNav } from '../../shared/components/course-nav';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { CourseService } from '../../core/services/course.service';
import { LessonService } from '../../core/services/lesson.service';
import { CourseOverview, Lesson, emptyPage } from '../../core/models/models';
import { IconComponent } from '../../shared/components/icon';
import {
  EmptyComponent,
  ErrorComponent,
  SkeletonComponent,
  uiHelpers,
} from '../../shared/components/ui';
import { errorMessage } from '../../core/interceptors/error.interceptor';
@Component({
  imports: [
    CourseNav,
    ReactiveFormsModule,
    RouterLink,
    MatPaginatorModule,
    IconComponent,
    EmptyComponent,
    ErrorComponent,
    SkeletonComponent,
  ],
  template: `<div class="breadcrumbs">
      <a [routerLink]="base">My courses</a><span>/</span> Lesson management
    </div>
    <div class="page-heading heading-with-action">
      <div>
        <span class="eyebrow">BUILD A PATH TO POSSIBILITY</span>
        <h1>{{ overview()?.course?.title || 'Course lessons' }}</h1>
        <p>Make every lesson a meaningful step forward.</p>
      </div>
      @if (overview()?.course?.status !== 'Published') {
        <button
          class="btn btn-primary"
          (click)="publish()"
          [disabled]="busy() || !page().totalCount"
        >
          Publish course <app-icon name="arrow" />
        </button>
      } @else {
        <span class="pill success">Published</span>
      }
    </div>
    @if (loadError()) {
      <app-error [message]="loadError()" (retry)="load()" />
    }
    <app-course-nav [courseId]="id" />
    <div class="lesson-editor-grid">
      <section class="panel table-panel">
        <div class="panel-title padded">
          <div>
            <h2>Course lessons</h2>
            <p>{{ page().totalCount }} lessons in this course</p>
          </div>
          <span class="icon-tile"><app-icon name="book" /></span>
        </div>
        @if (loading()) {
          <app-skeleton />
        } @else {
          <div class="managed-lessons">
            @for (lesson of page().items; track lesson.lessonId) {
              <div class="managed-lesson">
                <span class="lesson-number">{{
                  lesson.sequenceNumber.toString().padStart(2, '0')
                }}</span>
                <div>
                  <strong>{{ lesson.title }}</strong
                  ><small
                    ><app-icon name="clock" />{{ lesson.durationMinutes }} min ·
                    {{ lesson.videoUrl ? 'Video + content' : 'Reading lesson' }}</small
                  >
                </div>
                <button
                  class="icon-button"
                  (click)="edit(lesson)"
                  [attr.aria-label]="'Edit ' + lesson.title"
                >
                  <app-icon name="edit" /></button
                ><button
                  class="icon-button danger"
                  (click)="remove(lesson)"
                  [disabled]="busy()"
                  [attr.aria-label]="'Delete ' + lesson.title"
                >
                  <app-icon name="trash" />
                </button>
              </div>
            } @empty {
              <app-empty
                title="Start with a first step"
                message="Add a focused lesson to bring your course to life."
              />
            }
          </div>
        }
        <mat-paginator
          [length]="page().totalCount"
          [pageSize]="10"
          [pageIndex]="pageIndex"
          [hidePageSize]="true"
          (page)="paginate($event)"
          aria-label="Lesson pages"
        />
      </section>
      <section class="panel">
        <div class="panel-title">
          <div>
            <h2>{{ editing() ? 'Edit lesson' : 'Add a lesson' }}</h2>
            <p>
              {{
                editing() ? 'Refine your learning content.' : 'One clear idea. One practical step.'
              }}
            </p>
          </div>
          @if (editing()) {
            <button class="icon-button" (click)="reset()" aria-label="Cancel editing">
              <app-icon name="close" />
            </button>
          }
        </div>
        <form [formGroup]="form" (ngSubmit)="save()" class="form-stack">
          <label
            >Lesson title<input
              formControlName="title"
              placeholder="What will this lesson cover?"
              maxlength="200"
            />
            @if (invalid('title')) {
              <small class="field-error">Enter a title, up to 200 characters.</small>
            }</label
          ><label
            >Lesson content<textarea
              formControlName="content"
              rows="7"
              placeholder="Add your lesson content, explanations, and exercises."
            ></textarea>
            @if (invalid('content')) {
              <small class="field-error">Content is required, up to 100,000 characters.</small>
            }</label
          ><label
            >Video URL <span class="muted">(optional)</span
            ><input type="url" formControlName="videoUrl" placeholder="https://…" />
            @if (invalid('videoUrl')) {
              <small class="field-error">Enter an absolute HTTP(S) URL.</small>
            }
            <small>Direct video files, YouTube, and Vimeo links are supported.</small></label
          >
          <div class="form-columns">
            <label
              >Sequence number<input
                type="number"
                formControlName="sequenceNumber"
                min="1"
                step="1" /></label
            ><label
              >Duration (minutes)<input
                type="number"
                formControlName="durationMinutes"
                min="0"
                max="10080"
                step="1"
            /></label>
          </div>
          @if (invalid('sequenceNumber') || invalid('durationMinutes')) {
            <small class="field-error"
              >Use a positive whole sequence number and a whole duration from 0 to 10,080
              minutes.</small
            >
          }
          <label class="checkbox-row"
            ><input type="checkbox" formControlName="isRequired" />Required for course
            completion</label
          >
          @if (error()) {
            <div role="alert" class="form-error">{{ error() }}</div>
          }
          <button class="btn btn-primary btn-block" [disabled]="busy()">
            {{ busy() ? 'Saving…' : editing() ? 'Save lesson' : 'Add lesson'
            }}<app-icon name="plus" />
          </button>
        </form>
      </section>
    </div>`,
})
export class ManageLessons {
  private lessons = inject(LessonService);
  private courses = inject(CourseService);
  private fb = inject(FormBuilder);
  private ui = uiHelpers();
  id = inject(ActivatedRoute).snapshot.paramMap.get('id')!;
  base = inject(AuthService).user()?.role === 'Admin' ? '/admin/courses' : '/trainer/courses';
  overview = signal<CourseOverview | null>(null);
  page = signal(emptyPage<Lesson>());
  loading = signal(true);
  busy = signal(false);
  loadError = signal('');
  error = signal('');
  editing = signal<string | null>(null);
  pageIndex = 0;
  form = this.fb.nonNullable.group({
    isRequired: [true],
    title: ['', [Validators.required, Validators.maxLength(200)]],
    content: ['', [Validators.required, Validators.maxLength(100000)]],
    videoUrl: ['', [Validators.maxLength(2048), Validators.pattern(/^https?:\/\/[^\s]+$/)]],
    sequenceNumber: [1, [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)]],
    durationMinutes: [
      10,
      [Validators.required, Validators.min(0), Validators.max(10080), Validators.pattern(/^\d+$/)],
    ],
  });
  constructor() {
    void this.load();
  }
  invalid(name: string) {
    const c = this.form.get(name);
    return c?.invalid && c.touched;
  }
  async load() {
    this.loading.set(true);
    this.loadError.set('');
    try {
      const [page, overview] = await Promise.all([
        firstValueFrom(
          this.lessons.list(this.id, { pageNumber: this.pageIndex + 1, pageSize: 10 }),
        ),
        firstValueFrom(this.courses.overview(this.id)),
      ]);
      this.page.set(page);
      this.overview.set(overview);
      if (!this.editing())
        this.form.controls.sequenceNumber.setValue(
          Math.max(0, ...overview.lessons.map((l) => l.sequenceNumber)) + 1,
        );
    } catch (e) {
      this.loadError.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
  paginate(e: PageEvent) {
    this.pageIndex = e.pageIndex;
    void this.load();
  }
  edit(l: Lesson) {
    this.editing.set(l.lessonId);
    this.error.set('');
    this.form.reset({ ...l, videoUrl: l.videoUrl || '' });
  }
  reset() {
    this.editing.set(null);
    this.error.set('');
    this.form.reset({
      title: '',
      content: '',
      videoUrl: '',
      sequenceNumber:
        Math.max(0, ...(this.overview()?.lessons.map((l) => l.sequenceNumber) || [])) + 1,
      durationMinutes: 10,
      isRequired: true,
    });
  }
  async save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const v = this.form.getRawValue();
      const body = { ...v, videoUrl: v.videoUrl.trim() || null };
      await firstValueFrom(
        this.editing()
          ? this.lessons.update(this.editing()!, body)
          : this.lessons.create(this.id, body),
      );
      this.ui.toast('Lesson saved. Another step forward.');
      this.reset();
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  async remove(l: Lesson) {
    if (
      !(await this.ui.confirm(
        'Delete this lesson?',
        `Delete “${l.title}” and its progress records? This cannot be undone.`,
        'Delete lesson',
      ))
    )
      return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.lessons.delete(l.lessonId));
      if (this.editing() === l.lessonId) this.reset();
      this.ui.toast('Lesson deleted.');
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  async publish() {
    if (
      !(await this.ui.confirm(
        'Publish this course?',
        'Your course will become visible in the public catalog.',
        'Publish course',
      ))
    )
      return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.courses.publish(this.id));
      this.ui.toast('Your course is live.');
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
