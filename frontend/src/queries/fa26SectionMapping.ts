export const fall2026Term = 'FA26';

export type SectionMappingSource = {
  sectionId: string;
  supportedTerm: string;
  sectionCode: string | null;
};

export type Fa26SectionMappingEntry = {
  displaySection: string;
  displayOption: string | null;
  displayMeetingCode: string;
  displayName: string;
  lectureGroupKey: string;
  officialSectionCode: string;
  packageId: string;
  term: typeof fall2026Term;
  tssSections: string[];
};

export type Fa26SectionMapping = {
  entries: Fa26SectionMappingEntry[];
  bySectionId: Map<string, Fa26SectionMappingEntry>;
};

const naturalCollator = new Intl.Collator('en-US', {
  numeric: true,
  sensitivity: 'base',
});

function alphabeticLabel(index: number) {
  let value = index + 1;
  let label = '';
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

function tssSections(sectionCode: string | null) {
  return (sectionCode ?? '')
    .split('+')
    .map((section) => section.trim())
    .filter(Boolean);
}

function lectureGroupKey(sectionCode: string | null) {
  const sections = tssSections(sectionCode);
  return (
    sections.find((section) => /-le$/iu.test(section)) ?? sections[0] ?? ''
  );
}

function compareSources(a: SectionMappingSource, b: SectionMappingSource) {
  const codeComparison = naturalCollator.compare(
    a.sectionCode ?? '',
    b.sectionCode ?? '',
  );
  return codeComparison || naturalCollator.compare(a.sectionId, b.sectionId);
}

export function buildFa26SectionMapping(
  sections: readonly SectionMappingSource[],
): Fa26SectionMapping {
  const groups = new Map<string, SectionMappingSource[]>();
  for (const section of sections) {
    if (section.supportedTerm !== fall2026Term) continue;
    if (!section.sectionCode?.trim()) continue;
    const groupKey = lectureGroupKey(section.sectionCode);
    if (!groupKey) continue;
    const group = groups.get(groupKey);
    if (group) group.push(section);
    else groups.set(groupKey, [section]);
  }

  const entries = [...groups.entries()]
    .sort(([a], [b]) => naturalCollator.compare(a, b))
    .flatMap(([groupKey, group], groupIndex) => {
      const letter = alphabeticLabel(groupIndex);
      const sortedGroup = [...group].sort(compareSources);
      return sortedGroup.map((section, optionIndex) => {
        const displaySection = `Section ${letter}`;
        const displayOption =
          sortedGroup.length > 1
            ? `${letter}${String(optionIndex + 1).padStart(2, '0')}`
            : null;
        return {
          displaySection,
          displayOption,
          displayMeetingCode: displayOption ?? `${letter}00`,
          displayName: displayOption
            ? `${displaySection} · ${displayOption}`
            : displaySection,
          lectureGroupKey: groupKey,
          officialSectionCode: section.sectionCode ?? '',
          packageId: section.sectionId,
          term: fall2026Term,
          tssSections: tssSections(section.sectionCode),
        } satisfies Fa26SectionMappingEntry;
      });
    });

  return {
    entries,
    bySectionId: new Map(entries.map((entry) => [entry.packageId, entry])),
  };
}
