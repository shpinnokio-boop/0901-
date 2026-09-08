const menuButton = document.querySelector('.menu-button');
const mainNav = document.querySelector('.main-nav');
const yearElement = document.querySelector('#current-year');
if (menuButton && mainNav) {
  menuButton.addEventListener('click', () => { const open = menuButton.getAttribute('aria-expanded') === 'true'; menuButton.setAttribute('aria-expanded', String(!open)); menuButton.setAttribute('aria-label', open ? '메뉴 열기' : '메뉴 닫기'); mainNav.classList.toggle('open', !open); });
  mainNav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => { mainNav.classList.remove('open'); menuButton.setAttribute('aria-expanded', 'false'); }));
}
if (yearElement) yearElement.textContent = new Date().getFullYear();

document.querySelectorAll('.demo-form').forEach((form) => {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const status = form.querySelector('.form-status');
    if (status) status.textContent = form.dataset.message || '입력한 내용이 저장되었습니다.';
  });
});

const postBody = document.querySelector('#post-body');
const charCount = document.querySelector('#char-count');
if (postBody && charCount) postBody.addEventListener('input', () => { charCount.textContent = `${postBody.value.length}자`; });
