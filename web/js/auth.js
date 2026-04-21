/**
 * Локальное хранилище сессии.
 *
 * Намеренно крошечный модуль: JWT и минимальная проекция `user`
 * лежат в localStorage, поэтому переживают перезагрузку страницы.
 * localStorage допустим для этой модели угроз (нет чувствительных
 * операций и сторонних скриптов). Для более серьёзной системы
 * токены стоит перенести в HttpOnly-cookie.
 */

const KEY_TOKEN = 'mschool.token';
const KEY_USER  = 'mschool.user';

// Собственное событие — другие модули подписываются, чтобы обновить
// шапку при смене состояния авторизации, без жёсткой связанности.
const EVENT = 'mschool:auth-changed';

export const getToken = () => localStorage.getItem(KEY_TOKEN);
export const getUser  = () => {
  const raw = localStorage.getItem(KEY_USER);
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
};
export const isAuthenticated = () => !!getToken();

export function setSession({ token, user }) {
  localStorage.setItem(KEY_TOKEN, token);
  localStorage.setItem(KEY_USER, JSON.stringify(user));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function clearSession() {
  localStorage.removeItem(KEY_TOKEN);
  localStorage.removeItem(KEY_USER);
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function onAuthChange(handler) {
  window.addEventListener(EVENT, handler);
  // В другой вкладке могли войти/выйти — держим UI в синхроне.
  window.addEventListener('storage', (e) => {
    if (e.key === KEY_TOKEN || e.key === KEY_USER) handler();
  });
}
