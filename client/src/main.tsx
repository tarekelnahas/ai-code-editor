import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './styles/theme.css';

// Create the root element and render the application. StrictMode
// highlights potential problems during development but is stripped in
// production builds. The #root div is defined in index.html.

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);