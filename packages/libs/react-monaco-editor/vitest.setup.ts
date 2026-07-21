if (!document.queryCommandSupported) {
  document.queryCommandSupported = () => false;
}

globalThis.CSS ??= {} as typeof CSS;
CSS.escape ??= (value) => value.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`);

window.matchMedia ??= (query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent: () => false,
});
