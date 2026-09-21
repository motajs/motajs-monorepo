import * as Blockly from 'blockly';
import JSON5 from 'json5';
import { javascriptGenerator } from 'blockly/javascript';
import { blockRegistry, type BlockSchema, type DeclarativeInteraction } from '../registry';
import type { BlocklyInteractionCapabilities } from '@/Workbench/EventsEditor/BlocklyCapabilitiesContext';
import { buildBlocklyPreview, type BlocklyInteractionDiagnostic } from './previewModel';

export interface InteractionResult {
  ok: boolean;
  diagnostic?: BlocklyInteractionDiagnostic;
}

type InteractionHandler<T extends DeclarativeInteraction = DeclarativeInteraction> = (
  block: Blockly.Block,
  interaction: T,
  capabilities: BlocklyInteractionCapabilities,
) => Promise<InteractionResult>;

export class BlocklyInteractionRegistry {
  private readonly handlers = new Map<DeclarativeInteraction['type'], InteractionHandler>();

  register<T extends DeclarativeInteraction>(type: T['type'], handler: InteractionHandler<T>): void {
    this.handlers.set(type, handler as InteractionHandler);
  }

  async execute(
    block: Blockly.Block,
    interaction: DeclarativeInteraction,
    capabilities: BlocklyInteractionCapabilities,
  ): Promise<InteractionResult> {
    const handler = this.handlers.get(interaction.type);
    if (!handler) return failure('interaction.unavailable', `交互 ${interaction.type} 尚未注册`);
    try {
      return await handler(block, interaction, capabilities);
    } catch (cause) {
      return failure('interaction.failed', cause instanceof Error ? cause.message : String(cause));
    }
  }
}

function failure(code: string, message: string): InteractionResult {
  return { ok: false, diagnostic: { code, message, severity: 'error' } };
}

function parseBlockEvent(block: Blockly.Block): unknown {
  // Preview and other block-local interactions must not serialize the
  // following statement chain. A connected block otherwise produces several
  // comma-separated events, which cannot be parsed as one preview event.
  const generated = javascriptGenerator.blockToCode(block, true);
  const code = (Array.isArray(generated) ? generated[0] : generated).trim().replace(/,$/, '');
  if (!code) return null;
  return JSON5.parse(code);
}

function definitionArgs(schema: BlockSchema): Array<{ type: string; name?: string }> {
  const definition = schema.definition as unknown as Record<string, unknown>;
  return Object.entries(definition)
    .filter(([key, value]) => /^args\d+$/.test(key) && Array.isArray(value))
    .flatMap(([, value]) => value as Array<{ type: string; name?: string }>);
}

export function getEffectiveInteractions(schema: BlockSchema): DeclarativeInteraction[] {
  if (schema.interactions?.length) return schema.interactions;
  const args = definitionArgs(schema);
  const multiline = args.find((arg) => arg.type === 'field_multilinetext' && arg.name);
  if (multiline?.name) return [{ type: 'editText', field: multiline.name, mode: 'multiline' }];
  if (schema.category === 'map') {
    const names = new Set(args.map((arg) => arg.name));
    const xField = names.has('X') ? 'X' : names.has('POS_X') ? 'POS_X' : undefined;
    const yField = names.has('Y') ? 'Y' : names.has('POS_Y') ? 'POS_Y' : undefined;
    if (xField && yField)
      return [
        {
          type: 'selectPoint',
          xField,
          yField,
          floorField: names.has('FLOOR_ID') ? 'FLOOR_ID' : undefined,
          floorPolicy: names.has('FLOOR_ID') ? 'explicit' : 'current',
        },
      ];
  }
  return [];
}

function parseColour(value: string): string | null {
  const channels = value
    .split(',')
    .slice(0, 3)
    .map((part) => Number(part.trim()));
  if (channels.length !== 3 || channels.some((part) => !Number.isFinite(part))) return null;
  return `#${channels.map((part) => Math.max(0, Math.min(255, part)).toString(16).padStart(2, '0')).join('')}`;
}

export const blocklyInteractionRegistry = new BlocklyInteractionRegistry();

