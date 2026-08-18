import { Injectable } from '@angular/core';

function base64(value: Uint8Array): string {
  let binary = '';
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function bytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

@Injectable({ providedIn: 'root' })
export class SecurityService {
  async createPin(pin: string): Promise<{ pinSalt: string; pinVerifier: string }> {
    if (!/^\d{4,8}$/.test(pin)) throw new Error('Use a PIN containing 4 to 8 digits.');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    return { pinSalt: base64(salt), pinVerifier: base64(await this.derive(pin, salt)) };
  }
  async verifyPin(
    pin: string,
    salt: string | undefined,
    verifier: string | undefined,
  ): Promise<boolean> {
    if (!salt || !verifier) return false;
    const actual = await this.derive(pin, bytes(salt));
    const expected = bytes(verifier);
    if (actual.length !== expected.length) return false;
    let difference = 0;
    for (let index = 0; index < actual.length; index += 1)
      difference |= actual[index] ^ expected[index];
    return difference === 0;
  }
  private async derive(pin: string, salt: Uint8Array): Promise<Uint8Array> {
    const material = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(pin),
      'PBKDF2',
      false,
      ['deriveBits'],
    );
    return new Uint8Array(
      await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          hash: 'SHA-256',
          salt: salt.slice().buffer as ArrayBuffer,
          iterations: 210_000,
        },
        material,
        256,
      ),
    );
  }
}
