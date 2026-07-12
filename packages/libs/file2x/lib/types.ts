export type PlainData = null | number | string | boolean | PlainData[] | {
  [key: string]: PlainData;
};

export interface Encode2xOptions {
  indent?: string | number;
  declaration?: "var" | "let" | "const";
}

export interface GameData2x<T = PlainData> {
  uuid: string;
  data: T;
}

export interface GameMapData2x<T = PlainData> {
  prefix: string[];
  mapId: string;
  data: T;
}

export type ScriptData = string | ScriptDataObject;

export interface ScriptDataObject {
  [key: string]: ScriptData;
}

export interface GameScript2x {
  uuid: string;
  data: ScriptDataObject;
}