blocklyInteractionRegistry.register('editText', async (block, interaction, capabilities) => {
  if (interaction.type !== 'editText') return failure('interaction.type', '错误的文本交互');
  const raw = String(block.getFieldValue(interaction.field) ?? '');
  const value = interaction.mode === 'escaped-newline' ? raw.replace(/\\n/g, '\n') : raw;
  const result = await capabilities.editText({
    contextId: `blockly:${block.type}:${block.id}:${interaction.field}`,
    value,
    lint: interaction.lint || interaction.mode === 'javascript',
  });
  if (result === null) return { ok: true };
  block.setFieldValue(
    interaction.mode === 'escaped-newline' ? result.replace(/\n/g, '\\n') : result,
    interaction.field,
  );
  return { ok: true };
});

blocklyInteractionRegistry.register('selectPoint', async (block, interaction, capabilities) => {
  if (interaction.type !== 'selectPoint') return failure('interaction.type', '错误的选点交互');
  const result = await capabilities.selectPoint({
    floorId: interaction.floorField ? String(block.getFieldValue(interaction.floorField) ?? '') : undefined,
    x: block.getFieldValue(interaction.xField),
    y: block.getFieldValue(interaction.yField),
    multiple: interaction.multiple ?? true,
  });
  if (!result) return { ok: true };
  block.setFieldValue(String(result.x), interaction.xField);
  block.setFieldValue(String(result.y), interaction.yField);
  if (interaction.floorField && interaction.floorPolicy !== 'current') {
    block.setFieldValue(result.floorId, interaction.floorField);
  }
  return { ok: true };
});

blocklyInteractionRegistry.register('selectMaterial', async (block, interaction, capabilities) => {
  if (interaction.type !== 'selectMaterial') return failure('interaction.type', '错误的素材交互');
  const current = String(block.getFieldValue(interaction.field) ?? '');
  const result = await capabilities.selectMaterial({
    title: '请选择素材',
    value: current ? [current] : [],
    kind: interaction.materialKind,
    multiple: interaction.multiple,
    transform: interaction.transform,
    aliasPolicy: interaction.aliasPolicy,
  });
  if (!result) return { ok: true };
  const value = interaction.multiple ? JSON.stringify(result) : (result[0] ?? '');
  block.setFieldValue(value, interaction.field);
  return { ok: true };
});

blocklyInteractionRegistry.register('preview', async (block, interaction, capabilities) => {
  if (interaction.type !== 'preview') return failure('interaction.type', '错误的预览交互');
  await capabilities.preview(buildBlocklyPreview(parseBlockEvent(block), interaction.adapter));
  return { ok: true };
});

blocklyInteractionRegistry.register('colourBinding', async (block, interaction) => {
  if (interaction.type !== 'colourBinding') return failure('interaction.type', '错误的颜色交互');
  const colour = parseColour(String(block.getFieldValue(interaction.textField) ?? ''));
  if (colour) block.setFieldValue(colour, interaction.colourField);
  return { ok: true };
});

blocklyInteractionRegistry.register('command', async (_block, interaction, capabilities) => {
  if (interaction.type !== 'command') return failure('interaction.type', '错误的命令交互');
  if (interaction.command === 'showKeyCodes') {
    capabilities.report(
      '键值：A-Z 为 65-90，0-9 为 48-57，Esc 27，空格 32，回车 13，方向键 37-40，PgUp 33，PgDn 34。',
      'info',
    );
    return { ok: true };
  }
  return failure('interaction.command', `未知命令 ${interaction.command}`);
});

export interface BlocklyInteractionController {
  dispose(): void;
  refresh(): void;
  runSelectedPointInteraction(): Promise<boolean>;
}

