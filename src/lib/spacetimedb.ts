import { DbConnection } from "./module_bindings/index";

const HOST =
  process.env.NEXT_PUBLIC_SPACETIMEDB_HOST ?? "wss://maincloud.spacetimedb.com";
const DB_NAME =
  process.env.NEXT_PUBLIC_SPACETIMEDB_DB_NAME ?? "timer-counter-6b3bt";

export function createDbConnection(token: string): DbConnection {
  return DbConnection.builder()
    .withUri(HOST)
    .withDatabaseName(DB_NAME)
    .withToken(token)
    .build();
}

export type { DbConnection };
