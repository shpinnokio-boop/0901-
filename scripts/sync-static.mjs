import { cpSync, mkdirSync, rmSync } from 'node:fs';

const pages = ['login.html', 'post.html', 'posts.html', 'profile.html', 'signup.html', 'write.html'];
mkdirSync('public', { recursive: true });
rmSync('public/index.html', { force: true });
for (const directory of ['assets', 'css', 'js']) {
  rmSync(`public/${directory}`, { recursive: true, force: true });
  cpSync(directory, `public/${directory}`, { recursive: true });
}
for (const page of pages) cpSync(page, `public/${page}`);
cpSync('index.html', 'public/home.html');
