import pathUtils from 'path';

import { accessProjectById, invalidateProject, type ProjectFs } from './project';
import { errorResponse, HttpError, ResponseUtils } from './utils';

const ENCODINGS = new Map<string, BufferEncoding>([
  ['utf8', 'utf8'],
  ['utf-8', 'utf8'],
  ['base64', 'base64'],
]);

export const normalizeProjectPath = (input: string, allowEmpty = false): string => {
  if (/[\u0000-\u001f\u007f-\u009f]/.test(input) || input.includes('\\') || input.startsWith('/')) {
    throw new HttpError(400, 'invalid-path', 'Project path must be relative', input);
  }
  const segments = input.split('/');
  if (segments.some((segment) => segment === '..')) {
    throw new HttpError(400, 'invalid-path', 'Project path cannot escape the project root', input);
  }
  const normalized = pathUtils.posix.normalize(input).replace(/^\.\//, '');
  if ((!normalized || normalized === '.') && !allowEmpty) {
    throw new HttpError(400, 'invalid-path', 'Project path cannot be empty', input);
  }
  return normalized === '.' ? '' : normalized;
};

const requireParam = (params: URLSearchParams, name: string): string => {
  const value = params.get(name);
  if (value === null) throw new HttpError(400, 'missing-parameter', `Missing parameter: ${name}`);
  return value;
};

const encodingParam = (params: URLSearchParams): BufferEncoding => {
  const raw = requireParam(params, 'type').toLowerCase();
  const encoding = ENCODINGS.get(raw);
  if (!encoding) throw new HttpError(400, 'invalid-encoding', `Unsupported encoding: ${raw}`);
  return encoding;
};

const performOperation = async (fs: ProjectFs, operation: string, params: URLSearchParams): Promise<Response> => {
  switch (operation) {
    case 'readFile': {
      const path = normalizeProjectPath(requireParam(params, 'name'));
      const value = await fs.promises.readFile(path, { encoding: encodingParam(params) });
      return ResponseUtils.text(value as string, { headers: { 'cache-control': 'no-store' } });
    }
    case 'writeFile': {
      const path = normalizeProjectPath(requireParam(params, 'name'));
      const value = requireParam(params, 'value');
      await fs.promises.writeFile(path, value, { encoding: encodingParam(params) });
      return Response.json(value.length, { headers: { 'cache-control': 'no-store' } });
    }
    case 'writeMultiFiles': {
      const paths = requireParam(params, 'name').split(';');
      const values = requireParam(params, 'value').split(';');
      if (paths.length !== values.length) {
        throw new HttpError(400, 'length-mismatch', 'name and value counts do not match');
      }
      const normalized = paths.map((path) => {
        if (path.includes(';')) throw new HttpError(400, 'invalid-path', 'File name cannot contain semicolons', path);
        return normalizeProjectPath(path);
      });
      await Promise.all(
        normalized.map((path, index) => fs.promises.writeFile(path, values[index]!, { encoding: 'base64' })),
      );
      return Response.json(normalized.length, { headers: { 'cache-control': 'no-store' } });
    }
    case 'listFile': {
      const path = normalizeProjectPath(requireParam(params, 'name'), true);
      const list = (await fs.promises.readdir(path)) as string[];
      return Response.json(list, { headers: { 'cache-control': 'no-store' } });
    }
    case 'makeDir': {
      const path = normalizeProjectPath(requireParam(params, 'name'));
      await fs.promises.mkdir(path, { recursive: true });
      return ResponseUtils.text('', { headers: { 'cache-control': 'no-store' } });
    }
    case 'moveFile': {
      const src = normalizeProjectPath(requireParam(params, 'src'));
      const dest = normalizeProjectPath(requireParam(params, 'dest'));
      await fs.promises.rename(src, dest);
      return Response.json(true, { headers: { 'cache-control': 'no-store' } });
    }
    case 'deleteFile': {
      const path = normalizeProjectPath(requireParam(params, 'name'));
      await fs.promises.unlink(path);
      return Response.json(true, { headers: { 'cache-control': 'no-store' } });
    }
    default:
      throw new HttpError(404, 'unknown-operation', `Unknown file operation: ${operation}`);
  }
};

export const handleFsRequest = async (projectId: number, operation: string, request: Request): Promise<Response> => {
  if (request.method !== 'POST') {
    return ResponseUtils.error(405, 'method-not-allowed', 'File operations require POST');
  }
  const access = await accessProjectById(projectId);
  if (access.status === 'not-found') return ResponseUtils.error(404, 'project-not-found', 'Project not found');
  if (access.status === 'permission-required') {
    return ResponseUtils.error(403, 'project-permission-required', 'Project permission is required');
  }
  const params = new URLSearchParams(await request.text());
  const requestPath = params.get('name') ?? undefined;
  try {
    return await performOperation(access.fs, operation, params);
  } catch (error) {
    const candidate = error as { name?: string; code?: string };
    if (candidate?.name === 'NotAllowedError' || candidate?.code === 'EACCES') invalidateProject(projectId);
    return errorResponse(error, requestPath);
  }
};
