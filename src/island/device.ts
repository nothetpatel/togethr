/**
 * True for WebKit browsers: Safari on Mac, and every browser on iPhone/iPad
 * (Apple requires them all to use WebKit). Their WebGL renders the default
 * soft (PCF) shadow maps as if everything were in shadow, so they get basic
 * shadow maps instead.
 */
export function isWebKit(): boolean {
  const ua = navigator.userAgent;
  const iOS = /iP(hone|ad|od)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const desktopSafari = /^((?!chrome|chromium|android|crios|fxios|edg).)*safari/i.test(ua);
  return iOS || desktopSafari;
}
