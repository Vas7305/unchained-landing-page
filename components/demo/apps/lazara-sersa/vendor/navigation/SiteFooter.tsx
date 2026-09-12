import Image from "next/image";

import { Metadata } from "../foundations/Metadata";
import { Container } from "../layout/Container";
import { SocialLink } from "../press/SocialLink";
import { primaryNav, site } from "../content/site";

import { DirectionalLink } from "./DirectionalLink";
import styles from "./SiteFooter.module.css";

export function SiteFooter() {
  const { email, instagram, location } = site.contact;
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <Container className={styles.inner}>
        <div className={styles.identity}>
          <p className={styles.wordmark}>{site.wordmark}</p>
          <Metadata tone="muted" className={styles.descriptor}>
            {site.descriptor}
          </Metadata>
        </div>

        <nav aria-label="Footer" className={styles.column}>
          <Metadata tone="muted" as="h2" className={styles.columnTitle}>
            Index
          </Metadata>
          <ul className={styles.list}>
            {primaryNav.map((item) => (
              <li key={item.href}>
                <DirectionalLink href={item.href} className={styles.link}>
                  {item.label}
                </DirectionalLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.column}>
          <Metadata tone="muted" as="h2" className={styles.columnTitle}>
            Contact
          </Metadata>
          <ul className={styles.list}>
            {email ? (
              <li>
                <SocialLink href={`mailto:${email}`}>{email}</SocialLink>
              </li>
            ) : null}
            {instagram ? (
              <li>
                <SocialLink
                  href={`https://instagram.com/${instagram}`}
                  external
                >
                  Instagram
                </SocialLink>
              </li>
            ) : null}
            {!email && !instagram ? (
              <li className={styles.pending}>
                Contact details to be confirmed.
              </li>
            ) : null}
            {location ? <li className={styles.pending}>{location}</li> : null}
          </ul>
        </div>

        <div className={styles.bottom}>
          <p className={styles.copyright}>
            © {year} {site.name}
          </p>

          <a
            href="https://unchainedbusiness.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Powered by Unchained Business"
            className={styles.poweredBy}
          >
            <span className={styles.poweredByLabel}>Powered by</span>
            <Image
              src="/brand/unchained-business-logo.png"
              alt=""
              aria-hidden
              width={1000}
              height={293}
              className={styles.poweredByLogo}
            />
          </a>
        </div>
      </Container>
    </footer>
  );
}
