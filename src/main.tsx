import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createTheme, MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import './styles.css';
import App from './App';

// ox_lib runs Mantine v6 — reuse its dark palette, Roboto and shadow so components look identical
const theme = createTheme({
  fontFamily: 'Roboto, sans-serif',
  headings: { fontFamily: 'Roboto, sans-serif' },
  primaryColor: 'blue',
  primaryShade: 8,
  shadows: { sm: '1px 1px 3px rgba(0, 0, 0, 0.5)' },
  components: { Button: { styles: { root: { border: 'none' } } } },
  colors: {
    dark: ['#C1C2C5', '#A6A7AB', '#909296', '#5c5f66', '#373A40', '#2C2E33', '#25262b', '#1A1B1E', '#141517', '#101113'],
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} forceColorScheme="dark">
      <App />
    </MantineProvider>
  </StrictMode>,
);
