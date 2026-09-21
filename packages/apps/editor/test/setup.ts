const environment = document.createElement('script');
environment.id = 'mota-editor-environment';
environment.type = 'application/json';
environment.textContent = JSON.stringify({
  protocolVersion: 1,
  endpoints: {
    fs: '/',
    runtime: '/runtime.html',
    preview: '/game.html',
    docs: '/_docs/',
    project: '/',
  },
});
document.head.appendChild(environment);
