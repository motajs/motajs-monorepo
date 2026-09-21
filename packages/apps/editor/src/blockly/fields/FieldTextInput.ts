import * as Blockly from 'blockly';

const HORIZONTAL_HIT_PADDING = 4;

/**
 * Blockly leaves a small gap between inline fields. Make that gap part of the
 * adjacent text input's click target without changing its visible dimensions.
 */
export class FieldTextInput extends Blockly.FieldTextInput {
  private edgeHitRect: SVGRectElement | null = null;

  override initView(): void {
    super.initView();
    const root = this.getSvgRoot();
    if (!root) return;

    this.edgeHitRect = Blockly.utils.dom.createSvgElement(
      Blockly.utils.Svg.RECT,
      {
        'aria-hidden': 'true',
        'data-test-id': 'blockly-text-input-edge-hit-area',
        fill: 'transparent',
        'pointer-events': 'all',
        style: 'fill: transparent; stroke: transparent; stroke-width: 0; pointer-events: all;',
      },
      root,
    );
    root.insertBefore(this.edgeHitRect, root.firstChild);
    this.updateEdgeHitRect();
  }

  protected override render_(): void {
    super.render_();
    this.updateEdgeHitRect();
  }

  protected override showEditor_(event?: Event, quietInput?: boolean, manageEphemeralFocus?: boolean): void {
    const border = this.borderRect_?.getBoundingClientRect();
    const clientX = event && 'clientX' in event ? Number(event.clientX) : Number.NaN;
    const edgeCaret =
      border && Number.isFinite(clientX)
        ? clientX < border.left
          ? 0
          : clientX > border.right
            ? String(this.getValue() ?? '').length
            : null
        : null;

    // The edge hit area sits outside Blockly's visible field border. Letting
    // Blockly manage ephemeral focus for that pointer sequence can restore
    // focus to the block after the input opens, so own focus only for edge hits.
    super.showEditor_(event, quietInput, edgeCaret === null ? manageEphemeralFocus : false);
    if (edgeCaret !== null && this.htmlInput_) {
      const input = this.htmlInput_;
      input.setSelectionRange(edgeCaret, edgeCaret);
      window.setTimeout(() => {
        if (this.htmlInput_ !== input || !input.isConnected) return;
        input.focus();
        input.setSelectionRange(edgeCaret, edgeCaret);
      }, 0);
    }
  }

  private updateEdgeHitRect(): void {
    if (!this.edgeHitRect || !this.borderRect_) return;
    const width = Number(this.borderRect_.getAttribute('width'));
    const height = Number(this.borderRect_.getAttribute('height'));
    if (!Number.isFinite(width) || !Number.isFinite(height)) return;

    this.edgeHitRect.setAttribute('x', String(-HORIZONTAL_HIT_PADDING));
    this.edgeHitRect.setAttribute('y', '0');
    this.edgeHitRect.setAttribute('width', String(width + HORIZONTAL_HIT_PADDING * 2));
    this.edgeHitRect.setAttribute('height', String(height));
  }

  static override fromJson(options: Blockly.FieldTextInputFromJsonConfig): FieldTextInput {
    return new FieldTextInput(Blockly.utils.parsing.replaceMessageReferences(options.text ?? ''), undefined, options);
  }
}

let registered = false;

export function registerFieldTextInput(): void {
  if (registered) return;
  Blockly.fieldRegistry.register('field_mota_text_input', FieldTextInput);
  registered = true;
}
