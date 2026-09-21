import { expect, test } from '@playwright/test';
import { ProjectSandbox } from './utils/projectSandbox';
import { openEventEditor, selectPanel } from './utils/tableEditing';

test('Blockly multiline text wraps and keeps its editor aligned', async ({ page }) => {
  await ProjectSandbox.create(page);
  await page.goto('/');

  const tower = await selectPanel(page, 'tower', 'panel-tower');
  await openEventEditor(
    page,
    tower.getByTestId('table-input-firstData-startCanvas').locator('textarea'),
    /在这里可以用事件来自定义绘制标题界面/,
  );

  const text = '这是一段很长的显示文字，用来确认单行内容会在块内自动换行，而不是在末尾直接显示省略号。'.repeat(3);
  await page.getByTestId('event-editor-source').fill(JSON.stringify([text]));
  await page.getByTestId('event-editor-parse').click();

  const block = page.getByTestId('blockly-block-mota_text_0_s');
  const field = block.getByTestId('blockly-multiline-field');
  await expect(field.getByTestId('blockly-multiline-line')).toHaveCount(3);
  await expect(field).not.toContainText('...');
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );

  const before = await field.boundingBox();
  expect(before).not.toBeNull();
  await field.click();

  const editor = page.getByTestId('blockly-multiline-editor');
  await expect(editor).toBeVisible();
  await expect(editor).toHaveValue(text);
  const editingField = await field.boundingBox();
  const editorBox = await editor.boundingBox();
  expect(editingField).not.toBeNull();
  expect(editorBox).not.toBeNull();
  expect(Math.abs(editingField!.x - before!.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(editingField!.y - before!.y)).toBeLessThanOrEqual(2);
  expect(Math.abs(editingField!.width - before!.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(editorBox!.x - before!.x)).toBeLessThanOrEqual(4);
  expect(Math.abs(editorBox!.y - before!.y)).toBeLessThanOrEqual(4);

  await page.keyboard.press('Escape');
  await page.getByTestId('event-editor-source').fill(
    JSON.stringify([
      {
        type: 'text',
        text: '\t[老人,man]带标题的正文',
      },
    ]),
  );
  await page.getByTestId('event-editor-parse').click();

  const detailedBlock = page.getByTestId('blockly-block-mota_text_1_s');
  const detailedField = detailedBlock.getByTestId('blockly-multiline-field');
  await expect(detailedBlock).toBeVisible();
  await expect(page.getByTestId('blockly-block-mota_text_0_s')).toHaveCount(0);
  const detailedBlockBox = await detailedBlock.boundingBox();
  const detailedFieldBox = await detailedField.boundingBox();
  expect(detailedBlockBox).not.toBeNull();
  expect(detailedFieldBox).not.toBeNull();
  expect(detailedFieldBox!.x - detailedBlockBox!.x).toBeLessThanOrEqual(32);

  const search = page.getByTestId('event-editor-search');
  await search.fill('显示事件');
  const searchResults = page.getByTestId('event-editor-search-results');
  await expect(searchResults).toHaveAttribute('data-search-active', 'true');
  await expect.poll(async () => Number(await searchResults.getAttribute('data-result-count'))).toBeGreaterThan(0);

  await detailedBlock.click();
  await page.getByTestId('event-editor-select-point').click();
  await expect(page.getByTestId('select-point-modal')).toBeVisible();
  await expect(page.getByTestId('select-point-modal').getByText('右键多选')).toBeVisible();
  await page.getByTestId('select-point-cancel').click();
});

test('Blockly text field edges open the input instead of focusing the block', async ({ page }) => {
  await ProjectSandbox.create(page);
  await page.goto('/');

  const tower = await selectPanel(page, 'tower', 'panel-tower');
  await openEventEditor(page, tower.getByTestId('table-input-firstData-startCanvas').locator('textarea'));
  await page.getByTestId('event-editor-source').fill(
    JSON.stringify([
      {
        type: 'setValue',
        name: 'flag:difficulty',
        operator: '=',
        value: '-1',
      },
    ]),
  );
  await page.getByTestId('event-editor-parse').click();

  const block = page.getByTestId('blockly-block-mota_setValue_s');
  const valueField = block.locator('.blocklyTextInputField').filter({ hasText: '-1' });
  await expect(valueField).toHaveCount(1);
  const visibleBorder = valueField.locator(':scope > .blocklyFieldRect');
  const borderBox = await visibleBorder.boundingBox();
  expect(borderBox).not.toBeNull();

  await page.mouse.click(borderBox!.x + borderBox!.width + 2, borderBox!.y + borderBox!.height / 2);

  const editor = page.locator('.blocklyHtmlInput');
  await expect(editor).toBeVisible();
  await expect(editor).toHaveValue('-1');
  await expect(editor).toBeFocused();
  expect(
    await editor.evaluate((element) => {
      const input = element as HTMLInputElement;
      return {
        selectionStart: input.selectionStart,
        selectionEnd: input.selectionEnd,
      };
    }),
  ).toEqual({ selectionStart: 2, selectionEnd: 2 });
  await page.keyboard.press('Backspace');
  await expect(editor).toHaveValue('-');
});
