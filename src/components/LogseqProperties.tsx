import { RenderedProperty } from '@/types/logseqBlock';
import styles from './logseq.module.scss';

type LogseqPropertiesProps = {
  properties?: RenderedProperty[];
};

export const LogseqProperties = ({ properties }: LogseqPropertiesProps) => {
  if (!properties || properties.length === 0) {
    return null;
  }
  return (
    <dl className={styles.blockProperties}>
      {properties.map((prop) => (
        <div key={prop.name} className={styles.propertyRow}>
          <dt className={styles.propertyKey}>{prop.name}</dt>
          <dd className={styles.propertyValue}>
            {prop.values.length > 0 ? prop.values.join(', ') : 'Empty'}
          </dd>
        </div>
      ))}
    </dl>
  );
};
