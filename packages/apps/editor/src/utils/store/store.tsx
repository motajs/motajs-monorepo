import { type ComponentType, createContext, type FC, type ReactNode, useContext } from 'react';

const EMPTY = Symbol('EMPTY');

export interface StoreProviderProps {
  children: ReactNode;
}

export interface Store<Value> {
  Provider: ComponentType<StoreProviderProps>;
  useStore(): Value;
}

export interface ParameterfulStoreProviderProps<Argument> {
  argument: Argument;
  children: ReactNode;
}

export interface ParameterfulStore<Value, Argument> {
  Provider: ComponentType<ParameterfulStoreProviderProps<Argument>>;
  useStore(): Value;
}

export function createStore<Value>(useHook: () => Value): Store<Value>;
export function createStore<Value, Argument>(
  useHook: (arg: Argument) => Value,
): ParameterfulStore<Value, Argument>;
export function createStore<Value, Argument>(
  useHook: (() => Value) | ((arg: Argument) => Value),
): Store<Value> | ParameterfulStore<Value, Argument> {
  const Context = createContext<Value | typeof EMPTY>(EMPTY);

  const Provider: FC<StoreProviderProps | ParameterfulStoreProviderProps<Argument>> = (props) => {
    // @ts-expect-error only parameterful one will has argument
    const value = useHook(props.argument);
    return <Context.Provider value={value}>{props.children}</Context.Provider>;
  };

  const useStore = (): Value => {
    const value = useContext(Context);
    if (value === EMPTY) {
      throw new Error('Component must be wrapped with <Container.Provider>');
    }
    return value;
  };

  return {
    Provider,
    useStore,
  };
}

export const mergeStores = (stores: Store<unknown>[]): FC<{ children: ReactNode }> => {
  const EmptyProvider: FC<{ children: ReactNode }> = ({ children }) => <>{children}</>;

  const Provider = stores
    .map((store) => store.Provider)
    .reduce(
      (PrevProvider, CurrentProvider) =>
        ({ children }) =>
          (
            <PrevProvider>
              <CurrentProvider>{children}</CurrentProvider>
            </PrevProvider>
          ),
      EmptyProvider,
    );

  return ({ children }) => <Provider>{children}</Provider>;
};
