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
  const isWebView = isRunningInAndroidWebView();
  let maxViewportHeight = window.visualViewport?.height || window.innerHeight;
  let webViewFallbackTimer: number | null = null;
  let webViewFallbackActive = false;

  const isTextInputEl = (el: HTMLElement | null): boolean => {
    if (!el) return false;
    if (el.tagName === 'TEXTAREA') return true;
    if (el.tagName === 'INPUT') {
      const type = (el as HTMLInputElement).type;
      return !['checkbox', 'radio', 'file', 'hidden', 'range', 'button', 'submit', 'reset'].includes(type);
    }
    return el.isContentEditable;
  };

  const syncKeyboardInset = () => {
    const vv = window.visualViewport;
    const vvHeight = vv ? vv.height : window.innerHeight;
    const vvOffsetTop = vv ? vv.offsetTop : 0;
    if (vvHeight > maxViewportHeight) {
      maxViewportHeight = vvHeight;
    }
    const inset = Math.max(0, Math.round(maxViewportHeight - vvHeight));
    const nativeInset = inset > 90 ? inset : 0;

    // If native visualViewport resized, cancel any fallback
    if (nativeInset > 0) {
      webViewFallbackActive = false;
    }

    const fallbackInset =
      nativeInset === 0 && webViewFallbackActive
        ? Math.round(Math.min(340, Math.max(260, maxViewportHeight * 0.37)))
        : 0;
    const effectiveInset = nativeInset || fallbackInset;
    const appHeight = Math.max(280, Math.round(vvHeight - fallbackInset));

    document.documentElement.style.setProperty('--app-height', `${appHeight}px`);
    document.documentElement.style.setProperty('--vv-offset-top', `${Math.round(vvOffsetTop)}px`);
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
      webViewFallbackActive = false;
      syncKeyboardInset();
    }, 150);
  });

  document.addEventListener('focusin', (e) => {
    const target = e.target as HTMLElement | null;
    if (!isTextInputEl(target)) return;

    if (isWebView) {
      if (webViewFallbackTimer !== null) {
        window.clearTimeout(webViewFallbackTimer);
      }
      webViewFallbackTimer = window.setTimeout(() => {
        const vvHeight = window.visualViewport?.height || window.innerHeight;
        if (maxViewportHeight - vvHeight <= 90 && isTextInputEl(document.activeElement as HTMLElement | null)) {
          webViewFallbackActive = true;
          syncKeyboardInset();
        }
      }, 220);
    }

    window.setTimeout(() => {
      target?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 260);
  });

  document.addEventListener('focusout', () => {
    if (!isWebView) return;
    if (webViewFallbackTimer !== null) {
      window.clearTimeout(webViewFallbackTimer);
      webViewFallbackTimer = null;
    }
    window.setTimeout(() => {
      if (!isTextInputEl(document.activeElement as HTMLElement | null)) {
        if (webViewFallbackActive) {
          webViewFallbackActive = false;
          syncKeyboardInset();
        }
      }
    }, 120);
  });
}

createRoot(document.getElementById('root')!).render(<App />);
