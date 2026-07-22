import { describe, expect, it } from 'vitest';

import {
  buildFa26SectionMapping,
  type SectionMappingSource,
} from './fa26SectionMapping';

function section(
  sectionId: string,
  sectionCode: string,
  supportedTerm = 'FA26',
): SectionMappingSource {
  return { sectionId, sectionCode, supportedTerm };
}

describe('Fall 2026 section naming mapping', () => {
  it('assigns stable lecture groups and package option names', () => {
    const mapping = buildFa26SectionMapping([
      section('pkg-b2', '002-000-LE + 002-002-DI'),
      section('pkg-a2', '001-000-LE + 001-002-DI'),
      section('pkg-a1', '001-000-LE + 001-001-DI'),
      section('pkg-b1', '002-000-LE + 002-001-DI'),
    ]);

    expect(mapping.entries.map((entry) => entry.displayName)).toEqual([
      'Section A · A01',
      'Section A · A02',
      'Section B · B01',
      'Section B · B02',
    ]);
    expect(mapping.bySectionId.get('pkg-a1')).toMatchObject({
      displaySection: 'Section A',
      displayOption: 'A01',
      displayMeetingCode: 'A01',
      officialSectionCode: '001-000-LE + 001-001-DI',
      packageId: 'pkg-a1',
      tssSections: ['001-000-LE', '001-001-DI'],
    });
  });

  it('uses the lecture component as the group key for full packages', () => {
    const mapping = buildFa26SectionMapping([
      section('pkg-2', '001-000-LE + 001-001-DI + 001-002-LA'),
      section('pkg-1', '001-000-LE + 001-001-DI + 001-001-LA'),
    ]);

    expect(mapping.entries).toEqual([
      expect.objectContaining({
        displayName: 'Section A · A01',
        lectureGroupKey: '001-000-LE',
        packageId: 'pkg-1',
      }),
      expect.objectContaining({
        displayName: 'Section A · A02',
        lectureGroupKey: '001-000-LE',
        packageId: 'pkg-2',
      }),
    ]);
  });

  it('omits an option suffix when a lecture group has one package', () => {
    const mapping = buildFa26SectionMapping([
      section('pkg-a', '001-000-LE + 001-001-DI'),
      section('pkg-b', '002-000-LE + 002-001-DI'),
    ]);

    expect(mapping.entries.map((entry) => entry.displayName)).toEqual([
      'Section A',
      'Section B',
    ]);
    expect(mapping.entries.map((entry) => entry.displayOption)).toEqual([
      null,
      null,
    ]);
    expect(mapping.entries.map((entry) => entry.displayMeetingCode)).toEqual([
      'A00',
      'B00',
    ]);
  });

  it('does not create friendly mappings outside Fall 2026', () => {
    const mapping = buildFa26SectionMapping([
      section('pkg-a', 'A01', 'SP26'),
      section('pkg-b', '001-000-LE', 'WI27'),
    ]);

    expect(mapping.entries).toEqual([]);
    expect(mapping.bySectionId.size).toBe(0);
  });

  it('does not invent a friendly name without an official section code', () => {
    const mapping = buildFa26SectionMapping([
      { sectionId: 'pkg-missing', sectionCode: null, supportedTerm: 'FA26' },
      section('pkg-valid', '001-000-LE'),
    ]);

    expect(mapping.entries.map((entry) => entry.packageId)).toEqual([
      'pkg-valid',
    ]);
    expect(mapping.bySectionId.has('pkg-missing')).toBe(false);
  });

  it('keeps duplicate official combinations unique by package id', () => {
    const mapping = buildFa26SectionMapping([
      section('pkg-2', '001-000-LE + 001-001-DI'),
      section('pkg-1', '001-000-LE + 001-001-DI'),
    ]);

    expect(mapping.entries.map((entry) => entry.displayName)).toEqual([
      'Section A · A01',
      'Section A · A02',
    ]);
    expect(mapping.entries.map((entry) => entry.packageId)).toEqual([
      'pkg-1',
      'pkg-2',
    ]);
  });
});
