import { type FC, useState } from 'react';
import { Button, Input } from 'antd';
import { floorCommands, type BatchCreateFloorOptions } from '@/project/commands';
import { useTowerDataSuspense } from '@/hooks/suspense';
import { notifyCommandResult, notifyError } from '@/utils/notify';
import { isValidFloorId } from '@/utils/string';

interface BatchCreateMapsFormProps {
  onSuccess?(floorId: string): void;
}

type TemplateToken = number | 'i' | '+' | '-' | '*' | '/' | '%' | '(' | ')';

function tokenizeTemplateExpression(expression: string): TemplateToken[] {
  const tokens: TemplateToken[] = [];
  let index = 0;

  while (index < expression.length) {
    const char = expression[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (char === 'i' || '+-*/%()'.includes(char)) {
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
    if (typeof token === 'number') return token;
    if (token === 'i') return i;
    if (token === '+') return parseFactor();
    if (token === '-') return -parseFactor();
    if (token === '(') {
      const value = parseExpression();
      if (take() !== ')') throw new Error(`模板表达式不合法: ${expression}`);
      return value;
    }
    throw new Error(`模板表达式不合法: ${expression}`);
  };

  const parseTerm = (): number => {
    let value = parseFactor();
    while (read() === '*' || read() === '/' || read() === '%') {
      const op = take();
      const next = parseFactor();
      if (op === '*') value *= next;
      if (op === '/') value /= next;
      if (op === '%') value %= next;
    }
    return value;
  };

  function parseExpression(): number {
    let value = parseTerm();
    while (read() === '+' || read() === '-') {
      const op = take();
      const next = parseTerm();
      value = op === '+' ? value + next : value - next;
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
  const { onSuccess } = props;
  const [tower] = useTowerDataSuspense();

  const [newMapsWidth, setNewMapsWidth] = useState('13');
  const [newMapsHeight, setNewMapsHeight] = useState('13');
  const [newFloorIds, setNewFloorIds] = useState('MT${i}');
  const [newFloorTitles, setNewFloorTitles] = useState('主塔 ${i} 层');
  const [newFloorNames, setNewFloorNames] = useState('${i}');
  const [newMapsFrom, setNewMapsFrom] = useState('1');
  const [newMapsTo, setNewMapsTo] = useState('5');

  const applyTemplate = (template: string, i: number): string => {
    try {
      return template.replace(/\${(.*?)}/g, (_word, value: string) => evalTemplateExpression(value, i));
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
      notifyError('请输入有效的起始和终止楼层');
      return;
    }
    if (to - from + 1 > 99) {
      notifyError('一次最多创建99个楼层');
      return;
    }

    const width = parseInt(newMapsWidth, 10);
    const height = parseInt(newMapsHeight, 10);
    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width <= 0 ||
      height <= 0 ||
      width > 128 ||
      height > 128
    ) {
      notifyError('新建地图的宽高必须是 1 到 128 的整数');
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
        title = newFloorTitles ? applyTemplate(newFloorTitles, i) : floorId;
        name = newFloorNames ? applyTemplate(newFloorNames, i) : floorId;
      } catch {
        return;
      }

      const normalized = floorId.toLowerCase();
      if (tower.main.floorIds.some((id) => id.toLowerCase() === normalized)) {
        notifyError('同名楼层已存在！(不区分大小写)');
        return;
      }
      if (!isValidFloorId(floorId)) {
        notifyError('楼层名 ' + floorId + ' 不合法！请使用字母、数字、下划线，且不能以数字开头！');
        return;
      }
      if (seen.has(normalized)) {
        notifyError('尝试重复创建楼层 ' + floorId + ' ！');
        return;
      }
      seen.add(normalized);
      floors.push({ floorId, title, name, width, height });
    }

    const result = await floorCommands.batchCreate(floors);
    if (
      notifyCommandResult(result, '批量创建 ' + floors[0].floorId + '~' + floors[floors.length - 1].floorId + ' 成功')
    ) {
      onSuccess?.(floors[0].floorId);
    }
  };

  return (
    <div className="mapBatchCreateForm" data-test-id="map-batch-form">
      <label>
        楼层 ID 模板
        <Input
          data-test-id="map-batch-floor-ids"
          value={newFloorIds}
          onChange={(event) => setNewFloorIds(event.target.value)}
        />
      </label>
      <label>
        楼层标题模板
        <Input
          data-test-id="map-batch-floor-titles"
          value={newFloorTitles}
          onChange={(event) => setNewFloorTitles(event.target.value)}
        />
      </label>
      <label>
        状态栏名称模板
        <Input
          data-test-id="map-batch-floor-names"
          value={newFloorNames}
          onChange={(event) => setNewFloorNames(event.target.value)}
        />
      </label>
      <div className="mapBatchRange">
        <label>
          起始 i
          <Input
            data-test-id="map-batch-from"
            value={newMapsFrom}
            onChange={(event) => setNewMapsFrom(event.target.value)}
          />
        </label>
        <span>至</span>
        <label>
          结束 i
          <Input data-test-id="map-batch-to" value={newMapsTo} onChange={(event) => setNewMapsTo(event.target.value)} />
        </label>
      </div>
      <div className="mapCreateDimensions">
        <label>
          宽
          <Input
            data-test-id="map-batch-width"
            value={newMapsWidth}
            onChange={(event) => setNewMapsWidth(event.target.value)}
          />
        </label>
        <span>×</span>
        <label>
          高
          <Input
            data-test-id="map-batch-height"
            value={newMapsHeight}
            onChange={(event) => setNewMapsHeight(event.target.value)}
          />
        </label>
      </div>
      <p className="mapBatchTemplateHint">
        模板支持 <code>{'${i}'}</code> 及简单算术表达式；每次最多创建 99 层。
      </p>
      <Button type="primary" onClick={() => void createNewMaps()} data-test-id="map-batch-submit">
        创建楼层
      </Button>
    </div>
  );
};
