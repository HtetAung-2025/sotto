import { useEffect } from "react";
import { Stack } from "expo-router";
import { Provider } from "../components/Provider";
import { configureNotificationActions } from "../lib/notifications";

export default function RootLayout() {
  useEffect(() => {
    configureNotificationActions();
  }, []);

  return (
    <Provider>
      <Stack screenOptions={{ headerShown: false }} />
    </Provider>
  );
}