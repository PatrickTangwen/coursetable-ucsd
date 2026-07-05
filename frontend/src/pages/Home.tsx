import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import CatalogDemo from '../components/landing/CatalogDemo';
import CourseCardDemo from '../components/landing/CourseCardDemo';
import ExamsDemo from '../components/landing/ExamsDemo';
import FitFigure from '../components/landing/FitFigure';
import {
  CalendarIcon,
  CheckIcon,
  LogoMark,
  SearchIcon,
} from '../components/landing/icons';
import WorksheetDemo from '../components/landing/WorksheetDemo';
import { createCatalogLink } from '../utilities/navigation';
import styles from './Home.module.css';

const DEPARTMENTS = [
  'COGS',
  'DSC',
  'CSE',
  'ECON',
  'BILD',
  'MATH',
  'CHEM',
  '+178 more',
];

function Feature({
  iconClass,
  icon,
  title,
  desc,
}: {
  readonly iconClass: string | undefined;
  readonly icon: ReactNode;
  readonly title: string;
  readonly desc: string;
}) {
  return (
    <div className={styles.feature}>
      <div className={clsx(styles.featureIcon, iconClass)}>{icon}</div>
      <div>
        <div className={styles.featureTitle}>{title}</div>
        <div className={styles.featureDesc}>{desc}</div>
      </div>
    </div>
  );
}

function Hero() {
  const [slide, setSlide] = useState(0);
  // Slides sit in a clipped flex track with a --slide-gap between them so the
  // off-screen panel's text never bleeds across the clip seam. The gap has to
  // be added back into the translate distance, or the active slide lands short.
  const trackStyle = {
    transform: `translateX(calc(-${slide} * (100% + var(--slide-gap))))`,
  };
  return (
    <section id="top" className={styles.hero}>
      {/* Copy carousel, kept in sync with the product-glimpse carousel */}
      <div className={styles.heroCopyClip}>
        <div className={styles.heroTrack} style={trackStyle}>
          <div className={styles.copyPanel}>
            <div className={styles.heroPanel1}>
              <h1 className={styles.h1}>
                Every course.
                <br />
                One search.
              </h1>
              <p className={styles.heroLead}>
                Search the full UCSD catalog by code, title, or instructor —
                then drag sections onto a weekly worksheet and see your quarter
                take shape before you enroll.
              </p>
              <div className={styles.ctaRow}>
                <Link to={createCatalogLink()} className={styles.btnPrimary}>
                  Search the catalog
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </Link>
                <a href="#worksheet" className={styles.btnGhost}>
                  See a worksheet
                </a>
              </div>
              <div className={styles.freeNote}>
                <CheckIcon />
                Free · No account needed to browse
              </div>
              <div className={styles.stats}>
                <div>
                  <div className={styles.statNum}>8,500+</div>
                  <div className={styles.statLabel}>sections indexed</div>
                </div>
                <div>
                  <div className={styles.statNum}>185+</div>
                  <div className={styles.statLabel}>departments</div>
                </div>
                <div>
                  <div className={styles.statNum}>Free</div>
                  <div className={styles.statLabel}>no account to browse</div>
                </div>
              </div>
            </div>
          </div>
          <div className={clsx(styles.copyPanel, styles.heroPanel2)}>
            <div className={styles.heroPanel2Inner}>
              <h2 className={styles.h2}>Search that matches what you type</h2>
              <p className={styles.sectionLead}>
                One search field covers course code, title, instructor, and
                description — then filter by subject, level, and term to land on
                the exact section you need.
              </p>
              <div className={styles.features}>
                <Feature
                  iconClass={styles.iconBlue}
                  icon={<SearchIcon size={16} color="#185FA5" />}
                  title="Search any field"
                  desc="Code, title, instructor, or keyword — results narrow as you type."
                />
                <Feature
                  iconClass={styles.iconGreen}
                  icon={
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#085041"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="4" y1="6" x2="20" y2="6" />
                      <line x1="7" y1="12" x2="17" y2="12" />
                      <line x1="10" y1="18" x2="14" y2="18" />
                    </svg>
                  }
                  title="Filter down fast"
                  desc="Narrow by subject, course level, and term in a couple of clicks."
                />
                <Feature
                  iconClass={styles.iconPurple}
                  icon={
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#3C3489"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="4" y1="6" x2="20" y2="6" />
                      <line x1="4" y1="12" x2="14" y2="12" />
                      <line x1="4" y1="18" x2="10" y2="18" />
                    </svg>
                  }
                  title="Meeting days in one glance"
                  desc="Day chips show exactly when a section meets before you add it."
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.heroWrap}>
        <FitFigure width={640}>
          <CatalogDemo slide={slide} onSelect={setSlide} />
        </FitFigure>
      </div>
    </section>
  );
}

