import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { firstValueFrom } from 'rxjs';
import { UserService } from '../../core/services/user.service';
import { AuthService } from '../../core/auth/auth.service';
import { User, Role, emptyPage } from '../../core/models/models';
import { IconComponent } from '../../shared/components/icon';
import { InitialsPipe } from '../../shared/pipes/initials.pipe';
import {
  EmptyComponent,
  ErrorComponent,
  SkeletonComponent,
  uiHelpers,
} from '../../shared/components/ui';
import { errorMessage } from '../../core/interceptors/error.interceptor';
@Component({
  imports: [
    FormsModule,
    DatePipe,
    MatPaginatorModule,
    IconComponent,
    InitialsPipe,
    EmptyComponent,
    ErrorComponent,
    SkeletonComponent,
  ],
  template: ` <div class="page-heading">
      <span class="eyebrow">A COMMUNITY BUILT ON POSSIBILITY</span>
      <h1>{{ trainers ? 'Trainer management' : 'User management' }}</h1>
      <p>
        {{
          trainers
            ? 'Support the people who help your community grow.'
            : 'Manage accounts, roles, and access across your learning community.'
        }}
      </p>
    </div>
    <section class="panel table-panel">
      <div class="table-toolbar">
        <form class="search-field" (ngSubmit)="searchUsers()">
          <app-icon name="search" /><input
            aria-label="Search users"
            name="search"
            [(ngModel)]="search"
            placeholder="Search by name or email"
          /><button type="submit" class="icon-button" aria-label="Run user search">
            <app-icon name="arrow" />
          </button>
        </form>
        <div class="filter-group">
          @if (!trainers) {
            <select aria-label="Filter by role" [(ngModel)]="role" (change)="searchUsers()">
              <option value="">All roles</option>
              <option>Admin</option>
              <option>Trainer</option>
              <option>Student</option>
            </select>
          }
          <select aria-label="Filter by status" [(ngModel)]="status" (change)="searchUsers()">
            <option value="">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>
      @if (loading()) {
        <app-skeleton />
      } @else if (error()) {
        <app-error [message]="error()" (retry)="load()" />
      } @else {
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Manage account</th>
              </tr>
            </thead>
            <tbody>
              @for (user of page().items; track user.userId) {
                <tr>
                  <td>
                    <div class="table-person">
                      <span class="avatar">{{ user.name | initials }}</span>
                      <div>
                        <strong>{{ user.name }}</strong
                        ><small>{{ user.email }}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span class="pill" [class.neutral]="user.role === 'Student'">{{
                      user.role
                    }}</span>
                  </td>
                  <td>
                    <span class="status-tag" [class.inactive]="!user.isActive"
                      ><i></i>{{ user.isActive ? 'Active' : 'Inactive' }}</span
                    >
                  </td>
                  <td>{{ user.createdAt | date: 'MMM d, y' }}</td>
                  <td>
                    <div class="table-actions">
                      <select
                        [attr.aria-label]="'Role for ' + user.name"
                        [ngModel]="user.role"
                        (ngModelChange)="changeRole(user, $event)"
                        [disabled]="busy()"
                      >
                        <option>Admin</option>
                        <option>Trainer</option>
                        <option>Student</option></select
                      ><button
                        class="btn btn-small"
                        [class.btn-danger-soft]="user.isActive"
                        [class.btn-secondary]="!user.isActive"
                        (click)="changeStatus(user)"
                        [disabled]="busy()"
                      >
                        {{ user.isActive ? 'Deactivate' : 'Activate' }}
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (!page().items.length) {
          <app-empty
            title="No matching accounts"
            message="Try a different search, role, or status."
          />
        }
      }
      <mat-paginator
        [length]="page().totalCount"
        [pageSize]="10"
        [pageIndex]="pageIndex"
        [hidePageSize]="true"
        (page)="paginate($event)"
        aria-label="User pages"
      />
    </section>`,
})
export class UsersPage {
  private api = inject(UserService);
  private auth = inject(AuthService);
  private ui = uiHelpers();
  trainers = inject(ActivatedRoute).snapshot.data['trainers'] === true;
  page = signal(emptyPage<User>());
  loading = signal(true);
  error = signal('');
  busy = signal(false);
  search = '';
  role = this.trainers ? 'Trainer' : '';
  status = '';
  pageIndex = 0;
  constructor() {
    void this.load();
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.page.set(
        await firstValueFrom(
          this.api.list({
            search: this.search,
            role: this.role,
            isActive: this.status,
            pageNumber: this.pageIndex + 1,
            pageSize: 10,
          }),
        ),
      );
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
  searchUsers() {
    this.pageIndex = 0;
    void this.load();
  }
  paginate(e: PageEvent) {
    this.pageIndex = e.pageIndex;
    void this.load();
  }
  async changeRole(user: User, role: Role) {
    if (role === user.role) return;
    if (
      !(await this.ui.confirm(
        'Change account role?',
        `Change ${user.name} from ${user.role} to ${role}? Their existing sessions will end.`,
        'Change role',
      ))
    ) {
      await this.load();
      return;
    }
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.role(user.userId, role));
      this.ui.toast('Account role updated.');
      if (user.userId === this.auth.user()?.userId) {
        this.auth.clear();
        location.assign('/login');
        return;
      }
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  async changeStatus(user: User) {
    if (
      !(await this.ui.confirm(
        user.isActive ? 'Deactivate account?' : 'Activate account?',
        `${user.isActive ? 'Deactivate' : 'Activate'} ${user.name}’s account? Existing sessions will end.`,
        user.isActive ? 'Deactivate' : 'Activate',
      ))
    )
      return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.status(user.userId, !user.isActive));
      this.ui.toast('Account status updated.');
      if (user.userId === this.auth.user()?.userId) {
        this.auth.clear();
        location.assign('/login');
        return;
      }
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
