import { relations, sql } from 'drizzle-orm';
import {
  pgTable,
  pgEnum,
  boolean,
  varchar,
  bigint,
  uniqueIndex,
  index,
  bigserial,
  serial,
  integer,
} from 'drizzle-orm/pg-core';

/** Shared by name / email / year / school / major visibility columns. */
export const profileVisibilityEnum = pgEnum('profile_visibility', [
  'self',
  'friends',
  'public',
]);

export const studentBluebookSettings = pgTable('studentBluebookSettings', {
  netId: varchar('netId', { length: 8 }).primaryKey().notNull(),
  evaluationsEnabled: boolean('evaluationsEnabled').notNull(),
  evaluationsRevoked: boolean('evaluationsRevoked').notNull().default(false),
  firstName: varchar('firstName', { length: 256 }).default(sql`NULL`),
  lastName: varchar('lastName', { length: 256 }).default(sql`NULL`),
  preferredFirstName: varchar('preferredFirstName', { length: 256 }).default(
    sql`NULL`,
  ),
  preferredLastName: varchar('preferredLastName', { length: 256 }).default(
    sql`NULL`,
  ),
  nameVisibility: profileVisibilityEnum('nameVisibility')
    .notNull()
    .default('public'),
  emailVisibility: profileVisibilityEnum('emailVisibility')
    .notNull()
    .default('friends'),
  yearVisibility: profileVisibilityEnum('yearVisibility')
    .notNull()
    .default('friends'),
  schoolVisibility: profileVisibilityEnum('schoolVisibility')
    .notNull()
    .default('friends'),
  majorVisibility: profileVisibilityEnum('majorVisibility')
    .notNull()
    .default('friends'),
  profilePageEnabled: boolean('profilePageEnabled').notNull().default(true),
  allowAnonymousProfileView: boolean('allowAnonymousProfileView')
    .notNull()
    .default(false),
  email: varchar('email', { length: 256 }).default(sql`NULL`),
  upi: bigint('upi', { mode: 'number' }),
  school: varchar('school', { length: 256 }).default(sql`NULL`),
  year: bigint('year', { mode: 'number' }),
  college: varchar('college', { length: 256 }).default(sql`NULL`),
  major: varchar('major', { length: 256 }).default(sql`NULL`),
  curriculum: varchar('curriculum', { length: 256 }).default(sql`NULL`),
  // You can use { mode: "bigint" }
  // if numbers are exceeding js number limitations
  challengeTries: bigint('challengeTries', { mode: 'number' })
    .default(0)
    .notNull(),
});

export const studentFriendRequests = pgTable(
  'studentFriendRequests',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
    netId: varchar('netId', { length: 8 }).notNull(),
    friendNetId: varchar('friendNetId', { length: 8 }).notNull(),
  },
  (table) => ({
    friendRequestsUniqueIdx: uniqueIndex('friend_requests_unique_idx').on(
      table.netId,
      table.friendNetId,
    ),
    friendRequestsNetidIdx: index('friend_requests_netid_idx').on(table.netId),
  }),
);

export const studentFriends = pgTable(
  'studentFriends',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey().notNull(),
    netId: varchar('netId', { length: 8 }).notNull(),
    friendNetId: varchar('friendNetId', { length: 8 }).notNull(),
  },
  (table) => ({
    friendsUniqueIdx: uniqueIndex('friends_unique_idx').on(
      table.netId,
      table.friendNetId,
    ),
    friendsNetidIdx: index('friends_netid_idx').on(table.netId),
  }),
);

