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
  const syncKeyboardInset = () => {
    const vv = window.visualViewport;
    if (!vv) return;
    const inset = Math.max(0, Math.round(window.innerHeight - (vv.height + vv.offsetTop)));
    const effectiveInset = inset > 90 ? inset : 0;
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

  document.addEventListener('focusin', (e) => {
    const target = e.target as HTMLElement | null;
    if (!target || (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA')) return;
    window.setTimeout(() => {
      target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 150);
  });
}

createRoot(document.getElementById('root')!).render(<App />);
