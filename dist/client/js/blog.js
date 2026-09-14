(function () {
  'use strict';

  const API = '/api/posts';
  const DRAFT_KEY = 'blogPostDraft';

  async function request(path, options) {
    const response = await fetch(API + path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message || '요청을 처리하지 못했습니다.');
    return data;
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
  }

  function readMinutes(content) {
    return Math.max(1, Math.ceil(String(content || '').length / 500));
  }

  function summary(content, limit = 110) {
    const text = String(content || '').replace(/\s+/g, ' ').trim();
    return text.length > limit ? text.slice(0, limit) + '…' : text;
  }

  function postUrl(post) {
    return 'post.html?id=' + encodeURIComponent(post.id);
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function meta(post) {
    const node = element('div', 'post-meta');
    const category = element('span', '', post.category);
    const time = element('time', '', formatDate(post.createdAt));
    time.dateTime = post.createdAt;
    node.append(category, time, element('span', '', readMinutes(post.content) + '분'));
    return node;
  }

  function listItem(post, index) {
    const article = element('article', 'dynamic-post');
    const number = element('p', 'list-index', String(index + 1).padStart(2, '0'));
    const copy = element('div');
    const heading = element('h2');
    const link = element('a', '', post.title);
    link.href = postUrl(post);
    heading.appendChild(link);
    copy.append(meta(post), heading, element('p', '', summary(post.content)));
    const arrow = element('a', 'card-arrow', '↗');
    arrow.href = link.href;
    arrow.setAttribute('aria-label', post.title + ' 읽기');
    article.append(number, copy, arrow);
    return article;
  }

  function homeCard(post, index) {
    const article = element('article', index % 3 === 1 ? 'post-card dark' : 'post-card');
    const heading = element('h3');
    const link = element('a', '', post.title);
    link.href = postUrl(post);
    heading.appendChild(link);
    const arrow = element('a', 'card-arrow', '↗');
    arrow.href = link.href;
    arrow.setAttribute('aria-label', post.title + ' 읽기');
    article.append(meta(post), heading, element('p', '', summary(post.content, 80)), arrow);
    return article;
  }

  function empty(message) {
    return element('p', 'empty-posts', message);
  }

  function renderHome(posts) {
    const featured = document.querySelector('.featured-post');
    const grid = document.querySelector('.post-grid');
    if (!featured || !grid) return;
    grid.replaceChildren();
    if (!posts.length) {
      featured.hidden = true;
      grid.replaceWith(empty('아직 발행된 글이 없습니다. 첫 글을 작성해 보세요.'));
      return;
    }
    const first = posts[0];
    const visual = featured.querySelector('.featured-visual');
    visual.href = postUrl(first);
    visual.setAttribute('aria-label', first.title + ' 읽기');
    featured.querySelector('.visual-number').textContent = '01';
    featured.querySelector('.visual-word').textContent = first.category;
    const copy = featured.querySelector('.featured-copy');
    copy.querySelector('.post-meta').replaceWith(meta(first));
    const title = copy.querySelector('h3 a');
    title.href = postUrl(first);
    title.textContent = first.title;
    copy.querySelector('p').textContent = summary(first.content);
    const read = copy.querySelector('.text-link');
    read.href = postUrl(first);
    posts.slice(1, 5).forEach((post, index) => grid.appendChild(homeCard(post, index)));
    const count = document.querySelector('.section-bar p');
    if (count) count.textContent = '총 ' + posts.length + '개의 이야기';
  }

  async function initCollections() {
    const home = document.querySelector('.featured-post');
    const list = document.querySelector('.list-posts');
    if (!home && !list) return;
    try {
      const { posts } = await request('', { method: 'GET' });
      if (home) renderHome(posts);
      if (list) {
        list.replaceChildren();
        if (!posts.length) list.appendChild(empty('아직 발행된 글이 없습니다.'));
        else posts.forEach((post, index) => list.appendChild(listItem(post, index)));
      }
    } catch (error) {
      if (list) list.replaceChildren(empty(error.message));
    }
  }

  function values(form) {
    return {
      title: form.elements.title.value.trim(),
      category: form.elements.category.value,
      tags: form.elements.tags.value.split(',').map((tag) => tag.trim()).filter(Boolean),
      content: form.elements.body.value.trim(),
    };
  }

  function fill(form, post) {
    form.elements.title.value = post.title || '';
    form.elements.category.value = post.category || '생각';
    form.elements.tags.value = Array.isArray(post.tags) ? post.tags.join(', ') : '';
    form.elements.body.value = post.content || '';
    form.elements.body.dispatchEvent(new Event('input'));
  }

  function formStatus(form, message, error) {
    const status = form.querySelector('.form-status');
    status.textContent = message;
    status.classList.toggle('error', Boolean(error));
  }

  function insert(textarea, before, after, placeholder) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.slice(start, end) || placeholder;
    textarea.setRangeText(before + selected + after, start, end, 'select');
    textarea.focus();
    textarea.dispatchEvent(new Event('input'));
  }

  async function initWrite() {
    const form = document.querySelector('#write-form');
    if (!form) return;
    const id = new URLSearchParams(location.search).get('id');
    const publish = document.querySelector('#publish-button');
    if (id) {
      try {
        const { post } = await request('/' + encodeURIComponent(id), { method: 'GET' });
        fill(form, post);
        document.querySelector('#write-title').textContent = '글 수정';
        publish.textContent = '수정 완료';
      } catch (error) {
        formStatus(form, error.message, true);
        publish.disabled = true;
      }
    } else {
      try {
        const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
        if (draft) fill(form, draft);
      } catch { localStorage.removeItem(DRAFT_KEY); }
    }
    document.querySelector('#save-draft').addEventListener('click', () => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(values(form)));
      formStatus(form, '이 기기에 임시 저장했습니다.', false);
    });
    form.querySelectorAll('[data-format]').forEach((button) => button.addEventListener('click', () => {
      const textarea = form.elements.body;
      if (button.dataset.format === 'bold') insert(textarea, '**', '**', '굵은 글');
      if (button.dataset.format === 'italic') insert(textarea, '*', '*', '기울임 글');
      if (button.dataset.format === 'quote') insert(textarea, '> ', '', '인용문');
      if (button.dataset.format === 'link') insert(textarea, '[', '](https://)', '링크 제목');
    }));
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      publish.disabled = true;
      formStatus(form, id ? '글을 수정하는 중입니다…' : '글을 발행하는 중입니다…', false);
      try {
        const result = await request(id ? '/' + encodeURIComponent(id) : '', {
          method: id ? 'PATCH' : 'POST',
          body: JSON.stringify(values(form)),
        });
        localStorage.removeItem(DRAFT_KEY);
        location.href = postUrl(result.post);
      } catch (error) {
        formStatus(form, error.message, true);
        publish.disabled = false;
      }
    });
  }

  async function initDetail() {
    const id = new URLSearchParams(location.search).get('id');
    const page = document.querySelector('.article-page');
    if (!id || !page) return;
    try {
      const { post } = await request('/' + encodeURIComponent(id), { method: 'GET' });
      document.title = post.title + ' | 강아지의 기록';
      const header = page.querySelector('.article-header');
      const postMeta = header.querySelector('.post-meta');
      postMeta.replaceWith(meta(post));
      header.querySelector('h1').textContent = post.title;
      header.querySelector('.article-lead').textContent = summary(post.content);
      const banner = page.querySelector('.article-banner');
      banner.querySelector('span').textContent = post.category.slice(0, 1);
      banner.querySelector('p').textContent = 'new story';
      const body = page.querySelector('.article-body');
      body.replaceChildren();
      post.content.split(/\n{2,}/).filter(Boolean).forEach((paragraph, index) => {
        const node = element('p', index === 0 ? 'dropcap' : '', paragraph);
        body.appendChild(node);
      });
      if (post.tags.length) {
        const tags = element('div', 'article-tags');
        post.tags.forEach((tag) => tags.appendChild(element('span', '', '#' + tag)));
        body.appendChild(tags);
      }
    } catch (error) {
      const box = element('div', 'article-load-error');
      box.append(element('h1', '', '글을 불러오지 못했습니다.'), element('p', '', error.message));
      const back = element('a', 'primary-button compact', '글 목록으로');
      back.href = 'posts.html';
      box.appendChild(back);
      page.replaceChildren(box);
    }
  }

  function managementItem(post, onEmpty) {
    const article = element('article', 'profile-post-item');
    const copy = element('div');
    const title = element('h3');
    const link = element('a', '', post.title);
    link.href = postUrl(post);
    title.appendChild(link);
    copy.append(element('p', '', post.category + ' · ' + formatDate(post.updatedAt)), title);
    const actions = element('div', 'profile-post-actions');
    const edit = element('a', '', '수정');
    edit.href = 'write.html?id=' + encodeURIComponent(post.id);
    const remove = element('button', 'delete-post', '삭제');
    remove.type = 'button';
    remove.addEventListener('click', async () => {
      if (!confirm('“' + post.title + '” 글을 삭제할까요? 삭제한 글은 복구할 수 없습니다.')) return;
      remove.disabled = true;
      try {
        await request('/' + encodeURIComponent(post.id), { method: 'DELETE' });
        article.remove();
        onEmpty();
      } catch (error) {
        document.querySelector('#my-posts-status').textContent = error.message;
        remove.disabled = false;
      }
    });
    actions.append(edit, remove);
    article.append(copy, actions);
    return article;
  }

  async function initProfile() {
    const list = document.querySelector('#my-posts-list');
    if (!list) return;
    const status = document.querySelector('#my-posts-status');
    const updateEmpty = () => {
      if (!list.children.length) status.textContent = '아직 작성한 글이 없습니다.';
    };
    try {
      const { posts } = await request('?mine=1', { method: 'GET' });
      status.textContent = posts.length ? '총 ' + posts.length + '개의 글이 있습니다.' : '아직 작성한 글이 없습니다.';
      posts.forEach((post) => list.appendChild(managementItem(post, updateEmpty)));
    } catch (error) { status.textContent = error.message; }
  }

  function start() {
    initCollections();
    initWrite();
    initDetail();
    initProfile();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
