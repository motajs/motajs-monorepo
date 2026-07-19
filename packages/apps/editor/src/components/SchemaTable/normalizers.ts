import type { Normalizer, NormalizerRegistry, RawSlot } from "./types";

function present<T>(value: T): RawSlot<T> { return { present: true, value }; }
const missing: RawSlot<never> = { present: false };

export const identityNormalizer: Normalizer<unknown, unknown> = {
  toEdit: (raw) => raw.present ? raw.value : undefined,
  toRaw: (edit) => present(edit),
};

export const nullableScalarOrListNormalizer: Normalizer<unknown, string[]> = {
  toEdit(raw) {
    if (!raw.present || raw.value === null) return [];
    if (typeof raw.value === "string") return [raw.value];
    if (Array.isArray(raw.value) && raw.value.every((item) => typeof item === "string")) return [...raw.value];
    throw new Error("Expected null, a string, or an array of strings");
  },
  toRaw(edit) {
    if (!Array.isArray(edit) || !edit.every((item) => typeof item === "string")) {
      throw new Error("Expected an array of strings from the material editor");
    }
    if (edit.length === 0) return present(null);
    if (edit.length === 1) return present(edit[0]);
    return present(edit);
  },
};

export const numericScalarOrListNormalizer: Normalizer<unknown, number[]> = {
  toEdit(raw) {
    if (!raw.present || raw.value == null || raw.value === 0) return [];
    if (typeof raw.value === "number" && Number.isFinite(raw.value)) return [raw.value];
    if (Array.isArray(raw.value) && raw.value.every((item) => typeof item === "number" && Number.isFinite(item))) {
      return [...raw.value];
    }
    throw new Error("Expected 0, a finite number, or an array of finite numbers");
  },
  toRaw(edit) {
    if (!Array.isArray(edit) || !edit.every((item) => typeof item === "number" && Number.isFinite(item))) {
      throw new Error("Expected an array of finite numbers from the checkbox editor");
    }
    return present([...edit]);
  },
};

function optionalNormalizer(validate: (value: unknown) => boolean, description: string): Normalizer<unknown, unknown> {
  return {
    toEdit(raw) {
      if (!raw.present || raw.value == null) return null;
      if (!validate(raw.value)) throw new Error(`Expected ${description}`);
      return raw.value;
    },
    toRaw(edit) {
      if (edit == null) return missing;
      if (!validate(edit)) throw new Error(`Expected ${description}`);
      return present(edit);
    },
  };
}

export const optionalPointNormalizer = optionalNormalizer(
  (value) => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite),
  "null or a two-number point",
);

export const optionalColorNormalizer = optionalNormalizer(
  (value) => Array.isArray(value)
    && (value.length === 3 || value.length === 4)
    && value.slice(0, 3).every((item) => typeof item === "number" && item >= 0 && item <= 255)
    && (value.length === 3 || (typeof value[3] === "number" && value[3] >= 0 && value[3] <= 1)),
  "null or an RGB/RGBA array",
);

export interface WeatherEditingValue {
  type: string;
  level: number;
}

function validWeatherLevel(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 10;
}

export const optionalWeatherNormalizer: Normalizer<unknown, WeatherEditingValue> = {
  toEdit(raw) {
    if (!raw.present || raw.value == null) return { type: "", level: 5 };
    if (
      !Array.isArray(raw.value)
      || raw.value.length !== 2
      || typeof raw.value[0] !== "string"
      || raw.value[0].length === 0
      || !validWeatherLevel(raw.value[1])
    ) {
      throw new Error("Expected null or a [weather type, integer level from 1 to 10] tuple");
    }
    return { type: raw.value[0], level: raw.value[1] };
  },
  toRaw(edit) {
    if (edit == null) return missing;
    if (!edit || typeof edit !== "object" || Array.isArray(edit)) {
      throw new Error("Expected a weather editing record");
    }
    const value = edit as Partial<WeatherEditingValue>;
    if (value.type === "") return missing;
    if (typeof value.type !== "string" || !validWeatherLevel(value.level)) {
      throw new Error("Expected a weather type and an integer level from 1 to 10");
    }
    return present([value.type, value.level]);
  },
};

export const optionalJsonNormalizer: Normalizer<unknown, unknown> = {
  toEdit: (raw) => raw.present ? raw.value : null,
  toRaw: (edit) => edit == null ? missing : present(edit),
};

export const optionalStringListNormalizer: Normalizer<unknown, string[]> = {
  toEdit(raw) {
    if (!raw.present || raw.value == null) return [];
    if (!Array.isArray(raw.value) || !raw.value.every((item) => typeof item === "string")) {
      throw new Error("Expected an array of strings");
    }
    return [...raw.value];
  },
  toRaw(edit) {
    if (!Array.isArray(edit) || !edit.every((item) => typeof item === "string")) {
      throw new Error("Expected an array of strings");
    }
    return edit.length === 0 ? missing : present(edit);
  },
};

export const optionalEventListNormalizer: Normalizer<unknown, unknown[] | null> = {
  toEdit(raw) {
    if (!raw.present || raw.value == null) return [];
    if (!Array.isArray(raw.value)) throw new Error("Expected an event array or null");
    return [...raw.value];
  },
  toRaw(edit) {
    if (edit == null) return missing;
    if (!Array.isArray(edit)) throw new Error("Expected an event array");
    return edit.length === 0 ? missing : present(edit);
  },
};

