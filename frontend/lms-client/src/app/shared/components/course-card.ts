import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Course } from '../../core/models/models';
import { IconComponent } from './icon';
@Component({
  selector: 'app-course-card',
  imports: [RouterLink, IconComponent],
  template: ` <a class="course-card" [routerLink]="['/courses', course().courseId]">
    <div class="course-art" [class.database]="course().category === 'Database'">
      @if (course().thumbnailUrl) {
        <img
          [src]="course().thumbnailUrl"
          [alt]="course().title"
          loading="lazy"
          (error)="hideImage($event)"
        />
      }
      <span class="art-grid"></span><span class="art-orbit"></span
      ><app-icon [name]="course().category === 'Database' ? 'globe' : 'code'" />
      <span class="art-label">{{ course().category }}</span
      ><span class="course-badge">COURSE</span>
    </div>
    <div class="course-card-body">
      <span class="eyebrow">{{ course().category }}</span>
      <h3>{{ course().title }}</h3>
      <p>{{ course().description }}</p>
      <div class="course-card-footer">
        <span><app-icon name="book" />Self-paced learning</span
        ><span class="round-arrow"><app-icon name="arrow" /></span>
      </div>
    </div>
  </a>`,
})
export class CourseCardComponent {
  course = input.required<Course>();
  hideImage(event: Event) {
    (event.target as HTMLImageElement).style.display = 'none';
  }
}
