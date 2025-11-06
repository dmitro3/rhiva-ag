import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

export * from "./zod-query";
export * from "./drizzle-query";
export * from "./custom-drizzle";

export * from "./zod";
export * from "./schema";
export const createDB = (url: string) => drizzle(url, { schema });
export type Database = ReturnType<typeof createDB>;