export const worksheetCourses = pgTable(
  'worksheetCourses',
  {
    id: serial('id').primaryKey().notNull(),
    worksheetId: integer('worksheetId')
      .notNull()
      // eslint-disable-next-line no-use-before-define
      .references(() => worksheets.id),
    crn: integer('crn').notNull(),
    color: varchar('color', { length: 32 }).notNull(),
    // Hidden can be null, which means the hidden status is unknown.
    // In the past hidden status was stored in client side, so unless
    // the user has synced hidden state with the server, it will be null.
    hidden: boolean('hidden'),
  },
  (table) => ({
    worksheetIdIdx: index('worksheet_id_idx').on(table.worksheetId),
    worksheetCoursesUniqueIdx: uniqueIndex('worksheet_courses_unique_idx').on(
      table.worksheetId,
      table.crn,
    ),
  }),
);

export const worksheets = pgTable(
  'worksheets',
  {
    id: serial('id').primaryKey().notNull(),
    netId: varchar('netId', { length: 8 }).notNull(),
    season: integer('season').notNull(),
    worksheetNumber: integer('worksheetNumber').notNull(),
    name: varchar('name', { length: 64 }).notNull(),
    private: boolean('private').notNull().default(false),
  },
  (table) => ({
    worksheetsUniqueIdx: uniqueIndex('worksheets_unique_idx').on(
      table.netId,
      table.season,
      table.worksheetNumber,
    ),
  }),
);

export const worksheetToCourses = relations(worksheets, ({ many }) => ({
  courses: many(worksheetCourses),
}));

export const coursesToWorksheet = relations(worksheetCourses, ({ one }) => ({
  worksheet: one(worksheets, {
    fields: [worksheetCourses.worksheetId],
    references: [worksheets.id],
  }),
}));

export const wishlistCourses = pgTable(
  'wishlistCourses',
  {
    id: serial('id').primaryKey().notNull(),
    netId: varchar('netId', { length: 8 }).notNull(),
    // Although wishlist is technically season-agnostic, we still store the
    // exact course that was wishlisted. This ensures that no matter how our
    // algorithm changes (same-course, cross-listing, etc.), the data always
    // stays interpretable. For example, same_course_id is purely generated by
    // us and susceptible to change if we change the Ferry algorithm; course
    // code is more resilient but the same course code may still represent
    // different courses in different seasons. In the end, we will just let
    // frontend decide the most sensible thing to display.
    season: integer('season').notNull(),
    crn: integer('crn').notNull(),
  },
  (table) => ({
    wishlistNetidIdx: index('wishlist_netid_idx').on(table.netId),
    wishlistUniqueIdx: uniqueIndex('wishlist_unique_idx').on(
      table.netId,
      table.season,
      table.crn,
    ),
  }),
);

export const appUsers = pgTable(
  'appUsers',
  {
    id: serial('id').primaryKey().notNull(),
    verifiedEmail: varchar('verifiedEmail', { length: 256 }).notNull(),
    createdAt: bigint('createdAt', { mode: 'number' }).notNull(),
    updatedAt: bigint('updatedAt', { mode: 'number' }).notNull(),
  },
  (table) => ({
    appUsersVerifiedEmailUniqueIdx: uniqueIndex(
      'app_users_verified_email_unique_idx',
    ).on(table.verifiedEmail),
  }),
);

export const emailVerificationCodes = pgTable(
  'emailVerificationCodes',
  {
    id: serial('id').primaryKey().notNull(),
    normalizedEmail: varchar('normalizedEmail', { length: 256 }).notNull(),
    codeHash: varchar('codeHash', { length: 128 }).notNull(),
    createdAt: bigint('createdAt', { mode: 'number' }).notNull(),
    expiresAt: bigint('expiresAt', { mode: 'number' }).notNull(),
    consumedAt: bigint('consumedAt', { mode: 'number' }),
    deliveryStatus: varchar('deliveryStatus', { length: 16 })
      .default('sent')
      .notNull(),
  },
  (table) => ({
    emailVerificationEmailIdx: index('email_verification_email_idx').on(
      table.normalizedEmail,
    ),
    emailVerificationLookupIdx: index('email_verification_lookup_idx').on(
      table.normalizedEmail,
      table.codeHash,
    ),
  }),
);

