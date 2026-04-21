/**
 * Контроллер страницы курса.
 *
 * Отвечает за:
 *   - загрузку и отрисовку курса (включая кнопку удаления — автору);
 *   - список уроков с markdown-рендерингом контента;
 *   - кнопку удаления урока для автора;
 *   - тест к уроку: пройти (все) и редактировать/удалить (автору).
 */

import { api, ApiError } from './api.js';
import { getUser, isAuthenticated } from './auth.js';
import { renderUserNav, flash, formData, formatDate, reportError } from './ui.js';
import { renderMarkdown } from './markdown.js';

const courseId = new URLSearchParams(location.search).get('id');

// Глобальное состояние страницы — маленькое, поэтому отдельный
// store не нужен. Проставляется в loadCourse().
let canAuthor = false;

renderUserNav();

if (!courseId) {
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

    const user = getUser();
    canAuthor = isAuthenticated() && user?.id === course.authorId;

    if (canAuthor) {
      // Форма добавления урока доступна только автору.
      document.getElementById('add-lesson').hidden = false;

      // Кнопка удаления курса — рядом с мета-информацией.
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn btn-danger';
      del.textContent = 'Удалить курс';
      del.addEventListener('click', () => deleteCourse(course));
      view.append(del);
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

async function deleteCourse(course) {
  if (!confirm(`Удалить курс «${course.title}»? Все уроки и тесты тоже будут удалены.`)) return;
  try {
    await api.deleteCourse(course.id);
    // Успех — уходим на главную, чтобы пользователь не остался на
    // странице удалённого курса.
    flash('Курс удалён', 'success');
    setTimeout(() => { window.location.href = '/'; }, 600);
  } catch (err) {
    reportError(err);
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

    for (const l of items) list.append(renderLessonItem(l));
  } catch (err) {
    reportError(err);
  } finally {
    list.setAttribute('aria-busy', 'false');
  }
}

function renderLessonItem(lesson) {
  const li = document.createElement('li');

  // Шапка: заголовок + (автору) кнопка удаления.
  const header = document.createElement('div');
  header.className = 'lesson-header';
  const title = document.createElement('div');
  title.className = 'lesson-title';
  title.textContent = lesson.title;
  header.append(title);

  if (canAuthor) {
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'icon-btn';
    del.title = 'Удалить урок';
    del.setAttribute('aria-label', 'Удалить урок');
    del.textContent = '×';
    del.addEventListener('click', () => deleteLesson(lesson, li));
    header.append(del);
  }
  li.append(header);

  // Контент — markdown → безопасный HTML.
  const body = document.createElement('div');
  body.className = 'lesson-content markdown';
  body.innerHTML = renderMarkdown(lesson.content);
  li.append(body);

  // Блок теста — привязан к уроку, рендерится отдельно.
  li.append(renderQuizSection(lesson));
  return li;
}

async function deleteLesson(lesson, li) {
  if (!confirm(`Удалить урок «${lesson.title}»?`)) return;
  try {
    await api.deleteLesson(courseId, lesson.id);
    li.remove();
    flash('Урок удалён', 'success');
    // Обновим счётчик «всего».
    const total = document.getElementById('lessons-total');
    const m = /(\d+)/.exec(total.textContent || '');
    if (m) total.textContent = `всего: ${Math.max(0, Number(m[1]) - 1)}`;
  } catch (err) {
    reportError(err);
  }
}

// --- Тест к уроку ------------------------------------------------------

/**
 * Рендерит секцию теста под уроком. Кнопки сворачивают/разворачивают
 * внутренние панели (прохождение / редактирование), чтобы вся
 * страница курса не раздувалась тестами по умолчанию.
 */
function renderQuizSection(lesson) {
  const section = document.createElement('div');
  section.className = 'lesson-quiz';

  const controls = document.createElement('div');
  controls.className = 'quiz-controls';

  const takeBtn = document.createElement('button');
  takeBtn.type = 'button';
  takeBtn.className = 'btn btn-ghost';
  takeBtn.textContent = 'Пройти тест';
  controls.append(takeBtn);

  let editBtn;
  if (canAuthor) {
    editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn-ghost';
    editBtn.textContent = 'Редактировать тест';
    controls.append(editBtn);
  }
  section.append(controls);

  // Панель, в которой ниже поочерёдно появляются форма прохождения
  // и редактор. Одновременно живёт только одна.
  const panel = document.createElement('div');
  panel.className = 'quiz-panel';
  panel.hidden = true;
  section.append(panel);

  takeBtn.addEventListener('click', async () => {
    if (!panel.hidden && panel.dataset.mode === 'take') {
      panel.hidden = true; panel.dataset.mode = '';
      return;
    }
    panel.dataset.mode = 'take';
    panel.hidden = false;
    await mountTakeQuiz(lesson.id, panel);
  });
  if (editBtn) {
    editBtn.addEventListener('click', async () => {
      if (!panel.hidden && panel.dataset.mode === 'edit') {
        panel.hidden = true; panel.dataset.mode = '';
        return;
      }
      panel.dataset.mode = 'edit';
      panel.hidden = false;
      await mountEditQuiz(lesson.id, panel);
    });
  }

  return section;
}

// --- Прохождение теста -------------------------------------------------

async function mountTakeQuiz(lessonId, container) {
  container.innerHTML = '<p class="muted">Загрузка теста…</p>';
  let quiz;
  try {
    quiz = await api.getQuiz(lessonId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      container.innerHTML = '<p class="muted">Тест к этому уроку пока не добавлен.</p>';
      return;
    }
    reportError(err);
    container.innerHTML = '';
    return;
  }

  container.innerHTML = '';
  const info = document.createElement('p');
  info.className = 'muted';
  info.textContent = `${quiz.questions.length} ${pluralize(quiz.questions.length, 'вопрос', 'вопроса', 'вопросов')} · проходной балл ${quiz.passingScore}%`;
  container.append(info);

  const form = document.createElement('form');
  form.className = 'quiz-take';
  form.noValidate = true;

  quiz.questions.forEach((q, qi) => {
    // Используем div/div вместо fieldset/legend: у <legend> есть
    // нетривиальное поведение при длинных текстах (вылезает за границу
    // fieldset), проще и надёжнее обойтись обычными блоками.
    const block = document.createElement('div');
    block.className = 'quiz-question';
    const legend = document.createElement('div');
    legend.className = 'quiz-question-title';
    legend.textContent = `${qi + 1}. ${q.text}`;
    block.append(legend);

    q.options.forEach((opt, oi) => {
      const label = document.createElement('label');
      label.className = 'quiz-option';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = `q${qi}`;
      input.value = String(oi);
      input.required = true;
      const span = document.createElement('span');
      span.textContent = opt;
      label.append(input, span);
      block.append(label);
    });

    form.append(block);
  });

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'btn btn-primary';
  submit.textContent = 'Отправить ответы';
  form.append(submit);
  container.append(form);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    // Собираем ответы. Если вопрос пропущен, отправляем -1 —
    // сервер засчитает его как неправильный.
    const answers = quiz.questions.map((_, qi) => {
      const picked = form.querySelector(`input[name="q${qi}"]:checked`);
      return picked ? Number(picked.value) : -1;
    });
    submit.disabled = true;
    try {
      const result = await api.attemptQuiz(lessonId, answers);
      renderQuizResult(container, quiz, answers, result);
    } catch (err) {
      reportError(err);
    } finally {
      submit.disabled = false;
    }
  });
}

