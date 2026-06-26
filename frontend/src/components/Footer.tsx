import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { Container } from 'react-bootstrap';

import Logo from './Navbar/Logo';
import { TextComponent } from './Typography';
import { scrollToTop } from '../utilities/display';
import { createCatalogLink } from '../utilities/navigation';
import styles from './Footer.module.css';

const links = [
  {
    section: 'Explore',
    items: [
      { name: 'Catalog', to: createCatalogLink() },
      { name: 'Worksheet', to: '/worksheet' },
    ],
  },
];

function Footer() {
  return (
    <Container fluid>
      <footer className={clsx(styles.footer, 'py-5 px-5')}>
        <div className="row">
          <div className="col-12 col-md">
            <span className={styles.footerLogo}>
              <Logo />
            </span>
            <small className="d-block mb-3">
              &copy; {new Date().getFullYear()}
            </small>
          </div>
          {links.map(({ section, items }) => (
            <div key={section} className="col-6 col-md">
              <h5 className={styles.sectionHeading}>{section}</h5>
              <ul className="list-unstyled text-small">
                {items.map(({ name, to }) => (
                  <li key={name}>
                    {to.startsWith('https:') ? (
                      <a href={to} rel="noopener noreferrer" target="_blank">
                        <TextComponent type="secondary">{name}</TextComponent>
                      </a>
                    ) : (
                      <NavLink to={to} onClick={scrollToTop}>
                        <TextComponent type="secondary">{name}</TextComponent>
                      </NavLink>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </footer>
    </Container>
  );
}

export default Footer;
