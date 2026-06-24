import { useState, useCallback } from "react";
import { Alert, Switch, Image } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { YStack, H1, Text, Button, XStack, Circle } from "tamagui";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import * as Notifications from "expo-notifications";

const isImageUri = (value) => {
  if (!value || typeof value !== "string") return false;

  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("file://") ||
    value.startsWith("content://") ||
    value.startsWith("data:image")
  );
};

const getProfileImage = (profile) => {
  return (
    profile?.photoURL ||
    profile?.imageUrl ||
    profile?.avatarUrl ||
    profile?.imageUri ||
    profile?.profileImage ||
    profile?.profileImageUrl ||
    profile?.avatar ||
    ""
  );
};

export default function SettingsScreen() {
  const [notificationOn, setNotificationOn] = useState(true);
  const [profile, setProfile] = useState(null);
  const [imageError, setImageError] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
      checkNotificationStatus();
    }, [])
  );

  const fetchProfile = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;

      const snap = await getDoc(doc(db, "users", uid));

      if (snap.exists()) {
        const data = snap.data();
        setProfile(data);
        setImageError(false);
      }
    } catch (error) {
      console.log("fetchProfile error:", error.message);
    }
  };

  const checkNotificationStatus = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      setNotificationOn(status === "granted");
    } catch (error) {
      console.log("checkNotificationStatus error:", error.message);
    }
  };

  const toggleNotification = async () => {
    try {
      if (!notificationOn) {
        const { status } = await Notifications.requestPermissionsAsync();
        setNotificationOn(status === "granted");
      } else {
        Alert.alert("通知をOFFにする", "端末の設定から通知をOFFにしてください", [
          { text: "OK" },
        ]);
      }
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  const handleLogout = async () => {
    Alert.alert("ログアウト", "ログアウトしますか？", [
      {
        text: "キャンセル",
        style: "cancel",
      },
      {
        text: "ログアウト",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut(auth);
            router.replace("/");
          } catch (error) {
            Alert.alert("Error", error.message);
          }
        },
      },
    ]);
  };

  const profileImage = getProfileImage(profile);
  const canShowImage = isImageUri(profileImage) && !imageError;

  return (
    <YStack
      flex={1}
      backgroundColor="#F7F2EA"
      alignItems="center"
      paddingTop={80}
      gap="$5"
    >
      <H1 fontSize={28}>設定</H1>

      <Circle
        size={100}
        backgroundColor="#FFD966"
        overflow="hidden"
        alignItems="center"
        justifyContent="center"
      >
        {canShowImage ? (
          <Image
            source={{ uri: profileImage }}
            style={{
              width: 100,
              height: 100,
              borderRadius: 50,
            }}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <Text fontSize={40} fontWeight="700" color="#1A1A1A">
            {profile?.name?.charAt(0) || "?"}
          </Text>
        )}
      </Circle>

      <YStack alignItems="center" gap="$1">
        <Text fontSize={24} fontWeight="700" color="#111">
          {profile?.name || "名前なし"}
        </Text>

        <Text fontSize={18} color="#999">
          {profile?.grade || ""}
        </Text>

        {profile?.groupName ? (
          <Text fontSize={13} color="#999" marginTop="$1">
            グループ：{profile.groupName}
          </Text>
        ) : null}
      </YStack>

      <YStack width="80%" gap="$3">
        <Button
          height={54}
          borderRadius="$5"
          backgroundColor="white"
          color="black"
          fontSize={18}
          fontWeight="700"
          borderWidth={1}
          borderColor="#DDD"
          onPress={() =>
            router.push({
              pathname: "/profile-setup",
              params: {
                from: "settings",
              },
            })
          }
        >
          プロフィールを編集する 〉
        </Button>

        <Button
          height={54}
          borderRadius="$5"
          backgroundColor="white"
          color="black"
          fontSize={18}
          fontWeight="700"
          borderWidth={1}
          borderColor="#DDD"
          onPress={() => router.push("/group")}
        >
          グループを変更する 〉
        </Button>
      </YStack>

      <YStack
        width="80%"
        backgroundColor="white"
        borderRadius="$5"
        padding="$4"
        gap="$3"
        borderWidth={1}
        borderColor="#DDD"
      >
        <Text fontSize={18} fontWeight="700">
          通知設定
        </Text>

        <XStack alignItems="center" justifyContent="space-between">
          <Text fontSize={16} color="#555">
            プッシュ通知
          </Text>

          <Switch value={notificationOn} onValueChange={toggleNotification} />
        </XStack>
      </YStack>

      <YStack
        width="80%"
        backgroundColor="white"
        borderRadius="$5"
        padding="$4"
        gap="$3"
        borderWidth={1}
        borderColor="#DDD"
      >
        <Text fontSize={18} fontWeight="700">
          得意なこと
        </Text>

        <XStack flexWrap="wrap" gap="$2">
          {profile?.tags?.length > 0 ? (
            profile.tags.map((tag) => (
              <Text
                key={tag}
                backgroundColor="#FFF0C2"
                color="#B8860B"
                paddingHorizontal="$2"
                paddingVertical="$1"
                borderRadius="$10"
                fontSize={13}
              >
                {tag}
              </Text>
            ))
          ) : (
            <Text color="#999">未設定</Text>
          )}
        </XStack>
      </YStack>

      <Button
        width="80%"
        height={58}
        borderRadius="$10"
        backgroundColor="#FFD966"
        color="black"
        fontSize={20}
        fontWeight="700"
        onPress={handleLogout}
      >
        ログアウト
      </Button>
    </YStack>
  );
}