function renderQuizResult(container, quiz, answers, result) {
  container.innerHTML = '';

  const summary = document.createElement('div');
  summary.className = `quiz-result ${result.passed ? 'passed' : 'failed'}`;
  summary.innerHTML = `<strong></strong><span></span>`;
  summary.querySelector('strong').textContent = result.passed ? 'Тест пройден' : 'Тест не пройден';
  summary.querySelector('span').textContent =
    ` · правильно ${result.correctCount} из ${result.total} (${result.score}%) · порог ${result.passingScore}%`;
  container.append(summary);

  // Разбор ответов — подсвечиваем правильные/неправильные.
  const list = document.createElement('ol');
  list.className = 'quiz-review';
  quiz.questions.forEach((q, qi) => {
    const li = document.createElement('li');
    li.className = result.correct[qi] ? 'ok' : 'bad';
    const title = document.createElement('div');
    title.className = 'quiz-review-title';
    title.textContent = q.text;
    li.append(title);

    q.options.forEach((opt, oi) => {
      const row = document.createElement('div');
      row.className = 'quiz-review-option';
      if (oi === result.correctIndices[qi]) row.classList.add('correct');
      if (oi === answers[qi] && !result.correct[qi]) row.classList.add('picked-wrong');
      row.textContent = opt;
      li.append(row);
    });

    list.append(li);
  });
  container.append(list);

  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'btn btn-ghost';
  retry.textContent = 'Пройти заново';
  retry.addEventListener('click', () => mountTakeQuiz(quiz.lessonId, container));
  container.append(retry);
}

