import { describe, expect, it } from 'vitest';

import { convertTritonGptCsvChunks } from './tritonGptScheduleCsv';

const header =
  'term_code,subject_code,course_code,class_name,course_title,academic_level,section_id,section_ref,section_code,instruction_type_name,instructors_text,seats_available,waitlist_available,meeting_kind,day_code,day_name,specific_date,start_time_display,end_time_display,building_code,room_code,is_remote,is_tba';

describe('TritonGPT schedule CSV conversion', () => {
  it('reconstructs comma titles and removes exact overlap rows', () => {
    const row =
      'FA26,BIPN,189,BIPN 189,Brain, Behavior, and Evolution,UD,E 1,FA26:E 1,001-000-LE,lecture,Timothy Gentner,25,,class,R,Thursday,,9:30am,10:50am,PODEM,PODEM 1A19,0,0';
    const converted = convertTritonGptCsvChunks(
      [`${header}\n${row}\n`, `${header}\n${row}\n`],
      { capturedAt: '2026-07-22T00:00:00.000Z', expectedSubjects: ['BIPN'] },
    );
    expect(converted.report).toMatchObject({
      raw_rows: 2,
      exact_duplicates_removed: 1,
      converted_rows: 1,
      courses: 1,
      sections: 1,
    });
    expect(converted.response.courses[0]).toMatchObject({
      course_title: 'Brain, Behavior, and Evolution',
      tss_course_code: 'BIPN-189',
      booking_choices: [
        {
          components: [
            {
              meetings: [
                expect.objectContaining({
                  location_displayed: 'PODEM 1A19',
                }),
              ],
            },
          ],
        },
      ],
    });
  });

  it('uses section-level availability when one meeting omits it', () => {
    const rows = [
      'FA26,LISP,015,LISP 015,Intermediate Spanish,LD,E 2,FA26:E 2,001-000-TU,tu,,20,,class,M,Monday,,12:00pm,12:50pm,MANDE,MANDE B-152,0,0',
      'FA26,LISP,015,LISP 015,Intermediate Spanish,LD,E 2,FA26:E 2,001-000-TU,tu,,final,R,Thursday,2026-12-10,11:30am,2:29pm,MANDE,MANDE B-152,0,0',
    ];
    const converted = convertTritonGptCsvChunks(
      [`${header}\n${rows.join('\n')}\n`],
      { capturedAt: '2026-07-22T00:00:00.000Z', expectedSubjects: ['LISP'] },
    );
    const component =
      converted.response.courses[0]!.booking_choices[0]!.components[0]!;
    expect(component.enrollment.seats_available).toBe(20);
    expect(component.meetings).toHaveLength(2);
  });

  it('recovers a missing instruction and instructor cell from the section suffix', () => {
    const row =
      'FA26,LIFR,001AX,LIFR 001AX,Analysis of French,LD,E 3,FA26:E 3,001-000-DI,,21,,class,R,Thursday,,9:30am,10:50am,YORK,YORK 3060,0,0';
    const converted = convertTritonGptCsvChunks([`${header}\n${row}\n`], {
      capturedAt: '2026-07-22T00:00:00.000Z',
      expectedSubjects: ['LIFR'],
    });
    expect(
      converted.response.courses[0]!.booking_choices[0]!.components[0],
    ).toMatchObject({
      type: 'discussion',
      enrollment: { seats_available: 21 },
    });
  });

  it('reports a truncated boundary row instead of publishing it as complete', () => {
    const row =
      'FA26,ANAR,111,ANAR 111,Foundations of Archaeology,UD,E 4,FA26:E 4,001-000-LE,lecture,Rachel Kalisher,30,,class,R';
    const valid =
      'FA26,AAS,010R,AAS 010R,Intro Studies,LD,E 5,FA26:E 5,001-000-LE,lecture,Libby Butler,75,,class,R,Thursday,,5:00pm,6:20pm,,,0,0';
    const converted = convertTritonGptCsvChunks(
      [`${header}\n${valid}\n${row}\n`],
      {
        capturedAt: '2026-07-22T00:00:00.000Z',
        expectedSubjects: ['AAS', 'ANAR'],
      },
    );
    expect(converted.response.coverage).toEqual({
      complete: false,
      continuation_needed: true,
      omitted_courses: ['ANAR 111'],
    });
    expect(converted.report.malformed_rows).toHaveLength(1);
    expect(converted.report.expected_subjects_without_rows).toEqual(['ANAR']);
  });

  it('reconstructs TSS booking packages so persisted worksheet ids stay stable', () => {
    const rows = [
      'FA26,CSE,100,CSE 100,Advanced Data Structures,UD,E 00000972,FA26:E 00000972,001-000-LE,lecture,Paul Cao,100,,class,M,Monday,,9:00am,9:50am,JEANN,JEANN AUD,0,0',
      'FA26,CSE,100,CSE 100,Advanced Data Structures,UD,E 00004071,FA26:E 00004071,001-001-DI,discussion,Paul Cao,100,,class,M,Monday,,5:00pm,5:50pm,GH,GH 242,0,0',
      'FA26,CSE,100,CSE 100,Advanced Data Structures,UD,E 00004072,FA26:E 00004072,001-002-DI,discussion,Paul Cao,100,,class,T,Tuesday,,5:00pm,5:50pm,GH,GH 242,0,0',
    ];
    const converted = convertTritonGptCsvChunks(
      [`${header}\n${rows.join('\n')}\n`],
      { capturedAt: '2026-07-22T00:00:00.000Z', expectedSubjects: ['CSE'] },
    );

    expect(converted.response.courses[0]!.booking_choices).toEqual([
      expect.objectContaining({
        booking_choice_ordinal: 1,
        displayed_package_id: null,
        components: [
          expect.objectContaining({ event_id: 'E 00000972' }),
          expect.objectContaining({ event_id: 'E 00004071' }),
        ],
      }),
      expect.objectContaining({
        booking_choice_ordinal: 2,
        displayed_package_id: null,
        components: [
          expect.objectContaining({ event_id: 'E 00000972' }),
          expect.objectContaining({ event_id: 'E 00004072' }),
        ],
      }),
    ]);
    expect(converted.report.sections).toBe(2);
  });

  it('uses the event id as the stable package id for a single component', () => {
    const row =
      'FA26,ANTH,001,ANTH 001,Introduction to Culture,LD,E 00000029,FA26:E 00000029,001-000-LE,lecture,Aftab Jassal,150,,class,T,Tuesday,,12:30pm,1:50pm,MANDE,MANDE B-202,0,0';
    const converted = convertTritonGptCsvChunks([`${header}\n${row}\n`], {
      capturedAt: '2026-07-22T00:00:00.000Z',
      expectedSubjects: ['ANTH'],
    });

    expect(
      converted.response.courses[0]!.booking_choices[0]!.displayed_package_id,
    ).toBe('E 00000029');
  });

  it('inherits a prior snapshot package id for the same exact event set', () => {
    const row =
      'FA26,ANTH,001,ANTH 001,Introduction to Culture,LD,E 00000029,FA26:E 00000029,001-000-LE,lecture,Aftab Jassal,150,,class,T,Tuesday,,12:30pm,1:50pm,MANDE,MANDE B-202,0,0';
    const converted = convertTritonGptCsvChunks([`${header}\n${row}\n`], {
      capturedAt: '2026-07-22T00:00:00.000Z',
      expectedSubjects: ['ANTH'],
      stablePackageIds: {
        'ANTH-001:E00000029': 'ANTH-001:E00000029',
      },
    });

    expect(
      converted.response.courses[0]!.booking_choices[0]!.displayed_package_id,
    ).toBe('ANTH-001:E00000029');
  });

  it('preserves remote meetings and does not relabel waitlist availability as demand', () => {
    const row =
      'FA26,CSE,008A,CSE 8A,Introduction to Programming,LD,E 8,FA26:E 8,001-000-LE,lecture,Staff,20,4,class,M,Monday,,9:00am,9:50am,,,1,0';
    const converted = convertTritonGptCsvChunks([`${header}\n${row}\n`], {
      capturedAt: '2026-07-22T00:00:00.000Z',
      expectedSubjects: ['CSE'],
    });
    const component =
      converted.response.courses[0]!.booking_choices[0]!.components[0]!;

    expect(component.meetings[0]).toMatchObject({
      location_displayed: 'REMOTE',
      is_remote: true,
      is_tba: false,
    });
    expect(component.enrollment.waitlist).toEqual({
      state: 'available_spots',
      count: null,
      available_spots: 4,
    });
  });
});
