import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { ProgressService } from './progress.service';
import { LessonService } from './lesson.service';
describe('Server-backed progress', () => {
  it('reads saved progress and completes only the selected lesson without a student ID', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    const progress = TestBed.inject(ProgressService);
    const lessons = TestBed.inject(LessonService);
    const reading = firstValueFrom(progress.course('course-id'));
    http.expectOne('/api/progress/courses/course-id').flush({
      success: true,
      data: {
        courseId: 'course-id',
        totalLessons: 3,
        completedLessons: 1,
        percentage: 33,
        lessons: [],
      },
    });
    expect((await reading).percentage).toBe(33);
    const completion = firstValueFrom(lessons.complete('lesson-id'));
    const request = http.expectOne('/api/lessons/lesson-id/complete');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({});
    request.flush({
      success: true,
      data: { lessonId: 'lesson-id', isCompleted: true, completedAt: new Date().toISOString() },
    });
    expect((await completion).isCompleted).toBe(true);
    http.verify();
  });
});
