import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';

interface FlowraNativeBridge {
  hideSplash(): void;
  saveBackup(fileName: string, base64Data: string): void;
  openBackup(): void;
  setScreenshotProtection(enabled: boolean): void;
  setRecentPreviewProtection(enabled: boolean): void;
  setDarkMode(enabled: boolean): void;
  isBiometricAvailable(): boolean;
  enableBiometric(secret: string): void;
  authenticateBiometric(): void;
  disableBiometric(): void;
  notificationPermissionGranted(): boolean;
  requestNotificationPermission(): void;
  ensureNotificationChannel(): void;
  scheduleReminder(id: number, title: string, body: string, atMillis: number): void;
  cancelReminders(ids: string): void;
}

interface NativeWindow extends Window {
  FlowraNative?: FlowraNativeBridge;
}

@Injectable({ providedIn: 'root' })
export class NativeIntegrationService {
  private readonly document = inject(DOCUMENT);

  isAndroid(): boolean {
    return Boolean(this.bridge());
  }
  hideSplash(): void {
    this.bridge()?.hideSplash();
  }
  saveBackup(fileName: string, content: string): Promise<void> {
    const bridge = this.bridge();
    if (!bridge) return Promise.reject(new Error('Android file saving is unavailable.'));
    const encoded = this.toBase64(new TextEncoder().encode(content));
    return this.waitForResult(
      'backup-saved',
      () => bridge.saveBackup(fileName, encoded),
      300_000,
    ).then(() => undefined);
  }
  openBackup(): Promise<string> {
    const bridge = this.bridge();
    if (!bridge) return Promise.reject(new Error('Android file selection is unavailable.'));
    return this.waitForResult('backup-opened', () => bridge.openBackup(), 300_000).then((value) =>
      new TextDecoder().decode(this.fromBase64(value)),
    );
  }
  biometricAvailable(): boolean {
    return this.bridge()?.isBiometricAvailable() ?? false;
  }
  setScreenshotProtection(enabled: boolean): void {
    this.bridge()?.setScreenshotProtection(enabled);
  }

  setRecentPreviewProtection(enabled: boolean): void {
    this.bridge()?.setRecentPreviewProtection(enabled);
  }

  setDarkMode(enabled: boolean): void {
    this.bridge()?.setDarkMode(enabled);
  }

  enableBiometric(secret: string): Promise<void> {
    const bridge = this.bridge();
    if (!bridge) return Promise.reject(new Error('Biometric unlock is available only on Android.'));
    return this.waitForResult('biometric-enabled', () => bridge.enableBiometric(secret)).then(
      () => undefined,
    );
  }

  authenticateBiometric(): Promise<string> {
    const bridge = this.bridge();
    if (!bridge) return Promise.reject(new Error('Biometric unlock is available only on Android.'));
    return this.waitForResult('biometric-unlock', () => bridge.authenticateBiometric());
  }

  disableBiometric(): void {
    this.bridge()?.disableBiometric();
  }

  notificationPermissionGranted(): boolean {
    return this.bridge()?.notificationPermissionGranted() ?? false;
  }

  requestNotificationPermission(): Promise<boolean> {
    const bridge = this.bridge();
    if (!bridge) return Promise.reject(new Error('Notifications are available only on Android.'));
    return this.waitForResult('notification-permission', () =>
      bridge.requestNotificationPermission(),
    ).then((value) => value === 'granted');
  }

  ensureNotificationChannel(): void {
    this.bridge()?.ensureNotificationChannel();
  }

  scheduleReminder(id: number, title: string, body: string, atMillis: number): void {
    this.bridge()?.scheduleReminder(id, title, body, atMillis);
  }

  cancelReminders(ids: readonly number[]): void {
    this.bridge()?.cancelReminders(ids.join(','));
  }

  private bridge(): FlowraNativeBridge | undefined {
    return (this.document.defaultView as NativeWindow | null)?.FlowraNative;
  }

  private waitForResult(action: string, start: () => void, timeoutMs = 60_000): Promise<string> {
    const nativeWindow = this.document.defaultView;
    if (!nativeWindow) return Promise.reject(new Error('The Android bridge is unavailable.'));
    return new Promise<string>((resolve, reject) => {
      const chunkTransfers = new Map<string, string[]>();
      const finish = (success: boolean, data: string, message: string): void => {
        globalThis.clearTimeout(timeout);
        nativeWindow.removeEventListener('flowra-native-result', handleResult);
        if (!success) {
          reject(new Error(message || 'The Android request failed.'));
          return;
        }
        resolve(chunkTransfers.get(data)?.join('') ?? data);
      };
      const handleResult = (event: Event): void => {
        const detail = (
          event as CustomEvent<{
            action: string;
            success: boolean;
            data?: string;
            message?: string;
            transferId?: string;
            index?: number;
            total?: number;
          }>
        ).detail;
        if (detail.action === `${action}-chunk`) {
          const transferId = detail.transferId;
          if (!transferId) return;
          const chunks = chunkTransfers.get(transferId) ?? [];
          chunks[detail.index ?? chunks.length] = detail.data ?? '';
          chunkTransfers.set(transferId, chunks);
          return;
        }
        if (detail.action === action)
          finish(detail.success, detail.data ?? '', detail.message ?? '');
      };
      nativeWindow.addEventListener('flowra-native-result', handleResult);
      const timeout = globalThis.setTimeout(
        () => finish(false, '', 'The Android request timed out.'),
        timeoutMs,
      );
      try {
        start();
      } catch (error) {
        finish(
          false,
          '',
          error instanceof Error ? error.message : 'The Android request could not start.',
        );
      }
    });
  }
  private toBase64(value: Uint8Array): string {
    let binary = '';
    for (let offset = 0; offset < value.length; offset += 0x8000)
      binary += String.fromCharCode(...value.subarray(offset, offset + 0x8000));
    return btoa(binary);
  }
  private fromBase64(value: string): Uint8Array {
    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  }
}
