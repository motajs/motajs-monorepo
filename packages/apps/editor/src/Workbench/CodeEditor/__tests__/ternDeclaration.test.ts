import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { buildTernDeclaration } from '../ternDeclaration';

describe('Tern declaration compatibility layer', () => {
  it('preserves aliases, documentation, function signatures and object returns', () => {
    const result = buildTernDeclaration(`var defs = [{
      "!name": "core",
      "!define": {
        "image": { "width": "number", "src": "string" },
        "flag": { "hard": { "!type": "number", "!doc": "当前难度" } },
        "hero": { "hp": { "!type": "number" } }
      },
      "core": {
        "material": { "images": "[image]" },
        "getStatus": {
          "!type": "fn(name: string, fallback?: flag) -> {value: number, ok: bool}",
          "!doc": "读取状态"
        }
      },
      "hero": { "!type": "heroStatus" },
      "flags": { "!type": "flag" }
    }];`);

    expect(result.diagnostics).toEqual([]);
    expect(result.declaration).toContain('type __MotaTern_image = {');
    expect(result.declaration).toContain('"images": Array<__MotaTern_image>');
    expect(result.declaration).toContain('fallback?: __MotaTern_flag');
    expect(result.declaration).toContain('=> { "value": number; "ok": boolean }');
    expect(result.declaration).toContain('declare let hero: __MotaTern_hero');
    expect(result.declaration).toContain('declare let flags: __MotaTern_flag');
    expect(result.declaration).toContain('读取状态');
  });

  it("converts the template's complete Tern JSON to valid TypeScript syntax", () => {
    const source = readFileSync(resolve(process.cwd(), '../../external/mota-js/_server/CodeMirror/defs.js'), 'utf8');
    const result = buildTernDeclaration(source);
    const file = ts.createSourceFile(
      'tern-compatibility.d.ts',
      result.declaration,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    expect(result.declaration.length).toBeGreaterThan(80_000);
    expect(result.declaration).toContain('type __MotaTern_flag');
    expect(result.declaration).toContain('"getSpecials"');
    expect(result.declaration).toContain('declare let hero: __MotaTern_hero');
    expect(result.declaration).toContain('declare let flags: __MotaTern_flag');
    expect(result.declaration).toContain('"drawDamage": (arg0: string | CanvasRenderingContext2D) => void');
    expect(
      file.parseDiagnostics.map((diagnostic) => ({
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
        start: diagnostic.start,
      })),
    ).toEqual([]);

    const options: ts.CompilerOptions = {
      lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
      noEmit: true,
      skipLibCheck: true,
    };
    const host = ts.createCompilerHost(options);
    const getSourceFile = host.getSourceFile.bind(host);
    host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) =>
      fileName === file.fileName ? file : getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
    host.fileExists = (fileName) => fileName === file.fileName || ts.sys.fileExists(fileName);
    const program = ts.createProgram([file.fileName], options, host);
    expect(
      program
        .getSemanticDiagnostics(file)
        .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')),
    ).toEqual([]);
  });

  it('augments the defs tree with runtime catalogs, open globals and forwarded functions', () => {
    const result = buildTernDeclaration(
      `var defs = [{
      "!name": "core",
      "!define": {
        "hero": { "hp": "number" },
        "flag": { "hard": "number" },
        "floor": {}, "enemy": {}, "item": {}, "image": {}, "audio": {}, "animate": {}
      },
      "core": {
        "status": { "hero": { "!type": "hero" }, "maps": {}, "bgmaps": {}, "fgmaps": {} },
        "material": { "items": {} },
        "flags": { "enableFloor": "bool" },
        "plugin": {},
        "enemys": { "hasSpecial": { "!type": "fn(special: number) -> bool", "!doc": "特殊属性" } }
      },
      "hero": { "!type": "heroStatus" },
      "flags": { "!type": "flag" }
    }];`,
      {
        modules: {
          plugin: [{ name: 'customPlugin', kind: 'function', parameters: ['floorId', 'callback'] }],
        },
        catalogs: {
          'material.items': [{ name: 'yellowKey', kind: 'object' }],
          'status.maps': [{ name: 'sample0', kind: 'object' }],
          'status.bgmaps': [{ name: 'sample0', kind: 'array' }],
          'status.hero.statistics': [{ name: 'moveDirectly', kind: 'number' }],
          flags: [{ name: 'statusBarItems', kind: 'array' }],
        },
        globals: {
          hero: [{ name: 'statistics', kind: 'object' }],
          flags: [{ name: 'runtimeFlag', kind: 'boolean' }],
        },
        projectFlags: ['projectFlag'],
        specials: [
          { id: 1, name: '先攻' },
          { id: 27, name: '自定义' },
        ],
      },
    );

    expect(result.declaration).toContain('"yellowKey": __MotaTern_item');
    expect(result.declaration).toContain('"sample0": __MotaTern_floor');
    expect(result.declaration).toContain('"sample0": Array<Array<number>>');
    expect(result.declaration).toContain('"moveDirectly": number');
    expect(result.declaration).toContain('"runtimeFlag": boolean');
    expect(result.declaration).toContain('"projectFlag": Record<string, any>');
    expect(result.declaration).toContain('"statusBarItems": Array<string>');
    expect(result.declaration).toContain('"customPlugin": (floorId: any, callback: any) => any');
    expect(result.declaration).toContain('type __MotaTern_hero =');
    expect(result.declaration).toContain('& Record<string, any>;');
    expect(result.declaration).toContain('type MotaEnemySpecialId = 1 | 27');
    expect(result.declaration).toContain('先攻(1); 自定义(27)');
    expect(result.declaration).toContain('declare let core: __MotaTernCore');
  });
});
