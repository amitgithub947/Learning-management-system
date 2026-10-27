import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { AssignmentService } from '../../../core/services/assignment.service';
import { Assignment, Submission } from '../../../core/models/advanced';
import { CourseNav } from '../../../shared/components/course-nav';
import { ErrorComponent, SkeletonComponent } from '../../../shared/components/ui';
import { SubmissionForm } from '../submission-form/submission-form';
import { SubmissionGrading } from '../submission-grading/submission-grading';
import { errorMessage } from '../../../core/interceptors/error.interceptor';
@Component({
  imports: [
    DatePipe,
    RouterLink,
    CourseNav,
    ErrorComponent,
    SkeletonComponent,
    SubmissionForm,
    SubmissionGrading,
  ],
  template: `<div class="breadcrumbs">
      <a [routerLink]="base + '/assignments'">Assignments</a><span>/</span>Assignment details
    </div>
    @if (loading()) {
      <app-skeleton />
    } @else if (error()) {
      <app-error [message]="error()" (retry)="load()" />
    } @else if (assignment(); as a) {
      <div class="page-heading heading-with-action">
        <div>
          <span class="eyebrow">PUT IT INTO PRACTICE</span>
          <h1>{{ a.title }}</h1>
          <p>
            Due {{ a.dueDate | date: 'fullDate' }} at {{ a.dueDate | date: 'shortTime' }} ·
            {{ a.maximumMarks }} marks · {{ a.passingPercentage }}% to pass
          </p>
        </div>
        <span class="pill" [class.neutral]="!a.isRequired">{{
          a.isRequired ? 'Required' : 'Optional'
        }}</span>
      </div>
      <app-course-nav [courseId]="a.courseId" />
      <section class="panel assignment-brief">
        <h2>Your assignment brief</h2>
        <div class="lesson-text">{{ a.description }}</div>
      </section>
      @if (student) {
        <section class="panel assignment-answer">
          @if (submission(); as s) {
            <div class="panel-title">
              <div>
                <h2>Your submission</h2>
                <p>Submitted {{ s.submittedAt | date: 'medium' }}</p>
              </div>
              <span class="pill" [class.neutral]="s.status === 'Submitted'">{{ s.status }}</span>
            </div>
            <div class="answer-content">{{ s.content }}</div>
            @if (s.status === 'Graded') {
              <div class="grade-summary">
                <strong
                  >{{ s.marks }} <small>/ {{ a.maximumMarks }} marks</small></strong
                ><span
                  class="pill"
                  [class.success]="((s.marks || 0) * 100) / a.maximumMarks >= a.passingPercentage"
                  >{{
                    ((s.marks || 0) * 100) / a.maximumMarks >= a.passingPercentage
                      ? 'Passed'
                      : 'Below passing threshold'
                  }}</span
                >
              </div>
              <h3>Trainer feedback</h3>
              <p class="preserve-lines">{{ s.feedback || 'No written feedback was added.' }}</p>
              <a class="btn btn-secondary" [routerLink]="['/student/progress', a.courseId]"
                >View course requirements</a
              >
            } @else {
              <p class="muted">Your trainer will review your work and add marks and feedback.</p>
            }
          } @else {
            <h2>Make it yours.</h2>
            <p>Take your time, explain your thinking, and share what you’ve learned.</p>
            <app-submission-form [assignment]="a" (submitted)="load()" />
          }
        </section>
      } @else {
        <section class="panel table-panel">
          <div class="panel-title padded">
            <div>
              <h2>Learner submissions</h2>
              <p>Review the work. Recognize the effort. Guide the next step.</p>
            </div>
            <a
              [routerLink]="[base + '/assignments', a.assignmentId, 'edit']"
              class="btn btn-small btn-secondary"
              >Edit assignment</a
            >
          </div>
          <app-submission-grading [assignment]="a" />
        </section>
      }
    } `,
})
export class AssignmentDetails {
  private api = inject(AssignmentService);
  private id = inject(ActivatedRoute).snapshot.paramMap.get('id')!;
  student = inject(AuthService).user()?.role === 'Student';
  base = '/' + inject(AuthService).user()!.role.toLowerCase();
  assignment = signal<Assignment | null>(null);
  submission = signal<Submission | null>(null);
  loading = signal(true);
  error = signal('');
  constructor() {
    void this.load();
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.assignment.set(await firstValueFrom(this.api.get(this.id)));
      if (this.student)
        this.submission.set((await firstValueFrom(this.api.submissions(this.id))).items[0] || null);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
}
