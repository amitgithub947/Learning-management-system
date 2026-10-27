import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { AssignmentService } from '../../../core/services/assignment.service';
import { CourseWorkspaceService } from '../../../core/services/course-workspace.service';
import { Assignment, CourseChoice } from '../../../core/models/advanced';
import { emptyPage } from '../../../core/models/models';
import { IconComponent } from '../../../shared/components/icon';
import { CourseNav } from '../../../shared/components/course-nav';
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
    DatePipe,
    RouterLink,
    MatPaginatorModule,
    IconComponent,
    CourseNav,
    EmptyComponent,
    ErrorComponent,
    SkeletonComponent,
  ],
  template: ` <div class="page-heading heading-with-action">
      <div>
        <span class="eyebrow">PUT YOUR KNOWLEDGE INTO PRACTICE</span>
        <h1>Assignments</h1>
        <p>
          {{
            student
              ? 'Show what you’ve learned. Get feedback that helps you grow.'
              : 'Create meaningful practice, review submissions, and guide your learners.'
          }}
        </p>
      </div>
      @if (!student && courseId()) {
        <a
          class="btn btn-primary"
          [routerLink]="base + '/assignments/new'"
          [queryParams]="{ courseId: courseId() }"
          ><app-icon name="plus" />Create assignment</a
        >
      }
    </div>
    <div class="course-selector panel">
      <label for="assignment-course">Course workspace</label
      ><select id="assignment-course" [ngModel]="courseId()" (ngModelChange)="choose($event)">
        <option value="" disabled>Select a course</option>
        @for (course of choices(); track course.courseId) {
          <option [value]="course.courseId">{{ course.title }}</option>
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
        title="Start with a course"
        [message]="
          student
            ? 'Enroll in a course to discover its assignments.'
            : 'Create a course before adding assignments.'
        "
        ><a class="btn btn-primary" [routerLink]="student ? '/courses' : '/trainer/courses'"
          >View courses</a
        ></app-empty
      >
    } @else {
      <section class="panel table-panel">
        <div class="table-toolbar">
          <form class="search-field" (ngSubmit)="searchRows()">
            <app-icon name="search" /><input
              name="search"
              [(ngModel)]="search"
              placeholder="Find an assignment"
              aria-label="Search assignments"
            /><button class="icon-button" aria-label="Search assignments">
              <app-icon name="arrow" />
            </button>
          </form>
          <span class="muted"
            >{{ page().totalCount }}
            {{ page().totalCount === 1 ? 'assignment' : 'assignments' }}</span
          >
        </div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Assignment</th>
                <th>Due date</th>
                <th>Marks / pass</th>
                <th>Requirement</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (a of page().items; track a.assignmentId) {
                <tr>
                  <td>
                    <strong>{{ a.title }}</strong>
                  </td>
                  <td>{{ a.dueDate | date: 'MMM d, y, h:mm a' }}</td>
                  <td>{{ a.maximumMarks }} marks · {{ a.passingPercentage }}%</td>
                  <td>
                    <span class="pill" [class.neutral]="!a.isRequired">{{
                      a.isRequired ? 'Required' : 'Optional'
                    }}</span>
                  </td>
                  <td>
                    <div class="table-actions">
                      <a
                        class="btn btn-small btn-primary"
                        [routerLink]="[base + '/assignments', a.assignmentId]"
                        >{{ student ? 'View assignment' : 'Submissions' }}</a
                      >
                      @if (!student) {
                        <a
                          class="icon-button"
                          [routerLink]="[base + '/assignments', a.assignmentId, 'edit']"
                          aria-label="Edit assignment"
                          ><app-icon name="edit" /></a
                        ><button
                          class="icon-button danger"
                          [disabled]="busy()"
                          (click)="remove(a)"
                          aria-label="Delete assignment"
                        >
                          <app-icon name="trash" />
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (!page().items.length) {
          <app-empty
            title="Room for a little practice"
            message="Assignments for this course will appear here."
          />
        }
        <mat-paginator
          [length]="page().totalCount"
          [pageSize]="10"
          [pageIndex]="pageIndex"
          [hidePageSize]="true"
          (page)="paginate($event)"
          aria-label="Assignment pages"
        />
      </section>
    }`,
})
export class AssignmentList {
  private api = inject(AssignmentService);
  private workspace = inject(CourseWorkspaceService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private ui = uiHelpers();
  student = inject(AuthService).user()?.role === 'Student';
  base = '/' + inject(AuthService).user()!.role.toLowerCase();
  choices = signal<CourseChoice[]>([]);
  courseId = signal(this.route.snapshot.queryParamMap.get('courseId') || '');
  page = signal(emptyPage<Assignment>());
  loading = signal(true);
  busy = signal(false);
  error = signal('');
  search = '';
  pageIndex = 0;
  constructor() {
    void this.initialize();
  }
  async initialize() {
    this.loading.set(true);
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
            search: this.search,
            pageNumber: this.pageIndex + 1,
            pageSize: 10,
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
  async remove(a: Assignment) {
    if (
      !(await this.ui.confirm(
        'Delete assignment?',
        `Delete “${a.title}”? Assignments with submissions are retained.`,
        'Delete assignment',
      ))
    )
      return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.delete(a.assignmentId));
      this.ui.toast('Assignment deleted.');
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
