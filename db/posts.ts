import { env } from 'cloudflare:workers';
import { HttpError, type AuthenticatedUser, type PostInput } from './request';

type PostRow = {
  id: string; author_id: string; author_email: string; author_name: string;
  title: string; category: string; tags: string; content: string; status: string;
  created_at: string; updated_at: string;
};

function database() {
  if (!env.DB) throw new Error('D1 database binding is unavailable.');
  return env.DB;
}

function mapPost(row: PostRow) {
  let tags: string[] = [];
  try { tags = JSON.parse(row.tags); } catch { tags = []; }
  return { id: row.id, authorName: row.author_name, title: row.title, category: row.category, tags, content: row.content, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at };
}

export async function listPosts(authorId?: string) {
  const query = authorId
    ? database().prepare('SELECT * FROM posts WHERE author_id = ? ORDER BY updated_at DESC').bind(authorId)
    : database().prepare("SELECT * FROM posts WHERE status = 'published' ORDER BY created_at DESC");
  const result = await query.all<PostRow>();
  return result.results.map(mapPost);
}

export async function getPost(id: string) {
  const row = await database().prepare("SELECT * FROM posts WHERE id = ? AND status = 'published'").bind(id).first<PostRow>();
  if (!row) throw new HttpError(404, '글을 찾을 수 없습니다.');
  return mapPost(row);
}

export async function createPost(user: AuthenticatedUser, input: PostInput) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await database().prepare('INSERT INTO posts (id, author_id, author_email, author_name, title, category, tags, content, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, user.id, user.email, user.name, input.title, input.category, JSON.stringify(input.tags), input.content, 'published', now, now).run();
  return getPost(id);
}

export async function updatePost(id: string, authorId: string, input: PostInput) {
  const result = await database().prepare('UPDATE posts SET title = ?, category = ?, tags = ?, content = ?, updated_at = ? WHERE id = ? AND author_id = ?')
    .bind(input.title, input.category, JSON.stringify(input.tags), input.content, new Date().toISOString(), id, authorId).run();
  if (!result.meta.changes) throw new HttpError(404, '수정할 글을 찾을 수 없습니다.');
  return getPost(id);
}

export async function deletePost(id: string, authorId: string) {
  const result = await database().prepare('DELETE FROM posts WHERE id = ? AND author_id = ?').bind(id, authorId).run();
  if (!result.meta.changes) throw new HttpError(404, '삭제할 글을 찾을 수 없습니다.');
}
