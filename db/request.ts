export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export type AuthenticatedUser = { id: string; email: string; name: string };
export type PostInput = { title: string; category: string; tags: string[]; content: string };

export function getAuthenticatedUser(request: Request): AuthenticatedUser {
  const id = request.headers.get('oai-authenticated-user-id');
  const email = request.headers.get('oai-authenticated-user-email') || '';
  if (!id) throw new HttpError(401, '글을 관리하려면 로그인이 필요합니다.');
  let name = email || '작성자';
  if (request.headers.get('oai-authenticated-user-full-name-encoding') === 'percent-encoded-utf-8') {
    const encoded = request.headers.get('oai-authenticated-user-full-name');
    if (encoded) try { name = decodeURIComponent(encoded); } catch { /* 이메일을 사용합니다. */ }
  }
  return { id, email, name };
}

export function parsePostInput(value: unknown): PostInput {
  if (!value || typeof value !== 'object') throw new HttpError(400, '글 내용을 확인해 주세요.');
  const record = value as Record<string, unknown>;
  const title = String(record.title || '').trim();
  const content = String(record.content || '').trim();
  const categories = ['생각', '일상', '배움', '관계', '일'];
  const category = categories.includes(String(record.category)) ? String(record.category) : '생각';
  const tags = Array.isArray(record.tags) ? record.tags.map(String).map((tag) => tag.trim()).filter(Boolean).slice(0, 10) : [];
  if (!title || title.length > 120) throw new HttpError(400, '제목은 1자 이상 120자 이하로 입력해 주세요.');
  if (!content || content.length > 50000) throw new HttpError(400, '본문은 1자 이상 50,000자 이하로 입력해 주세요.');
  return { title, category, tags, content };
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) return Response.json({ message: error.message }, { status: error.status });
  console.error(error);
  return Response.json({ message: '요청을 처리하지 못했습니다.' }, { status: 500 });
}
