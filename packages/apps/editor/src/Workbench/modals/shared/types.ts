import type { ReactNode } from 'react';

export type UIData = string | Record<string, unknown>;

export interface CheckboxSetConfig {
  key: Array<string | number>;
  prefix: string[];
}

// Modal hook 返回类型
export type UseModalReturn<Options, Result> = [(options: Options) => Promise<Result | null>, ReactNode];

// SelectFloor
export interface SelectFloorOptions {
  title: string;
  initialFloorId?: string | string[];
}

// SelectMaterial
export interface SelectMaterialOptions {
  title: string;
  value?: string | string[];
  directory: string;
  source?:
    { kind: 'directory'; path: string } | { kind: 'project-images'; includeLogical: boolean } | { kind: 'animations' };
  multiple?: boolean;
  transform?: ((one: string) => string | null) | null;
}

// SelectPoint
export interface SelectPointOptions {
  floorId?: string;
  floorSelection?: 'selectable' | 'fixed';
  x?: number | string;
  y?: number | string;
  bigmap?: boolean;
  /** 是否允许通过右键选择多个坐标，默认 false。 */
  multiple?: boolean;
}

export interface SelectPointResult {
  floorId: string;
  x: number | string;
  y: number | string;
}

// CheckboxSet
export interface CheckboxSetOptions {
  title: string;
  value: unknown;
  comments: CheckboxSetConfig | (() => CheckboxSetConfig);
}

// PreviewUI
export interface PreviewUIOptions {
  list: UIData[];
  runtimeList?: UIData[];
}

// SearchFlags (无参数)
export type SearchFlagsOptions = Record<string, never>;

// StatusBarPreview
export interface StatusBarPreviewOptions {
  code: string;
}
