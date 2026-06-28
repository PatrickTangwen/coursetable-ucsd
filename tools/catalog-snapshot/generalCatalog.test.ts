import { describe, expect, it } from 'vitest';
import {
  fetchGeneralCatalogForSubjects,
  fetchGeneralCatalogForSubject,
  parseGeneralCatalogHtml,
} from './generalCatalog';

function requestUrlText(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

const cseFixture = `
<main>
  <p class="anchor-parent"><a class="anchor" id="cse101" name="cse101"></a></p>
  <p class="course-name">CSE 101. Design and Analysis of Algorithms (4)</p>
  <p class="course-descriptions">Design and analysis of efficient algorithms with emphasis on sorting, searching, pattern matching, and graph algorithms. <strong class="italic"><em>Prerequisites:</em> </strong>CSE 21 or MATH 154 and CSE 12 or DSC 30; restricted to undergraduates.</p>
  <p class="anchor-parent"><a class="anchor" id="cse110" name="cse110"></a></p>
  <p class="course-name">CSE 110. Software Engineering (4)</p>
  <p class="course-descriptions">Introduction to software development and engineering methods, including specification, design, implementation, testing, and process.</p>
</main>
`;

const mathFixture = `
<main>
  <p class="anchor-parent"><a class="anchor" id="math20a" name="math20a"></a></p>
  <p class="course-name">MATH 20A. Calculus for Science and Engineering (4)</p>
  <p class="course-descriptions">Foundations of differential and integral calculus of one variable. Functions, graphs, continuity, limits, derivative, tangent line. Applications with algebraic, exponential, logarithmic, and trigonometric functions. <strong class="italic"><em>Prerequisites:</em></strong> Math Placement Exam qualifying score, or AP Calculus AB score of 3. <strong><em>Restrictions:</em></strong> Students may not receive credit for both MATH 20A and MATH 10B.</p>
  <p class="anchor-parent"><a class="anchor" id="math103a" name="math103a"></a></p>
  <p class="course-name">MATH 103A. Modern Algebra I (4)</p>
  <p class="course-descriptions">First course in a two-quarter introduction to abstract algebra with some applications. Emphasis on group theory. Topics include definitions, properties of isomorphisms, and subgroups. <strong class="italic"><em>Prerequisites:</em></strong> MATH 31CH or MATH 109 or consent of instructor.</p>
</main>
`;

const biologyFixture = `
<main>
  <p class="anchor-parent"><a class="anchor" id="bild1" name="bild1"></a></p>
  <p class="course-name">BILD 1. The Cell (4)</p>
  <p class="course-descriptions">Introduction to cellular biology.</p>
  <p class="anchor-parent"><a class="anchor" id="bipn156" name="bipn156"></a></p>
  <p class="course-name">BIPN 156. Glial Neurobiology (4)</p>
  <p class="course-descriptions">Molecular and cellular biology of glial cells in nervous system function.</p>
</main>
`;

describe('UCSD General Catalog parser', () => {
  it('parses CSE course metadata and preserves raw prerequisite text', () => {
    const courses = parseGeneralCatalogHtml(cseFixture, {
      subject: 'CSE',
      sourceUrl: 'https://catalog.ucsd.edu/courses/CSE.html',
    });

    expect(courses).toEqual([
      {
        course_id: 'CSE:101',
        subject: 'CSE',
        course_number: '101',
        title: 'Design and Analysis of Algorithms',
        units: '4',
        description:
          'Design and analysis of efficient algorithms with emphasis on sorting, searching, pattern matching, and graph algorithms.',
        prerequisites_text:
          'CSE 21 or MATH 154 and CSE 12 or DSC 30; restricted to undergraduates.',
        restrictions_text: null,
        catalog_url: 'https://catalog.ucsd.edu/courses/CSE.html#cse101',
      },
      {
        course_id: 'CSE:110',
        subject: 'CSE',
        course_number: '110',
        title: 'Software Engineering',
        units: '4',
        description:
          'Introduction to software development and engineering methods, including specification, design, implementation, testing, and process.',
        prerequisites_text: null,
        restrictions_text: null,
        catalog_url: 'https://catalog.ucsd.edu/courses/CSE.html#cse110',
      },
    ]);
  });

  it('parses MATH course metadata with separate labeled restrictions', () => {
    const courses = parseGeneralCatalogHtml(mathFixture, {
      subject: 'MATH',
      sourceUrl: 'https://catalog.ucsd.edu/courses/MATH.html',
    });

    expect(courses[0]).toEqual({
      course_id: 'MATH:20A',
      subject: 'MATH',
      course_number: '20A',
      title: 'Calculus for Science and Engineering',
      units: '4',
      description:
        'Foundations of differential and integral calculus of one variable. Functions, graphs, continuity, limits, derivative, tangent line. Applications with algebraic, exponential, logarithmic, and trigonometric functions.',
      prerequisites_text:
        'Math Placement Exam qualifying score, or AP Calculus AB score of 3.',
      restrictions_text:
        'Students may not receive credit for both MATH 20A and MATH 10B.',
      catalog_url: 'https://catalog.ucsd.edu/courses/MATH.html#math20a',
    });
    expect(courses[1]).toMatchObject({
      course_id: 'MATH:103A',
      prerequisites_text: 'MATH 31CH or MATH 109 or consent of instructor.',
    });
  });

  it('filters grouped catalog pages to the requested subject', () => {
    const courses = parseGeneralCatalogHtml(biologyFixture, {
      subject: 'BIPN',
      sourceUrl: 'https://catalog.ucsd.edu/courses/BIOL.html',
    });

    expect(courses).toEqual([
      {
        course_id: 'BIPN:156',
        subject: 'BIPN',
        course_number: '156',
        title: 'Glial Neurobiology',
        units: '4',
        description:
          'Molecular and cellular biology of glial cells in nervous system function.',
        prerequisites_text: null,
        restrictions_text: null,
        catalog_url: 'https://catalog.ucsd.edu/courses/BIOL.html#bipn156',
      },
    ]);
  });
});

describe('UCSD General Catalog fetcher', () => {
  it('fetches a configured subject from its UCSD catalog page', async () => {
    const requests: string[] = [];
    const courses = await fetchGeneralCatalogForSubject('CSE', {
      fetch(url) {
        requests.push(requestUrlText(url));
        return Promise.resolve(
          new Response(cseFixture, {
            status: 200,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
            },
          }),
        );
      },
    });

    expect(requests).toEqual(['https://catalog.ucsd.edu/courses/CSE.html']);
    expect(courses.map((course) => course.course_id)).toEqual([
      'CSE:101',
      'CSE:110',
    ]);
  });

  it('fetches a requested subject from a grouped UCSD catalog page', async () => {
    const requests: string[] = [];
    const courses = await fetchGeneralCatalogForSubject('BIPN', {
      catalogPage: 'BIOL',
      fetch(url) {
        requests.push(requestUrlText(url));
        return Promise.resolve(
          new Response(biologyFixture, {
            status: 200,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
            },
          }),
        );
      },
    });

    expect(requests).toEqual(['https://catalog.ucsd.edu/courses/BIOL.html']);
    expect(courses.map((course) => course.course_id)).toEqual(['BIPN:156']);
  });

  it('fetches each configured subject and returns combined catalog courses', async () => {
    const requestedSubjects: string[] = [];
    const courses = await fetchGeneralCatalogForSubjects(['CSE', 'MATH'], {
      fetch(url) {
        const urlText = requestUrlText(url);
        const subject = urlText.includes('MATH') ? 'MATH' : 'CSE';
        requestedSubjects.push(subject);
        return Promise.resolve(
          new Response(subject === 'MATH' ? mathFixture : cseFixture, {
            status: 200,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
            },
          }),
        );
      },
    });

    expect(requestedSubjects).toEqual(['CSE', 'MATH']);
    expect(courses.map((course) => course.subject)).toEqual([
      'CSE',
      'CSE',
      'MATH',
      'MATH',
    ]);
  });
});
