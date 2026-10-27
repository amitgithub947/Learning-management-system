import { CourseNav } from '../../shared/components/course-nav';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { firstValueFrom } from 'rxjs';
import { LessonService } from '../../core/services/lesson.service';
import { ProgressService } from '../../core/services/progress.service';
import { CourseService } from '../../core/services/course.service';
import { CourseProgress, Lesson } from '../../core/models/models';
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
    RouterLink,
    MatProgressBarModule,
    IconComponent,
    EmptyComponent,
    ErrorComponent,
    SkeletonComponent,
  ],
  template: `<div class="breadcrumbs">
      <a routerLink="/student/courses">My learning</a><span>/</span>{{ title() }}
    </div>
    @if (loading()) {
      <app-skeleton />
    } @else if (error()) {
      <app-error [message]="error()" (retry)="load()" />
    } @else if (progress(); as p) {
      <div class="page-heading learning-heading">
        <span class="eyebrow">ONE LESSON CLOSER</span>
        <h1>{{ title() }}</h1>
        <p>Settle in. Give yourself a little space to grow.</p>
      </div>
      <app-course-nav [courseId]="id" />
      <div class="learning-layout">
        <section class="learning-main">
          @if (lessonLoading()) {
            <app-skeleton />
          } @else if (lessonError()) {
            <app-error [message]="lessonError()" (retry)="select(selectedId())" />
          } @else if (lesson(); as current) {
            <div class="lesson-player">
              @if (embed(); as url) {
                <iframe
                  [src]="url"
                  title="Lesson video"
                  allow="fullscreen; picture-in-picture"
                  allowfullscreen
                  referrerpolicy="strict-origin-when-cross-origin"
                ></iframe>
              } @else if (current.videoUrl) {
                <video
                  [src]="current.videoUrl"
                  controls
                  preload="metadata"
                  aria-label="Lesson video"
                ></video>
              } @else {
                <div class="reading-player">
                  <span class="reading-symbol"><app-icon name="book" /></span
                  ><span class="eyebrow">TAKE A MOMENT. TAKE IT IN.</span>
                  <h2>{{ current.title }}</h2>
                  <span
                    ><app-icon name="clock" />{{ current.durationMinutes }} min reading lesson</span
                  ><span class="reading-decoration">✦</span>
                </div>
              }
            </div>
            <article class="panel lesson-content">
              <div class="lesson-content-heading">
                <span class="eyebrow"
                  >LESSON {{ current.sequenceNumber.toString().padStart(2, '0') }}</span
                ><span class="pill neutral"
                  ><app-icon name="clock" />{{ current.durationMinutes }} min</span
                >
              </div>
              <h2>{{ current.title }}</h2>
              <div class="lesson-text">{{ current.content }}</div>
              <div class="lesson-completion">
                <div>
                  <strong>{{
                    isComplete() ? 'A step worth celebrating.' : 'Ready to take the next step?'
                  }}</strong>
                  <p>
                    {{
                      isComplete()
                        ? 'This lesson is marked complete. Keep your momentum going.'
                        : 'Mark this lesson complete to save your progress.'
                    }}
                  </p>
                </div>
                <button
                  class="btn"
                  [class.btn-primary]="!isComplete()"
                  [class.btn-success]="isComplete()"
                  [disabled]="saving() || isComplete()"
                  (click)="complete()"
                >
                  <app-icon name="check" />{{
                    saving() ? 'Saving…' : isComplete() ? 'Lesson completed' : 'Mark as complete'
                  }}
                </button>
              </div>
              <div class="lesson-navigation">
                <button
                  class="btn btn-secondary"
                  (click)="move(-1)"
                  [disabled]="currentIndex() <= 0"
                >
                  <span class="reverse-icon"><app-icon name="arrow" /></span>Previous lesson</button
                ><button
                  class="btn btn-primary"
                  (click)="move(1)"
                  [disabled]="currentIndex() >= p.lessons.length - 1"
                >
                  Next lesson <app-icon name="arrow" />
                </button>
              </div>
            </article>
          } @else {
            <app-empty
              title="Your first lesson is on its way"
              message="Check back soon for new course content."
            />
          }
        </section>
        <aside class="panel course-curriculum">
          <div class="curriculum-heading">
            <span class="eyebrow">YOUR LEARNING PATH</span>
            <h2>Course content</h2>
            <div class="progress-label">
              <span>{{ p.completedLessons }} / {{ p.totalLessons }} complete</span
              ><strong>{{ p.percentage }}%</strong>
            </div>
            <mat-progress-bar mode="determinate" [value]="p.percentage" />
          </div>
          <nav aria-label="Course lessons">
            @for (item of p.lessons; track item.lessonId) {
              <button
                class="curriculum-lesson"
                [class.current]="item.lessonId === selectedId()"
                [class.completed]="item.isCompleted"
                (click)="select(item.lessonId)"
                [attr.aria-current]="item.lessonId === selectedId() ? 'step' : null"
              >
                <span class="lesson-status"
                  ><app-icon
                    [name]="
                      item.isCompleted ? 'check' : item.lessonId === selectedId() ? 'play' : 'book'
                    " /></span
                ><span
                  ><strong>{{ item.title }}</strong
                  ><small
                    >{{ item.durationMinutes }} min ·
                    {{ item.isCompleted ? 'Completed' : 'Lesson ' + item.sequenceNumber }}</small
                  ></span
                >
              </button>
            }
          </nav>
          <div class="curriculum-footer">
            <app-icon name="spark" />
            <p>A little progress is still progress.<br />You’re doing great.</p>
          </div>
        </aside>
      </div>
    }`,
})
export class Learning {
  private lessons = inject(LessonService);
  private progressApi = inject(ProgressService);
  private courses = inject(CourseService);
  private sanitizer = inject(DomSanitizer);
  private ui = uiHelpers();
  private route = inject(ActivatedRoute);
  id = this.route.snapshot.paramMap.get('id')!;
  title = signal('Your course');
  progress = signal<CourseProgress | null>(null);
  lesson = signal<Lesson | null>(null);
  selectedId = signal('');
  loading = signal(true);
  lessonLoading = signal(false);
  saving = signal(false);
  error = signal('');
  lessonError = signal('');
  private request = 0;
  currentIndex = computed(
    () => this.progress()?.lessons.findIndex((l) => l.lessonId === this.selectedId()) ?? -1,
  );
  isComplete = computed(
    () =>
      this.progress()?.lessons.find((l) => l.lessonId === this.selectedId())?.isCompleted || false,
  );
  embed = computed(() => {
    const raw = this.lesson()?.videoUrl;
    if (!raw) return null;
    try {
      const url = new URL(raw);
      let trusted = '';
      if (['youtube.com', 'www.youtube.com', 'youtu.be'].includes(url.hostname)) {
        const id =
          url.hostname === 'youtu.be'
            ? url.pathname.slice(1)
            : url.searchParams.get('v') || url.pathname.split('/').pop();
        if (id && /^[a-zA-Z0-9_-]{11}$/.test(id))
          trusted = `https://www.youtube-nocookie.com/embed/${id}`;
      }
      if (['vimeo.com', 'www.vimeo.com'].includes(url.hostname)) {
        const id = url.pathname.split('/').pop();
        if (id && /^\d+$/.test(id)) trusted = `https://player.vimeo.com/video/${id}`;
      }
      return trusted ? this.sanitizer.bypassSecurityTrustResourceUrl(trusted) : null;
    } catch {
      return null;
    }
  });
  constructor() {
    void this.load();
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const [course, progress] = await Promise.all([
        firstValueFrom(this.courses.get(this.id)),
        firstValueFrom(this.progressApi.course(this.id)),
      ]);
      this.title.set(course.title);
      this.progress.set(progress);
      const requested = this.route.snapshot.queryParamMap.get('lesson');
      const next =
        progress.lessons.find((l) => l.lessonId === requested) ||
        progress.lessons.find((l) => !l.isCompleted) ||
        progress.lessons[0];
      if (next) await this.select(next.lessonId);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
  async select(id: string) {
    if (!id) return;
    const request = ++this.request;
    this.selectedId.set(id);
    this.lessonLoading.set(true);
    this.lessonError.set('');
    try {
      const lesson = await firstValueFrom(this.lessons.get(id));
      if (request === this.request) this.lesson.set(lesson);
    } catch (e) {
      if (request === this.request) this.lessonError.set(errorMessage(e));
    } finally {
      if (request === this.request) this.lessonLoading.set(false);
    }
  }
  move(offset: number) {
    const next = this.progress()?.lessons[this.currentIndex() + offset];
    if (next) void this.select(next.lessonId);
  }
  async complete() {
    if (this.saving() || this.isComplete()) return;
    this.saving.set(true);
    try {
      await firstValueFrom(this.lessons.complete(this.selectedId()));
      this.progress.set(await firstValueFrom(this.progressApi.course(this.id)));
      this.ui.toast('Progress saved. One step closer.');
    } catch (e) {
      this.ui.toast(errorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }
}
