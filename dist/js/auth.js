(function () {
  'use strict';

  const API_URL = 'https://script.google.com/macros/s/AKfycbzHpUtazs4QqAbscFETrHCI1o5fsMsnyDJB4sA50878-hQD30xsX2sHBl6EUdKNdOJvOQ/exec';
  const TOKEN_KEY = 'blogAuthToken';
  const USER_KEY = 'blogAuthUser';

  async function request(action, values) {
    const body = new URLSearchParams({ action, ...values });
    const response = await fetch(API_URL, { method: 'POST', body });
    if (!response.ok) throw new Error('서버에 연결할 수 없습니다.');
    return response.json();
  }

  function readSession() {
    const stores = [sessionStorage, localStorage];
    for (const store of stores) {
      const token = store.getItem(TOKEN_KEY);
      if (!token) continue;
      try {
        return { token, user: JSON.parse(store.getItem(USER_KEY) || 'null'), store };
      } catch (error) {
        store.removeItem(TOKEN_KEY);
        store.removeItem(USER_KEY);
      }
    }
    return null;
  }

  function saveSession(token, user, remember) {
    clearSession();
    const store = remember ? localStorage : sessionStorage;
    store.setItem(TOKEN_KEY, token);
    store.setItem(USER_KEY, JSON.stringify(user));
  }

  function clearSession() {
    [sessionStorage, localStorage].forEach((store) => {
      store.removeItem(TOKEN_KEY);
      store.removeItem(USER_KEY);
    });
  }

  function showStatus(form, message, isError) {
    const status = form.querySelector('.form-status');
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('error', Boolean(isError));
  }

  function setSubmitting(form, submitting) {
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;
    if (!button.dataset.label) button.dataset.label = button.textContent;
    button.disabled = submitting;
    button.textContent = submitting ? '처리 중…' : button.dataset.label;
  }

  async function handleLogin(form) {
    showStatus(form, '', false);
    setSubmitting(form, true);
    try {
      const result = await request('login', {
        email: form.elements.email.value.trim(),
        password: form.elements.password.value,
      });
      if (!result.ok) throw new Error(result.message || '로그인하지 못했습니다.');
      saveSession(result.token, result.user, Boolean(form.elements.remember.checked));
      showStatus(form, result.message, false);
      window.setTimeout(() => { location.href = 'profile.html'; }, 450);
    } catch (error) {
      showStatus(form, error.message || '로그인하지 못했습니다.', true);
    } finally {
      setSubmitting(form, false);
    }
  }

  async function handleSignup(form) {
    showStatus(form, '', false);
    setSubmitting(form, true);
    try {
      const result = await request('signup', {
        name: form.elements.name.value.trim(),
        email: form.elements.email.value.trim(),
        password: form.elements.password.value,
      });
      if (!result.ok) throw new Error(result.message || '회원가입을 완료하지 못했습니다.');
      saveSession(result.token, result.user, true);
      showStatus(form, result.message, false);
      window.setTimeout(() => { location.href = 'profile.html'; }, 450);
    } catch (error) {
      showStatus(form, error.message || '회원가입을 완료하지 못했습니다.', true);
    } finally {
      setSubmitting(form, false);
    }
  }

  function renderSignedIn(user) {
    const loginLink = document.querySelector('a[href="login.html"]');
    const signupLink = document.querySelector('a[href="signup.html"]');
    if (loginLink) {
      loginLink.href = 'profile.html';
      loginLink.textContent = user && user.name ? user.name : '내 프로필';
    }
    if (signupLink) {
      signupLink.href = '#logout';
      signupLink.textContent = '로그아웃';
      signupLink.addEventListener('click', async (event) => {
        event.preventDefault();
        const session = readSession();
        try {
          if (session) await request('logout', { token: session.token });
        } catch (error) {
          // 서버 요청이 실패해도 현재 브라우저의 세션은 정리합니다.
        }
        clearSession();
        location.href = 'index.html';
      }, { once: true });
    }
  }

  async function initializeSession() {
    const session = readSession();
    if (!session) return;
    try {
      const result = await request('verify', { token: session.token });
      if (!result.ok) throw new Error(result.message);
      session.store.setItem(USER_KEY, JSON.stringify(result.user));
      renderSignedIn(result.user);
    } catch (error) {
      clearSession();
    }
  }

  function start() {
    const loginForm = document.querySelector('#login-form');
    const signupForm = document.querySelector('#signup-form');
    if (loginForm) loginForm.addEventListener('submit', (event) => { event.preventDefault(); handleLogin(loginForm); });
    if (signupForm) signupForm.addEventListener('submit', (event) => { event.preventDefault(); handleSignup(signupForm); });
    initializeSession();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
