import React from 'react';
import * as ReactDOM from 'react-dom/client';

import DesktopLyricsWindow from './components/DesktopLyricsWindow';

import 'normalize.css/normalize.css';
import './global.css';
import './desktop-lyrics.css';

const wrap = document.getElementById('wrap');

if (wrap === null) {
  throw new Error('Failed to find the desktop lyrics root element');
}

ReactDOM.createRoot(wrap).render(
  <React.StrictMode>
    <DesktopLyricsWindow />
  </React.StrictMode>,
);
