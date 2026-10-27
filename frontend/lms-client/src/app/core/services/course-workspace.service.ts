import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { CourseService } from './course.service';
import { ProgressService } from './progress.service';
import { CourseChoice } from '../models/advanced';
@Injectable({ providedIn: 'root' })
export class CourseWorkspaceService {
  private auth = inject(AuthService);
  private courses = inject(CourseService);
  private progress = inject(ProgressService);
  async choices() {
    const rows: CourseChoice[] = [];
    let pageNumber = 1;
    while (true) {
      const page =
        this.auth.user()?.role === 'Student'
          ? await firstValueFrom(this.progress.mine({ pageNumber, pageSize: 100 }))
          : await firstValueFrom(this.courses.mine({ pageNumber, pageSize: 100 }));
      rows.push(...page.items.map((c) => ({ courseId: c.courseId, title: c.title })));
      if (rows.length >= page.totalCount || !page.items.length) break;
      pageNumber++;
    }
    return rows;
  }
}