// --- Редактор теста (для автора) ---------------------------------------

async function mountEditQuiz(lessonId, container) {
  container.innerHTML = '<p class="muted">Загрузка…</p>';
  let existing = null;
  try {
    existing = await api.getQuiz(lessonId);
  } catch (err) {
    // 404 — теста ещё нет, редактируем «с нуля». Другие ошибки показываем.
    if (!(err instanceof ApiError && err.status === 404)) {
      reportError(err);
      container.innerHTML = '';
      return;
    }
  }

  container.innerHTML = '';
  const editor = document.createElement('div');
  editor.className = 'quiz-editor';

  // Верхняя строка: проходной балл.
  const topRow = document.createElement('div');
  topRow.className = 'quiz-editor-row';
  const scoreLabel = document.createElement('label');
  scoreLabel.innerHTML = 'Проходной балл, % ';
  const scoreInput = document.createElement('input');
  scoreInput.type = 'number';
  scoreInput.min = '0';
  scoreInput.max = '100';
  scoreInput.step = '1';
  scoreInput.value = String(existing?.passingScore ?? 70);
  scoreInput.className = 'quiz-score-input';
  scoreLabel.append(scoreInput);
  topRow.append(scoreLabel);
  editor.append(topRow);

  // Список редакторов вопросов.
  const questions = document.createElement('div');
  questions.className = 'quiz-questions';
  editor.append(questions);

  const addQuestionBtn = document.createElement('button');
  addQuestionBtn.type = 'button';
  addQuestionBtn.className = 'btn btn-ghost';
  addQuestionBtn.textContent = '+ Добавить вопрос';
  addQuestionBtn.addEventListener('click', () => {
    questions.append(createQuestionEditor());
  });
  editor.append(addQuestionBtn);

  // Панель действий.
  const actions = document.createElement('div');
  actions.className = 'quiz-editor-actions';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn btn-primary';
  saveBtn.textContent = existing ? 'Сохранить тест' : 'Создать тест';
  actions.append(saveBtn);

  if (existing) {
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn-danger';
    delBtn.textContent = 'Удалить тест';
    delBtn.addEventListener('click', async () => {
      if (!confirm('Удалить тест к этому уроку?')) return;
      try {
        await api.deleteQuiz(lessonId);
        flash('Тест удалён', 'success');
        container.innerHTML = '';
      } catch (err) { reportError(err); }
    });
    actions.append(delBtn);
  }

  editor.append(actions);

  // Заполняем редактор существующими вопросами либо одним пустым.
  const seeds = existing?.questions?.length
    ? existing.questions
    : [{ text: '', options: ['', ''], correctIndex: 0 }];
  for (const q of seeds) questions.append(createQuestionEditor(q));

  saveBtn.addEventListener('click', async () => {
    const payload = collectQuizPayload(editor);
    if (!payload) return; // collectQuizPayload уже показал ошибку
    saveBtn.disabled = true;
    try {
      await api.upsertQuiz(lessonId, payload);
      flash(existing ? 'Тест обновлён' : 'Тест создан', 'success');
      existing = true; // дальше кнопка работает уже как «обновить»
      saveBtn.textContent = 'Сохранить тест';
    } catch (err) {
      reportError(err);
    } finally {
      saveBtn.disabled = false;
    }
  });

  container.append(editor);
}

