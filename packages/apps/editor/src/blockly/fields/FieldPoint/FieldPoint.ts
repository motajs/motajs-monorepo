/**
 * FieldPoint - 地图选点字段
 *
 * 将 x, y, floorId 合并为一个结构化字段
 * 显示为可点击的坐标文本 "(x, y, floorId)" 或 "(x, y)"
 * 点击时打开 SelectPoint 弹窗
 *
 * 特性：
 * - 带底色的背景矩形，类似 FieldDropdown
 * - 支持"当前楼层"和"具体楼层"两种语义
 */

import * as Blockly from 'blockly';

import { openPointPicker } from './openPointPicker';
import {
  DEFAULT_CONFIG,
  DEFAULT_POINT,
  isRelativeFloor,
  RELATIVE_FLOOR_DISPLAY,
  type FieldPointConfig,
  type FieldPointJsonConfig,
  type PointValue,
} from './types';

/** CSS 类名常量 */
const POINT_FIELD_RECT_CLASS = 'blocklyPointFieldRect';

/**
 * FieldPoint - 地图选点字段
 *
 * 继承自 Blockly.Field，使用 SVG 渲染，点击打开弹窗
 */
export class FieldPoint extends Blockly.Field<PointValue> {
  /** 配置项 */
  private config_: Required<FieldPointConfig>;

  /** 文本元素 */
  protected textElement_: SVGTextElement | null = null;

  /**
   * 构造函数
   * @param value 初始值
   * @param validator 验证器
   * @param config 配置项
   */
  constructor(
    value?: PointValue | null,
    validator?: Blockly.FieldValidator<PointValue> | null,
    config?: FieldPointConfig,
  ) {
    super(value ?? DEFAULT_POINT, validator);
    this.config_ = { ...DEFAULT_CONFIG, ...config };
    this.EDITABLE = true;
    this.SERIALIZABLE = true;
  }

  /**
   * 从 JSON 配置创建字段（静态工厂方法）
   * 供 Blockly 内部使用
   */
  static override fromJson(options: Blockly.FieldConfig): FieldPoint {
    const pointOptions = options as unknown as FieldPointJsonConfig;
    const value: PointValue = {
      x: pointOptions.x ?? 0,
      y: pointOptions.y ?? 0,
      floorId: pointOptions.floorId,
    };
    return new FieldPoint(value, undefined, {
      includeFloor: pointOptions.includeFloor,
      allowRelativeFloor: pointOptions.allowRelativeFloor,
      multiSelect: pointOptions.multiSelect,
    });
  }

  /**
   * 初始化 SVG 视图
   * 创建带底色的背景矩形和文本元素
   */
  protected override initView(): void {
    // 创建背景矩形
    this.createBorderRect_();

    // 添加 CSS 类用于样式控制
    if (this.borderRect_) {
      Blockly.utils.dom.addClass(this.borderRect_, POINT_FIELD_RECT_CLASS);
      // 设置与 FieldDropdown 一致的高度（21px）
      // Blockly 默认的 FIELD_BORDER_RECT_HEIGHT 是 16，但 FieldDropdown 因为包含箭头所以是 21
      this.borderRect_.setAttribute('height', '21');
    }

    // 创建文本元素
    this.textElement_ = Blockly.utils.dom.createSvgElement(
      Blockly.utils.Svg.TEXT,
      {
        class: 'blocklyText',
        y: this.getConstants()?.FIELD_TEXT_BASELINE ?? 12,
      },
      this.fieldGroup_,
    );

    // 设置初始文本
    this.renderContent_();
  }

  /**
   * 应用颜色（响应块颜色变化）
   * 使用块的颜色系统来设置背景色
   *
   * 对于非 shadow 块，不设置 fill，让 Blockly 默认 CSS 规则生效：
   * .blocklyEditableField>rect { fill: #fff; fill-opacity: .6; }
   */
  override applyColour(): void {
    const sourceBlock = this.getSourceBlock();
    if (!sourceBlock || !this.borderRect_) return;

    // 只有 shadow 块才需要特殊的颜色处理
    if (sourceBlock instanceof Blockly.BlockSvg && sourceBlock.isShadow()) {
      this.borderRect_.style.fill = sourceBlock.style.colourSecondary;
    }
    // 非 shadow 块：不设置 fill，让 CSS 控制，保持与其他字段一致的半透明效果
  }

