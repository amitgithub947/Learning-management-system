import { Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { QuizService } from '../../../core/services/quiz.service';
import { AuthService } from '../../../core/auth/auth.service';
import { QuizResult } from '../../../core/models/advanced';
import { CourseNav } from '../../../shared/components/course-nav';
import { ProgressRing } from '../../../shared/components/progress-ring';
import { ErrorComponent, SkeletonComponent } from '../../../shared/components/ui';
import { IconComponent } from '../../../shared/components/icon';
import { errorMessage } from '../../../core/interceptors/error.interceptor';
@Component({
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    CourseNav,
    ProgressRing,
    ErrorComponent,
    SkeletonComponent,
    IconComponent,
  ],
  template: `@if (loading()) {
      <app-skeleton />
    } @else if (error()) {
      <app-error [message]="error()" (retry)="load()" />
    } @else if (result(); as r) {
      <div class="page-heading">
        <span class="eyebrow">UNDERSTANDING GROWS WITH EVERY ATTEMPT</span>
        <h1>{{ r.quizTitle }}</h1>
        <p>{{ r.studentName }} · Submitted {{ r.submittedAt | date: 'medium' }}</p>
      </div>
      <app-course-nav [courseId]="r.courseId" />
      <section class="panel quiz-result-summary">
        <app-progress-ring [value]="r.percentage" label="quiz score" />
        <div>
          <span class="pill" [class.success]="r.isPassed">{{
            r.isExpired ? 'Time expired' : r.isPassed ? 'Passed' : 'Keep learning'
          }}</span>
          <h2>
            {{
              r.isPassed ? 'A step worth celebrating.' : 'Every attempt is a learning opportunity.'
            }}
          </h2>
          <p>
            {{ r.score }} of {{ r.maximumMarks }} marks · {{ r.percentage | number: '1.0-2' }}% ·
            {{ r.passingPercentage }}% required to pass
          </p>
          @if (r.isExpired) {
            <p class="form-error">The server deadline passed. Late answers receive zero marks.</p>
          }
          <div class="quiz-actions">
            <a
              class="btn btn-secondary"
              [routerLink]="[base + '/quizzes', r.quizId, student ? 'history' : 'results']"
              >Attempt history</a
            >
            @if (student) {
              <a class="btn btn-primary" [routerLink]="['/student/progress', r.courseId]"
                >View course progress <app-icon name="arrow"
              /></a>
            }
          </div>
        </div>
      </section>
      <div class="section-heading compact">
        <h2>Review your answers</h2>
        <span class="muted">Scored by the server</span>
      </div>
      <div class="result-review-list">
        @for (a of r.answers; track a.questionId) {
          <article class="panel answer-review">
            <div class="question-topline">
              <span class="eyebrow">QUESTION {{ $index + 1 }}</span
              ><span class="pill" [class.success]="a.awardedMarks === a.maximumMarks"
                >{{ a.awardedMarks }} / {{ a.maximumMarks }} marks</span
              >
            </div>
            <h3>{{ a.questionText }}</h3>
            @if (a.questionType === 'FreeText') {
              <dl class="text-answer-review">
                <dt>Your answer</dt>
                <dd>{{ a.text || 'Not answered' }}</dd>
                <dt>Expected answer</dt>
                <dd>{{ a.expectedAnswer }}</dd>
              </dl>
            } @else {
              <div class="review-options">
                @for (option of a.options; track option.optionId) {
                  <div
                    [class.correct]="option.isCorrect"
                    [class.chosen]="a.selectedOptionIds.includes(option.optionId)"
                  >
                    <app-icon
                      [name]="
                        option.isCorrect
                          ? 'check'
                          : a.selectedOptionIds.includes(option.optionId)
                            ? 'close'
                            : 'chevron'
                      "
                    /><span>{{ option.optionText }}</span
                    ><small
                      >{{ option.isCorrect ? 'Correct answer' : ''
                      }}{{
                        a.selectedOptionIds.includes(option.optionId) ? ' · Your selection' : ''
                      }}</small
                    >
                  </div>
                }
              </div>
            }
          </article>
        }
      </div>
    }`,
})
export class QuizResults {
  private api = inject(QuizService);
  private id = inject(ActivatedRoute).snapshot.paramMap.get('id')!;
  student = inject(AuthService).user()?.role === 'Student';
  base = '/' + inject(AuthService).user()!.role.toLowerCase();
  result = signal<QuizResult | null>(null);
  loading = signal(true);
  error = signal('');
  constructor() {
    void this.load();
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.result.set(await firstValueFrom(this.api.result(this.id)));
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
}
