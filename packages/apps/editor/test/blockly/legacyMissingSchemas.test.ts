import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';
import JSON5 from 'json5';
import { beforeAll, describe, expect, it } from 'vitest';

import { registerAllBlocks, blockRegistry } from '@/blockly/blocks';
import { withDisabledBlocksEnabled } from '@/blockly/registry';
import { eventsToWorkspaceState } from '@/blockly/parser';
import { parseEvent } from '@/blockly/parser/eventToState';
import { getBlocksByCategory } from '@/blockly/toolbox';

beforeAll(() => registerAllBlocks());

function roundTrip(event: Record<string, unknown>): Record<string, unknown> {
  const workspace = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(eventsToWorkspaceState([event]), workspace);
  javascriptGenerator.init(workspace);
  const generated = withDisabledBlocksEnabled(
    workspace,
    () => javascriptGenerator.blockToCode(workspace.getTopBlocks(false)[0]),
  );
  const code = Array.isArray(generated) ? generated[0] : generated;
  const result = JSON5.parse(`[${code.trim().replace(/,$/, '')}]`)[0] as Record<string, unknown>;
  javascriptGenerator.finish('');
  workspace.dispose();
  return result;
}

const fixtures: Array<[string, Record<string, unknown>]> = [
  ['insert public event', { type: 'insert', name: '加点事件', args: [1, 'flag:x', { value: true }] }],
  ['insert point event', { type: 'insert', loc: ['flag:x', 2], which: 'afterBattle', floorId: 'sample1', args: [1] }],
  ['trigger expression point', { type: 'trigger', loc: ['flag:x', 2] }],
  ['setViewport absolute', { type: 'setViewport', loc: ['flag:x', 2], moveMode: 'easeIn', time: 300, async: true }],
  ['setViewport relative', { type: 'setViewport', dxy: [-1, 'flag:y'], moveMode: 'easeOut', time: 100 }],
  ['lockViewport', { type: 'lockViewport', lock: true }],
  ['showImage', { type: 'showImage', code: 1, image: 'bg.jpg', reverse: 'x', loc: [10, 20], opacity: 0.8, time: 300, async: true }],
  ['showImage cropped', { type: 'showImage', code: 2, image: 'fg.png', reverse: 'y', sloc: [0, 1, 32, 48], loc: [10, 20, 64, 96], opacity: 0.5, time: 500 }],
  ['moveImage mode', { type: 'moveImage', code: 2, to: ['flag:x', 20], opacity: 0.6, moveMode: 'easeIn', time: 500, async: true }],
  ['animate hero', { type: 'animate', name: 'zone', loc: 'hero', async: true }],
  ['animate window', { type: 'animate', name: 'zone', loc: [1, 2], alignWindow: true }],
  ['stopAnimate callback', { type: 'stopAnimate', doCallback: true }],
  ['vibrate', { type: 'vibrate', direction: 'vertical', time: 2000, speed: 10, power: 8, async: true }],
  ['playBgm start time', { type: 'playBgm', name: 'bgm.mp3', startTime: 3, keep: true }],
  ['resumeBgm resume', { type: 'resumeBgm', resume: true }],
  ['playSound sync', { type: 'playSound', name: 'attack.mp3', pitch: 110, stop: true, sync: true }],
  ['setVolume transition', { type: 'setVolume', value: 80, time: 500, async: true }],
  ['setVolume immediate', { type: 'setVolume', value: 80 }],
  ['setCurtain restore', { type: 'setCurtain', time: 300, moveMode: 'easeIn', async: true, keep: true }],
  ['setCurtain color', { type: 'setCurtain', color: [10, 20, 30, 0.5], time: 300, moveMode: 'easeOut' }],
  ['screenFlash move mode', { type: 'screenFlash', color: [255, 255, 255, 0.5], time: 100, times: 3, moveMode: 'easeInOut', async: true }],
  ['setWeather keep', { type: 'setWeather', name: 'rain', level: 6, keep: true }],
  ['clear weather', { type: 'setWeather' }],
  ['waitAsync flags', { type: 'waitAsync', excludeAnimates: true, includeSounds: true }],
  ['setText complete', { type: 'setText', position: 'up', offset: 12, align: 'center', bold: true, title: [255, 0, 0, 1], text: [255, 255, 255, 1], background: 'winskin.png', titlefont: 22, textfont: 18, lineHeight: 24, time: 30, letterSpacing: 1, animateTime: 200 }],
  ['moveTextBox complete', { type: 'moveTextBox', code: 2, loc: ['flag:x', 20], relative: true, moveMode: 'easeIn', time: 500, async: true }],
  ['clearTextBox code', { type: 'clearTextBox', code: [1, 3, 5] }],
  ['win no exit', { type: 'win', reason: '完成', norank: 1, noexit: 1 }],
  ['changeFloor stair', { type: 'changeFloor', floorId: ':next', stair: 'downFloor', direction: 'up', time: 300 }],
  ['jump relative', { type: 'jump', from: [1, 2], dxy: [-1, 3], time: 500, keep: true, async: true }],
  ['jumpHero relative', { type: 'jumpHero', dxy: ['flag:dx', 2], time: 500, async: true }],
  ['openShop open', { type: 'openShop', id: 'shop1', open: true }],
  ['autoSave remove last', { type: 'autoSave', removeLast: true }],
  ['forbidSave allow', { type: 'forbidSave', forbid: false }],
  ['hideStatusBar toolbox', { type: 'hideStatusBar', toolbox: true }],
  ['setHeroOpacity mode', { type: 'setHeroOpacity', opacity: 0.5, moveMode: 'easeIn', time: 300, async: true }],
  ['update without auto events', { type: 'update', doNotCheckAutoEvents: true }],
  ['async function', { type: 'function', async: true, function: 'function(){ return core.status.floorId; }' }],
  ['setBlockOpacity', { type: 'setBlockOpacity', loc: [[1, 2], [3, 4]], floorId: 'sample0', opacity: 0.5, time: 300, async: true }],
  ['setBlockFilter', { type: 'setBlockFilter', loc: [1, 2], blur: 1, hue: 120, grayscale: 0.4, invert: true, shadow: 2 }],
  ['turnBlock', { type: 'turnBlock', loc: [1, 2], direction: ':left' }],
  ['showFloorImg', { type: 'showFloorImg', loc: [[1, 2], [3, 4]], floorId: 'sample0' }],
  ['hideFloorImg', { type: 'hideFloorImg', loc: [1, 2] }],
  ['showBgFgMap', { type: 'showBgFgMap', name: 'fg', loc: [1, 2] }],
  ['hideBgFgMap', { type: 'hideBgFgMap', name: 'bg', loc: [[1, 2], [2, 3]] }],
  ['setBgFgBlock', { type: 'setBgFgBlock', name: 'fg', number: 'flag:block', loc: [1, 2], floorId: 'sample0' }],
  ['follow', { type: 'follow', name: 'npc.png' }],
  ['unfollow', { type: 'unfollow', name: 'npc.png' }],
  ['loadEquip', { type: 'loadEquip', id: 'sword1' }],
  ['unloadEquip', { type: 'unloadEquip', pos: 2 }],
  ['resetEnemyOnPoint', { type: 'resetEnemyOnPoint', loc: [[1, 2], [3, 4]], floorId: 'sample0', norefresh: true }],
  ['moveEnemyOnPoint absolute', { type: 'moveEnemyOnPoint', from: [1, 2], to: [3, 4], floorId: 'sample0', norefresh: true }],
  ['moveEnemyOnPoint relative', { type: 'moveEnemyOnPoint', from: [1, 2], dxy: [-1, 3] }],
  ['setEquip', { type: 'setEquip', id: 'sword1', valueType: 'percentage', name: 'atk', operator: '+=', value: '12' }],
  ['loadBgm', { type: 'loadBgm', name: 'bgm.mp3' }],
  ['freeBgm', { type: 'freeBgm', name: 'bgm.mp3' }],
  ['setBgmSpeed', { type: 'setBgmSpeed', value: 120, pitch: true }],
  ['showTextImage', { type: 'showTextImage', text: '第一行\n第二行', code: 2, loc: [10, 20], lineHeight: 1.6, reverse: 'x', opacity: 0.8, time: 300, async: true }],
  ['rotateImage', { type: 'rotateImage', code: 1, center: [100, 120], moveMode: 'easeIn', angle: -90, time: 500, async: true }],
  ['scaleImage', { type: 'scaleImage', code: 1, center: [100, 120], moveMode: 'easeOut', scale: 0.8, time: 300, async: true }],
  ['showGif', { type: 'showGif', name: 'demo.gif', loc: [10, 20] }],
  ['setFilter', { type: 'setFilter', blur: 1, hue: 120, grayscale: 0.5, invert: false, shadow: 2 }],
  ['fillText', { type: 'fillText', x: 'flag:x', y: 20, style: [255, 255, 255, 1], font: '20px Verdana', maxWidth: 300, text: '文本' }],
  ['drawTextContent', { type: 'drawTextContent', text: '多行\n文本', left: 10, top: 20, maxWidth: 300, color: [255, 0, 0, 1], align: 'center', fontSize: 18, lineHeight: 24, bold: true }],
  ['drawLine', { type: 'drawLine', x1: 0, y1: 0, x2: 'flag:x', y2: 100, style: [255, 255, 255, 1], lineWidth: 2 }],
  ['drawArrow', { type: 'drawArrow', x1: 0, y1: 0, x2: 100, y2: 100, style: [255, 0, 0, 1], lineWidth: 3 }],
  ['fillPolygon', { type: 'fillPolygon', nodes: [[0, 0], [100, 0], [0, 100]], style: [255, 255, 255, 1] }],
  ['strokePolygon', { type: 'strokePolygon', nodes: [[0, 0], [100, 0], [0, 100]], style: [255, 255, 255, 1], lineWidth: 2 }],
  ['fillEllipse', { type: 'fillEllipse', x: 100, y: 100, a: 80, b: 40, angle: 30, style: [255, 255, 255, 1] }],
  ['strokeEllipse', { type: 'strokeEllipse', x: 100, y: 100, a: 80, b: 40, angle: 30, style: [255, 255, 255, 1], lineWidth: 2 }],
  ['fillArc', { type: 'fillArc', x: 100, y: 100, r: 50, start: 0, end: 90, style: [255, 255, 255, 1] }],
  ['strokeArc', { type: 'strokeArc', x: 100, y: 100, r: 50, start: 0, end: 90, style: [255, 255, 255, 1], lineWidth: 2 }],
  ['drawImage', { type: 'drawImage', image: 'bg.jpg', reverse: 'x', x: 0, y: 0, w: 320, h: 240, angle: 15 }],
  ['drawImage cropped', { type: 'drawImage', image: 'bg.jpg', x: 0, y: 0, w: 32, h: 32, x1: 100, y1: 100, w1: 64, h1: 64, angle: 10 }],
];

