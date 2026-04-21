/**
 * Контроллер страницы курса.
 *
 * Загружает один курс и его уроки по `id` из query-параметра, а
 * автору курса показывает форму добавления урока.
 */

import { api, ApiError } from './api.js';
import { getUser, isAuthenticated } from './auth.js';
import { renderUserNav, flash, formData, formatDate, reportError } from './ui.js';

const courseId = new URLSearchParams(location.search).get('id');

renderUserNav();

if (!courseId) {
  // Кривой URL — выходим с понятным сообщением.
  document.getElementById('course-view').innerHTML =
    `<p class="muted">В URL не указан идентификатор курса.</p>`;
} else {
  boot();
}

async function boot() {
  await loadCourse();
  await loadLessons();
  wireLessonForm();
}

// --- Курс --------------------------------------------------------------

async function loadCourse() {
  const view = document.getElementById('course-view');
  try {
    const course = await api.getCourse(courseId);
    view.innerHTML = '';
    view.setAttribute('aria-busy', 'false');

    const h = document.createElement('h1');
    h.textContent = course.title;

    const desc = document.createElement('p');
    desc.textContent = course.description;

    const meta = document.createElement('p');
    meta.className = 'muted';
    meta.textContent = `создан ${formatDate(course.createdAt)}`;

    view.append(h, desc, meta);

    // Форма добавления урока — только автору курса.
    const user = getUser();
    if (isAuthenticated() && user?.id === course.authorId) {
      document.getElementById('add-lesson').hidden = false;
    }
  } catch (err) {
    view.innerHTML = '';
    view.setAttribute('aria-busy', 'false');
    if (err instanceof ApiError && err.status === 404) {
      view.innerHTML = `<p class="muted">Курс не найден.</p>`;
    } else {
      reportError(err);
    }
  }
}

// --- Уроки -------------------------------------------------------------

async function loadLessons() {
  const list = document.getElementById('lessons-list');
  const total = document.getElementById('lessons-total');
  list.setAttribute('aria-busy', 'true');
  try {
    const { items, meta } = await api.listLessons(courseId, { page: 1, limit: 100 });
    total.textContent = `всего: ${meta.total}`;
    list.innerHTML = '';

    if (items.length === 0) {
      const li = document.createElement('li');
      li.style.listStyle = 'none';
      li.innerHTML = `<p class="muted">Уроков пока нет.</p>`;
      list.append(li);
      return;
    }

    for (const l of items) {
      const li = document.createElement('li');
      const title = document.createElement('div');
      title.className = 'lesson-title';
      title.textContent = l.title;
      const body = document.createElement('div');
      body.className = 'lesson-content';
      // textContent (а не innerHTML) — трактуем пользовательский ввод
      // как простой текст, никогда не исполняем HTML/скрипты из API.
      body.textContent = l.content;
      li.append(title, body);
      list.append(li);
    }
  } catch (err) {
    reportError(err);
  } finally {
    list.setAttribute('aria-busy', 'false');
  }
}

// --- Форма добавления урока -------------------------------------------

function wireLessonForm() {
  const form = document.getElementById('lesson-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { title, content } = formData(e.currentTarget);
    const btn = form.querySelector('button');
    if (btn) btn.disabled = true;
    try {
      await api.createLesson(courseId, { title, content });
      form.reset();
      flash('Урок добавлен', 'success');
      await loadLessons();
    } catch (err) {
      reportError(err);
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}

window.addEventListener('unhandledrejection', (e) => {
  if (e.reason instanceof ApiError) e.preventDefault();
});
