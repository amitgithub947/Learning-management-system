import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { QuizService } from '../../../core/services/quiz.service';
import { CourseWorkspaceService } from '../../../core/services/course-workspace.service';
import { CourseChoice, QuestionType, QuizRequest } from '../../../core/models/advanced';
import { IconComponent } from '../../../shared/components/icon';
import { ErrorComponent, uiHelpers } from '../../../shared/components/ui';
import { errorMessage } from '../../../core/interceptors/error.interceptor';
@Component({
  imports: [ReactiveFormsModule, RouterLink, IconComponent, ErrorComponent],
  template: `<div class="breadcrumbs">
      <a [routerLink]="base + '/quizzes'">Quizzes</a><span>/</span
      >{{ id ? 'Quiz editor' : 'Create quiz' }}
    </div>
    <div class="page-heading">
      <span class="eyebrow">TURN UNDERSTANDING INTO CONFIDENCE</span>
      <h1>{{ id ? 'Your quiz, thoughtfully built.' : 'Build a meaningful knowledge check.' }}</h1>
      <p>Clear questions, transparent criteria, and scoring handled securely by the server.</p>
    </div>
    @if (loadError()) {
      <app-error [message]="loadError()" (retry)="load()" />
    } @else {
      @if (locked()) {
        <div class="info-banner">
          <app-icon name="lock" />This quiz has attempts and is read-only. Create a new quiz to
          change its questions or scoring.
        </div>
      }
      <form [formGroup]="form" (ngSubmit)="save()" class="quiz-builder">
        <section class="panel form-stack">
          <div class="form-columns">
            <label
              >Course<select formControlName="courseId">
                @for (c of choices(); track c.courseId) {
                  <option [value]="c.courseId">{{ c.title }}</option>
                }
              </select></label
            ><label
              >Quiz title<input
                formControlName="title"
                maxlength="200"
                placeholder="A clear, focused knowledge check"
            /></label>
          </div>
          <label
            >Description<textarea
              formControlName="description"
              rows="3"
              placeholder="Explain what this quiz covers and how to prepare."
            ></textarea>
          </label>
          <div class="form-columns">
            <label
              >Passing percentage<input
                type="number"
                formControlName="passingPercentage"
                min="1"
                max="100"
                step="0.01" /></label
            ><label
              >Time limit (minutes)<input
                type="number"
                formControlName="timeLimitMinutes"
                min="0"
                max="1440"
                step="1"
              /><small>Use 0 for an untimed quiz. Timers are enforced on the server.</small></label
            >
          </div>
          <div class="checkbox-group">
            <label class="checkbox-row"
              ><input type="checkbox" formControlName="isPublished" />Publish for enrolled
              students</label
            ><label class="checkbox-row"
              ><input type="checkbox" formControlName="isRequired" />Required for course
              completion</label
            >
          </div>
        </section>
        <div formArrayName="questions">
          @for (question of questions.controls; track question; let i = $index) {
            <section class="panel question-editor" [formGroupName]="i">
              <div class="panel-title">
                <div>
                  <span class="eyebrow">QUESTION {{ i + 1 }}</span>
                  <h2>Make every question count.</h2>
                </div>
                <button
                  type="button"
                  class="icon-button danger"
                  (click)="removeQuestion(i)"
                  [disabled]="questions.length === 1 || locked()"
                  aria-label="Remove question"
                >
                  <app-icon name="trash" />
                </button>
              </div>
              <div class="form-stack">
                <label
                  >Question<textarea
                    formControlName="questionText"
                    rows="2"
                    placeholder="What would you like to ask?"
                  ></textarea>
                </label>
                <div class="form-columns">
                  <label
                    >Question type<select formControlName="questionType" (change)="typeChanged(i)">
                      <option value="SingleChoice">Single choice</option>
                      <option value="MultipleChoice">Multiple choice</option>
                      <option value="FreeText">Short text (exact match)</option>
                    </select></label
                  ><label
                    >Marks<input
                      type="number"
                      formControlName="marks"
                      min="0.01"
                      max="100000"
                      step="0.01"
                  /></label>
                </div>
                @if (question.controls.questionType.value === 'FreeText') {
                  <label
                    >Expected answer<input
                      formControlName="expectedAnswer"
                      maxlength="2000"
                      placeholder="The accepted short answer"
                    /><small
                      >Compared after trimming and Unicode normalization, ignoring case. Use a
                      short, unambiguous answer.</small
                    ></label
                  >
                } @else {
                  <div formArrayName="options" class="option-editor-list">
                    @for (
                      option of question.controls.options.controls;
                      track option;
                      let j = $index
                    ) {
                      <div [formGroupName]="j" class="option-editor">
                        <span class="option-letter">{{ letters[j] }}</span
                        ><input
                          formControlName="optionText"
                          [attr.aria-label]="'Question ' + (i + 1) + ' option ' + letters[j]"
                          placeholder="Answer option"
                        /><label class="checkbox-row"
                          ><input
                            type="checkbox"
                            formControlName="isCorrect"
                            (change)="correctChanged(i, j)"
                          />Correct</label
                        ><button
                          type="button"
                          class="icon-button"
                          [disabled]="question.controls.options.length <= 2 || locked()"
                          (click)="question.controls.options.removeAt(j)"
                          aria-label="Remove option"
                        >
                          <app-icon name="close" />
                        </button>
                      </div>
                    }
                  </div>
                  <button
                    type="button"
                    class="btn btn-secondary"
                    (click)="addOption(i)"
                    [disabled]="question.controls.options.length >= 8 || locked()"
                  >
                    <app-icon name="plus" />Add option
                  </button>
                  <p class="form-hint">
                    {{
                      question.controls.questionType.value === 'SingleChoice'
                        ? 'Select exactly one correct answer.'
                        : 'Select every correct answer. Students must choose the exact set to earn the question marks.'
                    }}
                  </p>
                }
              </div>
            </section>
          }
        </div>

        <div class="builder-actions">
          <button
            type="button"
            class="btn btn-secondary"
            (click)="addQuestion()"
            [disabled]="questions.length >= 50 || locked()"
          >
            <app-icon name="plus" />Add question</button
          ><span class="muted">{{ questions.length }} / 50 questions</span>
        </div>
        @if (form.touched && form.invalid) {
          <div class="form-error">
            Complete the quiz details, each question, and every answer option. Marks must be
            positive and the passing percentage must be 1–100.
          </div>
        }
        @if (error()) {
          <div class="form-error" role="alert">{{ error() }}</div>
        }
        <div class="form-actions">
          <a
            [routerLink]="base + '/quizzes'"
            [queryParams]="{ courseId: form.controls.courseId.value }"
            class="btn btn-secondary"
            >Back to quizzes</a
          >
          @if (!locked()) {
            <button class="btn btn-primary" [disabled]="busy() || loading()">
              {{ busy() ? 'Saving…' : 'Save quiz' }}<app-icon name="arrow" />
            </button>
          }
        </div>
      </form>
    }`,
})
export class QuizBuilder {
  private fb = inject(FormBuilder);
  private api = inject(QuizService);
  private workspace = inject(CourseWorkspaceService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private ui = uiHelpers();
  id = this.route.snapshot.paramMap.get('id');
  base = '/' + inject(AuthService).user()!.role.toLowerCase();
  choices = signal<CourseChoice[]>([]);
  locked = signal(false);
  loading = signal(true);
  busy = signal(false);
  error = signal('');
  loadError = signal('');
  letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  option(text = '', correct = false) {
    return this.fb.nonNullable.group({
      optionText: [text, [Validators.required, Validators.maxLength(4000)]],
      isCorrect: [correct],
    });
  }
  question() {
    return this.fb.nonNullable.group({
      questionText: ['', [Validators.required, Validators.maxLength(10000)]],
      questionType: this.fb.nonNullable.control<QuestionType>('SingleChoice'),
      marks: [1, [Validators.required, Validators.min(0.01), Validators.max(100000)]],
      expectedAnswer: ['', Validators.maxLength(2000)],
      options: this.fb.array([this.option('', true), this.option()]),
    });
  }
  questions = this.fb.array([this.question()]);
  form = this.fb.nonNullable.group({
    courseId: [this.route.snapshot.queryParamMap.get('courseId') || '', Validators.required],
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', [Validators.required, Validators.maxLength(10000)]],
    passingPercentage: [70, [Validators.required, Validators.min(1), Validators.max(100)]],
    timeLimitMinutes: [
      15,
      [Validators.required, Validators.min(0), Validators.max(1440), Validators.pattern(/^\d+$/)],
    ],
    isPublished: [false],
    isRequired: [true],
    questions: this.questions,
  });
  constructor() {
    void this.load();
  }
  addQuestion() {
    if (!this.locked() && this.questions.length < 50) this.questions.push(this.question());
  }
  removeQuestion(i: number) {
    if (!this.locked() && this.questions.length > 1) this.questions.removeAt(i);
  }
  addOption(i: number) {
    const options = this.questions.at(i).controls.options;
    if (!this.locked() && options.length < 8) options.push(this.option());
  }
  typeChanged(i: number) {
    const q = this.questions.at(i);
    if (q.controls.questionType.value === 'FreeText') {
      q.controls.options.clear();
      q.controls.expectedAnswer.setValidators([Validators.required, Validators.maxLength(2000)]);
    } else {
      q.controls.expectedAnswer.clearValidators();
      q.controls.expectedAnswer.setValue('');
      if (q.controls.options.length < 2) {
        q.controls.options.push(this.option('', true));
        q.controls.options.push(this.option());
      }
    }
    q.controls.expectedAnswer.updateValueAndValidity();
  }
  correctChanged(i: number, j: number) {
    const q = this.questions.at(i);
    if (
      q.controls.questionType.value === 'SingleChoice' &&
      q.controls.options.at(j).controls.isCorrect.value
    )
      q.controls.options.controls.forEach((o, k) => {
        if (k !== j) o.controls.isCorrect.setValue(false);
      });
  }
  async load() {
    this.loading.set(true);
    this.loadError.set('');
    try {
      this.choices.set(await this.workspace.choices());
      if (this.id) {
        const quiz = await firstValueFrom(this.api.get(this.id));
        this.form.patchValue({
          courseId: quiz.courseId,
          title: quiz.title,
          description: quiz.description,
          passingPercentage: quiz.passingPercentage,
          isPublished: quiz.isPublished,
          isRequired: quiz.isRequired,
          timeLimitMinutes: quiz.timeLimitMinutes || 0,
        });
        this.questions.clear();
        for (const row of quiz.questions) {
          const q = this.question();
          q.patchValue({
            questionText: row.questionText,
            questionType: row.questionType,
            marks: row.marks,
            expectedAnswer: row.expectedAnswer || '',
          });
          q.controls.options.clear();
          for (const o of row.options)
            q.controls.options.push(this.option(o.optionText, o.isCorrect === true));
          if (row.questionType === 'FreeText')
            q.controls.expectedAnswer.addValidators(Validators.required);
          this.questions.push(q);
        }
        this.form.controls.courseId.disable();
        if (!quiz.canEdit) {
          this.locked.set(true);
          this.form.disable();
        }
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
    if (this.form.invalid || this.busy() || this.locked()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const v = this.form.getRawValue();
      const body: QuizRequest = {
        ...v,
        timeLimitMinutes: v.timeLimitMinutes || null,
        questions: v.questions.map((q) => ({
          ...q,
          expectedAnswer: q.questionType === 'FreeText' ? q.expectedAnswer : null,
        })),
      };
      const quiz = await firstValueFrom(
        this.id ? this.api.update(this.id, body) : this.api.create(body),
      );
      this.ui.toast('Quiz saved.');
      await this.router.navigate([this.base + '/quizzes'], {
        queryParams: { courseId: quiz.courseId },
      });
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
