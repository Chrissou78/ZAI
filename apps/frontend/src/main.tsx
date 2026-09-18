import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n';
import App from './App';
import './styles/globals.css';

// ══════════════════════════════════════════════════════════════
// Force https before anything else runs.
//
// The edge already 301s http → https, but nothing stops a browser from trying
// http first — there is no HSTS header — and a tab already open on http keeps
// running there. On such a page the origin is "http://experience.zai.ch",
// which is not in the API's CORS allowlist, so the WalletTwo token arrived
// fine and then POST /api/auth/login was blocked by the browser, leaving the
// user with a bare "Login failed". Stripe.js refuses to run on http at all.
//
// Allowing the http origin through CORS would unbreak login while leaving
// payments broken and tokens travelling in clear, so the page fixes its own
// protocol instead. This runs before render, so no request is ever made from
// the insecure origin.
// ══════════════════════════════════════════════════════════════
const isInsecure =
  window.location.protocol === 'http:' &&
  window.location.hostname !== 'localhost' &&
  window.location.hostname !== '127.0.0.1';

if (isInsecure) {
  const { host, pathname, search, hash } = window.location;
  window.location.replace(`https://${host}${pathname}${search}${hash}`);
} else {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
