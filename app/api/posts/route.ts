import { createPost, listPosts } from '@/db/posts';
import { errorResponse, getAuthenticatedUser, parsePostInput } from '@/db/request';

export async function GET(request: Request) {
  try {
    const mine = new URL(request.url).searchParams.get('mine') === '1';
    const user = mine ? getAuthenticatedUser(request) : null;
    return Response.json({ posts: await listPosts(user?.id) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const user = getAuthenticatedUser(request);
    const input = parsePostInput(await request.json());
    return Response.json({ post: await createPost(user, input) }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
