import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Enrollment, Page, Query } from '../models/models';
@Injectable({ providedIn: 'root' })
export class EnrollmentService {
  private api = inject(ApiService);
  enroll(courseId: string) {
    return this.api.post<Enrollment>('/enrollments', { courseId });
  }
  mine(q: Query = {}) {
    return this.api.get<Page<Enrollment>>('/enrollments/my-courses', q);
  }
  forCourse(id: string, q: Query = {}) {
    return this.api.get<Page<Enrollment>>(`/enrollments/course/${id}`, q);
  }
}
