import { FC } from "react";
import { Button, Dropdown } from "@douyinfe/semi-ui";
import { ButtonProps } from "@douyinfe/semi-ui/lib/es/button";
import { IconMoon, IconSun } from "@douyinfe/semi-icons";
import { DropdownProps } from "@douyinfe/semi-ui/lib/es/dropdown";
import { DarkModeStore } from "@/store";

export interface IDarkModeButtonProps extends ButtonProps {
  dropdown?: DropdownProps;
}

const DarkModeButton: FC<IDarkModeButtonProps> = (props) => {
  const { dropdown, ...buttonProps } = props;
  const { isDarkMode, setIsDarkMode } = DarkModeStore.useStore();

  return (
    <Dropdown
      trigger="contextMenu"
      render={(
        <Dropdown.Menu>
          <Dropdown.Item onClick={() => setIsDarkMode(void 0)}>跟随系统偏好</Dropdown.Item>
        </Dropdown.Menu>
      )}
      {...dropdown}
    >
      <Button
        type="tertiary"
        icon={isDarkMode ? <IconMoon /> : <IconSun />}
        onClick={() => {
          setIsDarkMode(!isDarkMode);
        }}
        {...buttonProps}
      />
    </Dropdown>
  );
};

export default DarkModeButton;
