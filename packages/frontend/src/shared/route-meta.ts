import "vue-router";

declare module "vue-router" {
  interface RouteMeta {
    breadcrumb?: { labelKey: string; route?: string };
    pageGroup?: string;
  }
}
