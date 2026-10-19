import Browser from 'webextension-polyfill';
import { useEffect, useState, useRef } from 'react';
import React from 'react';
import { IconSettings } from '@tabler/icons-react';

import styles from './index.module.scss';
import { getLogseqService } from '@pages/logseq/tool';
import { requestHostPermission, useHostPermission } from '@/hostPermission';

export default function Popup() {
  const [graphName, setGraphName] = useState<string>('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hostPermission = useHostPermission();

  useEffect(() => {
    (async () => {
      try {
        const service = await getLogseqService();
        const name = await service.getGraph();
        setGraphName(name);
      } catch {
        setGraphName('(not connected)');
      }
    })();
  }, []);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const openSettingsPage = () => {
    Browser.runtime.sendMessage({ type: 'open-options' });
  };

  const addToLogseq = async () => {
    if (!content.trim() || status === 'sending') return;
    setStatus('sending');
    try {
      await Browser.runtime.sendMessage({
        type: 'clip-with-selection',
        data: content.trim(),
      });
      setStatus('sent');
      setContent('');
    } catch {
      setStatus('error');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      addToLogseq();
    }
  };

  return (
    <div className="copilot">
      <div className={styles.content}>
        <div className={styles.copilotCardHeader}>
          <span>Graph: {graphName}</span>
          <IconSettings size={16} onClick={openSettingsPage} />
        </div>
        {hostPermission === false && (
          <div className={styles.permissionBanner}>
            <span>Logseq Copilot can't access websites until you allow it.</span>
            <button onClick={requestHostPermission}>Allow on all sites</button>
          </div>
        )}
        <textarea
          ref={textareaRef}
          className={styles.captureInput}
          placeholder="Type or paste content to add to Logseq..."
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            if (status !== 'idle') setStatus('idle');
          }}
          onKeyDown={handleKeyDown}
        />
        <button
          className={styles.addButton}
          onClick={addToLogseq}
          disabled={!content.trim() || status === 'sending'}
        >
          {status === 'sending' ? 'Adding...' : status === 'sent' ? 'Added!' : 'Add to Logseq'}
        </button>
      </div>
    </div>
  );
}
