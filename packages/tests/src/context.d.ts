import "vite-plus/test";

declare module "vite-plus/test" {
  interface ProvidedContext {
    frontendUrl: string;
  }
}