function createQuestionEditor(q = { text: '', options: ['', ''], correctIndex: 0 }) {
  const wrap = document.createElement('div');
  wrap.className = 'q-editor';

  const head = document.createElement('div');
  head.className = 'q-editor-head';
  const label = document.createElement('span');
  label.className = 'muted';
  label.textContent = 'Вопрос';
  const rm = document.createElement('button');
  rm.type = 'button';
  rm.className = 'icon-btn';
  rm.setAttribute('aria-label', 'Удалить вопрос');
  rm.textContent = '×';
  rm.addEventListener('click', () => wrap.remove());
  head.append(label, rm);
  wrap.append(head);

  const text = document.createElement('textarea');
  text.rows = 2;
  text.maxLength = 1000;
  text.placeholder = 'Формулировка вопроса';
  text.className = 'q-text';
  text.value = q.text ?? '';
  wrap.append(text);

  const opts = document.createElement('div');
  opts.className = 'q-options';
  wrap.append(opts);

  // Общее имя для радио-группы — уникально в пределах этого редактора,
  // иначе несколько вопросов «склеятся» в один набор радио.
  const radioName = 'correct-' + Math.random().toString(36).slice(2, 10);

  const renderOption = (value, index, isCorrect) => {
    const row = document.createElement('div');
    row.className = 'q-option';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = radioName;
    radio.checked = !!isCorrect;
    radio.title = 'Правильный ответ';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = `Вариант ${index + 1}`;
    input.maxLength = 500;
    input.value = value ?? '';

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'icon-btn';
    del.setAttribute('aria-label', 'Удалить вариант');
    del.textContent = '−';
    del.addEventListener('click', () => {
      if (opts.querySelectorAll('.q-option').length <= 2) {
        flash('Минимум два варианта ответа', 'error');
        return;
      }
      row.remove();
      // Если удалили «правильный» — назначим первым по умолчанию.
      if (!opts.querySelector('input[type=radio]:checked')) {
        const first = opts.querySelector('input[type=radio]');
        if (first) first.checked = true;
      }
    });

    row.append(radio, input, del);
    opts.append(row);
  };

  q.options.forEach((opt, i) => renderOption(opt, i, i === q.correctIndex));

  const addOpt = document.createElement('button');
  addOpt.type = 'button';
  addOpt.className = 'btn btn-ghost btn-sm';
  addOpt.textContent = '+ Вариант';
  addOpt.addEventListener('click', () => {
    const idx = opts.querySelectorAll('.q-option').length;
    if (idx >= 8) { flash('Максимум восемь вариантов', 'error'); return; }
    renderOption('', idx, false);
  });
  wrap.append(addOpt);

  return wrap;
}

/**
 * Собирает данные из DOM-редактора в payload для PUT /quiz.
 * При валидационной ошибке показывает flash и возвращает null.
 */
function collectQuizPayload(editor) {
  const passingScore = Number(editor.querySelector('.quiz-score-input').value) || 0;
  if (passingScore < 0 || passingScore > 100) {
    flash('Проходной балл должен быть от 0 до 100', 'error');
    return null;
  }

  const qNodes = Array.from(editor.querySelectorAll('.q-editor'));
  if (qNodes.length === 0) {
    flash('Добавьте хотя бы один вопрос', 'error');
    return null;
  }

  const questions = [];
  for (const qn of qNodes) {
    const text = qn.querySelector('.q-text').value.trim();
    if (!text) { flash('У одного из вопросов пустая формулировка', 'error'); return null; }

    const optRows = Array.from(qn.querySelectorAll('.q-option'));
    const options = optRows.map((row) => row.querySelector('input[type=text]').value.trim());
    if (options.some((o) => !o)) {
      flash('У одного из вариантов пустой текст', 'error');
      return null;
    }
    if (options.length < 2) {
      flash('У каждого вопроса должно быть минимум два варианта', 'error');
      return null;
    }
    const correctIndex = optRows.findIndex((row) => row.querySelector('input[type=radio]').checked);
    if (correctIndex < 0) {
      flash('Отметьте правильный ответ в каждом вопросе', 'error');
      return null;
    }
    questions.push({ text, options, correctIndex });
  }

  return { passingScore, questions };
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

// --- Утилиты -----------------------------------------------------------

function pluralize(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

window.addEventListener('unhandledrejection', (e) => {
  if (e.reason instanceof ApiError) e.preventDefault();
});
