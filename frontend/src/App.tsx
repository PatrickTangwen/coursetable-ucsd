import { useEffect } from 'react';
import { Routes, Route, Outlet, useLocation } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import PullToRefresh from 'pulltorefreshjs';
import { Helmet } from 'react-helmet';

import AuthRouteGate from './components/AuthRouteGate';
import CourseModal from './components/CourseModal/CourseModal';
import UcsdSnapshotCourseModal from './components/CourseModal/UcsdSnapshotCourseModal';
import Footer from './components/Footer';
import ModalHistoryBridge from './components/ModalHistoryBridge';
import TopNav from './components/Navbar/TopNav';
import Notice from './components/Notice';
import ProfModal from './components/ProfModal/ProfModal';
import SeoMeta from './components/SeoMeta';

// Popular pages are eagerly fetched
import CatalogListView from './pages/CatalogListView';
import Home from './pages/Home';
import Worksheet from './pages/Worksheet';
import { useStore, useInitStore } from './store';

import { suspended } from './utilities/display';
import styles from './App.module.css';

const SentryRoutes = Sentry.withSentryReactRouterV7Routing(Routes);

const SignIn = suspended(() => import('./pages/SignIn'));
const Privacy = suspended(() => import('./pages/Privacy.mdx'));
const NotFound = suspended(() => import('./pages/NotFound'));
const Graphiql = suspended(() => import('./pages/Graphiql'));

// Wraps every real route with the shared footer; the 404 catch-all stays
// outside so unknown URLs render without it.
function FooterLayout() {
  const location = useLocation();
  // The landing and sign-in pages bring their own footer; the catalog and
  // worksheet pages manage their own scroll areas, so the footer would
  // force a scrollbar there.
  const hideFooter =
    location.pathname === '/' ||
    location.pathname === '/login' ||
    location.pathname === '/catalog' ||
    location.pathname === '/worksheet';
  return (
    <>
      <Outlet />
      {!hideFooter && <Footer />}
    </>
  );
}

function Modal() {
  const currentModal = useStore((state) => state.currentModal);
  if (!currentModal) return null;
  switch (currentModal.type) {
    case 'course-planning':
      return <UcsdSnapshotCourseModal listing={currentModal.data} />;
    case 'legacy-course':
      return <CourseModal listing={currentModal.data} />;
    case 'professor':
      return <ProfModal professorId={currentModal.data} />;
    default:
      return null;
  }
}

function App() {
  const location = useLocation();

  useInitStore();

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    if (standalone) {
      PullToRefresh.init({
        onRefresh() {
          window.location.reload();
        },
      });
    }
  }, []);

  return (
    <div
      className={
        location.pathname === '/catalog' ? styles.catalogLayout : styles.layout
      }
    >
      {/* Default metadata; can be overridden by individual pages/components
      keep this in sync with index.html, so nothing actually changes after
      hydration, and things get restored to the default state when those
      components unmount */}
      <Helmet>
        <title>SunGrid</title>
        <meta
          name="description"
          content="UCSD public catalog search and Worksheet planning for browsing courses and building a local schedule from the published catalog snapshot."
        />
      </Helmet>
      <SeoMeta />
      <Notice
        // Increment for each new notice (though you don't need to change it
        // when removing a notice), or users who previously dismissed the banner
        // won't see the updated content.
        // When removing a notice, just remove/comment the text content below.
        // Don't remove this wrapper.
        id={26}
      />
      {/* The landing and sign-in pages bring their own header and footer */}
      {location.pathname !== '/' && location.pathname !== '/login' && (
        <TopNav />
      )}
      <SentryRoutes>
        <Route element={<FooterLayout />}>
          {/* Public landing page; renders instantly without waiting on auth */}
          <Route path="/" element={<Home />} />

          <Route element={<AuthRouteGate />}>
            {/* Authenticated routes */}
            {/* Catalog and worksheet can be viewed by anyone; we put them
            under authenticated routes because we want loading auth to show a
            loading screen */}
            <Route path="/catalog" element={<CatalogListView />} />
            <Route path="/worksheet" element={<Worksheet />} />
            <Route path="/graphiql" element={<Graphiql />} />
            <Route path="/login" element={<SignIn />} />
          </Route>

          {/* Static pages that don't need login */}
          <Route path="/privacypolicy" element={<Privacy />} />
        </Route>
        {/* Catch-all route to NotFound page; outside FooterLayout so the 404
        page renders without the footer */}
        <Route path="/*" element={<NotFound />} />
      </SentryRoutes>
      {/* Globally overlaid components */}
      <ModalHistoryBridge />
      <Modal />
    </div>
  );
}

export default App;
