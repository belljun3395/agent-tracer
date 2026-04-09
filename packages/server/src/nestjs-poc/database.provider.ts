import Database from "better-sqlite3";
import { Provider, OnModuleDestroy } from "@nestjs/common";

export const DATABASE_TOKEN = "SQLITE_DATABASE";

export const DatabaseProvider: Provider = {
  provide: DATABASE_TOKEN,
  useFactory: () => {
    return new Database(":memory:");
  },
};

export class DatabaseModule implements OnModuleDestroy {
  constructor(private db: Database.Database) {}
  onModuleDestroy() {
    this.db.close();
  }
}
