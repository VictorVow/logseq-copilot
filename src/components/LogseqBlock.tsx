import { LogseqBlockType } from '@/types/logseqBlock';
import LogseqPageLink from './LogseqPage';
import { LogseqProperties } from './LogseqProperties';
import Browser from 'webextension-polyfill';
import styles from './logseq.module.scss';
import React, { useEffect, useState } from 'react';

type LogseqBlockProps = {
  graph: string;
  blocks: LogseqBlockType[];
  isPopUp?: boolean;
};

type LogseqBlockItemProps = {
  graph: string;
  block: LogseqBlockType;
  // Children rendered inside an already-expanded parent are passed their
  // tree inline (the deferred fetch returns a fully-normalized tree and
  // the UI recurses over it). Root-level items leave this undefined so
  // the component knows to issue its own fetch on button click.
  initialChildren?: LogseqBlockType[];
};

const toBlockLink = (graph: string, block: LogseqBlockType) => {
  if (!block.uuid) return <></>;
  return (
    <a
      className={styles.toBlock}
      href={`logseq://graph/${graph}?block-id=${block.uuid}`}
    >
      <span className={'tie tie-block'}></span>
      To Block
    </a>
  );
};

// Renders one block and its (on-demand fetched) descendants. Extracted
// from LogseqBlock so every block in a search-result group can own its
// own marker / expand state instead of aliasing through blocks[0]. The
// component calls itself recursively when the fetched tree is expanded,
// so each nested descendant reuses the same marker controls and
// "Show child blocks" affordance without extra code paths.
const LogseqBlockItem = ({
  graph,
  block,
  initialChildren,
}: LogseqBlockItemProps) => {
  const [checked, setChecked] = useState(false);
  const [status, setStatus] = useState('');
  const [showChildren, setShowChildren] = useState(false);
  const [children, setChildren] = useState<LogseqBlockType[] | undefined>(
    initialChildren,
  );
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [childrenError, setChildrenError] = useState<string | null>(null);

  const statusUpdate = (marker: string) => {
    switch (marker) {
      case 'TODO':
      case 'LATER':
      case 'DOING':
      case 'NOW':
        setChecked(false);
        setStatus(marker);
        break;
      case 'DONE':
        setChecked(true);
        setStatus(marker);
        break;
      case 'CANCELED':
        setChecked(true);
        setStatus(marker);
    }
  };

  useEffect(() => {
    const listener = (message: any) => {
      if (
        message?.type === 'change-block-marker-result' &&
        message.uuid === block.uuid &&
        message.status === 'success'
      ) {
        statusUpdate(message.marker);
        return;
      }
      if (
        message?.type === 'get-block-children-result' &&
        message.uuid === block.uuid
      ) {
        setLoadingChildren(false);
        if (message.status === 'success') {
          setChildren(message.children ?? []);
          setChildrenError(null);
          setShowChildren(true);
        } else {
          setChildrenError(message.msg ?? 'Failed to load child blocks');
        }
      }
    };
    Browser.runtime.onMessage.addListener(listener);
    statusUpdate(block.marker);
    return () => Browser.runtime.onMessage.removeListener(listener);
  }, [block.uuid, block.marker]);

  const updateMarker = (marker: string) => {
    Browser.runtime.sendMessage({
      type: 'change-block-marker',
      marker,
      uuid: block.uuid,
    });
  };

  const markerStatusChange = (
    _e: React.MouseEvent<HTMLButtonElement, MouseEvent>,
  ) => {
    let marker = '';
    if (status === 'TODO') {
      marker = 'DOING';
    } else if (status === 'DOING') {
      marker = 'TODO';
    } else if (status === 'NOW') {
      marker = 'LATER';
    } else if (status === 'LATER') {
      marker = 'NOW';
    }
    updateMarker(marker);
  };

  const markerCheck = (_e: React.ChangeEvent<HTMLInputElement>) => {
    updateMarker(checked ? 'TODO' : 'DONE');
  };

  const markerRender = (marker: string) => {
    if (!marker) return <></>;
    return (
      <div className={styles.blockMarker}>
        <input
          className={styles.blockMarkerCheckbox}
          type="checkbox"
          checked={checked}
          onChange={markerCheck}
        />
        <button
          className={styles.blockMarkerStatus}
          onClick={markerStatusChange}
        >
          {status}
        </button>
      </div>
    );
  };

  const toggleChildren = () => {
    // If we already have the tree (either from a previous fetch or from
    // the parent expansion), toggling is a pure visibility flip.
    if (children !== undefined) {
      setShowChildren((v) => !v);
      return;
    }
    if (loadingChildren) return;
    setLoadingChildren(true);
    setChildrenError(null);
    Browser.runtime.sendMessage({
      type: 'get-block-children',
      uuid: block.uuid,
    });
  };

  if (!block.html) {
    return null;
  }

  const showButton = block.hasChildren === true;
  const buttonLabel = loadingChildren
    ? 'Loading child blocks…'
    : showChildren
    ? 'Hide child blocks'
    : 'Show child blocks';

  return (
    <li className={styles.blockContentListItem}>
      <div className={styles.blockContentRoot}>
        {block.marker != null && markerRender(block.marker)}
        <div
          className={styles.blockContent}
          dangerouslySetInnerHTML={{ __html: block.html }}
        />
        {toBlockLink(graph, block)}
      </div>
      <LogseqProperties properties={block.properties} />
      {showButton && (
        <button
          type="button"
          className={styles.showChildrenButton}
          onClick={toggleChildren}
          disabled={loadingChildren}
        >
          {buttonLabel}
        </button>
      )}
      {childrenError && (
        <div className={styles.childBlocksError}>{childrenError}</div>
      )}
      {showChildren && children && children.length > 0 && (
        <ul className={styles.childBlocks}>
          {children.map((child) => (
            <LogseqBlockItem
              key={child.uuid}
              graph={graph}
              block={child}
              initialChildren={child.children}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

export const LogseqBlock = ({ graph, blocks }: LogseqBlockProps) => {
  if (blocks.length === 0) {
    return <></>;
  }

  // Every block in a group shares the same parent page, so render the
  // page link once at the top and then hand each block off to its own
  // LogseqBlockItem. The old code aliased all blocks through blocks[0]
  // for marker state, which was a latent bug the moment the group had
  // more than one hit.
  const headerBlock = blocks.find((b) => b.html);
  if (!headerBlock) return <></>;

  return (
    <div className={styles.block}>
      <div className={styles.blockHeader}>
        <LogseqPageLink graph={graph} page={headerBlock.page} />
      </div>
      <div className={styles.blockBody}>
        <ul className={styles.blockContentList}>
          {blocks.map((block) => (
            <LogseqBlockItem key={block.uuid} graph={graph} block={block} />
          ))}
        </ul>
      </div>
    </div>
  );
};
