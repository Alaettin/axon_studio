/// <reference types="vite/client" />

/** Die Fassung aus der package.json, von Vite eingesetzt. Siehe vite.config.ts. */
declare const __APP_VERSION__: string;

declare module "*.png" {
  const pfad: string;
  export default pfad;
}
