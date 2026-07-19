export const WEEKLY_LOAD_TARGET_ID = 'weekly-load';

export function openWeeklyLoad(changeWorksheetView: (view: 'list') => void) {
  const { pathname, search } = window.location;
  window.history.replaceState(
    window.history.state,
    '',
    `${pathname}${search}#${WEEKLY_LOAD_TARGET_ID}`,
  );
  changeWorksheetView('list');
}

export function scrollToRequestedWeeklyLoad(element: HTMLElement) {
  if (window.location.hash !== `#${WEEKLY_LOAD_TARGET_ID}`) return false;

  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const { pathname, search } = window.location;
  window.history.replaceState(window.history.state, '', `${pathname}${search}`);
  return true;
}
