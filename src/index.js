import React from 'react';
import ReactDOM from 'react-dom/client';
import ComposerDashboard from './ComposerDashboard';
import './index.css'; // optional, for Tailwind styles or any CSS

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ComposerDashboard />
  </React.StrictMode>
);
