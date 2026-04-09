import React from 'react';
import { IconSearch } from '@tabler/icons-react';
import styles from './FloatingButton.module.scss';

type FloatingButtonProps = {
  count: number;
  isOpen: boolean;
  loaded: boolean;
  onClick: () => void;
};

const FloatingButton = ({
  count,
  isOpen,
  loaded,
  onClick,
}: FloatingButtonProps) => {
  const showCount = loaded && count > 0;
  const ariaLabel = showCount
    ? `Toggle Logseq Copilot sidebar (${count} results)`
    : 'Toggle Logseq Copilot sidebar';

  return (
    <button
      type="button"
      className={`${styles.floatingButton} ${isOpen ? styles.active : ''}`}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-expanded={isOpen}
      aria-controls="logseq-copilot-panel"
    >
      {showCount ? (
        <span className={styles.count}>{count}</span>
      ) : (
        <IconSearch size={24} stroke={2} />
      )}
    </button>
  );
};

export default FloatingButton;
