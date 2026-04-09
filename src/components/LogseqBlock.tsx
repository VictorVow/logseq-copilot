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
  // True for the top-level search-result block. Roots render the
  // "Show / Hide child blocks" toggle and own the deferred fetch state.
  // Nested descendants (isRoot=false) never render the toggle: they
  // always show their children inline when they have any, matching the
  // way a non-collapsed outline looks in Logseq desktop. Collapsed
  // descendants arrive with their `children` field already stripped by
  // the service-layer tree walker, so they naturally render as leaves.
  isRoot?: boolean;
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

// Renders one block and (for the root search hit) its on-demand fetched
// descendants. Nested descendants reuse the same component but skip the
// toggle: their children render inline automatically. Extracting this
// out of LogseqBlock also fixes a latent bug where marker state was
// aliased through blocks[0] for every item in a group.
const LogseqBlockItem = ({
  graph,
  block,
  isRoot = false,
}: LogseqBlockItemProps) => {
  const [checked, setChecked] = useState(false);
  const [status, setStatus] = useState('');
  const [showChildren, setShowChildren] = useState(false);
  const [fetchedChildren, setFetchedChildren] = useState<
    LogseqBlockType[] | undefined
  >(undefined);
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
      // Only roots fetch children, so only roots should react to the
      // fetch result. Nested items don't listen for this message at all.
      if (
        isRoot &&
        message?.type === 'get-block-children-result' &&
        message.uuid === block.uuid
      ) {
        setLoadingChildren(false);
        if (message.status === 'success') {
          setFetchedChildren(message.children ?? []);
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
  }, [block.uuid, block.marker, isRoot]);

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
    // If we already have the tree from a previous fetch, toggling is a
    // pure visibility flip. Otherwise kick off the deferred fetch.
    if (fetchedChildren !== undefined) {
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

  // Root items show the toggle and gate their fetched tree behind
  // showChildren state. Nested items always render whatever children
  // they arrived with (collapsed descendants already have `children`
  // stripped by the service-layer tree walker).
  const childrenToRender = isRoot
    ? showChildren
      ? fetchedChildren
      : undefined
    : block.children;

  const showToggleButton = isRoot && block.hasChildren === true;
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
      {showToggleButton && (
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
      {childrenToRender && childrenToRender.length > 0 && (
        <ul className={styles.childBlocks}>
          {childrenToRender.map((child) => (
            <LogseqBlockItem
              key={child.uuid}
              graph={graph}
              block={child}
              isRoot={false}
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
  // LogseqBlockItem. Top-level search hits are rendered as roots -- they
  // get the "Show child blocks" toggle. Their nested descendants (once
  // fetched) are rendered with isRoot=false and auto-expand.
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
            <LogseqBlockItem
              key={block.uuid}
              graph={graph}
              block={block}
              isRoot
            />
          ))}
        </ul>
      </div>
    </div>
  );
};
