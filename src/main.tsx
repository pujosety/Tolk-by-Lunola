import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { isRunningInAndroidWebView } from './lib/androidBridge';
import './index.css';

if (typeof window !== 'undefined') {
  const isStandalone =
    isRunningInAndroidWebView() ||
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    (window.navigator as { standalone?: boolean }).standalone === true;
  if (isStandalone) {
    document.documentElement.classList.add('is-standalone-app');
  }
  let maxViewportHeight = window.visualViewport?.height || window.innerHeight;

  const syncKeyboardInset = () => {
    const vv = window.visualViewport;
    if (!vv) return;
    if (vv.height > maxViewportHeight) {
      maxViewportHeight = vv.height;
    }
    const inset = Math.max(0, Math.round(maxViewportHeight - vv.height));
    const effectiveInset = inset > 90 ? inset : 0;
    document.documentElement.style.setProperty('--app-height', `${Math.round(vv.height)}px`);
    document.documentElement.style.setProperty('--vv-offset-top', `${Math.round(vv.offsetTop)}px`);
    document.documentElement.style.setProperty('--keyboard-inset', `${effectiveInset}px`);
    if (effectiveInset > 0) {
      document.documentElement.setAttribute('data-keyboard-open', 'true');
    } else {
      document.documentElement.removeAttribute('data-keyboard-open');
    }
  };

  syncKeyboardInset();
  window.visualViewport?.addEventListener('resize', syncKeyboardInset);
  window.visualViewport?.addEventListener('scroll', syncKeyboardInset);
  window.addEventListener('orientationchange', () => {
    window.setTimeout(() => {
      maxViewportHeight = window.visualViewport?.height || window.innerHeight;
      syncKeyboardInset();
    }, 150);
  });

  document.addEventListener('focusin', (e) => {
    const target = e.target as HTMLElement | null;
    if (!target || (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA')) return;
    window.setTimeout(() => {
      target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 150);
  });
}

createRoot(document.getElementById('root')!).render(<App />);
