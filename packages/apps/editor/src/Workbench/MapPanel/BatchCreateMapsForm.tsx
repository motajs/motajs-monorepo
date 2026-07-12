import { type FC, useState } from "react";
import { floorCommands, type BatchCreateFloorOptions } from "@/project/commands";
import { useTowerDataSuspense } from "@/hooks/suspense";
import { setCurrentFloorId } from "@/stores/editorState";
import { notifyCommandResult, notifyError } from "@/utils/notify";
import { isValidFloorId } from "@/utils/string";

interface BatchCreateMapsFormProps {
  visible: boolean;
}

type TemplateToken = number | "i" | "+" | "-" | "*" | "/" | "%" | "(" | ")";

function tokenizeTemplateExpression(expression: string): TemplateToken[] {
  const tokens: TemplateToken[] = [];
  let index = 0;

  while (index < expression.length) {
    const char = expression[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (char === "i" || "+-*/%()".includes(char)) {
      tokens.push(char as TemplateToken);
      index += 1;
      continue;
    }
    const match = expression.slice(index).match(/^\d+(?:\.\d+)?/);
    if (!match) {
      throw new Error(`模板表达式不合法: ${expression}`);
    }
    tokens.push(Number(match[0]));
    index += match[0].length;
  }

  return tokens;
}

function evalTemplateExpression(expression: string, i: number): string {
  const tokens = tokenizeTemplateExpression(expression);
  let index = 0;

  const read = () => tokens[index];
  const take = () => tokens[index++];

  const parseFactor = (): number => {
    const token = take();
    if (typeof token === "number") return token;
    if (token === "i") return i;
    if (token === "+") return parseFactor();
    if (token === "-") return -parseFactor();
    if (token === "(") {
      const value = parseExpression();
      if (take() !== ")") throw new Error(`模板表达式不合法: ${expression}`);
      return value;
    }
    throw new Error(`模板表达式不合法: ${expression}`);
  };

  const parseTerm = (): number => {
    let value = parseFactor();
    while (read() === "*" || read() === "/" || read() === "%") {
      const op = take();
      const next = parseFactor();
      if (op === "*") value *= next;
      if (op === "/") value /= next;
      if (op === "%") value %= next;
    }
    return value;
  };

  function parseExpression(): number {
    let value = parseTerm();
    while (read() === "+" || read() === "-") {
      const op = take();
      const next = parseTerm();
      value = op === "+" ? value + next : value - next;
    }
    return value;
  }

  const value = parseExpression();
  if (index !== tokens.length || !Number.isFinite(value)) {
    throw new Error(`模板表达式不合法: ${expression}`);
  }
  return String(value);
}

export const BatchCreateMapsForm: FC<BatchCreateMapsFormProps> = (props) => {
  const { visible } = props;
  const [tower] = useTowerDataSuspense();

  const [newMapsWidth, setNewMapsWidth] = useState("13");
  const [newMapsHeight, setNewMapsHeight] = useState("13");
  const [newFloorIds, setNewFloorIds] = useState("MT${i}");
  const [newFloorTitles, setNewFloorTitles] = useState("主塔 ${i} 层");
  const [newFloorNames, setNewFloorNames] = useState("${i}");
  const [newMapsFrom, setNewMapsFrom] = useState("1");
  const [newMapsTo, setNewMapsTo] = useState("5");
  const [newMapsStatus, setNewMapsStatus] = useState(true);

  const applyTemplate = (template: string, i: number): string => {
    try {
      return template.replace(/\${(.*?)}/g, (_word, value: string) =>
        evalTemplateExpression(value, i)
      );
    } catch (error) {
      notifyError(error);
      throw error;
    }
  };

  const createNewMaps = async () => {
    if (!newFloorIds) return;
    const from = parseInt(newMapsFrom, 10);
    const to = parseInt(newMapsTo, 10);
    if (Number.isNaN(from) || Number.isNaN(to) || from > to) {
      notifyError("请输入有效的起始和终止楼层");
      return;
    }
    if (to - from >= 100) {
      notifyError("一次最多创建99个楼层");
      return;
    }

    const width = parseInt(newMapsWidth, 10);
    const height = parseInt(newMapsHeight, 10);
    if (Number.isNaN(width) || Number.isNaN(height) || width > 128 || height > 128) {
      notifyError("新建地图的宽高都不得大于128");
      return;
    }

    const floors: BatchCreateFloorOptions[] = [];
    const seen = new Set<string>();
    for (let i = from; i <= to; i += 1) {
      let floorId: string;
      let title: string;
      let name: string;
      try {
        floorId = applyTemplate(newFloorIds, i);
        title = newMapsStatus ? applyTemplate(newFloorTitles, i) : floorId;
        name = newMapsStatus ? applyTemplate(newFloorNames, i) : floorId;
      } catch {
        return;
      }

      const normalized = floorId.toLowerCase();
      if (tower.main.floorIds.some((id) => id.toLowerCase() === normalized)) {
        notifyError("同名楼层已存在！(不区分大小写)");
        return;
      }
      if (!isValidFloorId(floorId)) {
        notifyError("楼层名 " + floorId + " 不合法！请使用字母、数字、下划线，且不能以数字开头！");
        return;
      }
      if (seen.has(normalized)) {
        notifyError("尝试重复创建楼层 " + floorId + " ！");
        return;
      }
      seen.add(normalized);
      floors.push({ floorId, title, name, width, height });
    }

    const result = await floorCommands.batchCreate(floors);
    if (notifyCommandResult(result, "批量创建 " + floors[0].floorId + "~" + floors[floors.length - 1].floorId + " 成功")) {
      setCurrentFloorId(floors[0].floorId);
    }
  };

  return (
    <div id="newFloors" data-test-id="map-batch-form" style={{ display: visible ? "block" : "none" }}>
      <span style={{ verticalAlign: "bottom" }}>楼层ID格式:</span>
      <input
        id="newFloorIds"
        data-test-id="map-batch-floor-ids"
        style={{ width: 70 }}
        value={newFloorIds}
        onChange={(e) => setNewFloorIds(e.target.value)}
      />
      <span style={{ verticalAlign: "bottom" }}>地图中文名格式:</span>
      <input
        id="newFloorTitles"
        data-test-id="map-batch-floor-titles"
        style={{ width: 100 }}
        value={newFloorTitles}
        onChange={(e) => setNewFloorTitles(e.target.value)}
      />
      <br />
      <span style={{ verticalAlign: "bottom" }}>状态栏名称:</span>
      <input
        id="newFloorNames"
        data-test-id="map-batch-floor-names"
        style={{ width: 70 }}
        value={newFloorNames}
        onChange={(e) => setNewFloorNames(e.target.value)}
      />
      <span style={{ verticalAlign: "bottom" }}>宽</span>
      <input
        id="newMapsWidth"
        data-test-id="map-batch-width"
        style={{ width: 20 }}
        value={newMapsWidth}
        onChange={(e) => setNewMapsWidth(e.target.value)}
      />
      <span style={{ verticalAlign: "bottom" }}>高</span>
      <input
        id="newMapsHeight"
        data-test-id="map-batch-height"
        style={{ width: 20 }}
        value={newMapsHeight}
        onChange={(e) => setNewMapsHeight(e.target.value)}
      />
      <input
        type="checkbox"
        id="newMapsStatus"
        checked={newMapsStatus}
        onChange={(e) => setNewMapsStatus(e.target.checked)}
        style={{ verticalAlign: "bottom" }}
      />
      <span style={{ verticalAlign: "bottom", marginLeft: "-4px" }}>
        保留楼层属性
      </span>
      <br />
      <span style={{ verticalAlign: "bottom" }}>从 i=</span>
      <input
        id="newMapsFrom"
        data-test-id="map-batch-from"
        value={newMapsFrom}
        onChange={(e) => setNewMapsFrom(e.target.value)}
        style={{ width: 20 }}
      />
      <span style={{ verticalAlign: "bottom" }}>到</span>
      <input
        id="newMapsTo"
        data-test-id="map-batch-to"
        value={newMapsTo}
        onChange={(e) => setNewMapsTo(e.target.value)}
        style={{ width: 20 }}
      />
      <input type="button" defaultValue="确认创建" onClick={createNewMaps} data-test-id="map-batch-submit" />
    </div>
  );
};
