import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';

interface FlowraNativeBridge {
  setScreenshotProtection(enabled: boolean): void;
  isBiometricAvailable(): boolean;
  enableBiometric(secret: string): void;
  authenticateBiometric(): void;
  disableBiometric(): void;
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
  biometricAvailable(): boolean {
    return this.bridge()?.isBiometricAvailable() ?? false;
  }
  setScreenshotProtection(enabled: boolean): void {
    this.bridge()?.setScreenshotProtection(enabled);
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

  private bridge(): FlowraNativeBridge | undefined {
    return (this.document.defaultView as NativeWindow | null)?.FlowraNative;
  }

  private waitForResult(action: string, start: () => void): Promise<string> {
    const nativeWindow = this.document.defaultView;
    if (!nativeWindow) return Promise.reject(new Error('The Android bridge is unavailable.'));
    return new Promise<string>((resolve, reject) => {
      const finish = (success: boolean, data: string, message: string): void => {
        globalThis.clearTimeout(timeout);
        nativeWindow.removeEventListener('flowra-native-result', handleResult);
        if (success) resolve(data);
        else reject(new Error(message || 'Biometric authentication failed.'));
      };
      const handleResult = (event: Event): void => {
        const detail = (
          event as CustomEvent<{
            action: string;
            success: boolean;
            data?: string;
            message?: string;
          }>
        ).detail;
        if (detail.action === action)
          finish(detail.success, detail.data ?? '', detail.message ?? '');
      };
      nativeWindow.addEventListener('flowra-native-result', handleResult);
      const timeout = globalThis.setTimeout(
        () => finish(false, '', 'Biometric authentication timed out.'),
        60_000,
      );
      try {
        start();
      } catch (error) {
        finish(
          false,
          '',
          error instanceof Error ? error.message : 'Biometric authentication could not start.',
        );
      }
    });
  }
}
