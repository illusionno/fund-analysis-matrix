import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AiConfig {
  apiKey: string;
  apiBase: string;
  model: string;
}

type State = AiConfig & {
  setApiKey: (key: string) => void;
  setApiBase: (base: string) => void;
  setModel: (model: string) => void;
  setAll: (config: AiConfig) => void;
  /** 是否至少填写了 API Key */
  isConfigured: () => boolean;
};

export const useConfig = create<State>()(
  persist(
    (set, get) => ({
      apiKey: "",
      apiBase: "",
      model: "",

      setApiKey(key) {
        set({ apiKey: key });
      },
      setApiBase(base) {
        set({ apiBase: base });
      },
      setModel(model) {
        set({ model });
      },
      setAll(config) {
        set(config);
      },
      isConfigured() {
        return get().apiKey.trim().length > 0;
      },
    }),
    { name: "fund-matrix-ai-config" },
  ),
);
