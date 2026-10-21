import { Button, Drawer, Spin } from 'antd';
import { ReactElement } from 'react';
import { TableGrid, TablePanelStatus } from '../../shared/schemaForm/components/TableGrid';
import { parseFieldPath } from '../../shared/schemaForm/model/fieldPath';
import { ITableRowNode } from '../../shared/schemaForm/types';

// 地图属性抽屉：受控视图，开 / 关与属性值都由面板持有，组件自己不存任何状态。
// 正文直接复用 shared/schemaForm 的表单模式（同一套控件 / 校验 / 字段路径），不另写一套属性表单；
// 抽屉里不出现保存入口，保存统一由「保存地图」触发。

export interface IMapPropertiesDrawerProps {
  /** 是否打开抽屉；只由 `IMapPanelViewState.propertiesOpen` 决定 */
  readonly open: boolean;
  /** 属性域的加载状态（由面板的 `propertiesStatus` 映射而来） */
  readonly status: TablePanelStatus;
  /** 属性表单的行树 */
  readonly rows: readonly ITableRowNode[];
  /** 加载失败的原因；没有失败时为 undefined */
  readonly error?: string;
  /**
   * 提交一个属性字段
   * @param path 字段路径段数组
   * @param value 新值
   */
  onChange(path: readonly (string | number)[], value: unknown): void;
  /** 加载失败后的「重试」 */
  onRetry(): void;
  /** 点抽屉关闭按钮 */
  onClose(): void;
}

/**
 * 渲染抽屉正文：加载与失败由抽屉自己给文案，其余状态交给表单引擎
 * @param props 抽屉 props
 * @returns 正文元素
 */
function renderBody(props: IMapPropertiesDrawerProps): ReactElement | null {
  if (props.status === TablePanelStatus.Loading) {
    return (
      <div className="emap-properties-state" data-test-id="map-properties-loading">
        <Spin size="small" />
        <span>正在加载地图属性…</span>
      </div>
    );
  }

  if (props.status === TablePanelStatus.Error) {
    return (
      <div className="emap-properties-state" data-test-id="map-properties-error" title={props.error}>
        <div className="emap-properties-error-title">地图属性加载失败</div>
        <div className="emap-properties-error-detail">请稍后重试。</div>
        <Button size="small" autoInsertSpace={false} onClick={props.onRetry}>
          重试
        </Button>
      </div>
    );
  }

  if (props.status === TablePanelStatus.NoTarget) return null;

  return (
    <TableGrid
      status={props.status}
      rows={props.rows}
      formMode
      onChange={(key: string, value: unknown): void => props.onChange(parseFieldPath(key), value)}
    />
  );
}

/**
 * 地图属性抽屉：标题「地图属性」、宽 480，正文只有一份可滚动的表单
 * @param props 抽屉 props
 * @returns 抽屉元素
 */
export function MapPropertiesDrawer(props: IMapPropertiesDrawerProps): ReactElement {
  return (
    <Drawer open={props.open} size={480} title="地图属性" destroyOnHidden onClose={props.onClose}>
      <div className="emap-properties" data-test-id="map-properties-drawer">
        <div className="emap-properties-body">{renderBody(props)}</div>
      </div>
    </Drawer>
  );
}
