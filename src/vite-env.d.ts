/// <reference types="vite/client" />

// Build-time constant injected by Vite
declare const __BUILD_TIME__: string;

interface PlausibleOptions {
  u?: string;
  callback?: () => void;
}

interface Window {
  plausible?: (
    event: 'pageview' | string,
    options?: { props?: Record<string, string | number | boolean> } | PlausibleOptions
  ) => void;
}

