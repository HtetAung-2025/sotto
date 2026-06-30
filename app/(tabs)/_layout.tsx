import { useEffect, useState } from "react";
import { Tabs } from "expo-router";
import {
  PlusCircle,
  UserRound,
  Settings,
  Bell,
} from "@tamagui/lucide-icons-2";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, Unsubscribe } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

export default function TabLayout() {
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    let unsubscribeRequests: Unsubscribe | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeRequests) {
        unsubscribeRequests();
        unsubscribeRequests = null;
      }

      if (!user) {
        setNotificationCount(0);
        return;
      }

      unsubscribeRequests = onSnapshot(
        collection(db, "requests"),
        (snapshot) => {
          let count = 0;

          snapshot.forEach((d) => {
            const data = d.data();

            if (data.status === "cancelled") return;

            const repliedToMyPost =
              data.fromUid === user.uid &&
              data.status === "responded" &&
              !data.thanksSent;

            const directWaitingForMe =
              data.type === "direct" &&
              data.toUid === user.uid &&
              data.fromUid !== user.uid &&
              data.status === "waiting" &&
              !data.respondedBy;

            const groupWaitingForMe =
              data.type === "group" &&
              data.fromUid !== user.uid &&
              data.status === "waiting" &&
              !data.respondedBy;

            const thanksForMe =
              data.respondedBy === user.uid &&
              data.status === "matched" &&
              data.thanksSent === true &&
              data.thanksSeenByResponder !== true;

            if (
              repliedToMyPost ||
              directWaitingForMe ||
              groupWaitingForMe ||
              thanksForMe
            ) {
              count += 1;
            }
          });

          setNotificationCount(count);
        },
        (error) => {
          console.log("notification badge error:", error);
          setNotificationCount(0);
        }
      );
    });

    return () => {
      if (unsubscribeRequests) {
        unsubscribeRequests();
      }

      unsubscribeAuth();
    };
  }, []);

  const badge =
    notificationCount > 0
      ? notificationCount > 99
        ? "99+"
        : String(notificationCount)
      : undefined;

  return (
    <Tabs
      initialRouteName="reservations"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#FFD966",
        tabBarInactiveTintColor: "#999",
        tabBarStyle: {
          height: 80,
          paddingBottom: 12,
          paddingTop: 8,
          backgroundColor: "white",
        },
      }}
    >
      <Tabs.Screen
        name="reservations"
        options={{
          title: "投稿",
          tabBarIcon: ({ color }) => <PlusCircle color={color} size={26} />,
        }}
      />

      <Tabs.Screen
        name="requests"
        options={{
          title: "出会う",
          tabBarIcon: ({ color }) => <UserRound color={color} size={24} />,
        }}
      />

      <Tabs.Screen
        name="notifications"
        options={{
          title: "通知",
          tabBarIcon: ({ color }) => <Bell color={color} size={24} />,
          tabBarBadge: badge,
          tabBarBadgeStyle: {
            backgroundColor: "#E35A5A",
            color: "white",
            fontSize: 11,
            fontWeight: "700",
            minWidth: 18,
            height: 18,
            borderRadius: 999,
          },
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "設定",
          tabBarIcon: ({ color }) => <Settings color={color} size={24} />,
        }}
      />
    </Tabs>
  );
}