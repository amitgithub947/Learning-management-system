import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { QuizBuilder } from './quiz-builder';
import { AuthService } from '../../../core/auth/auth.service';
import { CourseWorkspaceService } from '../../../core/services/course-workspace.service';
describe('QuizBuilder', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuizBuilder],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: new Map(), queryParamMap: new Map([['courseId', 'course']]) },
          },
        },
        { provide: AuthService, useValue: { user: signal({ role: 'Trainer' }) } },
        {
          provide: CourseWorkspaceService,
          useValue: { choices: () => Promise.resolve([{ courseId: 'course', title: 'Course' }]) },
        },
      ],
    }).compileComponents();
  });
  it('requires an expected answer for short-text questions and removes answer options', async () => {
    const f = TestBed.createComponent(QuizBuilder);
    f.detectChanges();
    await f.whenStable();
    const c = f.componentInstance;
    const q = c.questions.at(0);
    q.controls.questionType.setValue('FreeText');
    c.typeChanged(0);
    expect(q.controls.options.length).toBe(0);
    expect(q.controls.expectedAnswer.hasError('required')).toBe(true);
    q.controls.expectedAnswer.setValue('TypeScript');
    expect(q.controls.expectedAnswer.valid).toBe(true);
  });
  it('keeps exactly one selected correct option in a single-choice question', async () => {
    const f = TestBed.createComponent(QuizBuilder);
    f.detectChanges();
    await f.whenStable();
    const c = f.componentInstance;
    const options = c.questions.at(0).controls.options;
    options.at(1).controls.isCorrect.setValue(true);
    c.correctChanged(0, 1);
    expect(options.at(0).controls.isCorrect.value).toBe(false);
    expect(options.at(1).controls.isCorrect.value).toBe(true);
  });
});
