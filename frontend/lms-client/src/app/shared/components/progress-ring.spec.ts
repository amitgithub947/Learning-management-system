import { TestBed } from '@angular/core/testing';
import { ProgressRing } from './progress-ring';
describe('ProgressRing', () => {
  it('renders zero progress safely and supports a quiz score caption', async () => {
    await TestBed.configureTestingModule({ imports: [ProgressRing] }).compileComponents();
    const f = TestBed.createComponent(ProgressRing);
    f.componentRef.setInput('value', 0);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('0');
    expect(f.nativeElement.textContent).toContain('lessons complete');
    expect(f.componentInstance.background()).not.toContain('NaN');
    f.componentRef.setInput('value', 100);
    f.componentRef.setInput('label', 'quiz score');
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('100');
    expect(f.nativeElement.textContent).toContain('quiz score');
  });
});