  /**
   * 渲染文本内容
   */
  private renderContent_(): void {
    if (this.textElement_) {
      this.textElement_.textContent = this.getText_();
    }
  }

  /**
   * 获取显示文本
   */
  protected override getText_(): string {
    const value = this.getValue();
    if (!value) {
      return '(?, ?)';
    }

    const { x, y, floorId } = value;

    if (!this.config_.includeFloor) {
      return `(${x}, ${y})`;
    }

    if (!floorId) {
      return `(${x}, ${y})`;
    }

    // 相对楼层显示友好文本
    if (isRelativeFloor(floorId)) {
      return `(${x}, ${y}, ${RELATIVE_FLOOR_DISPLAY[floorId]})`;
    }

    // 具体楼层直接显示 ID
    return `(${x}, ${y}, ${floorId})`;
  }

  /**
   * 值更新时的回调
   */
  protected override doValueUpdate_(newValue: PointValue): void {
    super.doValueUpdate_(newValue);
    this.renderContent_();
  }

  /**
   * 验证值格式
   */
  protected override doClassValidation_(newValue?: PointValue | null): PointValue | null {
    if (newValue === null || newValue === undefined) {
      return DEFAULT_POINT;
    }

    // 确保是有效的 PointValue
    if (typeof newValue !== 'object') {
      return DEFAULT_POINT;
    }

    const x = typeof newValue.x === 'number' || typeof newValue.x === 'string' ? newValue.x : 0;
    const y = typeof newValue.y === 'number' || typeof newValue.y === 'string' ? newValue.y : 0;
    const floorId = typeof newValue.floorId === 'string' ? newValue.floorId : undefined;

    return { x, y, floorId };
  }

  /**
   * 显示编辑器（点击时触发）
   */
  protected override showEditor_(): void {
    const value = this.getValue() ?? DEFAULT_POINT;

    openPointPicker({
      x: value.x,
      y: value.y,
      floorId: value.floorId,
      includeFloor: this.config_.includeFloor,
      allowRelativeFloor: this.config_.allowRelativeFloor,
      onSelect: (x, y, floorId) => {
        this.setValue({ x, y, floorId });
      },
      onCancel: () => {
        // 取消时不做任何操作
      },
    });
  }

  /**
   * 更新字段尺寸
   * 计算文本宽度并更新背景矩形
   */
  protected override updateSize_(): void {
    const constants = this.getConstants();

    // 默认值（与 Geras renderer 默认值一致）
    const xPadding = this.borderRect_ ? (constants?.FIELD_BORDER_RECT_X_PADDING ?? 4) : 0;
    const fontSize = constants?.FIELD_TEXT_FONTSIZE ?? 11;
    const fontWeight = constants?.FIELD_TEXT_FONTWEIGHT ?? 'normal';
    const fontFamily = constants?.FIELD_TEXT_FONTFAMILY ?? 'sans-serif';
    const textHeight = constants?.FIELD_TEXT_HEIGHT ?? 16;

    // 计算文本宽度
    let textWidth = 0;
    if (this.textElement_) {
      textWidth = Blockly.utils.dom.getFastTextWidth(this.textElement_, fontSize, fontWeight, fontFamily);
    }

    // 计算总宽度和高度
    // 使用与 FieldDropdown 一致的高度（21px）而不是默认的 16px
    const totalWidth = textWidth + xPadding * 2;
    const totalHeight = this.borderRect_ ? 21 : textHeight;

    // 更新尺寸
    this.size_.width = Math.max(totalWidth, 20);
    this.size_.height = totalHeight;

    // 更新背景矩形位置和尺寸
    this.positionTextElement_(xPadding, textWidth);
    this.positionBorderRect_();
  }

  /**
   * 序列化值为 JSON
   * 返回给 Blockly 保存状态用
   */
  override saveState(): PointValue {
    return this.getValue() ?? DEFAULT_POINT;
  }

  /**
   * 从 JSON 恢复值
   */
  override loadState(state: PointValue): void {
    this.setValue(state);
  }

  /**
   * 获取配置
   */
  getConfig(): Required<FieldPointConfig> {
    return { ...this.config_ };
  }
}

/**
 * 注册 FieldPoint 到 Blockly
 */
export function registerFieldPoint(): void {
  Blockly.fieldRegistry.register('field_point', FieldPoint);
}
