import type { Diagnostic } from '@/components/SchemaTable';
import type { TowerData } from '@/services/tower';

function diagnostic(source: string, code: string, message: string): Diagnostic {
  return { source, code, message, severity: 'error' };
}

export function buildTowerDiagnostics(tower: TowerData): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const firstData = tower.firstData as Record<string, unknown>;
  const hero = firstData.hero && typeof firstData.hero === 'object' ? (firstData.hero as Record<string, unknown>) : {};
  const values = tower.values ?? {};

  if (typeof firstData.name !== 'string' || !/^[A-Za-z0-9_]{1,30}$/.test(firstData.name)) {
    diagnostics.push(
      diagnostic('tower:firstData.name', 'tower.name.invalid', '工程标识符必须是 1 到 30 位字母、数字或下划线。'),
    );
  }

  if (!Array.isArray(tower.main.floorIds) || !tower.main.floorIds.includes(tower.firstData.floorId)) {
    diagnostics.push(
      diagnostic('tower:firstData.floorId', 'tower.initial-floor.invalid', '初始楼层不在当前楼层列表中。'),
    );
  }

  if (typeof hero.lv !== 'number' || !Number.isInteger(hero.lv) || hero.lv <= 0) {
    diagnostics.push(diagnostic('tower:firstData.hero.lv', 'tower.hero.level', '初始等级必须是正整数。'));
  }

  const numericSources: Array<[string, unknown]> = [
    ...Object.entries(values).map(([key, value]) => [`tower:values.${key}`, value] as [string, unknown]),
    ...['hpmax', 'hp', 'manamax', 'mana', 'atk', 'def', 'mdef', 'money', 'exp'].map(
      (key) => [`tower:firstData.hero.${key}`, hero[key]] as [string, unknown],
    ),
  ];
  for (const [source, value] of numericSources) {
    if (value != null && (typeof value !== 'number' || !Number.isFinite(value))) {
      diagnostics.push(diagnostic(source, 'tower.number.finite', '该值必须是有限数字。'));
    }
  }

  const rows = values.statusCanvasRowsOnMobile;
  if (rows != null && (!Number.isInteger(rows) || Number(rows) < 1 || Number(rows) > 5)) {
    diagnostics.push(
      diagnostic(
        'tower:values.statusCanvasRowsOnMobile',
        'tower.status.rows',
        '竖状态栏自绘行数必须是 1 到 5 的整数。',
      ),
    );
  }

  return diagnostics;
}
