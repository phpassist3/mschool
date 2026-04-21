/**
 * Контроллер главной страницы.
 *
 * Отвечает за:
 *   - переключение блоков «вход/регистрация» и «создать курс»
 *     в зависимости от состояния авторизации;
 *   - подключение трёх форм (login, register, create course);
 *   - отрисовку списка курсов с пагинацией.
 */

import { api, ApiError } from './api.js';
import { isAuthenticated, setSession } from './auth.js';
import { renderUserNav, flash, formData, formatDate, reportError } from './ui.js';

const PAGE_SIZE = 10;
let currentPage = 1;

// --- Bootstrap ---------------------------------------------------------

renderUserNav();
syncAuthSections();
wireAuthForms();
wireCourseForm();
loadCourses(currentPage);

window.addEventListener('mschool:auth-changed', () => {
  syncAuthSections();
  loadCourses(currentPage);
});

// --- Видимость секций --------------------------------------------------

function syncAuthSections() {
  const authed = isAuthenticated();
  document.getElementById('auth-section').hidden = authed;
  document.getElementById('compose-section').hidden = !authed;
}

// --- Формы авторизации -------------------------------------------------

function wireAuthForms() {
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { email, password } = formData(e.currentTarget);
    await submitButtonBusy(e.currentTarget, async () => {
      try {
        const { user, token } = await api.login(email, password);
        setSession({ user, token });
        flash(`Добро пожаловать, ${user.email}`, 'success');
      } catch (err) { reportError(err); }
    });
  });

  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { email, password } = formData(e.currentTarget);
    await submitButtonBusy(e.currentTarget, async () => {
      try {
        const { user, token } = await api.register(email, password);
        setSession({ user, token });
        flash('Аккаунт создан', 'success');
      } catch (err) { reportError(err); }
    });
  });
}

// --- Форма создания курса ----------------------------------------------

function wireCourseForm() {
  const form = document.getElementById('course-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { title, description } = formData(e.currentTarget);
    await submitButtonBusy(e.currentTarget, async () => {
      try {
        await api.createCourse({ title, description });
        form.reset();
        flash('Курс создан', 'success');
        currentPage = 1;
        loadCourses(currentPage);
      } catch (err) { reportError(err); }
    });
  });
}

// --- Список курсов -----------------------------------------------------

async function loadCourses(page) {
  const list = document.getElementById('courses-list');
  const pager = document.getElementById('courses-pager');
  const total = document.getElementById('courses-total');
  list.setAttribute('aria-busy', 'true');

  try {
    const { items, meta } = await api.listCourses({ page, limit: PAGE_SIZE });
    currentPage = meta.page;
    total.textContent = `всего: ${meta.total}`;
    list.innerHTML = '';

    if (items.length === 0) {
      const li = document.createElement('li');
      li.innerHTML = `<p class="muted">Пока ничего нет — будьте первым автором.</p>`;
      list.append(li);
    } else {
      for (const c of items) list.append(renderCourseItem(c));
    }
    renderPager(pager, meta, loadCourses);
  } catch (err) {
    reportError(err);
  } finally {
    list.setAttribute('aria-busy', 'false');
  }
}

function renderCourseItem(c) {
  const li = document.createElement('li');
  const a = document.createElement('a');
  a.className = 'course-title';
  a.href = `/course.html?id=${encodeURIComponent(c.id)}`;
  a.textContent = c.title;
  const desc = document.createElement('p');
  desc.textContent = c.description;
  const meta = document.createElement('div');
  meta.className = 'course-meta';
  meta.textContent = `создан ${formatDate(c.createdAt)}`;
  li.append(a, desc, meta);
  return li;
}

function renderPager(container, meta, onGo) {
  container.innerHTML = '';
  if (meta.pages <= 1) return;
  // Компактный числовой пейджер — ок для ~20 страниц. Для больших
  // выборок уйдём на keyset-пагинацию и кнопку «загрузить ещё».
  for (let p = 1; p <= meta.pages; p++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = p;
    if (p === meta.page) btn.setAttribute('aria-current', 'page');
    btn.addEventListener('click', () => onGo(p));
    container.append(btn);
  }
}

// --- Вспомогательное ---------------------------------------------------

/**
 * Блокирует кнопку submit на время async-задачи. Защищает от
 * двойных отправок и даёт мгновенный отклик пользователю.
 */
async function submitButtonBusy(form, task) {
  const btn = form.querySelector('button');
  if (btn) btn.disabled = true;
  try { await task(); }
  finally { if (btn) btn.disabled = false; }
}

// Если пользователь уходит со страницы, не шумим в консоль
// собственным ApiError, который мы уже обработали.
window.addEventListener('unhandledrejection', (e) => {
  if (e.reason instanceof ApiError) e.preventDefault();
});
