import {
  CUSTOM_ELEMENTS_SCHEMA,
  Component,
  ElementRef,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';

@Component({
  selector: 'app-confirmation-dialog',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div
      class="confirmation-backdrop"
      tabindex="-1"
      (click)="cancelled.emit()"
      (keydown.escape)="cancelled.emit()"
    >
      <section
        class="confirmation-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmation-title"
        aria-describedby="confirmation-message"
        (click)="$event.stopPropagation()"
        (keydown.escape)="$event.stopPropagation(); cancelled.emit()"
        (keydown.tab)="trapFocus($event)"
      >
        <span class="confirmation-icon" aria-hidden="true">
          <ion-icon [name]="iconName()" />
        </span>
        <div>
          <h2 id="confirmation-title">{{ title() }}</h2>
          <p id="confirmation-message">{{ message() }}</p>
        </div>
        <div class="confirmation-actions">
          <button #cancelButton class="secondary-button" type="button" (click)="cancelled.emit()">
            {{ cancelLabel() }}
          </button>
          <button #confirmButton class="primary-button" type="button" (click)="confirmed.emit()">
            <ion-icon [name]="iconName()" aria-hidden="true" />
            {{ confirmLabel() }}
          </button>
        </div>
      </section>
    </div>
  `,
  styles: `
    .confirmation-backdrop {
      position: fixed;
      z-index: 1100;
      inset: 0;
      display: grid;
      align-items: end;
      background: rgb(45 13 28 / 68%);
      backdrop-filter: blur(5px);
    }
    .confirmation-dialog {
      display: grid;
      width: 100%;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 0.85rem;
      padding: 1.25rem max(1rem, env(safe-area-inset-right))
        max(1.25rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
      border: 1px solid var(--border);
      border-radius: 1.5rem 1.5rem 0 0;
      color: var(--text);
      background: var(--surface);
      box-shadow: 0 -1rem 4rem rgb(45 13 28 / 28%);
    }
    .confirmation-icon {
      display: grid;
      width: 3rem;
      height: 3rem;
      place-items: center;
      border-radius: 1rem;
      color: var(--primary);
      background: var(--primary-soft);
      font-size: 1.35rem;
    }
    h2 {
      margin: 0;
      font-size: 1.2rem;
    }
    p {
      margin: 0.35rem 0 0;
      color: var(--text-muted);
      line-height: 1.5;
    }
    .confirmation-actions {
      display: grid;
      grid-column: 1 / -1;
      grid-template-columns: 1fr 1fr;
      gap: 0.65rem;
      margin-top: 0.35rem;
    }
    @media (min-width: 560px) {
      .confirmation-backdrop {
        place-items: center;
        padding: calc(env(safe-area-inset-top) + 1rem) max(1rem, env(safe-area-inset-right))
          max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
      }
      .confirmation-dialog {
        width: min(100%, 29rem);
        padding: 1.3rem;
        border-radius: 1.5rem;
      }
    }
  `,
})
export class ConfirmationDialog {
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmLabel = input.required<string>();
  readonly cancelLabel = input.required<string>();
  readonly iconName = input('create-outline');
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
  private readonly document = inject(DOCUMENT);
  private readonly cancelButton = viewChild<ElementRef<HTMLButtonElement>>('cancelButton');
  private readonly confirmButton = viewChild<ElementRef<HTMLButtonElement>>('confirmButton');

  constructor() {
    effect(() => {
      const button = this.cancelButton()?.nativeElement;
      if (button) queueMicrotask(() => button.focus());
    });
  }

  protected trapFocus(event: Event): void {
    if (!(event instanceof KeyboardEvent)) return;
    const first = this.cancelButton()?.nativeElement;
    const last = this.confirmButton()?.nativeElement;
    if (!first || !last) return;
    if (event.shiftKey && this.document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && this.document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
