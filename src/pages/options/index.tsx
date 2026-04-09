import { createRoot } from 'react-dom/client';
import Options from './Options';
import './index.scss';
import {
  ChakraProvider,
  ColorModeScript,
  extendTheme,
  type ThemeConfig,
} from '@chakra-ui/react';

const config: ThemeConfig = {
  initialColorMode: 'system',
  useSystemColorMode: true,
};

const theme = extendTheme({ config });

const container = document.getElementById('app-container');
const root = createRoot(container!);
root.render(
  <>
    <ColorModeScript initialColorMode={theme.config.initialColorMode} />
    <ChakraProvider theme={theme}>
      <Options />
    </ChakraProvider>
  </>,
);
