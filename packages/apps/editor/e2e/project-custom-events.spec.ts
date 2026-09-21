import { expect, test } from '@playwright/test';
import { ProjectSandbox } from './utils/projectSandbox';
import { waitForEventEditorReady } from './utils/tableEditing';

const PACK_PATH = '.metaphysics/schemas/blockly/project-events.json';

test('registers an unknown event as a lossless project custom block', async ({ page }) => {
  test.setTimeout(60_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const sandbox = await ProjectSandbox.create(page);
  await page.goto('/');
  await page.getByTestId('workspace-common-events').click();
  await waitForEventEditorReady(page, /通过传参/);

  // Opening the manager directly is a blank authoring flow and must not create a file.
  await page.getByTestId('custom-block-manager-open').click();
  const manager = page.locator('.customBlockManagerModal');
  await expect(manager).toBeVisible();
  const expectedManagerHeight = await page.evaluate(() => Math.min(820, window.innerHeight - 16));
  await expect
    .poll(() => manager.evaluate((element) => element.getBoundingClientRect().height))
    .toBe(expectedManagerHeight);
  await expect
    .poll(() => manager.locator('.ant-modal-container').evaluate((element) => element.getBoundingClientRect().height))
    .toBe(expectedManagerHeight);
  expect(await page.locator('.ant-modal-wrap').evaluate((wrap) => wrap.scrollHeight <= wrap.clientHeight + 1)).toBe(
    true,
  );
  await expect(manager.getByLabel('事件 type')).toHaveValue('');
  await expect(manager.locator('.customBlockFieldRow')).toHaveCount(0);
  await expect(manager.getByTestId('custom-block-unsaved-draft')).toContainText('未保存草稿');
  await expect(manager.locator('.customBlockVisualPreview .blocklyBlockCanvas > g')).toHaveCount(1);
  expect(sandbox.hasFile(PACK_PATH)).toBe(false);

  await manager.getByLabel('事件 type').fill('temporary');
  await manager.getByLabel('块标题').fill('临时块');
  await manager.getByTestId('custom-block-new').click();
  await expect(manager.getByLabel('事件 type')).toHaveValue('');
  await expect(manager.getByLabel('块标题')).toHaveValue('新自定义事件块');
  await expect(manager.getByLabel('事件 type')).toBeFocused();

  await manager.getByRole('button', { name: '新增字段', exact: true }).click();
  await expect(manager.getByPlaceholder('显示名称（必填）')).toHaveAttribute('aria-invalid', 'true');
  await expect(manager.getByPlaceholder('数据 path（必填）')).toHaveAttribute('aria-invalid', 'true');
  await expect(manager.locator('.customBlockRequired')).toHaveCount(2);
  await expect(manager.locator('.customBlockVisualPreview .blocklyBlockCanvas > g')).toHaveCount(1);
  await expect(manager.locator('.customBlockFieldAdvanced')).toContainText('补全源');
  await expect(manager.locator('.customBlockFieldAdvanced')).toContainText('素材选择');
  expect(
    await manager
      .locator('.customBlockFieldHeader')
      .evaluate((header) => header.parentElement?.classList.contains('customBlockFields')),
  ).toBe(true);
  await manager.getByRole('button', { name: 'Close' }).click();

  const event = {
    type: 'dialogue',
    title: '妖精',
    enabled: true,
    portraits: [{ side: 'left', image: 'fairy.png' }],
    'literal.key': 'kept',
  };
  await page.getByTestId('event-editor-source').fill(JSON.stringify([event]));
  await page.getByTestId('event-editor-parse').click();
  const register = page.locator('.blocklyActionField');
  await expect(register).toHaveText('注册自定义块');
  await register.click();

  await expect(manager).toBeVisible();
  await expect(manager.getByLabel('事件 type')).toHaveValue('dialogue');
  await expect
    .poll(() => manager.evaluate((element) => element.getBoundingClientRect().height))
    .toBe(expectedManagerHeight);
  await expect(manager.locator('.customBlockFieldRow')).toHaveCount(4);
  await expect(manager.locator('.roundTripStatus')).toContainText('保持无损');
  await expect(manager.locator('.customBlockVisualPreview .blocklyBlockCanvas > g')).toHaveCount(1);
  const fieldValues = await manager.locator('.customBlockFieldRow').evaluateAll((rows) =>
    rows.map((row) =>
      Array.from(row.querySelectorAll('input'))
        .slice(0, 2)
        .map((input) => input.value),
    ),
  );
  expect(fieldValues).toContainEqual(['literal.key', '["literal.key"]']);

  const write = sandbox.waitForWrite(PACK_PATH);
  await manager.getByRole('button', { name: '保存', exact: true }).click();
  await write;
  const saved = JSON.parse(sandbox.readText(PACK_PATH)) as {
    kind: string;
    formatVersion: number;
    blocks: Array<{ event: { preserveUnbound: boolean; match: { equals: string } } }>;
  };
  expect(saved).toMatchObject({
    kind: 'blockly-block-pack',
    formatVersion: 1,
    blocks: [{ event: { preserveUnbound: true, match: { equals: 'dialogue' } } }],
  });
  await expect(manager.getByTestId('custom-block-delete')).toBeVisible();

  await manager.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('.blocklyActionField')).toHaveCount(0);
  await expect(page.getByTestId('event-editor-source')).toContainText('literal.key');
  await expect(page.getByRole('treeitem', { name: '自定义事件' })).toBeVisible();

  await page.getByTestId('operation-history-undo').click();
  await expect(page.locator('.blocklyActionField')).toHaveText('注册自定义块');
  await expect(page.getByRole('treeitem', { name: '自定义事件' })).toHaveCount(0);
  await page.getByTestId('operation-history-redo').click();
  await expect(page.locator('.blocklyActionField')).toHaveCount(0);
  await expect(page.getByRole('treeitem', { name: '自定义事件' })).toBeVisible();

  await page.getByTestId('custom-block-manager-open').click();
  await expect(manager.getByTestId('custom-block-delete')).toBeVisible();
  const deleted = sandbox.waitForDelete(PACK_PATH);
  await manager.getByTestId('custom-block-delete').click();
  const confirm = page.locator('.ant-modal-confirm');
  await expect(confirm).toBeVisible();
  const confirmDelete = confirm.getByRole('button', { name: /删\s*除/ });
  await expect(confirmDelete).toBeEnabled();
  await confirmDelete.click();
  await deleted;
  await expect(manager.getByTestId('custom-block-delete')).toHaveCount(0);
  await expect(page.locator('.blocklyActionField')).toHaveText('注册自定义块');
  expect(pageErrors).toEqual([]);
});
