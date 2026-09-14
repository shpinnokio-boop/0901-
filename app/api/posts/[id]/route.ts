import { deletePost, getPost, updatePost } from '@/db/posts';
import { errorResponse, getAuthenticatedUser, parsePostInput } from '@/db/request';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try { return Response.json({ post: await getPost((await context.params).id) }); }
  catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await getAuthenticatedUser(request);
    const post = await updatePost((await context.params).id, user.id, parsePostInput(await request.json()));
    return Response.json({ post });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await getAuthenticatedUser(request);
    await deletePost((await context.params).id, user.id);
    return new Response(null, { status: 204 });
  } catch (error) { return errorResponse(error); }
}
