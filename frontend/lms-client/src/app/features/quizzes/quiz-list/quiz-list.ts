import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { QuizService } from '../../../core/services/quiz.service';
import { CourseWorkspaceService } from '../../../core/services/course-workspace.service';
import { Quiz, CourseChoice } from '../../../core/models/advanced';
import { emptyPage } from '../../../core/models/models';
import { CourseNav } from '../../../shared/components/course-nav';
import { IconComponent } from '../../../shared/components/icon';
import {
  EmptyComponent,
  ErrorComponent,
  SkeletonComponent,
  uiHelpers,
} from '../../../shared/components/ui';
import { errorMessage } from '../../../core/interceptors/error.interceptor';
@Component({
  imports: [
    FormsModule,
    RouterLink,
    MatPaginatorModule,
    CourseNav,
    IconComponent,
    EmptyComponent,
    ErrorComponent,
    SkeletonComponent,
  ],
  template: `<div class="page-heading heading-with-action">
      <div>
        <span class="eyebrow">A CHANCE TO SEE WHAT STICKS</span>
        <h1>Quizzes</h1>
        <p>
          {{
            student
              ? 'Test your understanding. Learn from every attempt.'
              : 'Build thoughtful questions and see how your learners are doing.'
          }}
        </p>
      </div>
      @if (!student && courseId()) {
        <a
          class="btn btn-primary"
          [routerLink]="base + '/quizzes/new'"
          [queryParams]="{ courseId: courseId() }"
          ><app-icon name="plus" />Create quiz</a
        >
      }
    </div>
    <div class="course-selector panel">
      <label for="quiz-course">Course workspace</label
      ><select id="quiz-course" [ngModel]="courseId()" (ngModelChange)="choose($event)">
        <option value="" disabled>Select a course</option>
        @for (c of choices(); track c.courseId) {
          <option [value]="c.courseId">{{ c.title }}</option>
        }
      </select>
    </div>
    @if (courseId()) {
      <app-course-nav [courseId]="courseId()" />
    }
    @if (loading()) {
      <app-skeleton />
    } @else if (error()) {
      <app-error [message]="error()" (retry)="load()" />
    } @else if (!choices().length) {
      <app-empty
        title="Begin with a course"
        [message]="
          student
            ? 'Enroll in a course to discover its quizzes.'
            : 'Create a course before building a quiz.'
        "
      />
    } @else {
      <section class="panel table-panel">
        <div class="table-toolbar">
          <form class="search-field" (ngSubmit)="searchRows()">
            <app-icon name="search" /><input
              name="search"
              [(ngModel)]="search"
              placeholder="Find a quiz"
              aria-label="Search quizzes"
            /><button class="icon-button" aria-label="Search quizzes">
              <app-icon name="arrow" />
            </button>
          </form>
          <span class="muted"
            >{{ page().totalCount }} {{ page().totalCount === 1 ? 'quiz' : 'quizzes' }}</span
          >
        </div>
        <div class="quiz-cards">
          @for (q of page().items; track q.quizId) {
            <article class="quiz-card">
              <div class="quiz-card-heading">
                <span class="icon-tile"><app-icon name="help" /></span>
                <div>
                  <h2>{{ q.title }}</h2>
                  <span class="pill" [class.neutral]="!q.isPublished">{{
                    q.isPublished ? 'Published' : 'Draft'
                  }}</span
                  ><span class="requirement-label">{{
                    q.isRequired ? 'Required' : 'Optional'
                  }}</span>
                </div>
              </div>
              <p>{{ q.description }}</p>
              <div class="quiz-meta">
                <span
                  ><app-icon name="book" />{{ q.questionCount }}
                  {{ q.questionCount === 1 ? 'question' : 'questions' }}</span
                ><span
                  ><app-icon name="clock" />{{
                    q.timeLimitMinutes ? q.timeLimitMinutes + ' min' : 'Untimed'
                  }}</span
                ><span>{{ q.maximumMarks }} {{ q.maximumMarks === 1 ? 'mark' : 'marks' }}</span
                ><span>{{ q.passingPercentage }}% to pass</span>
              </div>
              <div class="quiz-actions">
                @if (student) {
                  <button class="btn btn-primary" (click)="start(q)" [disabled]="busy()">
                    Start / resume quiz <app-icon name="arrow" /></button
                  ><a
                    class="btn btn-secondary"
                    [routerLink]="[base + '/quizzes', q.quizId, 'history']"
                    >My attempts</a
                  >
                } @else {
                  <a class="btn btn-primary" [routerLink]="[base + '/quizzes', q.quizId, 'edit']">{{
                    q.canEdit ? 'Edit quiz' : 'View quiz'
                  }}</a
                  ><a
                    class="btn btn-secondary"
                    [routerLink]="[base + '/quizzes', q.quizId, 'results']"
                    >Student results</a
                  ><button
                    class="icon-button danger"
                    [disabled]="busy() || !q.canEdit"
                    (click)="remove(q)"
                    aria-label="Delete quiz"
                  >
                    <app-icon name="trash" />
                  </button>
                }
              </div>
            </article>
          } @empty {
            <app-empty
              title="A fresh opportunity to learn"
              message="Quizzes for this course will appear here."
            />
          }
        </div>
        <mat-paginator
          [length]="page().totalCount"
          [pageSize]="6"
          [pageIndex]="pageIndex"
          [hidePageSize]="true"
          (page)="paginate($event)"
          aria-label="Quiz pages"
        />
      </section>
    }`,
})
export class QuizList {
  private api = inject(QuizService);
  private workspace = inject(CourseWorkspaceService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private ui = uiHelpers();
  student = inject(AuthService).user()?.role === 'Student';
  base = '/' + inject(AuthService).user()!.role.toLowerCase();
  choices = signal<CourseChoice[]>([]);
  courseId = signal(this.route.snapshot.queryParamMap.get('courseId') || '');
  page = signal(emptyPage<Quiz>());
  loading = signal(true);
  busy = signal(false);
  error = signal('');
  search = '';
  pageIndex = 0;
  constructor() {
    void this.initialize();
  }
  async initialize() {
    try {
      this.choices.set(await this.workspace.choices());
      if (!this.courseId()) this.courseId.set(this.choices()[0]?.courseId || '');
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
      this.loading.set(false);
    }
  }
  async load() {
    if (!this.courseId()) {
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set('');
    try {
      this.page.set(
        await firstValueFrom(
          this.api.list(this.courseId(), {
            pageNumber: this.pageIndex + 1,
            pageSize: 6,
            search: this.search,
          }),
        ),
      );
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
  choose(id: string) {
    this.courseId.set(id);
    this.pageIndex = 0;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { courseId: id },
      replaceUrl: true,
    });
    void this.load();
  }
  searchRows() {
    this.pageIndex = 0;
    void this.load();
  }
  paginate(e: PageEvent) {
    this.pageIndex = e.pageIndex;
    void this.load();
  }
  async start(q: Quiz) {
    if (this.busy()) return;
    if (
      !(await this.ui.confirm(
        'Ready to begin?',
        q.timeLimitMinutes
          ? `You have ${q.timeLimitMinutes} minutes from the server-recorded start. Late submissions receive zero marks. An existing active attempt will resume.`
          : 'Take your time and review your answers. An existing active attempt will resume.',
        'Start quiz',
      ))
    )
      return;
    this.busy.set(true);
    try {
      const attempt = await firstValueFrom(this.api.start(q.quizId));
      await this.router.navigate(['/student/quiz-attempts', attempt.attemptId]);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  async remove(q: Quiz) {
    if (
      !(await this.ui.confirm(
        'Delete quiz?',
        `Delete “${q.title}”? Attempt history is retained and prevents deletion.`,
        'Delete quiz',
      ))
    )
      return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.delete(q.quizId));
      this.ui.toast('Quiz deleted.');
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
