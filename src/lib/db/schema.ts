import {
  pgTable,
  varchar,
  bigint,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const holders = pgTable(
  "holders",
  {
    address: varchar("address", { length: 44 }).primaryKey(),
    balance: bigint("balance", { mode: "number" }).notNull(),
    firstSeen: timestamp("first_seen", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastUpdated: timestamp("last_updated", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_holders_balance").on(table.balance),
    index("idx_holders_first_seen").on(table.firstSeen),
  ]
);

export const customNames = pgTable(
  "custom_names",
  {
    address: varchar("address", { length: 44 })
      .primaryKey()
      .references(() => holders.address, { onDelete: "cascade" }),
    displayName: varchar("display_name", { length: 20 }).notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_custom_names_display_name_lower").on(
      sql`lower(${table.displayName})`
    ),
  ]
);
