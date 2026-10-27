import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { firstValueFrom } from 'rxjs';
import { AssignmentService } from '../../../core/services/assignment.service';
import { Assignment, Submission } from '../../../core/models/advanced';
import { emptyPage } from '../../../core/models/models';
import { EmptyComponent, ErrorComponent, uiHelpers } from '../../../shared/components/ui';
import { errorMessage } from '../../../core/interceptors/error.interceptor';
@Component({
  selector: 'app-submission-grading',
  imports: [FormsModule, DatePipe, MatPaginatorModule, EmptyComponent, ErrorComponent],
  template: `@if (error()) {
      <app-error [message]="error()" (retry)="load()" />
    }
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Learner</th>
            <th>Submitted</th>
            <th>Status</th>
            <th>Marks</th>
            <th>Review</th>
          </tr>
        </thead>
        <tbody>
          @for (s of page().items; track s.submissionId) {
            <tr>
              <td>{{ s.studentName || s.studentId }}</td>
              <td>{{ s.submittedAt | date: 'MMM d, h:mm a' }}</td>
              <td>
                <span class="pill" [class.neutral]="s.status !== 'Graded'">{{ s.status }}</span>
              </td>
              <td>
                {{ s.marks === null ? 'Pending' : s.marks + ' / ' + assignment().maximumMarks }}
              </td>
              <td>
                <button class="btn btn-small btn-secondary" (click)="review(s)">
                  Review answer
                </button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    @if (!page().items.length) {
      <app-empty
        title="Good work takes a little time"
        message="Submitted answers will appear here for review."
      />
    }
    <mat-paginator
      [length]="page().totalCount"
      [pageSize]="10"
      [pageIndex]="pageIndex"
      [hidePageSize]="true"
      (page)="paginate($event)"
      aria-label="Submission pages"
    />
    @if (selected(); as s) {
      <section class="grading-review">
        <div class="panel-title">
          <div>
            <h2>Review {{ s.studentName || 'student' }}’s submission</h2>
            <p>{{ s.submittedAt | date: 'medium' }}</p>
          </div>
          <button class="btn btn-small btn-secondary" (click)="selected.set(null)">
            Close review
          </button>
        </div>
        <div class="answer-content">{{ s.content }}</div>
        <form (ngSubmit)="grade()" class="form-stack">
          <div class="form-columns">
            <label
              >Marks (out of {{ assignment().maximumMarks }})<input
                type="number"
                name="marks"
                [(ngModel)]="marks"
                [min]="0"
                [max]="assignment().maximumMarks"
                step="0.01"
                required
            /></label>
            <p class="form-hint">
              Passing threshold: {{ assignment().passingPercentage }}%. Grades contribute to
              server-calculated course completion.
            </p>
          </div>
          <label
            >Feedback<textarea
              name="feedback"
              [(ngModel)]="feedback"
              rows="4"
              maxlength="10000"
              placeholder="Share specific, useful feedback."
            ></textarea>
          </label>
          @if (gradeError()) {
            <div class="form-error" role="alert">{{ gradeError() }}</div>
          }
          <button class="btn btn-primary" [disabled]="busy()">
            {{ busy() ? 'Saving…' : 'Save marks and feedback' }}
          </button>
        </form>
      </section>
    }`,
})
export class SubmissionGrading {
  assignment = input.required<Assignment>();
  graded = output<void>();
  private api = inject(AssignmentService);
  private ui = uiHelpers();
  page = signal(emptyPage<Submission>());
  error = signal('');
  gradeError = signal('');
  selected = signal<Submission | null>(null);
  busy = signal(false);
  marks: number | null = null;
  feedback = '';
  pageIndex = 0;
  ngOnInit() {
    void this.load();
  }
  async load() {
    this.error.set('');
    try {
      this.page.set(
        await firstValueFrom(
          this.api.submissions(this.assignment().assignmentId, {
            pageNumber: this.pageIndex + 1,
            pageSize: 10,
          }),
        ),
      );
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
  paginate(e: PageEvent) {
    this.pageIndex = e.pageIndex;
    void this.load();
  }
  review(s: Submission) {
    this.selected.set(s);
    this.marks = s.marks;
    this.feedback = s.feedback || '';
    this.gradeError.set('');
  }
  async grade() {
    const s = this.selected();
    if (!s || this.busy()) return;
    if (
      this.marks === null ||
      !Number.isFinite(this.marks) ||
      this.marks < 0 ||
      this.marks > this.assignment().maximumMarks
    ) {
      this.gradeError.set('Enter marks between zero and the assignment maximum.');
      return;
    }
    this.busy.set(true);
    this.gradeError.set('');
    try {
      await firstValueFrom(this.api.grade(s.submissionId, this.marks, this.feedback));
      this.ui.toast('Marks and feedback saved.');
      this.selected.set(null);
      await this.load();
      this.graded.emit();
    } catch (e) {
      this.gradeError.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
