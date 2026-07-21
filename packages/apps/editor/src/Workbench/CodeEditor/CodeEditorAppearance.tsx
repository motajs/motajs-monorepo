import { Checkbox, InputNumber, Popover, Tooltip } from "antd";
import { Settings2 } from "lucide-react";
import type { FC } from "react";
import type { CodeEditorAppearance } from "./useCodeEditorAppearance";

export const CodeEditorSettingsButton: FC<{ appearance: CodeEditorAppearance }> = ({ appearance }) => (
  <Popover
    arrow={false}
    content={(
      <div className="codeEditorAppearanceSettings">
        <label>
          <span>字号</span>
          <InputNumber
            max={32}
            min={10}
            precision={0}
            size="small"
            value={appearance.fontSize}
            onChange={(value) => {
              if (value != null) appearance.setFontSize(value);
            }}
          />
        </label>
        <Checkbox
          checked={appearance.fontBold}
          onChange={(event) => appearance.setFontBold(event.target.checked)}
        >
          字体加粗
        </Checkbox>
      </div>
    )}
    placement="bottomRight"
    trigger="click"
  >
    <Tooltip title="编辑器设置">
      <button aria-label="编辑器设置" className="codeEditorSettingsButton" data-test-id="code-editor-settings">
        <Settings2 size={15} />
      </button>
    </Tooltip>
  </Popover>
);
