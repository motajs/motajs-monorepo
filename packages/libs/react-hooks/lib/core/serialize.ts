import { Optional, combine } from "@motajs/utils";
import { State } from "@/utils/type";
import { useCurrentFn } from "./common";
import { SetStateAction } from "react";
import { isFunction } from "lodash-es";

type Unserialize<S> = (raw: string) => Optional<S>;
type Serialize<S> = (value: S) => string;

const createUseAs = <S>(serialize: Serialize<S>, unserialize: Unserialize<S>) => {
  const optionalSerialize = (value: Optional<S>) => value === void 0 ? void 0 : serialize(value);
  const optionalUnserialize = (raw: Optional<string>) => raw === void 0 ? void 0 : unserialize(raw);

  const useAsCast = (state: State<Optional<string>>): State<Optional<S>> => {
    const [rawValue, setRawValue] = state;

    const value = optionalUnserialize(rawValue);

    const setValue = useCurrentFn((value: SetStateAction<Optional<S>>) => {
      if (isFunction(value)) {
        setRawValue((prev) => {
          const newValue = value(optionalUnserialize(prev));
          return optionalSerialize(newValue);
        });
      } else {
        setRawValue(optionalSerialize(value));
      }
    });

    return [value, setValue];
  };
  return useAsCast;
};

const fromBoolean: Serialize<boolean> = (value) => {
  switch (value) {
    case true: return "true";
    case false: return "false";
  }
};

const toBoolean: Unserialize<boolean> = (raw) => {
  switch (raw) {
    case "true": return true;
    case "false": return false;
    default: return void 0;
  }
};

export const useAsBoolean = createUseAs(fromBoolean, toBoolean);
export const withAsBoolean = <A extends unknown[]>(hook: (...args: A) => State<Optional<string>>) => combine(hook, useAsBoolean);

const fromNumber: Serialize<number> = (value) => value.toString();

const toNumber: Unserialize<number> = (raw) => Number(raw);

export const useAsNumber = createUseAs(fromNumber, toNumber);
export const withAsNumber = <A extends unknown[]>(hook: (...args: A) => State<Optional<string>>) => combine(hook, useAsBoolean);
