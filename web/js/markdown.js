/**
 * Минимальный безопасный Markdown → HTML.
 *
 * Поддержка — ровно то, что нужно для уроков:
 *   - заголовки #..######
 *   - параграфы (пустая строка = разделитель)
 *   - **жирный**, *курсив*, `инлайн-код`
 *   - fenced-блоки ```…```
 *   - списки с - и 1.
 *   - цитаты >
 *   - ссылки [label](url)  (только http(s), mailto: и относительные)
 *   - картинки ![alt](url) (только http(s))
 *
 * Безопасность: весь пользовательский ввод экранируется до вставки
 * в HTML, поэтому возможность внедрить <script>, onerror="…" и т.п.
 * отсутствует by design — никаких сторонних библиотек не нужно.
 */

const ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ESCAPE[c]);

// Разрешённые схемы для ссылок. Относительные пути (начинаются с /)
// тоже ок — открывают страницу на том же домене.
const isSafeHref = (url) => /^(https?:|mailto:|\/)/.test(url);
const isSafeImgSrc = (url) => /^https?:\/\//.test(url);

/**
 * Инлайн-разметка одной строки. Порядок важен: сначала защищаем
 * куски кода placeholder'ами (чтобы * и ** внутри `кода` не стали
 * bold/italic), потом экранируем весь текст, потом применяем
 * остальные правила, потом разворачиваем placeholder'ы обратно.
 */
function renderInline(text) {
  const codeSpans = [];
  text = text.replace(/`([^`]+)`/g, (_, code) => {
    codeSpans.push(`<code>${escapeHtml(code)}</code>`);
    return `\u0000${codeSpans.length - 1}\u0000`;
  });

  text = escapeHtml(text);

  // Картинки — раньше ссылок, синтаксис похож.
  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (full, alt, url) => {
    if (!isSafeImgSrc(url)) return full;
    return `<img src="${url}" alt="${alt}" loading="lazy">`;
  });

  // Ссылки.
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (full, label, url) => {
    if (!isSafeHref(url)) return full;
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });

  // Жирный и курсив. Жирный — первым, чтобы `**a**` не стал `<em>*a*</em>`.
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');

  // Разворачиваем placeholder'ы обратно в <code>…</code>.
  text = text.replace(/\u0000(\d+)\u0000/g, (_, i) => codeSpans[Number(i)]);
  return text;
}

/**
 * Главная функция: принимает Markdown-текст, возвращает безопасный HTML.
 */
export function renderMarkdown(src) {
  if (!src) return '';
  const lines = String(src).replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced-блок: ``` … ```
    if (/^```/.test(line)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++; // пропускаем закрывающий ```
      out.push(`<pre><code>${escapeHtml(buf.join('\n'))}</code></pre>`);
      continue;
    }

    // Заголовок #..######
    const h = /^(#{1,6})\s+(.+)$/.exec(line);
    if (h) {
      out.push(`<h${h[1].length}>${renderInline(h[2])}</h${h[1].length}>`);
      i++;
      continue;
    }

    // Ненумерованный список
    if (/^\s*-\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*-\s+/, ''));
        i++;
      }
      out.push('<ul>' + items.map((x) => `<li>${renderInline(x)}</li>`).join('') + '</ul>');
      continue;
    }

    // Нумерованный список
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      out.push('<ol>' + items.map((x) => `<li>${renderInline(x)}</li>`).join('') + '</ol>');
      continue;
    }

    // Цитата >
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${renderInline(buf.join(' '))}</blockquote>`);
      continue;
    }

    // Пустая строка — разделитель блоков.
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Всё остальное — параграф. Собираем подряд идущие непустые
    // строки, которые не начинают другой блок.
    const buf = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,6}\s|```|\s*-\s|\s*\d+\.\s|>\s?)/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    out.push(`<p>${renderInline(buf.join(' '))}</p>`);
  }

  return out.join('\n');
}