export type EventEntryEditingValue = unknown[] | Record<string, unknown>;

export const optionalEventNormalizer: Normalizer<unknown, EventEntryEditingValue> = {
  toEdit(raw) {
    if (!raw.present || raw.value == null) return [];
    if (Array.isArray(raw.value)) return [...raw.value];
    if (!raw.value || typeof raw.value !== "object") {
      throw new Error("Expected an event array, configured event object, or null");
    }
    const value = raw.value as Record<string, unknown>;
    if (value.data != null && !Array.isArray(value.data)) {
      throw new Error("Expected configured event data to be an array or null");
    }
    return {
      ...value,
      ...(Array.isArray(value.data) ? { data: [...value.data] } : {}),
    };
  },
  toRaw(edit) {
    if (Array.isArray(edit)) return edit.length === 0 ? missing : present(edit);
    if (!edit || typeof edit !== "object") {
      throw new Error("Expected an event array or configured event object");
    }
    if (edit.data != null && !Array.isArray(edit.data)) {
      throw new Error("Expected configured event data to be an array or null");
    }
    return present(edit);
  },
};

export interface AutoEventEditingPage {
  id: number;
  value: Record<string, unknown> | null;
}

function autoEventPage(value: unknown, label: string): Record<string, unknown> | null {
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an auto-event object or null`);
  }
  return value as Record<string, unknown>;
}

export const autoEventPagesNormalizer: Normalizer<unknown, AutoEventEditingPage[]> = {
  toEdit(raw) {
    if (!raw.present || raw.value == null) return [];
    if (!raw.value || typeof raw.value !== "object" || Array.isArray(raw.value)) {
      throw new Error("Expected an auto-event page record or null");
    }
    return Object.entries(raw.value as Record<string, unknown>)
      .map(([key, value]) => {
        if (!/^(0|[1-9]\d*)$/.test(key)) throw new Error(`Invalid auto-event page id: ${key}`);
        const id = Number(key);
        if (!Number.isSafeInteger(id)) throw new Error(`Auto-event page id is too large: ${key}`);
        return { id, value: autoEventPage(value, `Page ${key}`) };
      })
      .sort((left, right) => left.id - right.id);
  },
  toRaw(edit) {
    if (!Array.isArray(edit)) throw new Error("Expected an auto-event page list");
    const result: Record<string, unknown> = {};
    for (const [index, rawPage] of edit.entries()) {
      if (!rawPage || typeof rawPage !== "object" || Array.isArray(rawPage)) {
        throw new Error(`Page ${index} must be an editing record`);
      }
      const page = rawPage as Partial<AutoEventEditingPage>;
      if (!Number.isSafeInteger(page.id) || Number(page.id) < 0) {
        throw new Error(`Page ${index} has an invalid id`);
      }
      const key = String(page.id);
      if (Object.prototype.hasOwnProperty.call(result, key)) throw new Error(`Duplicate auto-event page id: ${key}`);
      result[key] = autoEventPage(page.value, `Page ${key}`);
    }
    return Object.keys(result).length === 0 ? missing : present(result);
  },
};

interface PassabilityEditingValue {
  cannotOut: string[];
  cannotIn: string[];
}

function stringList(value: unknown, field: string): string[] {
  if (value == null) return [];
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`${field} must be an array of strings`);
  }
  return [...value];
}

export const passabilityNormalizer: Normalizer<unknown, PassabilityEditingValue> = {
  toEdit(raw) {
    if (!raw.present) return { cannotOut: [], cannotIn: [] };
    if (!raw.value || typeof raw.value !== "object" || Array.isArray(raw.value)) {
      throw new Error("Expected a combined passability record");
    }
    const value = raw.value as Record<string, unknown>;
    return {
      cannotOut: stringList(value.cannotOut, "cannotOut"),
      cannotIn: stringList(value.cannotIn, "cannotIn"),
    };
  },
  toRaw(edit) {
    if (!edit || typeof edit !== "object" || Array.isArray(edit)) {
      throw new Error("Expected a passability editing record");
    }
    const value = edit as Partial<PassabilityEditingValue>;
    const cannotOut = stringList(value.cannotOut, "cannotOut");
    const cannotIn = stringList(value.cannotIn, "cannotIn");
    return {
      present: true,
      value: {
        ...(cannotOut.length > 0 ? { cannotOut } : {}),
        ...(cannotIn.length > 0 ? { cannotIn } : {}),
      },
    };
  },
};

export const builtinNormalizers: NormalizerRegistry = {
  identity: identityNormalizer as Normalizer<unknown, unknown>,
  nullableScalarOrList: nullableScalarOrListNormalizer as Normalizer<unknown, unknown>,
  numericScalarOrList: numericScalarOrListNormalizer as Normalizer<unknown, unknown>,
  optionalPoint: optionalPointNormalizer,
  optionalColor: optionalColorNormalizer,
  optionalWeather: optionalWeatherNormalizer as Normalizer<unknown, unknown>,
  optionalJson: optionalJsonNormalizer,
  optionalStringList: optionalStringListNormalizer as Normalizer<unknown, unknown>,
  optionalEventList: optionalEventListNormalizer as Normalizer<unknown, unknown>,
  optionalEvent: optionalEventNormalizer as Normalizer<unknown, unknown>,
  autoEventPages: autoEventPagesNormalizer as Normalizer<unknown, unknown>,
  passability: passabilityNormalizer as Normalizer<unknown, unknown>,
};
