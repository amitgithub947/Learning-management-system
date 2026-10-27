import { Pipe, PipeTransform } from '@angular/core';
@Pipe({ name: 'initials' })
export class InitialsPipe implements PipeTransform {
  transform(value: string | undefined | null) {
    return (value || '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0])
      .join('')
      .toUpperCase();
  }
}
