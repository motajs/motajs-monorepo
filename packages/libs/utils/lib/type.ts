export type Nullable<T> = T | null | undefined;

export const isNonNullable = <T>(val: T): val is NonNullable<T> => val != null;

export type Optional<T> = T | undefined;
