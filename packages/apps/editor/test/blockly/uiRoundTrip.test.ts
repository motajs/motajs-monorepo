import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import JSON5 from 'json5';
import path from 'node:path';

import { registerAllBlocks } from '@/blockly/blocks';
import { dataToWorkspaceStateWithEntry, eventsToWorkspaceState } from '@/blockly/parser';
import { MOTA_JS_ROOT } from '../../mota-root';

beforeAll(() => registerAllBlocks());

describe('UI event schemas', () => {
  it('round-trips the sample project startCanvas without losing branches', () => {
    const source = readFileSync(path.join(MOTA_JS_ROOT, 'project/data.js'), 'utf8');
    const context: Record<string, unknown> = {};
    runInNewContext(source, context);
    const data = context.data_a1e2fb4a_e986_4524_b0da_9b7ba7c0874d as {
      firstData: { startCanvas: unknown[] };
    };
    const events = structuredClone(data.firstData.startCanvas);
    const workspace = new Blockly.Workspace();
    Blockly.serialization.workspaces.load(eventsToWorkspaceState(events as never[]), workspace);
    javascriptGenerator.init(workspace);
    const generated = javascriptGenerator.blockToCode(workspace.getTopBlocks(false)[0]);
    const code = Array.isArray(generated) ? generated[0] : generated;

    expect(JSON5.parse(`[${code.trim().replace(/,$/, '')}]`)).toEqual(events);
    javascriptGenerator.finish('');
    workspace.dispose();
  });

  it('round-trips a previewUI tree through real Blockly blocks', () => {
    const events = [
      {
        type: 'previewUI',
        action: [
          { type: 'fillRect', x: 0, y: 0, width: 'flag:x', height: 300, style: [0, 0, 0, 0.6] },
          { type: 'setAttribute', align: 'center' },
          { type: 'fillBoldText', x: 208, y: 80, text: '开始游戏', strokeStyle: [0, 0, 0, 1] },
        ],
      },
    ];
    const workspace = new Blockly.Workspace();
    Blockly.serialization.workspaces.load(eventsToWorkspaceState(events), workspace);
    javascriptGenerator.init(workspace);

    const top = workspace.getTopBlocks(false)[0];
    const generated = javascriptGenerator.blockToCode(top);
    const code = Array.isArray(generated) ? generated[0] : generated;
    const roundTripped = JSON.parse(`[${code.trim().replace(/,$/, '')}]`);

    expect(roundTripped).toEqual(events);
    javascriptGenerator.finish('');
    workspace.dispose();
  });

  it('keeps optional drawSelector and clearMap fields absent', () => {
    const events = [{ type: 'drawSelector', code: 1 }, { type: 'clearMap' }];
    const workspace = new Blockly.Workspace();
    Blockly.serialization.workspaces.load(eventsToWorkspaceState(events), workspace);
    javascriptGenerator.init(workspace);
    const generated = javascriptGenerator.blockToCode(workspace.getTopBlocks(false)[0]);
    const code = Array.isArray(generated) ? generated[0] : generated;

    expect(JSON.parse(`[${code.trim().replace(/,$/, '')}]`)).toEqual(events);
    javascriptGenerator.finish('');
    workspace.dispose();
  });

  it('preserves wait keyboard and mouse branches', () => {
    const events = [
      {
        type: 'wait',
        forceChild: true,
        data: [
          { case: 'keyboard', keycode: '13,32', break: true, action: [{ type: 'comment', text: '确定' }] },
          { case: 'mouse', px: [10, 20], py: [30, 40], action: [{ type: 'break', n: 1 }] },
        ],
      },
    ];
    const workspace = new Blockly.Workspace();
    Blockly.serialization.workspaces.load(eventsToWorkspaceState(events), workspace);
    javascriptGenerator.init(workspace);
    const generated = javascriptGenerator.blockToCode(workspace.getTopBlocks(false)[0]);
    const code = Array.isArray(generated) ? generated[0] : generated;

    expect(JSON.parse(`[${code.trim().replace(/,$/, '')}]`)).toEqual(events);
    javascriptGenerator.finish('');
    workspace.dispose();
  });

  it('preserves compound control fields from the legacy Blockly definitions', () => {
    const events = [
      {
        type: 'choices',
        text: '\\t[流浪者,trader]请选择',
        timeout: 1500,
        width: 260,
        choices: [
          {
            text: '红钥匙',
            icon: 'redKey',
            color: [255, 0, 0, 1],
            need: 'item:redKey',
            condition: 'flag:showKey',
            action: [{ type: 'comment', text: 'selected' }],
          },
        ],
      },
      {
        type: 'confirm',
        text: '确认继续吗？',
        timeout: 800,
        default: true,
        yes: [{ type: 'comment', text: 'yes' }],
        no: [{ type: 'comment', text: 'no' }],
      },
      {
        type: 'switch',
        condition: 'flag:selection',
        caseList: [{ case: '1', nobreak: true, action: [{ type: 'comment', text: 'case' }] }],
      },
    ];
    const workspace = new Blockly.Workspace();
    Blockly.serialization.workspaces.load(eventsToWorkspaceState(events), workspace);
    javascriptGenerator.init(workspace);
    const generated = javascriptGenerator.blockToCode(workspace.getTopBlocks(false)[0]);
    const code = Array.isArray(generated) ? generated[0] : generated;

    expect(JSON5.parse(`[${code.trim().replace(/,$/, '')}]`)).toEqual(events);
    javascriptGenerator.finish('');
    workspace.dispose();
  });

  it('loads and round-trips the doorInfo entry with key blocks', () => {
    const doorInfo = {
      time: 240,
      openSound: 'open.mp3',
      closeSound: 'close.mp3',
      keys: { yellowKey: 1, 'orangeKey:o': 2 },
      afterOpenDoor: [{ type: 'comment', text: 'opened' }],
    };
    const workspace = new Blockly.Workspace();
    Blockly.serialization.workspaces.load(dataToWorkspaceStateWithEntry(doorInfo, 'doorInfo'), workspace);
    javascriptGenerator.init(workspace);

    const top = workspace.getTopBlocks(false)[0];
    expect(top.type).toBe('mota_doorInfo_m');
    expect(top.getInputTargetBlock('KEYS')?.type).toBe('mota_doorKeyUnknown');
    expect(top.getInputTargetBlock('KEYS')?.getNextBlock()?.type).toBe('mota_doorKeyKnown');
    expect(top.getInputTargetBlock('AFTER_OPEN_DOOR')?.type).toBe('mota_comment_s');

    const generated = javascriptGenerator.blockToCode(top);
    const code = Array.isArray(generated) ? generated[0] : generated;
    expect(JSON5.parse(code)).toEqual(doorInfo);
    javascriptGenerator.finish('');
    workspace.dispose();
  });
});
