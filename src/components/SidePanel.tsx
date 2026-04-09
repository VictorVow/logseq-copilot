import React, { useEffect, useRef } from 'react';
import { IconX } from '@tabler/icons-react';
import styles from './SidePanel.module.scss';

type SidePanelProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
};

const SidePanel = ({
  isOpen,
  onClose,
  title = 'Logseq Copilot',
  children,
}: SidePanelProps) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Escape key closes the panel.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  // Move focus into the panel when it opens.
  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
    }
  }, [isOpen]);

  return (
    <>
      <div
        className={styles.overlay}
        data-open={isOpen}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        id="logseq-copilot-panel"
        role="dialog"
        aria-modal="false"
        aria-labelledby="logseq-copilot-panel-title"
        aria-hidden={!isOpen}
        data-open={isOpen}
        className={styles.sidePanel}
      >
        <header className={styles.header}>
          <h2
            id="logseq-copilot-panel-title"
            className={styles.title}
          >
            {title}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close Logseq Copilot sidebar"
          >
            <IconX size={20} stroke={2} />
          </button>
        </header>
        <div className={styles.body}>{children}</div>
      </aside>
    </>
  );
};

export default SidePanel;
