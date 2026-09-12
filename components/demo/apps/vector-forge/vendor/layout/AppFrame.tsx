import React from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { RightPanel } from './RightPanel';
import { Resizer } from '../primitives/Resizer';
import { useResizableWidth } from '../hooks/useResizableWidth';
import { useUiStore, SCREENS_WITH_PANEL } from '../stores/uiStore';
import styles from './AppFrame.module.css';

interface AppFrameProps {
  children: React.ReactNode;
  rightPanelContent?: React.ReactNode;
}

export function AppFrame({ children, rightPanelContent }: AppFrameProps) {
  const screen = useUiStore((s) => s.screen);
  const showPanel = SCREENS_WITH_PANEL.has(screen);
  const rightWidth = useUiStore((s) => s.panelWidths.right);
  const setPanelWidth = useUiStore((s) => s.setPanelWidth);

  const { onPointerDown, onKeyDown } = useResizableWidth({
    value: rightWidth,
    onChange: (w) => setPanelWidth('right', w),
    min: 300,
    max: 560,
    invert: true,
  });

  return (
    <div className={styles.frame}>
      <Sidebar />
      <div className={styles.mainColumn}>
        <TopBar />
        <div
          className={`${styles.workspaceRow} ${showPanel ? styles.withPanel : ''}`}
          style={showPanel ? ({ '--right-w': `${rightWidth}px` } as React.CSSProperties) : undefined}
        >
          <main className={styles.centerPanel} id="main-content">
            {children}
          </main>
          {showPanel && (
            <>
              <Resizer ariaLabel="Resize options panel" onPointerDown={onPointerDown} onKeyDown={onKeyDown} />
              <RightPanel>{rightPanelContent}</RightPanel>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
