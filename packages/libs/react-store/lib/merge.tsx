import { FC, ReactNode } from "react";
import { Store } from "./store";

export const mergeStores = (stores: Store<unknown>[]) => {
  const providers = stores
    .map((store) => store.Provider)
    .reduceRight(
      (prevProviders, CurrentProvider) => (children) => (
        <CurrentProvider>
          {prevProviders(children)}
        </CurrentProvider>
      ),
      (children: ReactNode) => children,
    );

  const Provider: FC<{ children: ReactNode }> = ({ children }) => providers(children);

  return Provider;
};
