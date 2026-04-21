/**
 * Общие UI-помощники:
 *   - renderUserNav() — блок «вход/выход» в шапке;
 *   - flash()         — маленький toast в правом нижнем углу;
 *   - formData()      — достаёт простой объект из <form>;
 *   - formatDate()    — читаемая локальная дата.
 *
 * Держим их здесь, чтобы страничные модули (home.js / course.js)
 * концентрировались на собственной логике.
 */

import { getUser, clearSession, onAuthChange } from './auth.js';

// --- Блок пользователя в шапке -----------------------------------------

export function renderUserNav() {
  const el = document.getElementById('user-nav');
  if (!el) return;

  const paint = () => {
    const user = getUser();
    el.innerHTML = '';
    if (user) {
      const span = document.createElement('span');
      span.className = 'nav-user';
      span.innerHTML = `<span class="muted">вы вошли как</span> <strong></strong>`;
      span.querySelector('strong').textContent = user.email;
      const btn = document.createElement('button');
      btn.className = 'btn btn-ghost';
      btn.type = 'button';
      btn.textContent = 'Выйти';
      btn.addEventListener('click', () => {
        clearSession();
        // Если страница имеет смысл только для авторизованных —
        // полный reload, чтобы она заново проверила начальное состояние.
        window.location.reload();
      });
      el.append(span, btn);
    } else {
      const a = document.createElement('a');
      a.href = '/';
      a.className = 'muted';
      a.textContent = 'Войти / регистрация';
      el.append(a);
    }
  };

  paint();
  onAuthChange(paint);
}

// --- Flash-toast -------------------------------------------------------

let flashTimer = null;

export function flash(message, kind = 'info') {
  const el = document.getElementById('flash');
  if (!el) return;
  el.className = `flash ${kind === 'error' ? 'error' : kind === 'success' ? 'success' : ''}`;
  el.textContent = message;
  el.hidden = false;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { el.hidden = true; }, 4500);
}

// --- Утилиты -----------------------------------------------------------

export function formData(form) {
  const fd = new FormData(form);
  return Object.fromEntries(fd.entries());
}

const DATE_FMT = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
});
export function formatDate(iso) {
  try { return DATE_FMT.format(new Date(iso)); } catch { return iso; }
}

// --- Показ ошибок ------------------------------------------------------

/**
 * Маппит известную ApiError в понятный пользователю toast. Неизвестные
 * ошибки получают общий текст — наружу никогда не уходит «голый» стектрейс.
 */
export function reportError(err) {
  const code = err?.code;
  const map = {
    VALIDATION_ERROR:    'Проверьте заполнение формы.',
    EMAIL_TAKEN:         'Этот email уже зарегистрирован.',
    INVALID_CREDENTIALS: 'Неверный email или пароль.',
    UNAUTHORIZED:        'Сначала войдите в аккаунт.',
    FORBIDDEN:           'Недостаточно прав для этого действия.',
    COURSE_NOT_FOUND:    'Курс не найден.',
    RATE_LIMIT_EXCEEDED: err.message,         // сервер уже сформулировал
    NOT_FOUND:           'Страница не найдена.',
  };
  flash(map[code] ?? err?.message ?? 'Что-то пошло не так', 'error');
}
