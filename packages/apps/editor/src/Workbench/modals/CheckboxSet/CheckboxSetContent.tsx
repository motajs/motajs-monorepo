import { useMemo, type FC } from "react";
import type { CheckboxSetConfig } from "../shared/types";

interface CheckboxSetContentProps {
  value: Array<string | number>;
  comments: CheckboxSetConfig;
  onChange: (value: Array<string | number>) => void;
}

export const CheckboxSetContent: FC<CheckboxSetContentProps> = ({ value, comments, onChange }) => {
  const { keys, prefixes } = useMemo(() => {
    const nextKeys = Array.from(comments.key);
    const nextPrefixes = Array.from(comments.prefix);
    value.forEach((item) => {
      if (!nextKeys.includes(item)) {
        nextPrefixes.push(`${item}: `);
        nextKeys.push(item);
      }
    });
    return { keys: nextKeys, prefixes: nextPrefixes };
  }, [comments.key, comments.prefix, value]);

  const toggleValue = (item: string | number, checked: boolean) => {
    if (checked) {
      if (value.includes(item)) return;
      onChange([...value, item]);
    } else {
      onChange(value.filter((one) => one !== item));
    }
  };

  return (
    <div id="uieventExtraBody" data-test-id="checkbox-set-content" style={{ display: "block", marginTop: "-10px" }}>
      <table style={{ width: "100%" }}>
        <tbody>
          {keys.map((item, index) => {
            const checked = value.includes(item);
            if (index % 3 === 0) {
              return (
                <tr key={`row-${String(item)}`}>
                  <td className="popCheckboxItem">
                    {prefixes[index]}
                    <input
                      type="checkbox"
                      data-test-id={`checkbox-set-${String(item)}`}
                      className="uieventCheckboxSet"
                      checked={checked}
                      onChange={(event) => toggleValue(item, event.target.checked)}
                    />
                  </td>
                  {keys[index + 1] != null && (
                    <td className="popCheckboxItem">
                      {prefixes[index + 1]}
                      <input
                          type="checkbox"
                          data-test-id={`checkbox-set-${String(keys[index + 1])}`}
                        className="uieventCheckboxSet"
                        checked={value.includes(keys[index + 1])}
                        onChange={(event) => toggleValue(keys[index + 1], event.target.checked)}
                      />
                    </td>
                  )}
                  {keys[index + 2] != null && (
                    <td className="popCheckboxItem">
                      {prefixes[index + 2]}
                      <input
                          type="checkbox"
                          data-test-id={`checkbox-set-${String(keys[index + 2])}`}
                        className="uieventCheckboxSet"
                        checked={value.includes(keys[index + 2])}
                        onChange={(event) => toggleValue(keys[index + 2], event.target.checked)}
                      />
                    </td>
                  )}
                </tr>
              );
            }
            return null;
          })}
        </tbody>
      </table>
    </div>
  );
};
