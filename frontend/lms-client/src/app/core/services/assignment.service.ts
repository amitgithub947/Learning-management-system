import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Page, Query } from '../models/models';
import { Assignment, AssignmentRequest, Submission } from '../models/advanced';
@Injectable({ providedIn: 'root' })
export class AssignmentService {
  private api = inject(ApiService);
  list(courseId: string, q: Query = {}) {
    return this.api.get<Page<Assignment>>(`/courses/${courseId}/assignments`, q);
  }
  get(id: string) {
    return this.api.get<Assignment>(`/assignments/${id}`);
  }
  create(r: AssignmentRequest) {
    return this.api.post<Assignment>('/assignments', r);
  }
  update(id: string, r: AssignmentRequest) {
    return this.api.put<Assignment>(`/assignments/${id}`, r);
  }
  delete(id: string) {
    return this.api.delete(`/assignments/${id}`);
  }
  submit(id: string, content: string) {
    return this.api.post<Submission>(`/assignments/${id}/submit`, { content });
  }
  submissions(id: string, q: Query = {}) {
    return this.api.get<Page<Submission>>(`/assignments/${id}/submissions`, q);
  }
  grade(id: string, marks: number, feedback: string) {
    return this.api.patch<Submission>(`/submissions/${id}/grade`, { marks, feedback });
  }
}
