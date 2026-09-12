'use client';

import { useState } from 'react';
import { Inter, Playfair_Display } from 'next/font/google';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import type { DemoAppProps } from '@/lib/demo/types';

import { Layout } from './vendor/app/Layout';
import { ButtonLink } from './vendor/components/Button';
import { BookingDonePage } from './vendor/pages/BookingDonePage';
import { BookingPage } from './vendor/pages/BookingPage';
import { resetDemoStores } from './vendor/demo-reset';
import { routes } from './vendor/lib/routes';
import surface from './vendor/styles/surface.module.css';

/**
 * The two faces the product's tokens name.
 *
 * `--font-display` is Playfair Display and `--font-sans` is Inter in the
 * product's `src/styles/index.css`. The namespaced tokens in app/globals.css
 * point at the variables declared here, so the type is the product's type,
 * self-hosted, preloaded with the demo chunk, and not paid for by a visitor
 * who never opens a demo.
 */
const lkDisplay = Playfair_Display({
  variable: '--font-lk-display-face',
  subsets: ['latin', 'cyrillic'],
});

/**
 * No `weight` list on either: both are variable fonts, and the product's base
 * style sets `font-weight: 350` — a value between the named stops that only a
 * variable axis can hit. Pinning discrete weights here would round it to 300 or
 * 400 and quietly change the texture of every paragraph.
 */
const lkSans = Inter({
  variable: '--font-lk-sans-face',
  subsets: ['latin', 'cyrillic'],
});

/**
 * The pages of the site that this demo does not carry.
 *
 * Lanna Kamilina is a fourteen-page site. The booking flow is what the product
 * is judged on and what the registry advertises, so that is what is vendored in
 * full; the portfolio, the look-finder and the specialist pages are built
 * around the salon's photography, and that photography is of identifiable
 * clients. Shipping it into a marketing demo is a consent question rather than
 * a technical one, and it has not been answered.
 *
 * So the navigation stays real — the header and footer are the product's, with
 * every link they really have — and a link that leads out of the vendored
 * pages lands here and says so, in the product's own voice and typography.
 */
function NotInDemo() {
  return (
    <div className="lk-shell lk-section-y">
      <p className="lk-type-eyebrow text-lk-muted">Демонстрация</p>
      <h1 className="lk-type-display mt-4">Этот раздел не входит в демо</h1>
      <p className="lk-type-lead mt-5 max-w-lk-text">
        Здесь работает онлайн-запись — настоящий интерфейс салона, его
        собственный календарь и его правила. Остальные страницы сайта живут в
        самом продукте.
      </p>
      <div className="mt-8">
        <ButtonLink to={routes.booking}>К онлайн-записи</ButtonLink>
      </div>
    </div>
  );
}

/**
 * Lanna Kamilina — the salon's own frontend, running on its own mock layer.
 *
 * ─── What belongs to the product ──────────────────────────────────────────
 * Everything under `vendor/` that is not marked otherwise: the header, the
 * footer, the sticky call-to-action, the booking flow and its availability
 * picker, the confirmation page, the form controls, the typography scale, the
 * design tokens, the route table, and the whole of `features/booking` —
 * including the appointment book that makes a booked slot disappear from the
 * calendar.
 *
 * ─── What belongs to the demo ─────────────────────────────────────────────
 * Six divergences, each marked `DEMO DIVERGENCE` in place, and each a point
 * where the application reaches outside itself:
 *
 *   1. `features/booking/api.ts` — the live export opens WhatsApp or Telegram
 *      with the visitor's name and phone number prefilled. Swapped for
 *      `mockBookingApi`, which is the product's own module: no adapter had to
 *      be written, because the product already ships the replacement.
 *   2. `features/booking/schedule.ts` — the appointment book moves from
 *      `localStorage` to a Map behind the same `Storage` interface.
 *   3. `hooks/useSeo.ts` — the product writes the document title, the
 *      canonical link and JSON-LD into the head. There is one head here and it
 *      belongs to this website.
 *   4. `lib/attribution.ts` — `sessionStorage` becomes a Map.
 *   5. `components/AppLink.tsx` — View Transitions snapshot the whole
 *      document, which would slide this website sideways.
 *   6. `data/business.ts` — the salon's real telephone, WhatsApp and Telegram
 *      replaced with fictional ones, so nothing here dials anybody.
 *
 * Plus two things that are the demo's rather than the product's: the `lk-`
 * token prefix (Tailwind v4 registers `@theme` globally, and both projects
 * define `--color-accent`, `--color-muted`, `--font-sans`, `--radius-sm` and
 * `--radius-md` with different values), and `MemoryRouter` below.
 */
export default function LannaKamilinaDemo({ scenarioId }: DemoAppProps) {
  /**
   * Reset, before anything below renders.
   *
   * The appointment book is a module singleton — the same shape the product
   * uses, and the reason a booking made on one screen vanishes from the
   * calendar on another. Module state survives a remount, so the shell's
   * `key` change is not enough on its own. A `useState` initialiser runs
   * during this component's first render and before its children's, so the
   * previous visitor's appointment is never briefly visible.
   */
  useState(() => {
    resetDemoStores();
    return null;
  });

  void scenarioId;

  return (
    <div className={`${surface.surface} ${lkDisplay.variable} ${lkSans.variable}`}>
      {/*
        MemoryRouter is the whole router adapter.

        The product is a react-router SPA, and its components call `useNavigate`,
        `useSearchParams` and `Link` freely — the booking flow keeps its entire
        state in the query string, which is how a half-filled booking survives a
        refresh and how a campaign can deep-link into it. A BrowserRouter here
        would fight this site's own router for the address bar and carry the
        visitor off the page on the first click.

        MemoryRouter keeps that history in memory instead. Every one of those
        hooks works unchanged, the query string still drives the flow, and not
        one component had to be adapted for it.
      */}
      <MemoryRouter initialEntries={[routes.booking]}>
        <Routes>
          <Route element={<Layout />}>
            <Route path={routes.booking} element={<BookingPage />} />
            <Route path={routes.bookingDone} element={<BookingDonePage />} />
            <Route path="*" element={<NotInDemo />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </div>
  );
}
