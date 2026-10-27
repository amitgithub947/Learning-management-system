import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyComponent } from '../../shared/components/ui';
@Component({
  imports: [RouterLink, EmptyComponent],
  template: `<div class="container section">
    <app-empty
      title="This chapter hasn’t been written."
      message="The page you’re looking for doesn’t exist. Let’s find your next possibility."
      ><a class="btn btn-primary" routerLink="/courses">Explore courses</a></app-empty
    >
  </div>`,
})
export class NotFound {}
