import { Injectable } from '@angular/core';

export interface EncryptedEnvelope {
  readonly version: 1;
  readonly iv: string;
  readonly ciphertext: string;
}

export interface PasswordEnvelope extends EncryptedEnvelope {
  readonly format: 'flowra-backup';
  readonly salt: string;
  readonly iterations: number;
}

function bytesToBase64(value: Uint8Array): string {
  let binary = '';
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function arrayBuffer(value: Uint8Array): ArrayBuffer {
  return value.slice().buffer as ArrayBuffer;
}

@Injectable({ providedIn: 'root' })
export class CryptoService {
  createKey(): Promise<CryptoKey> {
    return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'decrypt',
    ]);
  }

  async encrypt<T>(value: T, key: CryptoKey): Promise<EncryptedEnvelope> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(value));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
    return {
      version: 1,
      iv: bytesToBase64(iv),
      ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    };
  }

  async decrypt<T>(envelope: EncryptedEnvelope, key: CryptoKey): Promise<T> {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: arrayBuffer(base64ToBytes(envelope.iv)) },
      key,
      arrayBuffer(base64ToBytes(envelope.ciphertext)),
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as T;
  }

  async encryptWithPassword<T>(value: T, password: string): Promise<PasswordEnvelope> {
    if (password.length < 8) throw new Error('Use a backup password of at least 8 characters.');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iterations = 310_000;
    const key = await this.passwordKey(password, salt, iterations);
    const encrypted = await this.encrypt(value, key);
    return { ...encrypted, format: 'flowra-backup', salt: bytesToBase64(salt), iterations };
  }

  async decryptWithPassword<T>(envelope: PasswordEnvelope, password: string): Promise<T> {
    if (envelope.format !== 'flowra-backup' || envelope.version !== 1)
      throw new Error('Unsupported Flowra backup.');
    const key = await this.passwordKey(password, base64ToBytes(envelope.salt), envelope.iterations);
    return this.decrypt<T>(envelope, key);
  }

  private async passwordKey(
    password: string,
    salt: Uint8Array,
    iterations: number,
  ): Promise<CryptoKey> {
    const material = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey'],
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt: arrayBuffer(salt), iterations },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  }
}
