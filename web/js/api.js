/**
 * Тонкая обёртка над fetch(), которая:
 *   - добавляет базовый префикс API к пути;
 *   - подставляет заголовок Authorization, когда есть токен;
 *   - парсит JSON на выходе (и бросает типизированную ошибку на 4xx/5xx).
 *
 * Весь остальной фронт ходит через неё вместо прямого fetch — так
 * авторизация, форма ошибок и базовый URL живут в одном месте.
 */

import { getToken, clearSession } from './auth.js';

// Тот же origin — nginx проксирует /api/ на бэкенд.
const BASE = '/api';

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Accept': 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (auth) {
    const token = getToken();
    if (!token) {
      // Защищённый вызов без токена — проваливаемся сразу, UI уведёт
      // пользователя на форму входа.
      throw new ApiError(401, 'NO_TOKEN', 'Not authenticated');
    }
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // 204 No Content — парсить нечего.
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    // Пробрасываем форму ошибки сервера: { error, message, details? }.
    const code = data?.error ?? 'HTTP_ERROR';
    const message = data?.message ?? res.statusText;
    // Протухший токен в любом месте UI должен возвращать нас к логину.
    if (res.status === 401) clearSession();
    throw new ApiError(res.status, code, message, data?.details);
  }
  return data;
}

export const api = {
  // --- Auth ---
  register: (email, password) => request('/auth/register', { method: 'POST', body: { email, password } }),
  login:    (email, password) => request('/auth/login',    { method: 'POST', body: { email, password } }),

  // --- Courses ---
  listCourses: ({ page = 1, limit = 10 } = {}) =>
    request(`/courses?page=${page}&limit=${limit}`),
  getCourse:   (id) => request(`/courses/${encodeURIComponent(id)}`),
  createCourse: (data) => request('/courses', { method: 'POST', body: data, auth: true }),

  // --- Lessons ---
  listLessons: (courseId, { page = 1, limit = 50 } = {}) =>
    request(`/courses/${encodeURIComponent(courseId)}/lessons?page=${page}&limit=${limit}`),
  createLesson: (courseId, data) =>
    request(`/courses/${encodeURIComponent(courseId)}/lessons`, { method: 'POST', body: data, auth: true }),
};
