import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const posts = sqliteTable('posts', {
  id: text('id').primaryKey(),
  authorId: text('author_id').notNull(),
  authorEmail: text('author_email').notNull(),
  authorName: text('author_name').notNull(),
  title: text('title').notNull(),
  category: text('category').notNull(),
  tags: text('tags').notNull().default('[]'),
  content: text('content').notNull(),
  status: text('status').notNull().default('published'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  index('idx_posts_author_updated').on(table.authorId, table.updatedAt),
  index('idx_posts_status_created').on(table.status, table.createdAt),
]);

export const blogUsers = sqliteTable('blog_users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  passwordSalt: text('password_salt').notNull(),
  role: text('role').notNull().default('reader'),
  status: text('status').notNull().default('active'),
  failedAttempts: integer('failed_attempts').notNull().default(0),
  lockedUntil: text('locked_until'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  lastLoginAt: text('last_login_at'),
}, (table) => [
  uniqueIndex('idx_blog_users_email').on(table.email),
]);

export const blogSessions = sqliteTable('blog_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  userId: text('user_id').notNull().references(() => blogUsers.id, { onDelete: 'cascade' }),
  expiresAt: text('expires_at').notNull(),
  revokedAt: text('revoked_at'),
  createdAt: text('created_at').notNull(),
}, (table) => [
  index('idx_blog_sessions_user_expires').on(table.userId, table.expiresAt),
]);
