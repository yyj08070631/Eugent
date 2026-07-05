import { safeStorage } from 'electron';

export interface SafeStorageLike {
  isEncryptionAvailable(): boolean;
  encryptString(plain: string): Buffer;
  decryptString(cipher: Buffer): string;
}

export const realSafeStorage: SafeStorageLike = {
  isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
  encryptString: (p) => safeStorage.encryptString(p),
  decryptString: (b) => safeStorage.decryptString(b),
};
