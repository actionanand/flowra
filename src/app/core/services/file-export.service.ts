import { Injectable } from '@angular/core';

interface FlowraExportPlugin {
  exportText(options: {
    filename: string;
    content: string;
    mimeType: string;
    title: string;
  }): Promise<void>;
  exportPdf(options: { filename: string; content: string; title: string }): Promise<void>;
}

interface CapacitorBridge {
  getPlatform?: () => string;
  isNativePlatform?: () => boolean;
  Plugins?: { FlowraExport?: FlowraExportPlugin };
}

declare global {
  interface Window {
    Capacitor?: CapacitorBridge;
  }
}

@Injectable({ providedIn: 'root' })
export class FileExportService {
  async exportCsv(filename: string, content: string, title: string): Promise<void> {
    const value = `\uFEFF${content}`;
    const plugin = this.androidPlugin();
    if (plugin) {
      await plugin.exportText({ filename, content: value, mimeType: 'text/csv', title });
      return;
    }
    await this.shareOrDownload(
      new Blob([value], { type: 'text/csv;charset=utf-8' }),
      filename,
      title,
    );
  }

  async exportPdf(
    filename: string,
    androidPayload: string,
    fallbackHtml: string,
    title: string,
  ): Promise<void> {
    const plugin = this.androidPlugin();
    if (plugin) {
      await plugin.exportPdf({ filename, content: androidPayload, title });
      return;
    }
    this.printHtml(fallbackHtml);
  }

  private androidPlugin(): FlowraExportPlugin | undefined {
    const capacitor = window.Capacitor;
    return capacitor?.isNativePlatform?.() === true && capacitor.getPlatform?.() === 'android'
      ? capacitor.Plugins?.FlowraExport
      : undefined;
  }

  private async shareOrDownload(blob: Blob, filename: string, title: string): Promise<void> {
    const file = new File([blob], filename, { type: blob.type });
    if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.append(anchor);
    anchor.click();
    globalThis.setTimeout(() => {
      anchor.remove();
      URL.revokeObjectURL(url);
    }, 300);
  }

  private printHtml(content: string): void {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;left:-9999px;width:0;height:0;border:0';
    document.body.append(frame);
    const target = frame.contentDocument ?? frame.contentWindow?.document;
    if (!target) {
      frame.remove();
      throw new Error('Unable to prepare PDF.');
    }
    target.open();
    target.write(content);
    target.close();
    globalThis.setTimeout(() => {
      frame.contentWindow?.print();
      globalThis.setTimeout(() => frame.remove(), 10_000);
    }, 400);
  }
}
