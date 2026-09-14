import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '강아지의 기록',
  description: '일과 일상에서 발견한 생각을 기록하는 개인 블로그',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
