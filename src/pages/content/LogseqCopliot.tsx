import React, { useEffect, useState } from 'react';
import { LogseqSearchResult } from '@/types/logseqBlock';
import { LogseqResponseType } from '../logseq/client';
import Browser from 'webextension-polyfill';
import styles from './index.module.scss';
import LogseqCopilot from '@components/LogseqCopilot';
import FloatingButton from '@components/FloatingButton';
import SidePanel from '@components/SidePanel';

type LogseqCopliotProps = {
  connect: Browser.Runtime.Port;
};

export const LogseqCopliot = ({ connect }: LogseqCopliotProps) => {
  const [msg, setMsg] = useState('Loading...');
  const [logseqSearchResult, setLogseqSearchResult] =
    useState<LogseqSearchResult>();
  const [isPanelOpen, setPanelOpen] = useState(false);

  // Register the port listener once. Without useEffect this would re-register
  // on every render, which becomes a leak the moment isPanelOpen triggers
  // a re-render.
  useEffect(() => {
    const listener = (resp: LogseqResponseType<LogseqSearchResult>) => {
      setMsg(resp.msg);
      setLogseqSearchResult(resp.response);
    };
    connect.onMessage.addListener(listener);
    return () => connect.onMessage.removeListener(listener);
  }, [connect]);

  const goOptionPage = () => {
    Browser.runtime.sendMessage({ type: 'open-options' });
  };

  const loaded = msg !== 'Loading...';
  const count =
    (logseqSearchResult?.pages.length ?? 0) +
    (logseqSearchResult?.blocks.length ?? 0);

  const statusShower = () => {
    if (msg === 'success') {
      return (
        <LogseqCopilot
          graph={logseqSearchResult?.graph || ''}
          blocks={logseqSearchResult?.blocks || []}
          pages={logseqSearchResult?.pages || []}
        />
      );
    } else if (loaded) {
      return (
        <button className={styles.configIt} onClick={goOptionPage}>
          Config it
        </button>
      );
    }
    return <></>;
  };

  return (
    <>
      <FloatingButton
        count={count}
        isOpen={isPanelOpen}
        loaded={loaded}
        onClick={() => setPanelOpen((v) => !v)}
      />
      <SidePanel
        isOpen={isPanelOpen}
        onClose={() => setPanelOpen(false)}
        title="Logseq Copilot"
      >
        <div className={styles.copilotBody}>{statusShower()}</div>
        <div className={styles.copilotFooter}>
          <span>
            <a href="https://github.com/EINDEX/logseq-copilot/issues">
              Feedback
            </a>
          </span>
          <span>
            power by{' '}
            <a href="https://logseq-copilot.eindex.me/">Logseq Copliot</a>
          </span>
        </div>
      </SidePanel>
    </>
  );
};
