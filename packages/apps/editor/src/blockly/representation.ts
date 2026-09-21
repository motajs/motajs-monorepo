const STATUS_NAMES: Record<string, string> = {
  hp: '生命',
  name: '名称',
  atk: '攻击',
  def: '防御',
  mdef: '魔防',
  money: '金币',
  exp: '经验',
  point: '加点',
  special: '属性',
};
const STATUS_IDS = Object.fromEntries(Object.entries(STATUS_NAMES).map(([id, name]) => [name, id]));

export function replaceExpressionForDisplay(value: string): string {
  let result = value.replace(/status:([A-Za-z0-9_]+)/g, (_all, id: string) => `状态：${STATUS_NAMES[id] ?? id}`);
  result = result
    .replace(/buff:/g, '增益：')
    .replace(/item:/g, '物品：')
    .replace(/flag:/g, '变量：')
    .replace(/switch:/g, '独立开关：')
    .replace(/global:/g, '全局存储：')
    .replace(/enemy:/g, '怪物：')
    .replace(/blockId:/g, '图块ID：')
    .replace(/blockNumber:/g, '图块数字：')
    .replace(/blockCls:/g, '图块类别：')
    .replace(/equip:/g, '装备孔：');
  return result;
}

export function replaceExpressionFromDisplay(value: string): string {
  let result = value.replace(
    /状态[:：]([A-Za-z0-9_\u4E00-\u9FCC]+)/g,
    (_all, name: string) => `status:${STATUS_IDS[name] ?? name}`,
  );
  result = result
    .replace(/增益[:：]/g, 'buff:')
    .replace(/物品[:：]/g, 'item:')
    .replace(/变量[:：]/g, 'flag:')
    .replace(/独立开关[:：]/g, 'switch:')
    .replace(/全局存储[:：]/g, 'global:')
    .replace(/怪物[:：]/g, 'enemy:')
    .replace(/图块ID[:：]/g, 'blockId:')
    .replace(/图块数字[:：]/g, 'blockNumber:')
    .replace(/图块类别[:：]/g, 'blockCls:')
    .replace(/装备孔[:：]/g, 'equip:');
  return result;
}
