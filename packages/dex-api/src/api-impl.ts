import { join } from "path";
import assert from "assert";
import type { XiorInstance, XiorResponse } from "xior";
import { buildPathWithQueryString, mapFilter } from "@rhiva-ag/shared";

export abstract class ApiImpl {
  protected abstract path?: string;

  constructor(protected readonly xior: XiorInstance) {}

  protected buildPath(...path: (string | number | undefined)[]) {
    assert(this.path, "path not override");

    return join(
      this.path,
      mapFilter(path, (path) => (path ? String(path) : null)).reduce((a, b) =>
        join(a, b),
      ),
    );
  }

  protected buildPathWithQueryString = buildPathWithQueryString;

  static async getData<T extends object | number | string>(
    response: Promise<XiorResponse<T>>,
  ) {
    const { data } = await response;
    return data;
  }
}
