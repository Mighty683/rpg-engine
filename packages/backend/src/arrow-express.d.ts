import "arrow-express";
import type { Request, Response } from "express";

declare module "arrow-express" {
  namespace ArrowExpress {
    interface InternalRequestType extends Request {}
    interface InternalResponseType extends Response {}
  }
}
