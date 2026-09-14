import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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
