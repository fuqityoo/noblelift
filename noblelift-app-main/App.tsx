import React, { useEffect, useState } from 'react';
import { TabProvider } from './src/store/TabContext';
import { AppProvider } from './src/state/AppContext';
import RootNavigator from './src/navigation/RootNavigator';
import LoginScreen from './src/screens/LoginScreen';
import { auth } from './src/store/auth';

export default function App() {
  const [, force] = useState(0);

  useEffect(() => {
    const unsub = auth.subscribe(() => force(x => x + 1));
    auth.bootstrap(); // единственное место bootstrap
    return () => { unsub(); };
  }, []);

  if (auth.loading) return null;
  if (!auth.profile) return <LoginScreen />;

  return (
    <TabProvider>
      <AppProvider>
        <RootNavigator />
      </AppProvider>
    </TabProvider>
  );
}