export function createBlocklyInteractionController(
  workspace: Blockly.WorkspaceSvg,
  capabilities: BlocklyInteractionCapabilities,
): BlocklyInteractionController {
  let lastClick: { blockId: string; time: number } | null = null;
  const doubleClickBindings = new Map<string, { root: SVGElement; listener: (event: Event) => void }>();
  const run = async (block: Blockly.Block, requestedType?: DeclarativeInteraction['type']) => {
    const schema = blockRegistry.getSchemaByBlockType(block.type);
    if (!schema) return false;
    const interactions = getEffectiveInteractions(schema);
    const interaction = requestedType
      ? interactions.find((item) => item.type === requestedType)
      : (interactions.find((item) => item.type === schema.defaultInteraction) ??
        [...interactions].sort(
          (a, b) =>
            ['preview', 'selectPoint', 'selectMaterial', 'editText'].indexOf(a.type) -
            ['preview', 'selectPoint', 'selectMaterial', 'editText'].indexOf(b.type),
        )[0]);
    if (!interaction) return false;
    const result = await blocklyInteractionRegistry.execute(block, interaction, capabilities);
    if (!result.ok && result.diagnostic) capabilities.report(result.diagnostic.message, 'error');
    return result.ok;
  };

  const decorateContextMenu = (block: Blockly.Block) => {
    const rendered = block as Blockly.BlockSvg;
    const getSvgRoot = (rendered as unknown as { getSvgRoot?: () => SVGElement | null }).getSvgRoot;
    const root = getSvgRoot?.call(rendered);
    root?.setAttribute('data-test-id', `blockly-block-${block.type}`);
    const schema = blockRegistry.getSchemaByBlockType(block.type);
    if (!schema) return;
    const effectiveInteractions = getEffectiveInteractions(schema);
    const hasDoubleClickInteraction = effectiveInteractions.some(
      (interaction) =>
        interaction.type !== 'colourBinding' &&
        (interaction.type !== 'command' || interaction.trigger === 'doubleClick'),
    );
    if (root && hasDoubleClickInteraction && !doubleClickBindings.has(block.id)) {
      const listener = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        void run(block);
      };
      root.addEventListener('dblclick', listener);
      doubleClickBindings.set(block.id, { root, listener });
    }
    const interactions = effectiveInteractions.filter(
      (interaction) =>
        interaction.type === 'preview' ||
        interaction.type === 'selectMaterial' ||
        (interaction.type === 'command' && interaction.trigger === 'contextMenu'),
    );
    if (!interactions.length) return;
    const previous = rendered.customContextMenu;
    rendered.customContextMenu = (options) => {
      previous?.(options);
      interactions.forEach((interaction) => {
        const text =
          interaction.type === 'preview'
            ? '预览此事件'
            : interaction.type === 'selectMaterial'
              ? '选择素材'
              : '查询键值表';
        options.push({
          text,
          enabled: true,
          callback: () => {
            void run(block, interaction.type);
          },
        });
      });
    };
  };

  const refresh = () => {
    for (const [blockId, binding] of doubleClickBindings) {
      if (workspace.getBlockById(blockId)) continue;
      binding.root.removeEventListener('dblclick', binding.listener);
      doubleClickBindings.delete(blockId);
    }
    workspace.getAllBlocks(false).forEach(decorateContextMenu);
  };

  refresh();

  const listener = (event: Blockly.Events.Abstract) => {
    if (event.type === Blockly.Events.BLOCK_CREATE) {
      const create = event as Blockly.Events.BlockCreate;
      (create.ids ?? []).forEach((id) => {
        const block = workspace.getBlockById(id);
        if (block) decorateContextMenu(block);
      });
    }
    if (event.type === Blockly.Events.FINISHED_LOADING) refresh();
    if (event.type === Blockly.Events.CLICK) {
      const click = event as Blockly.Events.Click;
      if (!click.blockId) return;
      // Rendered workspaces use the native dblclick listener above. Headless
      // workspaces keep this fallback for codecs and controller tests.
      if (doubleClickBindings.has(click.blockId)) return;
      const now = Date.now();
      if (lastClick?.blockId === click.blockId && now - lastClick.time <= 400) {
        lastClick = null;
        const block = workspace.getBlockById(click.blockId);
        if (block) void run(block);
      } else lastClick = { blockId: click.blockId, time: now };
    }
    if (event.type === Blockly.Events.BLOCK_CHANGE) {
      const change = event as Blockly.Events.BlockChange;
      if (change.element !== 'field' || !change.blockId || !change.name) return;
      const block = workspace.getBlockById(change.blockId);
      const schema = block && blockRegistry.getSchemaByBlockType(block.type);
      const binding = schema?.interactions?.find(
        (item) => item.type === 'colourBinding' && item.textField === change.name,
      );
      if (block && binding) void blocklyInteractionRegistry.execute(block, binding, capabilities);
    }
  };
  workspace.addChangeListener(listener);
  return {
    refresh,
    dispose: () => {
      workspace.removeChangeListener(listener);
      for (const { root, listener: doubleClick } of doubleClickBindings.values()) {
        root.removeEventListener('dblclick', doubleClick);
      }
      doubleClickBindings.clear();
    },
    async runSelectedPointInteraction() {
      const selected = Blockly.getSelected();
      return selected instanceof Blockly.Block ? run(selected, 'selectPoint') : false;
    },
  };
}
