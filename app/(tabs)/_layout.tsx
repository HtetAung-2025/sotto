import { useEffect, useState } from "react";
import { Tabs, useRouter } from "expo-router";
import {
  PlusCircle,
  Bell,
} from "@tamagui/lucide-icons-2";

import { Image, Pressable, View, Text } from "react-native";

import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  onSnapshot,
  Unsubscribe,
  doc,
} from "firebase/firestore";

import { auth, db } from "../../lib/firebase";

export default function TabLayout() {
  const router = useRouter();

  const [notificationCount, setNotificationCount] = useState(0);
  const [photoURL, setPhotoURL] = useState("");

  useEffect(() => {
    let unsubscribeRequests: Unsubscribe | null = null;
    let unsubscribeUser: Unsubscribe | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeRequests) unsubscribeRequests();
      if (unsubscribeUser) unsubscribeUser();

      if (!user) {
        setNotificationCount(0);
        setPhotoURL("");
        return;
      }

      // プロフィール画像取得
      unsubscribeUser = onSnapshot(doc(db, "users", user.uid), (snap) => {
        if (!snap.exists()) return;

        const data = snap.data();

        setPhotoURL(
          data.photoURL ||
            data.profileImageUrl ||
            data.profileImage ||
            data.imageUrl ||
            data.avatarUrl ||
            ""
        );
      });

      // 通知バッジ
      unsubscribeRequests = onSnapshot(
        collection(db, "requests"),
        (snapshot) => {
          let count = 0;

          snapshot.forEach((docSnap) => {
            const data = docSnap.data();

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
              data.thanksSent &&
              !data.thanksSeenByResponder;

            if (
              repliedToMyPost ||
              directWaitingForMe ||
              groupWaitingForMe ||
              thanksForMe
            ) {
              count++;
            }
          });

          setNotificationCount(count);
        }
      );
    });

    return () => {
      if (unsubscribeRequests) unsubscribeRequests();
      if (unsubscribeUser) unsubscribeUser();
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
        headerShown: true,
        headerTitleAlign: "center",
        headerStyle: {height: 110,backgroundColor: "#F7F2EA"},
        headerRight: () => (
          <Pressable
            onPress={() => router.push("/profile")}
            style={{
              marginRight: 16,
              marginBottom: 4,
            }}
          >
            {photoURL ? (
              <Image
                source={{ uri: photoURL }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: "#DDD",
                }}
              />
            ) : (
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: "#FFD966",
                  justifyContent: "center",
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: "#DDD",
                }}
              >
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "700",
                    color: "#333",
                  }}
                >
                  ?
                </Text>
              </View>
            )}
          </Pressable>
        ),

        tabBarActiveTintColor: "#FFD966",
        tabBarInactiveTintColor: "#999",

        tabBarStyle: {
          height: 80,
          paddingBottom: 12,
          paddingTop: 8,
          backgroundColor: "#fff",
        },
      }}
    >
      <Tabs.Screen
        name="reservations"
        options={{
          title: "投稿",
          tabBarIcon: ({ color }) => (
            <PlusCircle color={color} size={26} />
          ),
        }}
      />

      <Tabs.Screen
        name="notifications"
        options={{
          title: "通知",
          tabBarIcon: ({ color }) => (
            <Bell color={color} size={24} />
          ),
          tabBarBadge: badge,
          tabBarBadgeStyle: {
            backgroundColor: "#E35A5A",
            color: "#fff",
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
          href: null,
          title: "プロフィール",
          headerRight: () => null,
        }}
      />

      <Tabs.Screen
        name="requests"
        options={{
          href: null,
          title: "リクエスト",
        }}
      />
    </Tabs>
  );
}