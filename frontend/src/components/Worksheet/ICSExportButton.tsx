import { useEffect, useState, type MouseEvent } from 'react';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';
import ICSIcon from '../../images/ics.svg';
import { useStore } from '../../store';
import {
  formatSkippedMeetingsSummary,
  getCalendarExport,
} from '../../utilities/calendar';

function buildICSCalendar(events: string[]) {
  return `BEGIN:VCALENDAR
CALSCALE:GREGORIAN
VERSION:2.0
BEGIN:VTIMEZONE
TZID:America/New_York
BEGIN:DAYLIGHT
DTSTART:20070311T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
TZNAME:EDT
TZOFFSETFROM:-0500
TZOFFSETTO:-0400
END:DAYLIGHT
BEGIN:STANDARD
DTSTART:20071104T020000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
TZNAME:EST
TZOFFSETFROM:-0400
TZOFFSETTO:-0500
END:STANDARD
END:VTIMEZONE
${events.join('\n')}
END:VCALENDAR`;
}

type PreparedDownload = {
  fileName: string;
  skippedSummary: string;
  url: string;
};

export function useICSExport() {
  const { viewedSeason, courses } = useStore(
    useShallow((state) => ({
      viewedSeason: state.viewedSeason,
      courses: state.courses,
    })),
  );
  const [preparedDownload, setPreparedDownload] =
    useState<PreparedDownload | null>(null);

  useEffect(() => {
    if (!courses.some((course) => !course.hidden)) {
      setPreparedDownload(null);
      return undefined;
    }
    const { events, skippedMeetings } = getCalendarExport(
      'ics',
      courses,
      viewedSeason,
      { notify: false },
    );
    const skippedSummary = formatSkippedMeetingsSummary(skippedMeetings);
    if (events.length === 0) {
      setPreparedDownload(null);
      return undefined;
    }

    const fileName = `${viewedSeason}_worksheet.ics`;
    const blob = new Blob([buildICSCalendar(events)], {
      type: 'text/calendar;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    setPreparedDownload({ fileName, skippedSummary, url });

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [courses, viewedSeason]);

  const exportICS = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!preparedDownload) {
      event.preventDefault();
      const { skippedMeetings } = getCalendarExport(
        'ics',
        courses,
        viewedSeason,
      );
      const skippedSummary = formatSkippedMeetingsSummary(skippedMeetings);
      if (skippedSummary) toast.warning(skippedSummary);
      return;
    }
    toast.success(
      `Downloaded ${preparedDownload.fileName}. Check Downloads if it does not open.`,
    );
    if (preparedDownload.skippedSummary)
      toast.warning(preparedDownload.skippedSummary);
  };

  return {
    href: preparedDownload?.url ?? '#',
    download: preparedDownload?.fileName ?? `${viewedSeason}_worksheet.ics`,
    onClick: exportICS,
  };
}

export default function ICSExportButton() {
  const { href, download, onClick } = useICSExport();
  return (
    <a href={href} download={download} onClick={onClick}>
      <img style={{ height: '2rem' }} src={ICSIcon} alt="" />
      &nbsp;&nbsp;Download as ICS
    </a>
  );
}
