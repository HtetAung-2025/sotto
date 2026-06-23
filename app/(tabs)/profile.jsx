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

        console.log("プロフィール画像:", getProfileImage(data));

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
      { text: "キャンセル", style: "cancel" },
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
            onError={(error) => {
              console.log("profile image error:", error.nativeEvent);
              setImageError(true);
            }}
          />
        ) : (
          <Text fontSize={40} fontWeight="700" color="#1A1A1A">
            {profile?.name?.charAt(0) || "?"}
          </Text>
        )}
      </Circle>

      <YStack alignItems="center" gap="$1">
        <Text fontSize={22} fontWeight="700" color="#1A1A1A">
          {profile?.name || "---"}
        </Text>

        <Text fontSize={15} color="#888">
          {profile?.grade || "---"}
        </Text>
      </YStack>

      <YStack width="80%" gap="$3">
        <Button
          height={52}
          backgroundColor="white"
          color="#1A1A1A"
          fontWeight="700"
          fontSize={16}
          borderRadius="$6"
          borderWidth={0.5}
          borderColor="#E0E0E0"
          onPress={() => router.push("/profile-setup")}
        >
          プロフィールを編集する 〉
        </Button>

        <YStack
          backgroundColor="white"
          borderRadius="$6"
          padding="$4"
          gap="$2"
          borderWidth={0.5}
          borderColor="#E0E0E0"
        >
          <Text fontSize={16} fontWeight="700" color="#1A1A1A">
            通知設定
          </Text>

          <XStack justifyContent="space-between" alignItems="center">
            <Text fontSize={14} color="#555">
              プッシュ通知
            </Text>

            <Switch
              value={notificationOn}
              onValueChange={toggleNotification}
              trackColor={{ false: "#D9D9D9", true: "#FFD966" }}
              thumbColor="white"
            />
          </XStack>
        </YStack>

        {profile?.tags?.length > 0 && (
          <YStack
            backgroundColor="white"
            borderRadius="$6"
            padding="$4"
            gap="$2"
            borderWidth={0.5}
            borderColor="#E0E0E0"
          >
            <Text fontSize={16} fontWeight="700" color="#1A1A1A">
              得意なこと
            </Text>

            <XStack flexWrap="wrap" gap="$2">
              {profile.tags.map((tag) => (
                <Text
                  key={tag}
                  fontSize={12}
                  backgroundColor="#FFF3CC"
                  color="#B8860B"
                  paddingHorizontal="$2"
                  paddingVertical="$1"
                  borderRadius="$10"
                >
                  {tag}
                </Text>
              ))}
            </XStack>
          </YStack>
        )}

        <Button
          height={52}
          backgroundColor="#FFD966"
          color="#1A1A1A"
          fontWeight="700"
          fontSize={16}
          borderRadius="$10"
          marginTop="$2"
          onPress={handleLogout}
        >
          ログアウト
        </Button>
      </YStack>
    </YStack>
  );
}