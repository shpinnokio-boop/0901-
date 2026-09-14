(function () {
  'use strict';

  const API_URL = '/api/auth';
  const TOKEN_KEY = 'blogAuthToken';
  const USER_KEY = 'blogAuthUser';

  async function request(action, values) {
    const response = await fetch(API_URL, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...values }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message || '서버에 연결할 수 없습니다.');
    return data;
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
        remember: Boolean(form.elements.remember.checked),
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

  function getAuthLinks(nav) {
    const logoutLink = nav.querySelector('[data-auth-link="logout"], a[href="login.html"]');
    const profileLink = nav.querySelector('[data-auth-link="profile"], a[href="signup.html"]');
    if (logoutLink) logoutLink.dataset.authLink = 'logout';
    if (profileLink) profileLink.dataset.authLink = 'profile';
    return { logoutLink, profileLink };
  }

  function renderSignedOut() {
    document.querySelectorAll('.main-nav').forEach((nav) => {
      const { logoutLink, profileLink } = getAuthLinks(nav);
      if (logoutLink) {
        logoutLink.href = 'login.html';
        logoutLink.textContent = '로그인';
        logoutLink.removeAttribute('data-auth-action');
      }
      if (profileLink) {
        profileLink.href = 'signup.html';
        profileLink.textContent = '회원가입';
      }
    });
  }

  function renderSignedIn() {
    document.querySelectorAll('.main-nav').forEach((nav) => {
      const { logoutLink, profileLink } = getAuthLinks(nav);
      if (logoutLink) {
        logoutLink.href = '#logout';
        logoutLink.textContent = '로그아웃';
        logoutLink.dataset.authAction = 'logout';
      }
      if (profileLink) {
        profileLink.href = 'profile.html';
        profileLink.textContent = '프로필';
      }
    });
  }

  async function logout() {
    const session = readSession();
    clearSession();
    renderSignedOut();
    try {
      if (session) await request('logout', { token: session.token });
    } catch (error) {
      // 서버 요청이 실패해도 현재 브라우저의 세션은 종료합니다.
    }
    location.href = 'index.html';
  }

  async function initializeSession() {
    const session = readSession();
    if (!session) {
      renderSignedOut();
      return;
    }
    renderSignedIn();
    try {
      const result = await request('verify', { token: session.token });
      if (!result.ok) throw new Error(result.message);
      session.store.setItem(USER_KEY, JSON.stringify(result.user));
    } catch (error) {
      clearSession();
      renderSignedOut();
    }
  }

  function start() {
    const loginForm = document.querySelector('#login-form');
    const signupForm = document.querySelector('#signup-form');
    if (loginForm) loginForm.addEventListener('submit', (event) => { event.preventDefault(); handleLogin(loginForm); });
    if (signupForm) signupForm.addEventListener('submit', (event) => { event.preventDefault(); handleSignup(signupForm); });
    document.addEventListener('click', (event) => {
      const logoutLink = event.target.closest('[data-auth-action="logout"]');
      if (!logoutLink) return;
      event.preventDefault();
      logout();
    });
    initializeSession();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
