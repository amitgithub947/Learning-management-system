import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CourseService } from '../../core/services/course.service';
import { Course } from '../../core/models/models';
import { CourseCardComponent } from '../../shared/components/course-card';
import { IconComponent } from '../../shared/components/icon';
import { ErrorComponent, SkeletonComponent } from '../../shared/components/ui';
import { errorMessage } from '../../core/interceptors/error.interceptor';
@Component({
  imports: [RouterLink, CourseCardComponent, IconComponent, ErrorComponent, SkeletonComponent],
  template: ` <section class="landing-hero">
      <div class="container hero-grid">
        <div class="hero-copy">
          <div class="hero-kicker"><span class="live-dot"></span>FOR THE ALWAYS CURIOUS</div>
          <h1>Your next chapter<br />starts with<br /><span>one small step.</span></h1>
          <p>
            Build skills that open doors. Explore practical courses, learn from experienced
            trainers, and move forward at your own pace.
          </p>
          <div class="hero-actions">
            <a routerLink="/courses" class="btn btn-primary btn-lg"
              >Find your next course <app-icon name="arrow" /></a
            ><a routerLink="/register" class="hero-secondary"
              ><span class="play-circle"><app-icon name="play" /></span>Start your journey</a
            >
          </div>
          <div class="hero-footnote">
            <span class="mini-check"><app-icon name="check" /></span>Your pace. Your potential. Your
            next possibility.
          </div>
        </div>
        <div class="hero-visual" aria-hidden="true">
          <div class="hero-orbit orbit-one"></div>
          <div class="hero-orbit orbit-two"></div>
          <div class="visual-spark">✦</div>
          <div class="floating-label">
            <span class="label-icon"><app-icon name="spark" /></span>A little better, every day.
          </div>
          <div class="hero-learning-card">
            <div class="visual-card-top">
              <span class="visual-live"><i></i>YOUR LEARNING JOURNEY</span><app-icon name="book" />
            </div>
            <div class="visual-graphic">
              <span class="graphic-tile tile-one">&lt;/&gt;</span
              ><span class="graphic-tile tile-two">Aa</span
              ><span class="graphic-tile tile-three"><app-icon name="chart" /></span>
              <div class="graphic-ring"></div>
            </div>
            <div class="visual-card-bottom">
              <small>MAKE ROOM FOR WHAT’S NEXT</small>
              <h3>Learn it. Build it.<br />Make it yours.</h3>
              <div class="visual-progress"><span></span></div>
              <div class="visual-bottom-label">
                <span>One lesson at a time</span><app-icon name="arrow" />
              </div>
            </div>
          </div>
          <div class="floating-note">
            <span class="success-icon"><app-icon name="check" /></span>
            <div>
              <strong>Progress feels good.</strong><small>Keep your curiosity moving.</small>
            </div>
          </div>
        </div>
      </div>
    </section>
    <div class="benefit-strip">
      <div class="container">
        <span><app-icon name="shield" />Expert-led learning</span
        ><span><app-icon name="clock" />Built around your schedule</span
        ><span><app-icon name="chart" />Progress you can see</span
        ><span><app-icon name="globe" />Skills for the real world</span>
      </div>
    </div>
    <section class="section container">
      <div class="section-heading">
        <div>
          <span class="eyebrow">FIND YOUR NEXT POSSIBILITY</span>
          <h2>Big ideas start here.</h2>
          <p>Explore courses designed to turn curiosity into confidence.</p>
        </div>
        <a routerLink="/courses" class="text-link">Explore all courses <app-icon name="arrow" /></a>
      </div>
      @if (loading()) {
        <app-skeleton />
      } @else if (error()) {
        <app-error [message]="error()" (retry)="load()" />
      } @else {
        <div class="course-grid">
          @for (course of courses(); track course.courseId) {
            <app-course-card [course]="course" />
          } @empty {
            <p>New courses are on their way. Check back soon.</p>
          }
        </div>
      }
    </section>
    <section class="category-section">
      <div class="container">
        <span class="eyebrow">FOLLOW YOUR CURIOSITY</span>
        <h2>What will you explore?</h2>
        <div class="category-grid">
          @for (category of categories(); track category) {
            <a routerLink="/courses" [queryParams]="{ category }"
              ><span class="category-symbol"
                ><app-icon [name]="category === 'Database' ? 'globe' : 'code'" /></span
              ><strong>{{ category }}</strong
              ><app-icon name="arrow"
            /></a>
          }
        </div>
      </div>
    </section>
    <section class="section container" id="how-it-works">
      <div class="section-heading centered">
        <span class="eyebrow">A SIMPLE WAY FORWARD</span>
        <h2>A little learning. A lasting difference.</h2>
      </div>
      <div class="steps-grid">
        <article>
          <span class="step-number">01</span>
          <h3>Find your spark</h3>
          <p>Choose a course that meets you where you are and takes you somewhere new.</p>
        </article>
        <article>
          <span class="step-number">02</span>
          <h3>Make it a habit</h3>
          <p>Learn at your pace with focused lessons and practical, useful knowledge.</p>
        </article>
        <article>
          <span class="step-number">03</span>
          <h3>See yourself grow</h3>
          <p>Track every completed lesson and turn small wins into real progress.</p>
        </article>
      </div>
    </section>
    <section class="container cta-section">
      <div>
        <span class="eyebrow">YOUR FUTURE SELF WILL THANK YOU</span>
        <h2>Make today a starting point.</h2>
        <p>There’s a whole world of possibility ahead of you.</p>
      </div>
      <a routerLink="/register" class="btn btn-white btn-lg"
        >Start learning today <app-icon name="arrow"
      /></a>
    </section>`,
})
export class Landing {
  private api = inject(CourseService);
  courses = signal<Course[]>([]);
  categories = signal<string[]>([]);
  loading = signal(true);
  error = signal('');
  constructor() {
    void this.load();
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const [page, categories] = await Promise.all([
        firstValueFrom(this.api.list({ pageSize: 3, sort: 'newest' })),
        firstValueFrom(this.api.categories()),
      ]);
      this.courses.set(page.items);
      this.categories.set(categories);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
}