export const emailDeliveryAudits = pgTable(
  'emailDeliveryAudits',
  {
    normalizedRecipientEmail: varchar('normalizedRecipientEmail', {
      length: 256,
    }).notNull(),
    requestId: varchar('requestId', { length: 256 }).primaryKey().notNull(),
    providerMessageId: varchar('providerMessageId', { length: 256 }),
    requestTime: bigint('requestTime', { mode: 'number' }).notNull(),
    deliveryOutcome: varchar('deliveryOutcome', { length: 32 }).notNull(),
    expiresAt: bigint('expiresAt', { mode: 'number' }).notNull(),
  },
  (table) => ({
    recipientTimeIdx: index('email_delivery_audit_recipient_time_idx').on(
      table.normalizedRecipientEmail,
      table.requestTime,
    ),
    expiryIdx: index('email_delivery_audit_expiry_idx').on(table.expiresAt),
  }),
);

export const savedSearches = pgTable(
  'savedSearches',
  {
    id: serial('id').primaryKey().notNull(),
    netId: varchar('netId', { length: 8 }).notNull(),
    userId: integer('userId').references(() => appUsers.id),
    name: varchar('name', { length: 64 }).notNull(),
    queryString: varchar('queryString', { length: 2048 }).notNull(),
    createdAt: bigint('createdAt', { mode: 'number' }).notNull(),
  },
  (table) => ({
    savedSearchesNetidIdx: index('saved_searches_netid_idx').on(table.netId),
    savedSearchesUserIdIdx: index('saved_searches_user_id_idx').on(
      table.userId,
    ),
    savedSearchesNameUniqueIdx: uniqueIndex(
      'saved_searches_name_unique_idx',
    ).on(table.netId, table.name),
    savedSearchesUserNameUniqueIdx: uniqueIndex(
      'saved_searches_user_name_unique_idx',
    ).on(table.userId, table.name),
  }),
);

export const savedWorksheets = pgTable(
  'savedWorksheets',
  {
    id: serial('id').primaryKey().notNull(),
    userId: integer('userId')
      .notNull()
      .references(() => appUsers.id),
    name: varchar('name', { length: 64 }).notNull(),
    term: varchar('term', { length: 32 }).notNull(),
    private: boolean('private').notNull().default(true),
    isMain: boolean('isMain').notNull().default(false),
    mainWorksheetKey: varchar('mainWorksheetKey', { length: 16 }).default(
      sql`NULL`,
    ),
    createdAt: bigint('createdAt', { mode: 'number' }).notNull(),
    updatedAt: bigint('updatedAt', { mode: 'number' }).notNull(),
  },
  (table) => ({
    savedWorksheetsUserIdIdx: index('saved_worksheets_user_id_idx').on(
      table.userId,
    ),
    savedWorksheetsUserCreatedIdx: index(
      'saved_worksheets_user_created_idx',
    ).on(table.userId, table.createdAt),
    savedWorksheetsMainUniqueIdx: uniqueIndex(
      'saved_worksheets_main_unique_idx',
    ).on(table.userId, table.term, table.mainWorksheetKey),
  }),
);

export const savedWorksheetSections = pgTable(
  'savedWorksheetSections',
  {
    id: serial('id').primaryKey().notNull(),
    worksheetId: integer('worksheetId')
      .notNull()
      .references(() => savedWorksheets.id),
    sectionId: varchar('sectionId', { length: 128 }).notNull(),
    color: varchar('color', { length: 32 }).notNull(),
    hidden: boolean('hidden').notNull(),
  },
  (table) => ({
    savedWorksheetSectionsWorksheetIdIdx: index(
      'saved_worksheet_sections_worksheet_id_idx',
    ).on(table.worksheetId),
    savedWorksheetSectionsUniqueIdx: uniqueIndex(
      'saved_worksheet_sections_unique_idx',
    ).on(table.worksheetId, table.sectionId),
  }),
);
