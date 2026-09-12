import {
  LayoutDashboard,
  Spline,
  Wand2,
  Gauge,
  Globe,
  Layers,
  Download,
  Settings,
} from 'lucide-react';
import { useUiStore, SCREENS_WITH_PANEL } from '../stores/uiStore';
import { useSystemStore } from '../stores/systemStore';
import { useT } from '../hooks/useT';
import { BrandLockup } from '../BrandLockup';
import { SidebarProjectsSection } from './SidebarProjectsSection';
import type { Screen } from '../types';
import styles from './Sidebar.module.css';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

function NavItem({ icon, label, active, onClick }: NavItemProps) {
  return (
    <button
      className={`${styles.navItem} ${active ? styles.active : ''}`}
      onClick={onClick}
      type="button"
      aria-current={active ? 'page' : undefined}
    >
      <span className={styles.navIcon} aria-hidden="true">{icon}</span>
      <span className={styles.navLabel}>{label}</span>
    </button>
  );
}

const NAV_ITEMS: { screen: Screen; icon: React.ReactNode; labelKey: Parameters<ReturnType<typeof useT>>[0] }[] = [
  { screen: 'dashboard', icon: <LayoutDashboard size={16} strokeWidth={1.5} />, labelKey: 'nav.dashboard' },
  { screen: 'convert',   icon: <Spline         size={16} strokeWidth={1.5} />, labelKey: 'nav.convert' },
  { screen: 'enhance',   icon: <Wand2          size={16} strokeWidth={1.5} />, labelKey: 'nav.enhance' },
  { screen: 'optimize',  icon: <Gauge          size={16} strokeWidth={1.5} />, labelKey: 'nav.optimize' },
  { screen: 'web',       icon: <Globe          size={16} strokeWidth={1.5} />, labelKey: 'nav.web' },
  { screen: 'batch',     icon: <Layers         size={16} strokeWidth={1.5} />, labelKey: 'nav.batch' },
  { screen: 'export',    icon: <Download       size={16} strokeWidth={1.5} />, labelKey: 'nav.export' },
  { screen: 'settings',  icon: <Settings       size={16} strokeWidth={1.5} />, labelKey: 'nav.settings' },
];

export function Sidebar() {
  const screen = useUiStore((s) => s.screen);
  const setScreen = useUiStore((s) => s.setScreen);
  const { engineActive, cpuPct } = useSystemStore();
  const t = useT();

  const hasPanel = SCREENS_WITH_PANEL.has(screen);

  return (
    <nav className={styles.sidebar} aria-label="Main navigation">
      {/* Logo */}
      <div className={styles.logo}>
        <BrandLockup height={72} />
      </div>

      {/* Scrollable middle: nav + projects */}
      <div className={styles.middle}>
        <div className={styles.nav}>
          {NAV_ITEMS.map(({ screen: s, icon, labelKey }) => (
            <NavItem
              key={s}
              icon={icon}
              label={t(labelKey)}
              active={screen === s}
              onClick={() => setScreen(s)}
            />
          ))}
        </div>
        <SidebarProjectsSection />
      </div>

      {/* Status area */}
      <div className={styles.status}>
        <div className={styles.engineRow}>
          <span
            className={`${styles.engineDot} ${engineActive ? styles.engineActive : ''}`}
            aria-hidden="true"
          />
          <span className={styles.engineLabel}>
            {engineActive ? 'Engine Active' : 'Engine Idle'}
          </span>
        </div>
        <div className={styles.perfRow}>
          <span className={styles.perfLabel}>CPU</span>
          <span className={styles.perfVal}>{Math.round(cpuPct)}%</span>
        </div>
        {hasPanel && (
          <div className={styles.panelHint} aria-hidden="true">Panel</div>
        )}
      </div>
    </nav>
  );
}
