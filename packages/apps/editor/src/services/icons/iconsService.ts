export type IconIndex = Record<string, number | Record<string, unknown>>;

export interface IconsData {
  [images: string]: IconIndex;
}
