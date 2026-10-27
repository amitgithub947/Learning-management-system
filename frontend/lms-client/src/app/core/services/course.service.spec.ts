import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { CourseService } from './course.service';
describe('CourseService', () => {
  it('preserves server search, status, sort and pagination parameters', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(CourseService);
    const http = TestBed.inject(HttpTestingController);
    const promise = firstValueFrom(
      api.mine({
        search: 'TypeScript',
        status: 'Draft',
        sort: 'newest',
        pageNumber: 2,
        pageSize: 10,
      }),
    );
    const req = http.expectOne((r) => r.url === '/api/courses/my-courses');
    expect(req.request.params.get('pageNumber')).toBe('2');
    expect(req.request.params.get('search')).toBe('TypeScript');
    expect(req.request.params.get('status')).toBe('Draft');
    req.flush({ success: true, data: { items: [], pageNumber: 2, pageSize: 10, totalCount: 10 } });
    expect((await promise).totalCount).toBe(10);
    http.verify();
  });
  it('creates course metadata without trusting a client-supplied trainer identity', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    const body = {
      title: 'Course',
      description: 'Description',
      category: 'Development',
      thumbnailUrl: null,
    };
    const promise = firstValueFrom(TestBed.inject(CourseService).create(body));
    const req = http.expectOne('/api/courses');
    expect(req.request.body).toEqual(body);
    expect(req.request.body.trainerId).toBeUndefined();
    req.flush({ success: true, data: { courseId: 'id', ...body } });
    expect((await promise).courseId).toBe('id');
    http.verify();
  });
});
