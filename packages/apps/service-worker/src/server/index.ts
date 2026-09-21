import { defineRoute, MessageServer } from '@motajs/utils/advance/message';

import {
  ActivateProjectMessage,
  ForgetProjectMessage,
  GetEditorHostStatusMessage,
  GetProjectMessage,
  ListProjectMessage,
  RegisterProjectMessage,
} from '@/idl';
import { cleanupCaches } from './cache';
import {
  activateProject,
  forgetProject,
  getProjectDetails,
  listProject,
  registerProject,
  toProjectAccessResult,
} from './project';
import { routeRequest } from './router';
import { getEditorHostStatus } from './editorRelease';

const sw = self as unknown as ServiceWorkerGlobalScope;
const scopeUrl = new URL('./', sw.location.href);

sw.addEventListener('install', (event) => {
  event.waitUntil(sw.skipWaiting());
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([clients.claim(), cleanupCaches()]));
});

const messageServer = new MessageServer([
  defineRoute(RegisterProjectMessage, async ({ handle }) => ({ id: await registerProject(handle) })),
  defineRoute(ForgetProjectMessage, async ({ id }) => {
    await forgetProject(id);
  }),
  defineRoute(ListProjectMessage, async () => ({ list: await listProject() })),
  defineRoute(GetProjectMessage, async ({ id }) => getProjectDetails(id)),
  defineRoute(ActivateProjectMessage, async ({ id }) => toProjectAccessResult(await activateProject(id))),
  defineRoute(GetEditorHostStatusMessage, async () => await getEditorHostStatus(scopeUrl)),
]);

sw.addEventListener('message', (event) => {
  const task = (async () => {
    if (!event.source || !('url' in event.source)) return;
    const sourceUrl = new URL(event.source.url);
    if (sourceUrl.origin !== sw.location.origin) return;
    const response = await messageServer.serve(event.data);
    if (response) event.source.postMessage(response);
  })();
  event.waitUntil(task);
});

sw.addEventListener('fetch', (event) => {
  const backgroundTasks: Promise<unknown>[] = [];
  const clientId = event.resultingClientId || event.clientId || undefined;
  const task = routeRequest(event.request, scopeUrl, (background) => backgroundTasks.push(background), {
    clientId,
  }).then((response) => response ?? fetch(event.request));
  event.respondWith(task);
  event.waitUntil(
    task.then(async () => {
      await Promise.allSettled(backgroundTasks);
    }),
  );
});
