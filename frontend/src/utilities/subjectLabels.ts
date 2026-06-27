import { subjects as legacySubjects } from './constants';
import ucsdSubjectsData from '../generated/ucsd-subjects.json';

const ucsdSubjects = ucsdSubjectsData as { [code: string]: string };

export function getSubjectFullName(subject: string): string | undefined {
  return ucsdSubjects[subject] ?? legacySubjects[subject];
}

export function formatSubjectLabel(subject: string): string {
  const fullName = getSubjectFullName(subject);
  return fullName ? `${subject} - ${fullName}` : subject;
}
