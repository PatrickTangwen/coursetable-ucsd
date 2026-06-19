export type GeneralCatalogCourse = {
  course_id: string;
  subject: string;
  course_number: string;
  title: string;
  units: string | null;
  description: string | null;
  prerequisites_text: string | null;
  restrictions_text: string | null;
  catalog_url: string;
};

type FetchAdapter = typeof fetch;

const catalogBaseUrl = 'https://catalog.ucsd.edu/courses';

const namedEntities: { [key: string]: string } = {
  amp: '&',
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
};

function decodeEntity(entity: string, fallback: string): string {
  if (entity.startsWith('#x'))
    return String.fromCodePoint(parseInt(entity.slice(2), 16));
  if (entity.startsWith('#'))
    return String.fromCodePoint(Number(entity.slice(1)));
  return namedEntities[entity] ?? fallback;
}

function decodeHtml(value: string): string {
  let decoded = '';
  let lastIndex = 0;
  for (const match of value.matchAll(/&(?<entity>#\d+|#x[\da-f]+|\w+);/giu)) {
    const entity = match.groups?.entity;
    if (!entity) continue;
    decoded +=
      value.slice(lastIndex, match.index) + decodeEntity(entity, match[0]);
    lastIndex = match.index + match[0].length;
  }
  return decoded + value.slice(lastIndex);
}

function stripTags(value: string): string {
  let text = '';
  let insideTag = false;
  for (const char of value) {
    if (char === '<') {
      insideTag = true;
      text += ' ';
    } else if (char === '>') {
      insideTag = false;
      text += ' ';
    } else if (!insideTag) {
      text += char;
    }
  }
  return text;
}

function normalizeHtmlText(value: string): string {
  return decodeHtml(stripTags(value)).replace(/\s+/gu, ' ').trim();
}

function nullableText(value: string): string | null {
  return value || null;
}

function normalizeCourseNumber(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/gu, '');
}

function normalizeSubject(value: string): string {
  return value.trim().toUpperCase();
}

function parseCourseName(value: string): {
  subject: string;
  courseNumber: string;
  title: string;
  units: string | null;
} {
  const normalized = normalizeHtmlText(value);
  const firstSpace = normalized.indexOf(' ');
  const dotIndex = normalized.indexOf('.', firstSpace + 1);
  if (firstSpace === -1 || dotIndex === -1) {
    throw new Error(
      `UCSD General Catalog course name is invalid: ${normalized}`,
    );
  }

  const subject = normalized.slice(0, firstSpace);
  const courseNumber = normalized.slice(firstSpace + 1, dotIndex);
  const rest = normalized.slice(dotIndex + 1).trim();
  let units: string | null = null;
  let unitStart = -1;

  for (let index = 0; index < rest.length; index += 1) {
    if (rest[index] !== '(') continue;
    const end = rest.indexOf(')', index + 1);
    if (end === -1) break;
    const candidate = rest.slice(index + 1, end).trim();
    if (/\d/u.test(candidate)) {
      units = candidate;
      unitStart = index;
    }
    index = end;
  }

  if (!units) {
    return {
      subject: normalizeSubject(subject),
      courseNumber: normalizeCourseNumber(courseNumber),
      title: rest.trim(),
      units: null,
    };
  }

  return {
    subject: normalizeSubject(subject),
    courseNumber: normalizeCourseNumber(courseNumber),
    title: rest.slice(0, unitStart).trim(),
    units,
  };
}

function textByLabels(descriptionHtml: string): {
  description: string | null;
  prerequisitesText: string | null;
  restrictionsText: string | null;
} {
  const text = normalizeHtmlText(descriptionHtml);
  const labelMatches = [
    ...text.matchAll(/\b(?:prerequisites?|restrictions?):\s*/giu),
  ];
  if (!labelMatches.length) {
    return {
      description: nullableText(text),
      prerequisitesText: null,
      restrictionsText: null,
    };
  }

  const [firstLabel] = labelMatches;
  if (!firstLabel) {
    return {
      description: nullableText(text),
      prerequisitesText: null,
      restrictionsText: null,
    };
  }
  let prerequisitesText: string | null = null;
  let restrictionsText: string | null = null;

  for (const [index, match] of labelMatches.entries()) {
    const label = match[0].toLowerCase();
    const start = match.index + match[0].length;
    const end = labelMatches[index + 1]?.index ?? text.length;
    const value = nullableText(text.slice(start, end).trim());
    if (!value) continue;
    if (label.startsWith('prerequisite')) prerequisitesText = value;
    else if (label.startsWith('restriction')) restrictionsText = value;
  }

  return {
    description: nullableText(text.slice(0, firstLabel.index).trim()),
    prerequisitesText,
    restrictionsText,
  };
}

function catalogUrl(sourceUrl: string, anchorId: string | undefined): string {
  if (!anchorId) return sourceUrl;
  const url = new URL(sourceUrl);
  url.hash = anchorId;
  return url.toString();
}

export function parseGeneralCatalogHtml(
  html: string,
  options: {
    subject: string;
    sourceUrl: string;
  },
): GeneralCatalogCourse[] {
  const expectedSubject = normalizeSubject(options.subject);
  const coursePattern =
    /(?:<p\s+class=["'][^"']*\banchor-parent\b[^"']*["'][^>]*>\s*<a\s+class=["'][^"']*\banchor\b[^"']*["'][^>]*\bid=["'](?<anchorId>[^"']+)["'][^>]*><\/a>\s*<\/p>\s*)?<p\s+class=["'][^"']*\bcourse-name\b[^"']*["'][^>]*>(?<nameHtml>[\s\S]*?)<\/p>\s*<p\s+class=["'][^"']*\bcourse-descriptions\b[^"']*["'][^>]*>(?<descriptionHtml>[\s\S]*?)<\/p>/giu;

  const courses = [...html.matchAll(coursePattern)].map((match) => {
    const nameHtml = match.groups?.nameHtml ?? '';
    const descriptionHtml = match.groups?.descriptionHtml ?? '';
    const parsedName = parseCourseName(nameHtml);
    if (parsedName.subject !== expectedSubject) {
      throw new Error(
        `UCSD General Catalog ${expectedSubject} page contained ${parsedName.subject} course ${parsedName.courseNumber}`,
      );
    }
    const parsedDescription = textByLabels(descriptionHtml);
    const { courseNumber } = parsedName;
    return {
      course_id: `${parsedName.subject}:${courseNumber}`,
      subject: parsedName.subject,
      course_number: courseNumber,
      title: parsedName.title,
      units: parsedName.units,
      description: parsedDescription.description,
      prerequisites_text: parsedDescription.prerequisitesText,
      restrictions_text: parsedDescription.restrictionsText,
      catalog_url: catalogUrl(options.sourceUrl, match.groups?.anchorId),
    };
  });

  if (!courses.length) {
    throw new Error(
      `UCSD General Catalog courses not found for ${expectedSubject}`,
    );
  }

  return courses;
}

function subjectCatalogUrl(subject: string): string {
  return `${catalogBaseUrl}/${encodeURIComponent(normalizeSubject(subject))}.html`;
}

export async function fetchGeneralCatalogForSubject(
  subject: string,
  options: {
    fetch?: FetchAdapter;
  } = {},
): Promise<GeneralCatalogCourse[]> {
  const fetchAdapter = options.fetch ?? fetch;
  const sourceUrl = subjectCatalogUrl(subject);
  const response = await fetchAdapter(sourceUrl);

  if (!response.ok) {
    throw new Error(
      `UCSD General Catalog query failed for ${normalizeSubject(subject)}: ${response.status} ${response.statusText}`,
    );
  }

  return parseGeneralCatalogHtml(await response.text(), {
    subject,
    sourceUrl,
  });
}

export async function fetchGeneralCatalogForSubjects(
  subjects: string[],
  options: {
    fetch?: FetchAdapter;
  } = {},
): Promise<GeneralCatalogCourse[]> {
  const courses: GeneralCatalogCourse[] = [];
  for (const subject of subjects)
    courses.push(...(await fetchGeneralCatalogForSubject(subject, options)));
  return courses;
}
