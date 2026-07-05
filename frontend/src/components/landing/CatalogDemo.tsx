import clsx from 'clsx';
import DayChips from './DayChips';
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  SearchIcon,
  XIcon,
} from './icons';
import carousel from './carousel.module.css';
import styles from './CatalogDemo.module.css';

const SEARCH_ROWS = [
  {
    code: 'BENG 110',
    sec: 'A00',
    title: 'Biomechanics I',
    instr: 'Bhatt, Dhruv',
    days: ['M', 'W', 'F'],
    time: '10:00a–10:50a',
    loc: 'PCYNH 109',
  },
  {
    code: 'BILD 2',
    sec: 'A00',
    title: 'Multicellular Life',
    instr: 'Kuo, Calvin',
    days: ['M', 'W', 'F'],
    time: '9:00a–9:50a',
    loc: 'PETER 110',
  },
  {
    code: 'CHEM 6A',
    sec: 'A00',
    title: 'General Chemistry I',
    instr: 'Hoeger, Carl',
    days: ['M', 'W', 'F'],
    time: '8:00a–8:50a',
    loc: 'YORK 2622',
  },
  {
    code: 'CSE 11',
    sec: 'A00',
    title: 'Introduction to Programming and Computational…',
    instr: 'Politz, Joe',
    days: ['M', 'W', 'F'],
    time: '11:00a–11:50a',
    loc: 'CENTR 105',
  },
  {
    code: 'CSE 15L',
    sec: 'A00',
    title: 'Software Tools and Techniques Laboratory',
    instr: 'Politz, Joe',
    days: ['Tu', 'Th'],
    time: '10:00a–11:20a',
    loc: 'CENTR 115',
  },
  {
    code: 'CSE 100',
    sec: 'A00',
    title: 'Advanced Data Structures',
    instr: 'Niema, Moshiri',
    days: ['Tu', 'Th'],
    time: '2:00p–3:20p',
    loc: 'CENTR 109',
  },
];

const FILTER_ROWS = [
  {
    code: 'DSE 260B',
    sec: 'A00',
    title: 'Data Science Capstone Design 2',
    term: 'SP26',
  },
  {
    code: 'MGTF 423',
    sections: '2 sections',
    title: 'Data Science for Finance',
    term: 'WI26',
  },
  {
    code: 'MGTF 424',
    sec: 'A00',
    title: 'Data Science for Finance—Machine …',
    term: 'SP26',
  },
  {
    code: 'ASTR 154',
    sec: 'A01',
    title: 'Data Science in Astronomy',
    term: 'SP26',
  },
  {
    code: 'ASTR 254',
    sec: 'A01',
    title: 'Data Science in Astronomy',
    term: 'SP26',
  },
  {
    code: 'COGS 108',
    sections: '14 sections',
    title: 'Data Science in Practice',
    term: 'WI26',
  },
  {
    code: 'COGS 108',
    sections: '16 sections',
    title: 'Data Science in Practice',
    term: 'SP26',
  },
];

function SortableHeader({ label }: { readonly label: string }) {
  return (
    <div className={styles.th}>
      {label}
      <span className={styles.sortArrow}>▼</span>
    </div>
  );
}

