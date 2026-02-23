import React, { createContext, useContext, useReducer } from 'react';

export type Tab = 'tasks' | 'create' | 'profile' | 'directory' | 'cars' | 'admin' | 'archive' | 'available';

type TabState = { activeTab: Tab };
type TabAction = { type: 'SET_TAB'; tab: Tab };

const initial: TabState = { activeTab: 'tasks' };
function tabReducer(s: TabState, a: TabAction): TabState {
  return a.type === 'SET_TAB' ? { ...s, activeTab: a.tab } : s;
}

const TabCtx = createContext<{ activeTab: Tab; dispatch: React.Dispatch<TabAction> }>(null as any);

export function TabProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(tabReducer, initial);
  return (
    <TabCtx.Provider value={{ activeTab: state.activeTab, dispatch }}>
      {children}
    </TabCtx.Provider>
  );
}

export function useTab() {
  return useContext(TabCtx);
}
