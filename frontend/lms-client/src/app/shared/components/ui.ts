import { Component, inject, input, output } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { IconComponent } from './icon';
@Component({
  selector: 'app-empty',
  imports: [IconComponent],
  template: `<div class="empty-state">
    <div class="empty-icon"><app-icon [name]="icon()" /></div>
    <h3>{{ title() }}</h3>
    <p>{{ message() }}</p>
    <ng-content />
  </div>`,
})
export class EmptyComponent {
  title = input('Nothing here yet');
  message = input('Your next chapter starts here.');
  icon = input('book');
}
@Component({
  selector: 'app-error',
  imports: [IconComponent],
  template: `<div class="error-state" role="alert">
    <app-icon name="help" />
    <div>
      <strong>We couldn’t load this page</strong>
      <p>{{ message() }}</p>
    </div>
    <button class="btn btn-secondary" (click)="retry.emit()">Try again</button>
  </div>`,
})
export class ErrorComponent {
  message = input('Please try again.');
  retry = output<void>();
}
@Component({
  selector: 'app-skeleton',
  template: `<div class="skeleton-grid" aria-label="Loading content" role="status">
    @for (i of [1, 2, 3]; track i) {
      <div class="skeleton-card">
        <div class="skeleton skeleton-image"></div>
        <div class="skeleton skeleton-line"></div>
        <div class="skeleton skeleton-line short"></div>
      </div>
    }
  </div>`,
})
export class SkeletonComponent {}
@Component({
  selector: 'app-confirm-dialog',
  imports: [MatDialogModule, MatButtonModule],
  template: `<h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content
      ><p>{{ data.message }}</p></mat-dialog-content
    ><mat-dialog-actions align="end"
      ><button mat-button (click)="ref.close(false)">Cancel</button
      ><button mat-flat-button (click)="ref.close(true)">
        {{ data.confirm || 'Confirm' }}
      </button></mat-dialog-actions
    >`,
})
export class ConfirmDialog {
  data = inject<{ title: string; message: string; confirm?: string }>(MAT_DIALOG_DATA);
  ref = inject(MatDialogRef<ConfirmDialog>);
}
export function uiHelpers() {
  const dialog = inject(MatDialog);
  const snack = inject(MatSnackBar);
  return {
    toast: (message: string) => snack.open(message, 'Dismiss', { duration: 4000 }),
    confirm: (title: string, message: string, confirm = 'Confirm') =>
      firstValueFrom(
        dialog
          .open(ConfirmDialog, {
            width: '440px',
            maxWidth: '92vw',
            data: { title, message, confirm },
          })
          .afterClosed(),
      ),
  };
}
