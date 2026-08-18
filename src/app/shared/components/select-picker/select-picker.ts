import {
  CUSTOM_ELEMENTS_SCHEMA,
  Component,
  ElementRef,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

export interface SelectPickerOption {
  readonly value: string;
  readonly label: string;
  readonly detail?: string;
  readonly icon?: string;
}

@Component({
  selector: 'app-select-picker',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [TranslatePipe],
  templateUrl: './select-picker.html',
  styleUrl: './select-picker.scss',
  host: { '(document:keydown.escape)': 'close()' },
})
export class SelectPicker {
  readonly value = input('');
  readonly options = input.required<readonly SelectPickerOption[]>();
  readonly sheetTitle = input('Choose an option');
  readonly placeholder = input('Choose an option');
  readonly disabled = input(false);
  readonly compact = input(false);
  readonly searchable = input(false);
  readonly valueChange = output<string>();
  readonly open = signal(false);
  readonly search = signal('');
  readonly selectedOption = computed(() =>
    this.options().find((option) => option.value === this.value()),
  );
  readonly filteredOptions = computed(() => {
    const query = this.search().trim().toLocaleLowerCase();
    return query
      ? this.options().filter((option) =>
          `${option.label} ${option.detail ?? ''}`.toLocaleLowerCase().includes(query),
        )
      : this.options();
  });
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly closeButton = viewChild<ElementRef<HTMLButtonElement>>('closeButton');
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  openPicker(): void {
    if (this.disabled()) return;
    this.search.set('');
    this.open.set(true);
    globalThis.setTimeout(
      () => (this.searchInput() ?? this.closeButton())?.nativeElement.focus(),
      0,
    );
  }
  close(restoreFocus = true): void {
    if (!this.open()) return;
    this.open.set(false);
    if (restoreFocus) globalThis.setTimeout(() => this.trigger()?.nativeElement.focus(), 0);
  }
  select(value: string): void {
    this.valueChange.emit(value);
    this.close();
  }
  updateSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }
}
