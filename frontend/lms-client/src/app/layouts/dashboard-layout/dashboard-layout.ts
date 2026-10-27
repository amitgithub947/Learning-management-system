import { ThemeToggle } from '../../shared/components/theme-toggle';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { A11yModule } from '@angular/cdk/a11y';
import { AuthService } from '../../core/auth/auth.service';
import { IconComponent } from '../../shared/components/icon';
import { InitialsPipe } from '../../shared/pipes/initials.pipe';
@Component({
  selector: 'app-dashboard-layout',
  imports: [
    ThemeToggle,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    IconComponent,
    InitialsPipe,
    A11yModule,
  ],
  template: ` <a class="skip-link" href="#main">Skip to content</a>
    <div class="dashboard-shell">
      @if (open()) {
        <button
          class="sidebar-backdrop"
          aria-label="Close navigation"
          (click)="open.set(false)"
        ></button>
      }
      <aside
        id="workspace-navigation"
        class="sidebar"
        [class.is-open]="open()"
        [attr.inert]="mobile().matches && !open() ? '' : null"
        [cdkTrapFocus]="mobile().matches && open()"
        [cdkTrapFocusAutoCapture]="mobile().matches && open()"
        (keydown.escape)="open.set(false)"
      >
        <a routerLink="/" class="brand"
          ><span class="brand-mark"><app-icon name="book" /></span>learnwell<span class="brand-dot"
            >.</span
          ></a
        >
        <div class="workspace-label">{{ auth.user()?.role }} workspace</div>
        <nav aria-label="Dashboard navigation">
          @for (item of links(); track item.path) {
            <a [routerLink]="item.path" routerLinkActive="selected"
              ><app-icon [name]="item.icon" />{{ item.label }}</a
            >
          }
        </nav>
        <div class="sidebar-bottom">
          <div class="sidebar-tip">
            <app-icon name="spark" /><strong>Small steps. Big possibilities.</strong>
            <p>Your next chapter is one lesson away.</p>
            <a routerLink="/courses">Explore something new <app-icon name="arrow" /></a>
          </div>
          <a routerLink="/account/profile" routerLinkActive="selected" class="sidebar-account"
            ><app-icon name="settings" />Account settings</a
          ><button class="sidebar-account" (click)="logout()">
            <app-icon name="logout" />Log out
          </button>
        </div>
      </aside>
      <div class="dashboard-main">
        <header class="dashboard-header">
          <div class="header-location">
            <button
              class="icon-button mobile-menu"
              aria-label="Open navigation"
              aria-controls="workspace-navigation"
              [attr.aria-expanded]="open()"
              (click)="open.set(true)"
            >
              <app-icon name="menu" /></button
            ><a routerLink="/">Workspace</a><app-icon name="chevron" /><span>{{ section() }}</span>
          </div>
          <div class="header-profile">
            <app-theme-toggle />
            <a routerLink="/courses" class="explore-link"
              ><app-icon name="globe" />Explore catalog</a
            ><span class="header-divider"></span
            ><a routerLink="/account/profile" class="profile-link"
              ><span class="avatar">{{ auth.user()?.name | initials }}</span>
              <div>
                <strong>{{ auth.user()?.name }}</strong
                ><small>{{ auth.user()?.role }}</small>
              </div></a
            >
          </div>
        </header>
        <main id="main" class="workspace-content"><router-outlet /></main>
        <footer class="workspace-footer">
          Learn something. Build something. Keep going.<span>Learnwell © {{ year }}</span>
        </footer>
      </div>
    </div>`,
})
export class DashboardLayout {
  mobile = toSignal(inject(BreakpointObserver).observe('(max-width: 640px)'), {
    initialValue: { matches: false, breakpoints: {} },
  });
  auth = inject(AuthService);
  router = inject(Router);
  open = signal(false);
  section = signal('Overview');
  year = new Date().getFullYear();
  links = computed(() => {
    const role = this.auth.user()?.role;
    if (!role) return [];
    const base = `/${role?.toLowerCase()}`;
    if (role === 'Admin')
      return [
        { label: 'Overview', icon: 'grid', path: base + '/dashboard' },
        { label: 'User management', icon: 'users', path: base + '/users' },
        { label: 'Trainer management', icon: 'shield', path: base + '/trainers' },
        { label: 'All courses', icon: 'book', path: base + '/courses' },
        { label: 'Assignments', icon: 'edit', path: base + '/assignments' },
        { label: 'Quizzes', icon: 'help', path: base + '/quizzes' },
        { label: 'Analytics', icon: 'chart', path: base + '/analytics' },
      ];
    if (role === 'Trainer')
      return [
        { label: 'Overview', icon: 'grid', path: base + '/dashboard' },
        { label: 'My courses', icon: 'book', path: base + '/courses' },
        { label: 'Create a course', icon: 'plus', path: base + '/courses/new' },
        { label: 'Assignments', icon: 'edit', path: base + '/assignments' },
        { label: 'Quizzes', icon: 'help', path: base + '/quizzes' },
        { label: 'Analytics', icon: 'chart', path: base + '/analytics' },
      ];
    return [
      { label: 'Overview', icon: 'grid', path: base + '/dashboard' },
      { label: 'My learning', icon: 'book', path: base + '/courses' },
      { label: 'My progress', icon: 'chart', path: base + '/progress' },
      { label: 'Assignments', icon: 'edit', path: base + '/assignments' },
      { label: 'Quizzes', icon: 'help', path: base + '/quizzes' },
      { label: 'Certificates', icon: 'trophy', path: base + '/certificates' },
      { label: 'Browse courses', icon: 'globe', path: '/courses' },
    ];
  });
  constructor() {
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.open.set(false);
        const url = this.router.url;
        this.section.set(
          url.includes('assignments')
            ? 'Assignments'
            : url.includes('quiz')
              ? 'Quizzes'
              : url.includes('certificates')
                ? 'Certificates'
                : url.includes('analytics')
                  ? 'Analytics'
                  : url.includes('profile')
                    ? 'Account settings'
                    : url.includes('learn')
                      ? 'Learning studio'
                      : url.includes('progress')
                        ? 'My progress'
                        : url.includes('users')
                          ? 'User management'
                          : url.includes('trainers')
                            ? 'Trainer management'
                            : url.includes('courses')
                              ? 'Courses'
                              : 'Overview',
        );
      });
  }
  async logout() {
    try {
      await this.auth.logout();
    } finally {
      await this.router.navigateByUrl('/login');
    }
  }
}
