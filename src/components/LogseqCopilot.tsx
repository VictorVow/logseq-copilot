import { IconSettings } from '@tabler/icons-react';
import styles from './logseq.module.scss';
import Browser from 'webextension-polyfill';
import { LogseqBlock } from './LogseqBlock';
import LogseqPageLink from './LogseqPage';
import { LogseqProperties } from './LogseqProperties';

const LogseqCopilot = ({ graph, pages, blocks }) => {
  const goOptionPage = () => {
    Browser.runtime.sendMessage({ type: 'open-options' });
  };

  const groupedBlocks = blocks.reduce((groups, item) => {
    const group = (groups[item.page.name] || []);
    group.push(item);
    groups[item.page.name] = group;
    return groups;
  }, {});

  const count = () => {
    return pages.length + blocks.length;
  };

  const blocksRender = () => {
    if (blocks.length === 0) {
      return <></>;
    }
    return (
      <div className={styles.blocks}>
        {Object.entries(groupedBlocks).map(([key, blocks], i) => {
          return <LogseqBlock key={key} blocks={blocks} graph={graph} />;
        })}
      </div>
    );
  };

  const pagesRender = () => {
    if (pages.length === 0) {
      return <></>;
    }
    // Pages with user-defined properties get rendered as full-width cards
    // so the property list has room to breathe; bare pages stay in the
    // compact 3-column grid to preserve density when there's nothing
    // extra to show.
    const pagesWithProps = pages.filter(
      (page: any) => page && page.properties && page.properties.length > 0,
    );
    const pagesWithoutProps = pages.filter(
      (page: any) =>
        page && (!page.properties || page.properties.length === 0),
    );
    return (
      <>
        {pagesWithProps.length > 0 && (
          <div className={styles.pageCards}>
            {pagesWithProps.map((page: any) => (
              <div key={page.name} className={styles.pageCard}>
                <LogseqPageLink graph={graph} page={page}></LogseqPageLink>
                <LogseqProperties properties={page.properties} />
              </div>
            ))}
          </div>
        )}
        {pagesWithoutProps.length > 0 && (
          <div className={styles.pages}>
            {pagesWithoutProps.slice(0, 9).map((page: any) => (
              <div key={page.name} className={styles.page}>
                <LogseqPageLink graph={graph} page={page}></LogseqPageLink>
              </div>
            ))}
          </div>
        )}
      </>
    );
  };

  if (count() === 0) {
    return (
      <span>
        Nothing here, Do some research with Logseq!{' '}
        <a href={`logseq://graph/${graph}`}>Go</a>
      </span>
    );
  }

  return (
    <>
      <div className={styles.copilotCardHeader}>
        <span>Graph: {graph}</span>
        <IconSettings onClick={goOptionPage} size={16} />
      </div>
      {pagesRender()}
      {blocksRender()}
    </>
  );
};

export default LogseqCopilot;
