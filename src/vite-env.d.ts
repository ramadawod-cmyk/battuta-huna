/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VIATOR_PID?: string;
  readonly VITE_GEOAPIFY_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
