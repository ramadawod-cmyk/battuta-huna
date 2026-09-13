/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VIATOR_PID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
