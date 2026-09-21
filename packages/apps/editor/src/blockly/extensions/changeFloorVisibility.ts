/**
 * changeFloorVisibility 扩展
 *
 * 用于 mota_changeFloor_m 块的条件字段显示/隐藏：
 * - 当 FLOOR_LIST 选择 :before/:next/:now 时，隐藏 FLOOR_ID
 * - 当 STAIR 选择非 loc 时，隐藏 POS_X/POS_Y
 */

import * as Blockly from 'blockly';

/** 扩展名称常量 */
export const CHANGE_FLOOR_VISIBILITY_EXTENSION = 'changeFloor_visibility';

/**
 * 更新字段可见性的辅助函数
 */
function updateFieldVisibility(block: Blockly.Block): void {
  const floorList = block.getFieldValue('FLOOR_LIST');
  const stair = block.getFieldValue('STAIR');

  // 隐藏/显示 FLOOR_ID
  // 当选择 :before/:next/:now 时，不需要显示具体楼层 ID
  const floorIdField = block.getField('FLOOR_ID');
  if (floorIdField) {
    floorIdField.setVisible(floorList === 'floorId');
  }

  // 隐藏/显示坐标相关字段（包括标签）
  // 当选择 upFloor/downFloor 等楼梯类型时，不需要显示坐标
  const showPos = stair === 'loc';

  // 隐藏/显示标签和输入框
  const labelXField = block.getField('LABEL_X');
  const posXField = block.getField('POS_X');
  const labelYField = block.getField('LABEL_Y');
  const posYField = block.getField('POS_Y');

  if (labelXField) {
    labelXField.setVisible(showPos);
  }
  if (posXField) {
    posXField.setVisible(showPos);
  }
  if (labelYField) {
    labelYField.setVisible(showPos);
  }
  if (posYField) {
    posYField.setVisible(showPos);
  }
}

/**
 * 注册 changeFloor_visibility 扩展
 *
 * 使用 setOnChange 监听块的变化事件，动态更新字段可见性
 */
export function registerChangeFloorVisibilityExtension(): void {
  // 避免重复注册
  if (Blockly.Extensions.isRegistered(CHANGE_FLOOR_VISIBILITY_EXTENSION)) {
    return;
  }

  Blockly.Extensions.register(CHANGE_FLOOR_VISIBILITY_EXTENSION, function (this: Blockly.Block) {
    // 初始化时更新一次可见性
    updateFieldVisibility(this);

    // 监听变化事件
    this.setOnChange(function (this: Blockly.Block, e: Blockly.Events.Abstract) {
      // 只处理块变化事件
      if (e.type !== Blockly.Events.BLOCK_CHANGE) {
        return;
      }

      const changeEvent = e as Blockly.Events.BlockChange;

      // 只处理当前块的变化
      if (changeEvent.blockId !== this.id) {
        return;
      }

      // 只处理字段值变化
      if (changeEvent.element !== 'field') {
        return;
      }

      // 只处理相关字段的变化
      const fieldName = changeEvent.name;
      if (fieldName !== 'FLOOR_LIST' && fieldName !== 'STAIR') {
        return;
      }

      // 更新字段可见性
      updateFieldVisibility(this);

      // 重新渲染块以更新布局
      if (this instanceof Blockly.BlockSvg && this.rendered) {
        this.render();
      }
    });
  });
}
