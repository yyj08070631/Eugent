import type { EugentApi } from '@eugent/preload';

declare global {
  interface Window {
    eugent: EugentApi;
  }
}

export {};
