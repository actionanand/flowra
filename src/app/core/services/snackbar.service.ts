import { Service, signal } from '@angular/core';

export type SnackbarTone = 'SUCCESS' | 'INFO' | 'WARNING';

export interface SnackbarMessage {
  readonly id: number;
  readonly text: string;
  readonly tone: SnackbarTone;
}

@Service()
export class SnackbarService {
  readonly message = signal<SnackbarMessage | null>(null);
  private timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;

  show(text: string, tone: SnackbarTone = 'SUCCESS', durationMs = 3_600): void {
    this.dismiss();
    const id = Date.now();
    this.message.set({ id, text, tone });
    this.timeoutId = globalThis.setTimeout(() => {
      if (this.message()?.id === id) this.dismiss();
    }, durationMs);
  }

  dismiss(): void {
    if (this.timeoutId !== undefined) globalThis.clearTimeout(this.timeoutId);
    this.timeoutId = undefined;
    this.message.set(null);
  }
}
