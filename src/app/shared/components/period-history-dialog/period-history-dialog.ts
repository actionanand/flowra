import {
  CUSTOM_ELEMENTS_SCHEMA,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { validateHistoricalPeriodRange } from '../../../core/utils/period-range';

export interface HistoricalPeriodRange {
  readonly startDate: string;
  readonly endDate: string;
}

@Component({
  selector: 'app-period-history-dialog',
  imports: [TranslatePipe],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './period-history-dialog.html',
  styleUrl: './period-history-dialog.scss',
})
export class PeriodHistoryDialog {
  readonly today = input.required<string>();
  readonly latestStartDate = input.required<string>();
  readonly busy = input(false);
  readonly externalErrorKey = input('');
  readonly confirmed = output<HistoricalPeriodRange>();
  readonly cancelled = output<void>();
  readonly changed = output<void>();

  protected readonly startDate = signal('');
  protected readonly endDate = signal('');
  protected readonly submitted = signal(false);
  protected readonly localErrorKey = computed(() => {
    if (!this.submitted() && !this.startDate() && !this.endDate()) return '';
    const error = validateHistoricalPeriodRange(this.startDate(), this.endDate(), this.today(), []);
    return error ? `periodHistory.errors.${error}` : '';
  });
  protected readonly errorKey = computed(() => this.localErrorKey() || this.externalErrorKey());

  private readonly document = inject(DOCUMENT);
  private readonly closeButton = viewChild<ElementRef<HTMLButtonElement>>('closeButton');
  private readonly startInput = viewChild<ElementRef<HTMLInputElement>>('startInput');
  private readonly saveButton = viewChild<ElementRef<HTMLButtonElement>>('saveButton');

  constructor() {
    effect(() => {
      const input = this.startInput()?.nativeElement;
      if (input) queueMicrotask(() => input.focus());
    });
  }

  protected updateStart(event: Event): void {
    this.startDate.set(this.inputValue(event));
    this.changed.emit();
  }

  protected updateEnd(event: Event): void {
    this.endDate.set(this.inputValue(event));
    this.changed.emit();
  }

  protected submit(event: Event): void {
    event.preventDefault();
    this.submitted.set(true);
    if (this.localErrorKey() || this.busy()) return;
    this.confirmed.emit({ startDate: this.startDate(), endDate: this.endDate() });
  }

  protected cancel(): void {
    if (!this.busy()) this.cancelled.emit();
  }

  protected trapFocus(event: Event): void {
    if (!(event instanceof KeyboardEvent)) return;
    const first = this.closeButton()?.nativeElement;
    const last = this.saveButton()?.nativeElement;
    if (!first || !last) return;
    if (event.shiftKey && this.document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && this.document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private inputValue(event: Event): string {
    return event.target instanceof HTMLInputElement ? event.target.value : '';
  }
}