function SearchResultsSlide() {
  return (
    <div className={carousel.slide}>
      <div className={styles.appBar}>
        <span className={styles.wordmark}>SunGrid</span>
        <div className={styles.searchBox}>
          <SearchIcon />
          <span className={styles.searchPlaceholder}>
            Search by course code, title, instructor, or …
          </span>
        </div>
        <span className={styles.resultCount}>Showing 17 results</span>
      </div>
      <div className={styles.filterBar}>
        <div className={styles.filterChip}>
          Subject
          <ChevronDownIcon />
        </div>
        <div className={styles.filterChip}>
          Course Level
          <ChevronDownIcon />
        </div>
        <div className={styles.filterChip}>
          Term (1)
          <ChevronDownIcon />
        </div>
        <div className={styles.activeChip}>
          Summer Session 1 2026
          <XIcon size={10} strokeWidth={3} />
        </div>
        <div className={styles.resetBtn}>Reset</div>
      </div>
      <div className={clsx(styles.thead, styles.searchCols)}>
        <div />
        <SortableHeader label="CODE" />
        <SortableHeader label="TITLE" />
        <div>INSTRUCTORS</div>
        <SortableHeader label="MEETS" />
        <div>LOCATION</div>
      </div>
      <div className={styles.rows}>
        {SEARCH_ROWS.map((row) => (
          <div key={row.code} className={clsx(styles.row, styles.searchCols)}>
            <div className={styles.addIcon}>
              <PlusIcon />
            </div>
            <div className={styles.codeCell}>
              <span className={styles.code}>{row.code}</span>
              <span className={styles.secLabel}>{row.sec}</span>
            </div>
            <span className={styles.title}>{row.title}</span>
            <span className={styles.instr}>{row.instr}</span>
            <div className={styles.meets}>
              <DayChips on={row.days} />
              <span className={styles.time}>{row.time}</span>
            </div>
            <span className={styles.loc}>{row.loc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SearchFilterSlide() {
  return (
    <div className={carousel.slide}>
      <div className={styles.appBar}>
        <span className={styles.wordmark}>SunGrid</span>
        <div className={styles.searchBox}>
          <SearchIcon />
          <span className={styles.searchQuery}>Data science</span>
          <XIcon size={13} color="#9F9D97" strokeWidth={2.4} />
        </div>
        <span className={styles.resultCount}>Showing 24 results</span>
      </div>
      <div className={clsx(styles.filterBar, styles.filterBarTight)}>
        <div className={clsx(styles.filterChip, styles.filterChipSm)}>
          Subject
          <ChevronDownIcon size={9} />
        </div>
        <div className={clsx(styles.filterChip, styles.filterChipSm)}>
          Course Level
          <ChevronDownIcon size={9} />
        </div>
        <div className={clsx(styles.filterChip, styles.filterChipSm)}>
          Term (2)
          <ChevronDownIcon size={9} />
        </div>
        <div className={clsx(styles.activeChip, styles.activeChipSm)}>
          Spring 26
          <XIcon size={10} strokeWidth={3} />
        </div>
        <div className={clsx(styles.activeChip, styles.activeChipSm)}>
          Winter 26
          <XIcon size={10} strokeWidth={3} />
        </div>
      </div>
      <div className={clsx(styles.thead, styles.filterCols)}>
        <div />
        <SortableHeader label="CODE" />
        <div />
        <SortableHeader label="TITLE" />
        <SortableHeader label="TERM" />
      </div>
      <div className={styles.rows}>
        {FILTER_ROWS.map((row) => (
          <div
            key={`${row.code}-${row.term}-${row.sections ?? row.sec}`}
            className={clsx(styles.row, styles.rowTall, styles.filterCols)}
          >
            {row.sections ? (
              <div />
            ) : (
              <div className={styles.addIcon}>
                <PlusIcon />
              </div>
            )}
            <span className={styles.code}>{row.code}</span>
            {row.sections ? (
              <span className={styles.sectionsBadge}>
                {row.sections}
                <ChevronDownIcon size={8} color="currentColor" />
              </span>
            ) : (
              <span className={styles.secLabel}>{row.sec}</span>
            )}
            <span className={styles.title}>{row.title}</span>
            <span
              className={clsx(
                styles.termBadge,
                row.term === 'SP26' ? styles.termGreen : styles.termBlue,
              )}
            >
              {row.term}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// The hero product-glimpse figure: a two-slide carousel of catalog
// "screenshots". Slide state lives in the parent so the hero copy carousel
// stays in sync with it.
export default function CatalogDemo({
  slide,
  onSelect,
}: {
  readonly slide: number;
  readonly onSelect: (index: number) => void;
}) {
  return (
    <div className={styles.vis}>
      <div className={styles.glow} />
      <div className={styles.slideDots}>
        {[0, 1].map((index) => (
          <button
            key={index}
            type="button"
            aria-label={`Show catalog slide ${index + 1}`}
            className={clsx(styles.dot, slide === index && styles.dotActive)}
            onClick={() => onSelect(index)}
          />
        ))}
      </div>
      <div className={styles.viewport}>
        <div
          className={carousel.track}
          style={{ transform: `translateX(-${slide * 100}%)` }}
        >
          <SearchResultsSlide />
          <SearchFilterSlide />
        </div>
      </div>
      <button
        type="button"
        aria-label="Previous slide"
        className={clsx(carousel.arrow, carousel.prev)}
        onClick={() => onSelect((slide + 1) % 2)}
      >
        <ChevronLeftIcon />
      </button>
      <button
        type="button"
        aria-label="Next slide"
        className={clsx(carousel.arrow, carousel.next, styles.nudge)}
        onClick={() => onSelect((slide + 1) % 2)}
      >
        <ChevronRightIcon />
      </button>
    </div>
  );
}
