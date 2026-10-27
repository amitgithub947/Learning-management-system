import { ThemeToggle } from '../../shared/components/theme-toggle';
import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { IconComponent } from '../../shared/components/icon';
@Component({
  selector: 'app-public-layout',
  imports: [ThemeToggle, RouterLink, RouterLinkActive, RouterOutlet, IconComponent],
  template: ` <a class="skip-link" href="#main">Skip to content</a>
    <header class="public-header">
      <div class="container nav-inner">
        <a routerLink="/" class="brand" aria-label="Learnwell home"
          ><span class="brand-mark"><app-icon name="book" /></span>learnwell<span class="brand-dot"
            >.</span
          ></a
        >
        <nav aria-label="Main navigation">
          <a routerLink="/courses" routerLinkActive="active">Explore courses</a
          ><a routerLink="/" fragment="how-it-works" class="hide-mobile">How it works</a>
        </nav>
        <div class="nav-actions">
          <app-theme-toggle />
          @if (auth.user()) {
            <a class="btn btn-primary" [routerLink]="auth.home()"
              >My dashboard <app-icon name="arrow"
            /></a>
          } @else {
            <a routerLink="/login" class="nav-login">Log in</a
            ><a routerLink="/register" class="btn btn-primary"
              >Get started <app-icon name="arrow"
            /></a>
          }
        </div>
      </div>
    </header>
    <main id="main"><router-outlet /></main>
    <footer class="public-footer">
      <div class="container footer-main">
        <div>
          <a class="brand" routerLink="/"
            ><span class="brand-mark"><app-icon name="book" /></span>learnwell.</a
          >
          <p>A little progress. A world of possibility.</p>
        </div>
        <div>
          <a routerLink="/courses">Explore courses</a><a routerLink="/register">Start learning</a
          ><a routerLink="/login">Trainer login</a
          ><a routerLink="/certificates/verify">Verify a certificate</a>
        </div>
      </div>
      <div class="container footer-bottom">
        <span>© {{ year }} Learnwell. Keep moving forward.</span
        ><span>Made for curious minds.</span>
      </div>
    </footer>`,
})
export class PublicLayout {
  auth = inject(AuthService);
  year = new Date().getFullYear();
}
