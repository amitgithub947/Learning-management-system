import { Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom, interval } from 'rxjs';
import { QuizService } from '../../../core/services/quiz.service';
import { Attempt, QuizAnswer } from '../../../core/models/advanced';
import { IconComponent } from '../../../shared/components/icon';
import { ErrorComponent, SkeletonComponent, uiHelpers } from '../../../shared/components/ui';
import { errorMessage } from '../../../core/interceptors/error.interceptor';
@Component({
  imports: [ReactiveFormsModule, IconComponent, ErrorComponent, SkeletonComponent],
  template: `@if (loading()) {
      <app-skeleton />
    } @else if (error() && !attempt()) {
      <app-error [message]="error()" (retry)="load()" />
    } @else if (attempt(); as a) {
      <div class="quiz-attempt-header">
        <div>
          <span class="eyebrow">TAKE A BREATH. TRUST WHAT YOU KNOW.</span>
          <h1>{{ a.quizTitle }}</h1>
          <p>
            {{ a.questions.length }} questions · {{ a.maximumMarks }} marks ·
            {{ answered() }} answered
          </p>
        </div>
        <div
          class="quiz-timer"
          [class.urgent]="remaining() !== null && remaining()! < 60"
          role="timer"
          aria-label="Time remaining"
        >
          <app-icon name="clock" /><strong>{{ timerLabel() }}</strong
          ><span>{{ a.expiresAt ? 'remaining' : 'No time limit' }}</span>
        </div>
      </div>
      <div class="info-banner">
        <app-icon name="shield" />Answers are graded on the server.
        {{
          a.expiresAt
            ? 'The server rejects late answers, even if your browser timer differs.'
            : 'Review your answers before submitting.'
        }}
      </div>
      <form [formGroup]="form" (ngSubmit)="submit(true)">
        <div class="attempt-question-list">
          @for (q of a.questions; track q.questionId; let i = $index) {
            <section class="panel attempt-question">
              <div class="question-topline">
                <span class="eyebrow">QUESTION {{ i + 1 }}</span
                ><span class="pill neutral"
                  >{{ q.marks }} {{ q.marks === 1 ? 'mark' : 'marks' }}</span
                >
              </div>
              <h2>{{ q.questionText }}</h2>
              @if (q.questionType === 'FreeText') {
                <label class="form-stack"
                  >Your short answer<textarea
                    [formControl]="answers.at(i).controls.text"
                    rows="3"
                    maxlength="10000"
                    placeholder="Write your answer here"
                  ></textarea>
                </label>
              } @else {
                <p class="muted small">
                  {{
                    q.questionType === 'SingleChoice'
                      ? 'Choose one answer.'
                      : 'Select all correct answers. Exact matching earns the question marks.'
                  }}
                </p>
                <div class="answer-options">
                  @for (o of q.options; track o.optionId) {
                    <label class="answer-option" [class.selected]="selected(i, o.optionId)"
                      ><input
                        [type]="q.questionType === 'SingleChoice' ? 'radio' : 'checkbox'"
                        [name]="q.questionId"
                        [checked]="selected(i, o.optionId)"
                        (change)="choose(i, o.optionId, $event)"
                        [disabled]="saving()"
                      /><span>{{ o.optionText }}</span></label
                    >
                  }
                </div>
              }
            </section>
          }
        </div>
        @if (error()) {
          <div class="form-error" role="alert">{{ error() }}</div>
        }
        <div class="attempt-submit panel">
          <div>
            <strong>Ready to see how you did?</strong>
            <p>
              {{ answered() }} of {{ a.questions.length }} answered. Unanswered questions earn zero
              marks.
            </p>
          </div>
          <button class="btn btn-primary" [disabled]="saving()">
            {{ saving() ? 'Submitting…' : 'Submit quiz' }}<app-icon name="arrow" />
          </button>
        </div>
      </form>
    }`,
})
export class QuizAttemptPage {
  private api = inject(QuizService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private ui = uiHelpers();
  private id = this.route.snapshot.paramMap.get('id')!;
  attempt = signal<Attempt | null>(null);
  loading = signal(true);
  saving = signal(false);
  error = signal('');
  private elapsed = signal(0);
  private started = 0;
  private autoSent = false;
  private revision = signal(0);
  answers = new FormArray<
    FormGroup<{ text: FormControl<string>; selectedOptionIds: FormControl<string[]> }>
  >([]);
  form = new FormGroup({ answers: this.answers });
  remaining = computed(() => {
    const a = this.attempt();
    return a?.expiresAt
      ? Math.max(
          0,
          Math.ceil((Date.parse(a.expiresAt) - Date.parse(a.serverTime) - this.elapsed()) / 1000),
        )
      : null;
  });
  timerLabel = computed(() => {
    const value = this.remaining();
    return value === null
      ? 'Untimed'
      : `${Math.floor(value / 60)
          .toString()
          .padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`;
  });
  answered = computed(() => {
    this.revision();
    return this.answers.controls.filter(
      (c) =>
        c.controls.selectedOptionIds.value.length > 0 || c.controls.text.value.trim().length > 0,
    ).length;
  });
  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.revision.update((v) => v + 1);
      if (this.attempt() && !this.loading())
        sessionStorage.setItem(
          'lms.quiz.' + this.id,
          JSON.stringify(this.form.getRawValue().answers),
        );
    });
    interval(1000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        if (!this.attempt() || this.loading()) return;
        this.elapsed.set(performance.now() - this.started);
        if (this.remaining() === 0 && !this.autoSent) {
          this.autoSent = true;
          void this.submit(false);
        }
      });
    void this.load();
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const attempt = await firstValueFrom(this.api.attempt(this.id));
      if (attempt.submittedAt) {
        await this.router.navigate(['/student/quiz-attempts', this.id, 'result']);
        return;
      }
      let draft: { text: string; selectedOptionIds: string[] }[] = [];
      try {
        draft = JSON.parse(sessionStorage.getItem('lms.quiz.' + this.id) || '[]');
        if (!Array.isArray(draft)) draft = [];
      } catch {
        draft = [];
      }
      this.answers.clear();
      for (let i = 0; i < attempt.questions.length; i++) {
        const row = draft[i];
        this.answers.push(
          new FormGroup({
            text: new FormControl(typeof row?.text === 'string' ? row.text : '', {
              nonNullable: true,
            }),
            selectedOptionIds: new FormControl(
              Array.isArray(row?.selectedOptionIds)
                ? row.selectedOptionIds.filter((id) =>
                    attempt.questions[i].options.some((o) => o.optionId === id),
                  )
                : [],
              { nonNullable: true },
            ),
          }),
        );
      }
      this.attempt.set(attempt);
      this.started = performance.now();
      this.elapsed.set(0);
      this.revision.update((v) => v + 1);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
  selected(i: number, id: string) {
    return this.answers.at(i).controls.selectedOptionIds.value.includes(id);
  }
  choose(i: number, id: string, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    const control = this.answers.at(i).controls.selectedOptionIds;
    const type = this.attempt()!.questions[i].questionType;
    control.setValue(
      type === 'SingleChoice'
        ? [id]
        : checked
          ? [...control.value.filter((v) => v !== id), id]
          : control.value.filter((v) => v !== id),
    );
  }
  async submit(confirm: boolean) {
    if (this.saving() || !this.attempt()) return;
    if (
      confirm &&
      !(await this.ui.confirm(
        'Submit this quiz?',
        `${this.answered()} of ${this.attempt()!.questions.length} questions answered. Submitted attempts cannot be changed.`,
        'Submit quiz',
      ))
    )
      return;
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const answers: QuizAnswer[] = this.attempt()!.questions.map((q, i) => ({
        questionId: q.questionId,
        selectedOptionIds: this.answers.at(i).controls.selectedOptionIds.value,
        text: q.questionType === 'FreeText' ? this.answers.at(i).controls.text.value : null,
      }));
      await firstValueFrom(this.api.submit(this.id, answers));
      sessionStorage.removeItem('lms.quiz.' + this.id);
      await this.router.navigate(['/student/quiz-attempts', this.id, 'result']);
    } catch (e) {
      this.error.set(errorMessage(e));
      if (confirm) this.autoSent = false;
    } finally {
      this.saving.set(false);
    }
  }
}
