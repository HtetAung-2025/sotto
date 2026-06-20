import { useEffect, useState } from "react";
import { Tabs } from "expo-router";
import {
  Home,
  Search,
  UserRound,
  Settings,
  Bell,
} from "@tamagui/lucide-icons-2";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

export default function TabLayout() {
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    let unsubscribeRequests = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubscribeRequests) {
        unsubscribeRequests();
        unsubscribeRequests = null;
      }

      if (!user) {
        setNotificationCount(0);
        return;
      }

      let myGroupId = "test";

      try {
        const mySnap = await getDoc(doc(db, "users", user.uid));

        if (mySnap.exists()) {
          myGroupId = mySnap.data().groupId || "test";
        }
      } catch (error) {
        console.log("groupId error:", error.message);
      }

      unsubscribeRequests = onSnapshot(collection(db, "requests"), (snapshot) => {
        let count = 0;

        snapshot.forEach((d) => {
          const data = d.data();

          if (data.status === "cancelled") return;

          // 自分の投稿に、誰かが返事した
          const repliedToMyPost =
            data.fromUid === user.uid &&
            data.status === "responded" &&
            !data.thanksSent;

          // 出会う：自分宛てに届いた未返信の相談
          const directWaitingForMe =
            data.type === "direct" &&
            data.toUid === user.uid &&
            data.fromUid !== user.uid &&
            data.status === "waiting" &&
            !data.respondedBy;

          // 見つける：同じグループに届いた未返信の相談
          const groupWaitingForMe =
            data.fromUid !== user.uid &&
            data.groupId === myGroupId &&
            data.status === "waiting" &&
            !data.respondedBy &&
            (data.type === "group" || (!data.type && !data.toUid));

          // 自分が返事した相談に、ありがとうが届いた
          // まだ通知画面で見ていないものだけ数える
          const thanksForMe =
            data.respondedBy === user.uid &&
            data.status === "matched" &&
            data.thanksSent &&
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
      });
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
        name="home"
        options={{
          title: "ホーム",
          tabBarIcon: ({ color }) => <Home color={color} size={24} />,
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
        name="reservations"
        options={{
          title: "見つける",
          tabBarIcon: ({ color }) => <Search color={color} size={24} />,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "設定",
          tabBarIcon: ({ color }) => <Settings color={color} size={24} />,
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
    </Tabs>
  );
}