describe('legacy Blockly schema completion', () => {
  it.each(fixtures)('round-trips %s', (_name, event) => {
    expect(roundTrip(event)).toEqual(event);
  });

  it('uses a typed value input for setEquip', () => {
    const state = eventsToWorkspaceState([{ type: 'setEquip', id: 'sword1', name: 'atk', value: 12 }]);
    const workspace = new Blockly.Workspace();
    Blockly.serialization.workspaces.load(state, workspace);
    const block = workspace.getTopBlocks(false)[0];
    expect(block.getInputTargetBlock('VALUE')).not.toBeNull();
    workspace.dispose();
  });

  it('registers every supported legacy event type', () => {
    const expected = fixtures.map(([, event]) => String(event.type));
    for (const type of new Set(expected)) expect(blockRegistry.hasEventType(type), type).toBe(true);
  });

  it('keeps the legacy toolbox category order and sound colours', () => {
    const map = getBlocksByCategory('map');
    expect(map.indexOf('mota_setBlockOpacity_s')).toBeLessThan(map.indexOf('mota_turnBlock_s'));
    expect(map.indexOf('mota_setBgFgBlock_s')).toBeLessThan(map.indexOf('mota_showFloorImg_s'));

    const sound = getBlocksByCategory('sound');
    expect(sound.indexOf('mota_showTextImage_s')).toBeLessThan(sound.indexOf('mota_rotateImage_s'));
    expect(sound.indexOf('mota_showGif_s')).toBeLessThan(sound.indexOf('mota_playBgm_s'));
    expect(blockRegistry.getSchema('showTextImage')?.definition.colour).toBe(20);

    const ui = getBlocksByCategory('ui');
    expect(ui.indexOf('mota_setFilter_s')).toBeLessThan(ui.indexOf('mota_fillText_s'));
    expect(ui.indexOf('mota_drawImage_s')).toBeLessThan(ui.indexOf('mota_drawIcon_s'));
  });

  it('keeps animateImage raw with a deprecation diagnostic', () => {
    const state = parseEvent({ type: 'animateImage', code: 1 }, { entryType: 'event' });
    expect(state.type).toBe('mota_unknown');
    expect(state.fields?.DIAGNOSTIC).toBe('旧版兼容事件，无可确认执行语义，已按原始 JSON 保留');
    expect(roundTrip({ type: 'animateImage', code: 1 })).toEqual({ type: 'animateImage', code: 1 });
  });

  it('preserves Blockly workspace state on the completed schemas', () => {
    const event = { type: 'drawLine', x1: 0, y1: 0, x2: 10, y2: 10, _collapsed: true, _disabled: true };
    expect(roundTrip(event)).toEqual(event);
  });
});
