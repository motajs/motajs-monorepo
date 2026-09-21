import { describe, expect, it } from 'vitest';
import { parseEditorEnvironment } from './environment';

function environmentDocument(value: unknown): Document {
  const source = document.implementation.createHTMLDocument();
  const base = source.createElement('base');
  base.href = 'https://example.test/editor/';
  source.head.appendChild(base);
  const script = source.createElement('script');
  script.id = 'mota-editor-environment';
  script.textContent = JSON.stringify(value);
  source.head.appendChild(script);
  return source;
}

describe('editor environment', () => {
  it('resolves all host endpoints against the injected document base', () => {
    const result = parseEditorEnvironment(
      environmentDocument({
        protocolVersion: 1,
        endpoints: {
          fs: '../api/fs/',
          runtime: './runtime.html',
          preview: '../preview/',
          docs: '../preview/_docs/',
          project: '../project/',
        },
      }),
    );
    expect(result.endpoints).toEqual({
      fs: 'https://example.test/api/fs/',
      runtime: 'https://example.test/editor/runtime.html',
      preview: 'https://example.test/preview/',
      docs: 'https://example.test/preview/_docs/',
      project: 'https://example.test/project/',
    });
  });

  it('accepts optional release identity and update capability', () => {
    const result = parseEditorEnvironment(
      environmentDocument({
        protocolVersion: 1,
        release: { buildId: 'build-2', version: '2.0.0' },
        endpoints: {
          fs: '../api/fs/',
          runtime: './runtime.html',
          preview: '../preview/',
          docs: '../preview/_docs/',
          project: '../project/',
          update: '../api/editor-update/',
        },
      }),
    );
    expect(result.release).toEqual({ buildId: 'build-2', version: '2.0.0' });
    expect(result.endpoints.update).toBe('https://example.test/api/editor-update/');
  });

  it('accepts an environment without project documentation', () => {
    const result = parseEditorEnvironment(
      environmentDocument({
        protocolVersion: 1,
        endpoints: {
          fs: '/api/fs/',
          runtime: '/runtime.html',
          preview: '/preview/',
          project: '/project/',
        },
      }),
    );
    expect(result.endpoints.docs).toBeUndefined();
  });

  it('rejects missing, duplicate, and incompatible configuration', () => {
    expect(() => parseEditorEnvironment(document.implementation.createHTMLDocument())).toThrow('exactly one');
    const duplicate = environmentDocument({ protocolVersion: 1, endpoints: {} });
    duplicate.head.appendChild(duplicate.querySelector('script')!.cloneNode(true));
    expect(() => parseEditorEnvironment(duplicate)).toThrow('exactly one');
    expect(() => parseEditorEnvironment(environmentDocument({ protocolVersion: 2, endpoints: {} }))).toThrow(
      'Unsupported',
    );
  });

  it('rejects missing endpoints', () => {
    expect(() =>
      parseEditorEnvironment(
        environmentDocument({
          protocolVersion: 1,
          endpoints: { fs: '/', runtime: '/runtime.html' },
        }),
      ),
    ).toThrow("endpoint 'preview'");
  });

  it('rejects malformed optional update capabilities', () => {
    const endpoints = {
      fs: '/api/fs/',
      runtime: '/runtime.html',
      preview: '/preview/',
      docs: '/docs/',
      project: '/project/',
    };
    expect(() =>
      parseEditorEnvironment(
        environmentDocument({
          protocolVersion: 1,
          release: { buildId: '', version: '2.0.0' },
          endpoints,
        }),
      ),
    ).toThrow('buildId');
    expect(() =>
      parseEditorEnvironment(
        environmentDocument({
          protocolVersion: 1,
          endpoints: { ...endpoints, update: '' },
        }),
      ),
    ).toThrow("endpoint 'update'");
    expect(() =>
      parseEditorEnvironment(
        environmentDocument({
          protocolVersion: 1,
          endpoints: { ...endpoints, docs: '' },
        }),
      ),
    ).toThrow("endpoint 'docs'");
  });
});