function DeptStrip() {
  return (
    <section className={styles.strip}>
      <div className={styles.stripInner}>
        <span className={styles.stripLabel}>SEARCH ACROSS DEPARTMENTS</span>
        <span className={styles.stripDivider} />
        <div className={styles.stripChips}>
          {DEPARTMENTS.map((dept) => (
            <span key={dept} className={styles.stripChip}>
              {dept}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function WorksheetSection() {
  return (
    <section id="worksheet" className={styles.worksheetSection}>
      <div className={styles.worksheetGrid}>
        <FitFigure width={720} className={styles.visCol}>
          <WorksheetDemo />
        </FitFigure>
        <div className={styles.copyCol}>
          <span className={styles.eyebrow}>WORKSHEET</span>
          <h2 className={styles.h2}>See your whole week before you enroll</h2>
          <p className={styles.sectionLead}>
            Drop sections onto a live weekly grid. Overlaps are flagged the
            moment they happen, so you catch conflicts here — not on your
            enrollment appointment.
          </p>
          <div className={styles.features}>
            <Feature
              iconClass={styles.iconRed}
              icon={<span className={styles.redDot} />}
              title="Conflict detection"
              desc="Overlapping sections are flagged the moment they collide on the grid."
            />
            <Feature
              iconClass={styles.iconGray}
              icon={
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#6F6D67"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                </svg>
              }
              title="Load at a glance"
              desc="Quickly view your workload, finals, busiest day, credits, and more."
            />
            <Feature
              iconClass={styles.iconGreen}
              icon={
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#085041"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              }
              title="Sync with your calendar"
              desc="Push your worksheet to Apple, Google, or Outlook calendar — stays in sync as you make changes."
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function ExamsSection() {
  return (
    <section id="exams" className={styles.examsSection}>
      <div className={styles.copyCol}>
        <span className={styles.eyebrow}>EXAMS &amp; CONFLICTS</span>
        <h2 className={styles.h2}>
          Every exam, every collision, laid out clearly
        </h2>
        <p className={styles.sectionLead}>
          Pull up every midterm and final in your worksheet as one list, or
          drill into exactly which sections overlap and by how many minutes.
        </p>
        <div className={styles.features}>
          <Feature
            iconClass={styles.iconBlue}
            icon={<CalendarIcon color="#185FA5" />}
            title="Full exam list"
            desc="Every midterm and final across your worksheet, sorted by date or grouped by course."
          />
          <Feature
            iconClass={styles.iconRed}
            icon={
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#A32D2D"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            }
            title="Conflict breakdown"
            desc="Each collision shows the exact overlap window, down to the minute."
          />
          <Feature
            iconClass={styles.iconGreen}
            icon={<CheckIcon size={16} color="#085041" />}
            title="You're still in control"
            desc="Conflicts don't block enrolling — resolve them with your instructor as needed."
          />
        </div>
      </div>
      <div className={styles.visCol}>
        <div className={styles.visRel}>
          <div className={clsx(styles.glow, styles.glowRed)} />
          <FitFigure width={560}>
            <ExamsDemo />
          </FitFigure>
        </div>
      </div>
    </section>
  );
}

function CourseSection() {
  return (
    <section id="course" className={styles.courseSection}>
      <div className={clsx(styles.copyCol, styles.courseCopy)}>
        <span className={styles.eyebrow}>COURSE DETAIL</span>
        <h2 className={styles.h2}>Everything about a course, one click away</h2>
        <p className={styles.sectionLead}>
          Open any course to see every offering group, meeting pattern, and
          prerequisite — plus past grade distributions. Pick a discussion and
          add the whole section to your worksheet in one move.
        </p>
        <div className={styles.features}>
          <Feature
            iconClass={styles.iconGreen}
            icon={
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#085041"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="8" y1="2" x2="8" y2="6" />
              </svg>
            }
            title="Every section & meeting"
            desc="Lectures, discussions, labs and finals, grouped by offering."
          />
          <Feature
            iconClass={styles.iconPurple}
            icon={
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#534AB7"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            }
            title="Prerequisites & restrictions"
            desc="Know what you need before it costs you an enrollment window."
          />
          <Feature
            iconClass={styles.iconBlue}
            icon={
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#185FA5"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="6" y1="20" x2="6" y2="12" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="18" y1="20" x2="18" y2="9" />
              </svg>
            }
            title="Past grade distributions"
            desc="Compare instructors and terms before you commit."
          />
        </div>
      </div>
      <div className={clsx(styles.visCol, styles.courseVis)}>
        <div className={styles.visRel}>
          <div className={clsx(styles.glow, styles.glowPurple)} />
          <FitFigure width={560}>
            <CourseCardDemo />
          </FitFigure>
        </div>
      </div>
    </section>
  );
}

function SyncSection() {
  return (
    <section className={styles.syncSection}>
      <div className={styles.syncInner}>
        <div className={styles.syncHeader}>
          <span className={styles.eyebrow}>SIGNED IN</span>
          <h2 className={styles.h2}>Pick up where you left off</h2>
          <p className={styles.sectionLead}>
            Verify a UCSD email once and your searches and worksheets follow you
            across devices and quarters. Browsing stays open to everyone —
            signing in just makes it stick.
          </p>
        </div>
        <div className={styles.grid3}>
          <div className={styles.card}>
            <div className={clsx(styles.cardIcon, styles.iconBlue)}>
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#185FA5"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className={styles.cardTitle}>Saved searches</div>
            <div className={styles.cardDesc}>
              Keep the filters you use every quarter one click away — no
              rebuilding.
            </div>
          </div>
          <div className={styles.card}>
            <div className={clsx(styles.cardIcon, styles.iconGreen)}>
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#085041"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12a9 9 0 1 1-9-9c2.5 0 4.5 1 6 2.5" />
                <polyline points="21 3 21 9 15 9" />
              </svg>
            </div>
            <div className={styles.cardTitle}>Synced worksheets</div>
            <div className={styles.cardDesc}>
              Start a schedule on your laptop, finish it on your phone — same
              worksheet.
            </div>
          </div>
          <div className={styles.card}>
            <div className={clsx(styles.cardIcon, styles.iconPurple)}>
              <CalendarIcon size={19} color="#3C3489" />
            </div>
            <div className={styles.cardTitle}>Finals view</div>
            <div className={styles.cardDesc}>
              See your final exam schedule laid out the moment your sections are
              set.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  {
    num: '1',
    title: 'Search the catalog',
    desc: 'Type a code, title, or instructor. Filter by subject, level, and term to find the exact section.',
  },
  {
    num: '2',
    title: 'Build your worksheet',
    desc: 'Add sections to a weekly grid and watch your schedule — and any conflicts — appear in real time.',
  },
  {
    num: '3',
    title: 'Sign in to save',
    desc: 'Verify a UCSD email to keep everything synced and ready for your enrollment appointment.',
  },
];

function HowSection() {
  return (
    <section id="how" className={styles.howSection}>
      <div className={styles.howInner}>
        <div className={styles.howHeader}>
          <span className={styles.eyebrow}>HOW IT WORKS</span>
          <h2 className={clsx(styles.h2, styles.howH2)}>
            Three steps to a full quarter
          </h2>
        </div>
        <div className={styles.howGrid}>
          {STEPS.map((step) => (
            <div key={step.num} className={styles.step}>
              <div className={styles.stepTop}>
                <span className={styles.stepNum}>{step.num}</span>
                <span className={styles.stepLine} />
              </div>
              <div className={styles.stepTitle}>{step.title}</div>
              <div className={styles.stepDesc}>{step.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaSection() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  return (
    <section className={styles.ctaSection}>
      <div className={styles.ctaCard}>
        <div className={styles.ctaDots} />
        <div className={styles.ctaBigS}>S</div>
        <div className={styles.ctaContent}>
          <h2 className={styles.ctaH2}>
            Plan your quarter
            <br />
            in one place
          </h2>
          <p className={styles.ctaLead}>
            Start searching in seconds — no account required. Sign in with a
            UCSD email whenever you want to save your work.
          </p>
          <div className={styles.ctaRowWrap}>
            <form
              className={styles.ctaPill}
              onSubmit={(event) => {
                event.preventDefault();
                void navigate('/login', { state: { email } });
              }}
            >
              <input
                type="email"
                aria-label="UCSD email"
                placeholder="student@ucsd.edu"
                className={styles.ctaInput}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <button type="submit" className={styles.ctaSubmit}>
                Get started
              </button>
            </form>
            <Link to={createCatalogLink()} className={styles.ctaBrowse}>
              Browse without an account →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// The public landing page shown at "/". It carries its own header and footer,
// so the global TopNav/Footer are hidden on this route (see App.tsx).
export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  // Close the mobile menu on Escape (also for narrow-desktop keyboards).
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <a
            href="#top"
            className={styles.logoLink}
            title="SunGrid"
            onClick={closeMenu}
          >
            <LogoMark className={styles.logoSvg} />
          </a>
          <nav className={styles.nav}>
            <Link to={createCatalogLink()} className={styles.navLink}>
              Catalog
            </Link>
            <a href="#worksheet" className={styles.navLink}>
              Worksheet
            </a>
            <a href="#how" className={styles.navLink}>
              How it works
            </a>
          </nav>
          <div className={styles.spacer} />
          <Link to="/login" className={clsx(styles.navLink, styles.authBtn)}>
            Sign in
          </Link>
          <button
            type="button"
            className={styles.menuBtn}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className={styles.menuBars} />
          </button>
        </div>
        {menuOpen && (
          <>
            <button
              type="button"
              className={styles.menuBackdrop}
              aria-label="Close menu"
              tabIndex={-1}
              onClick={closeMenu}
            />
            <nav id="mobile-menu" className={styles.mobileMenu}>
              <Link
                to={createCatalogLink()}
                className={styles.mobileMenuLink}
                onClick={closeMenu}
              >
                Catalog
              </Link>
              <a
                href="#worksheet"
                className={styles.mobileMenuLink}
                onClick={closeMenu}
              >
                Worksheet
              </a>
              <a
                href="#how"
                className={styles.mobileMenuLink}
                onClick={closeMenu}
              >
                How it works
              </a>
            </nav>
          </>
        )}
      </header>

      <Hero />
      <DeptStrip />
      <WorksheetSection />
      <ExamsSection />
      <CourseSection />
      <SyncSection />
      <HowSection />
      <CtaSection />

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <a href="#top" className={styles.footerLogo}>
            SunGrid
          </a>
          <nav className={styles.footerNav}>
            <Link to={createCatalogLink()} className={styles.footerLink}>
              Catalog
            </Link>
            <a href="#worksheet" className={styles.footerLink}>
              Worksheet
            </a>
            <a href="#how" className={styles.footerLink}>
              How it works
            </a>
            <Link to="/login" className={styles.footerLink}>
              Sign in
            </Link>
          </nav>
          <div className={styles.spacer} />
        </div>
      </footer>
    </div>
  );
}
