const cheerio = require('cheerio');

function normalizeText(value = '') {
  return String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/Copertina di/gi, '')
    .trim();
}

function findTextValue($, node) {
  const element = $(node).get(0);
  if (!element || !element.children) {
    return '';
  }

  for (const child of element.children) {
    if (child.type === 'text') {
      const text = normalizeText(child.data || '');
      if (text) {
        return text;
      }
    }

    if (child.type === 'tag') {
      const text = findTextValue($, child);
      if (text) {
        return text;
      }
    }
  }

  return '';
}

function findImageSrc($, node) {
  const src =
    $(node).children('img').first().attr('src') ||
    $(node).find('img').first().attr('src') ||
    '';

  return normalizeText(src);
}

function resolveUrl(baseUrl, relativeUrl) {
  if (!relativeUrl) {
    return '';
  }

  try {
    return new URL(relativeUrl, baseUrl).toString();
  } catch {
    return '';
  }
}

function parsePublicationDate(rawValue) {
  const value = normalizeText(rawValue);
  let match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  match = value.match(/^(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, month, year] = match;
    return `${year}-${month.padStart(2, '0')}-01`;
  }

  return '';
}

function parseIndexTable($, tables) {
  let indexTablePosition = -1;

  if (tables.length === 3) {
    indexTablePosition = 1;
  } else if (tables.length > 3) {
    indexTablePosition = 2;
  }

  if (indexTablePosition < 0 || !tables[indexTablePosition]) {
    return [];
  }

  const rows = $(tables[indexTablePosition]).find('tr').toArray();
  const indexes = [];

  for (let i = 1; i < rows.length; i += 1) {
    const cells = $(rows[i]).find('td').toArray();
    if (cells.length < 2) {
      continue;
    }

    const title = findTextValue($, cells[0]);
    const author = findTextValue($, cells[1]);

    if (!title && !author) {
      continue;
    }

    indexes.push({ title, author });
  }

  return indexes;
}

function parseBookFromHtml(html, options = {}) {
  const { baseUrl = '', collanaName = '' } = options;
  const $ = cheerio.load(html, { decodeEntities: true });

  $('head, style').remove();

  const tables = $('table').toArray();
  let currentTable = 0;

  if (tables.length > 0) {
    const firstCells = $(tables[0]).find('td').toArray();
    if (firstCells.length > 0 && $(firstCells[0]).find('table').length > 0) {
      currentTable = 1;
    }
  }

  const book = {
    number: 0,
    title_ita: '',
    title_orig: '',
    author: '',
    date_pub: '',
    cover_author: 'N/A',
    coverImageUrl: '',
    synopsis: '',
    synopsisImageUrl: '',
    index: []
  };

  const mainTable = tables[currentTable];
  if (!mainTable) {
    return book;
  }

  const rows = $(mainTable).find('tr').toArray();
  let rowCount = 0;

  for (let i = 0; i < rows.length; i += 1) {
    const cells = $(rows[i]).find('td').toArray();
    if (cells.length === 0) {
      continue;
    }

    if (cells.length === 1 && i < 2) {
      continue;
    }

    switch (rowCount++) {
      case 0: {
        book.coverImageUrl = resolveUrl(baseUrl, findImageSrc($, cells[0]));

        const numberValue = parseInt(findTextValue($, cells[1]), 10);
        if (Number.isFinite(numberValue)) {
          book.number = numberValue;
        }

        book.title_ita = findTextValue($, cells[2]);
        break;
      }

      case 1:
        book.date_pub = parsePublicationDate(findTextValue($, cells[0]));
        book.title_orig = findTextValue($, cells[1]);
        break;

      case 2: {
        const coverAuthor = findTextValue($, cells[0]);
        if (coverAuthor) {
          book.cover_author = coverAuthor;
        }

        book.author = findTextValue($, cells[1]);
        break;
      }

      case 3: {
        const synopsis = findTextValue($, cells[0]);
        if (synopsis) {
          book.synopsis = synopsis;
        }
        break;
      }

      case 4: {
        const synopsis = findTextValue($, cells[0]);
        if (!synopsis) {
          book.synopsisImageUrl = resolveUrl(baseUrl, findImageSrc($, cells[0]));
        } else if (!book.synopsis) {
          book.synopsis = synopsis;
        }
        break;
      }

      default:
        break;
    }
  }

  book.index = parseIndexTable($, tables);

  if (!book.title_ita && !book.title_orig) {
    const fallbackTitle = `${collanaName}${book.number || ''}`.trim();
    book.title_ita = fallbackTitle;
    book.title_orig = fallbackTitle;
  } else if (!book.title_ita) {
    book.title_ita = book.title_orig;
  } else if (!book.title_orig) {
    book.title_orig = book.title_ita;
  }

  return book;
}

module.exports = {
  parseBookFromHtml
};
