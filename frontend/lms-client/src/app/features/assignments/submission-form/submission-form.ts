import { Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AssignmentService } from '../../../core/services/assignment.service';
import { Assignment } from '../../../core/models/advanced';
import { uiHelpers } from '../../../shared/components/ui';
import { IconComponent } from '../../../shared/components/icon';
import { errorMessage } from '../../../core/interceptors/error.interceptor';
@Component({
  selector: 'app-submission-form',
  imports: [ReactiveFormsModule, IconComponent],
  template: `<form [formGroup]="form" (ngSubmit)="submit()" class="form-stack">
    <label
      >Your answer<textarea
        formControlName="content"
        rows="9"
        placeholder="Explain your approach and share your answer."
      ></textarea>
    </label>
    @if (form.controls.content.touched && form.controls.content.invalid) {
      <small class="field-error">Enter your answer (up to 100,000 characters).</small>
    }
    @if (error()) {
      <div class="form-error" role="alert">{{ error() }}</div>
    }
    <p class="form-hint">
      Review your answer before submitting. The trainer will grade it and share feedback.
    </p>
    <button class="btn btn-primary" [disabled]="busy() || isOverdue()">
      {{ busy() ? 'Submitting…' : isOverdue() ? 'Deadline passed' : 'Submit answer'
      }}<app-icon name="arrow" />
    </button>
  </form>`,
})
export class SubmissionForm {
  assignment = input.required<Assignment>();
  submitted = output<void>();
  private api = inject(AssignmentService);
  private ui = uiHelpers();
  busy = signal(false);
  error = signal('');
  form = inject(FormBuilder).nonNullable.group({
    content: ['', [Validators.required, Validators.maxLength(100000)]],
  });
  isOverdue() {
    return new Date(this.assignment().dueDate).getTime() < Date.now();
  }
  async submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    if (
      !(await this.ui.confirm(
        'Submit your answer?',
        'Your answer will be sent to your trainer for grading.',
        'Submit answer',
      ))
    )
      return;
    this.busy.set(true);
    this.error.set('');
    try {
      await firstValueFrom(
        this.api.submit(this.assignment().assignmentId, this.form.controls.content.value),
      );
      this.ui.toast('Answer submitted. Your effort counts.');
      this.submitted.emit();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
