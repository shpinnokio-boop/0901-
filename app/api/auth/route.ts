import { AuthError, login, logout, signup, verify } from '@/db/auth';

export async function POST(request: Request) {
  try {
    const input = await request.json() as Record<string, unknown>;
    const action = String(input.action || '').toLowerCase();
    if (action === 'signup') {
      const auth = await signup(input);
      return Response.json({ ok: true, message: '회원가입이 완료되었습니다.', ...auth }, { status: 201 });
    }
    if (action === 'login') {
      const auth = await login(input);
      return Response.json({ ok: true, message: '로그인되었습니다.', ...auth });
    }
    if (action === 'verify') {
      return Response.json({ ok: true, user: await verify(String(input.token || '')) });
    }
    if (action === 'logout') {
      await logout(String(input.token || ''));
      return Response.json({ ok: true, message: '로그아웃되었습니다.' });
    }
    return Response.json({ ok: false, code: 'INVALID_ACTION', message: '지원하지 않는 요청입니다.' }, { status: 400 });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ ok: false, code: error.code, message: error.message }, { status: error.status });
    }
    console.error(error);
    return Response.json({ ok: false, code: 'SERVER_ERROR', message: '요청을 처리하지 못했습니다.' }, { status: 500 });
  }
}
