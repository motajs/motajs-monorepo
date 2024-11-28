import { FC } from "react";
import DarkModeEffectSemi from "@motajs/react-dark-mode/DarkModeEffect/semi";
import { DarkModeStore } from "@motajs/react-dark-mode";
import { QueryClient, QueryClientProvider } from "react-query";
import MainView from "./MainView";

const queryClient = new QueryClient();

const App: FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <DarkModeStore.Provider>
        <DarkModeEffectSemi />
        <MainView />
      </DarkModeStore.Provider>
    </QueryClientProvider>
  );
};

export default App;
