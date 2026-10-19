import {
  Flex,
  Container,
  Heading,
  Text,
  Link,
  Divider,
  Alert,
  AlertIcon,
  AlertDescription,
  Button,
} from '@chakra-ui/react';
import { requestHostPermission, useHostPermission } from '@/hostPermission';
import { LogseqConnectOptions } from './components/Connect';
import { ClipNoteOptions } from './components/ClipNote';
import styles from './Options.module.scss';

const Options = () => {
  const hostPermission = useHostPermission();

  return (
    <Container className={styles.options} maxW={'56rem'} mt={'1rem'}>
      <Flex direction={'row'}>
        <Flex direction={'column'} w={'16rem'}>
          <Heading>Logseq Copilot</Heading>
          <Text>
            <Link
              href={`https://github.com/EINDEX/logseq-copilot/releases/tag/${process.env.VERSION}`}
            >
              {process.env.VERSION}
            </Link>
          </Text>
        </Flex>
        <Flex direction={'column'} w={'40rem'} gap={2}>
          {hostPermission === false && (
            <Alert status="warning" borderRadius="md">
              <AlertIcon />
              <AlertDescription flex={1}>
                Logseq Copilot doesn't have access to websites, so it only
                works after clicking its toolbar button.
              </AlertDescription>
              <Button size="sm" onClick={requestHostPermission}>
                Allow on all sites
              </Button>
            </Alert>
          )}

          <LogseqConnectOptions />

          <Divider />

          <ClipNoteOptions />
        </Flex>
      </Flex>
    </Container>
  );
};

export default Options;
