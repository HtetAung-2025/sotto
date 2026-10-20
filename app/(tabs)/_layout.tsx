import { useEffect, useState } from "react";
import { Tabs, useRouter } from "expo-router";
import { PlusCircle, Bell } from "@tamagui/lucide-icons-2";
import { Text } from "tamagui";
import { Pressable, View, Image } from "react-native";

import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, doc } from "firebase/firestore";
import type { Unsubscribe } from "firebase/firestore";

import { auth, db } from "../../lib/firebase";

export default function TabLayout() {
  const router = useRouter();

  const [notificationCount, setNotificationCount] = useState(0);
  const [photoURL, setPhotoURL] = useState("");

  useEffect(() => {
    let unsubscribeRequests: Unsubscribe | null = null;
    let unsubscribeUser: Unsubscribe | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeRequests) {
        unsubscribeRequests();
        unsubscribeRequests = null;
      }

      if (unsubscribeUser) {
        unsubscribeUser();
        unsubscribeUser = null;
      }

      setNotificationCount(0);
      setPhotoURL("");

      if (!user) return;

      // プロフィール画像取得
      unsubscribeUser = onSnapshot(
        doc(db, "users", user.uid),
        (snap) => {
          if (!snap.exists()) {
            setPhotoURL("");
            return;
          }

          const data = snap.data();

          setPhotoURL(
            data.photoURL ||
              data.profileImageUrl ||
              data.profileImage ||
              data.imageUrl ||
              data.avatarUrl ||
              ""
          );
        },
        (error) => {
          console.error("Profile listener error:", error);
        }
      );

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
        },
        (error) => {
          console.error("Requests listener error:", error);
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

        headerStyle: {
          height: 110,
        },

        headerTitleStyle: {
          fontFamily: "ZenMaruGothic_700Bold",
          fontSize: 22,
        },

        headerRight: () => (
          <Pressable
            onPress={() => router.push("/profile")}
            accessibilityRole="button"
            accessibilityLabel="プロフィールを開く"
            style={{
              marginRight: 16,
              marginBottom: -4,
            }}
          >
            {photoURL ? (
              <Image
                source={{ uri: photoURL }}
                resizeMode="cover"
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
                  fontFamily="$body"
                  fontSize={18}
                  fontWeight="700"
                  color="#333"
                >
                  ?
                </Text>
              </View>
            )}
          </Pressable>
        ),

        tabBarActiveTintColor: "#FFF",
        tabBarInactiveTintColor: "#999",

        tabBarLabelStyle: {
          fontFamily: "ZenMaruGothic_700Bold",
          fontSize: 12,
        },

        tabBarStyle: {
          height: 80,
          marginBottom: -12,
          paddingBottom: 12,
          backgroundColor: "#fff",
          borderTopWidth: 0,
        },

        tabBarItemStyle: {
          height: "100%",
          overflow: "hidden",
        },

        tabBarIconStyle: {
          marginTop: 5,
        },
      }}
    >
      <Tabs.Screen
        name="reservations"
        options={{
          title: "話しかける",
          tabBarIcon: ({ color }) => (
            <PlusCircle size={28} color={color} />
          ),
          tabBarActiveBackgroundColor: "#B6B6B6",
          tabBarInactiveBackgroundColor: "#fff",
          tabBarItemStyle: {
            borderTopRightRadius: 20,
            overflow: "hidden",
          },
        }}
      />

      <Tabs.Screen
        name="notifications"
        options={{
          title: "通知",
          tabBarIcon: ({ color }) => (
            <Bell size={26} color={color} />
          ),
          tabBarActiveBackgroundColor: "#B6B6B6",
          tabBarInactiveBackgroundColor: "#fff",
          tabBarItemStyle: {
            borderTopLeftRadius: 20,
            overflow: "hidden",
          },
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
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="戻る"
              style={{ marginLeft: 16 }}
            >
              <Text
                fontFamily="$body"
                fontSize={32}
                color="#BBB"
              >
                ‹
              </Text>
            </Pressable>
          ),
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