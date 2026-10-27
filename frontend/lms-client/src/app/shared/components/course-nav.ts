import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { IconComponent } from './icon';
@Component({
  selector: 'app-course-nav',
  imports: [RouterLink, IconComponent],
  template: `@if (authenticated()) {
    <nav class="course-context-nav" aria-label="Course workspace">
      <a
        [routerLink]="
          student() ? ['/student/learn', courseId()] : [base() + '/courses', courseId(), 'lessons']
        "
        ><app-icon name="book" />Lessons</a
      ><a [routerLink]="base() + '/assignments'" [queryParams]="{ courseId: courseId() }"
        ><app-icon name="edit" />Assignments</a
      ><a [routerLink]="base() + '/quizzes'" [queryParams]="{ courseId: courseId() }"
        ><app-icon name="help" />Quizzes</a
      ><a
        [routerLink]="
          student()
            ? ['/student/progress', courseId()]
            : [base() + '/courses', courseId(), 'students']
        "
        ><app-icon name="chart" />{{ student() ? 'Course progress' : 'Student progress' }}</a
      >
      @if (!student()) {
        <a [routerLink]="[base() + '/courses', courseId(), 'completion']"
          ><app-icon name="settings" />Completion rules</a
        >
      }
    </nav>
  }`,
})
export class CourseNav {
  courseId = input.required<string>();
  private auth = inject(AuthService);
  authenticated = computed(() => !!this.auth.user());
  student = computed(() => this.auth.user()?.role === 'Student');
  base = computed(() => '/' + this.auth.user()?.role.toLowerCase());
}
