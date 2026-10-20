import { useState, useCallback } from "react";
import {
  Alert,
  Switch,
  Image,
  ScrollView,
  Platform,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { YStack, Text, Button, XStack, Circle } from "tamagui";
import {
  File,
  BookOpen,
  Edit3,
  Lightbulb,
  GraduationCap,
  Briefcase,
  Key,
  Music,
} from "@tamagui/lucide-icons-2";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import * as Notifications from "expo-notifications";

const IS_WEB = Platform.OS === "web";

const showMessage = (title, message) => {
  if (IS_WEB) {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

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

const ICON_BY_NAME = {
  File,
  BookOpen,
  Edit3,
  Lightbulb,
  GraduationCap,
  Briefcase,
  Key,
  Music,
};

const DEFAULT_ICON_NAME = {
  "授業・課題": "File",
  "ソフト・教材": "BookOpen",
  "ソフト・機材": "BookOpen",
  "作品・制作": "Edit3",
  "制作・作品づくり": "Edit3",
  "プレゼン": "Lightbulb",
  "発表・プレゼン": "Lightbulb",
  "学校生活": "GraduationCap",
  "進路・就活": "Briefcase",
  "就活・進路": "Briefcase",
  "経験談": "Key",
  "雑談": "Music",
};

export default function SettingsScreen() {
  const [notificationOn, setNotificationOn] = useState(false);
  const [checkingNotifications, setCheckingNotifications] = useState(!IS_WEB);
  const [changingNotifications, setChangingNotifications] = useState(false);
  const [profile, setProfile] = useState(null);
  const [imageError, setImageError] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const fetchProfile = async () => {
        try {
          const uid = auth.currentUser?.uid;

          if (!uid) {
            if (active) setProfile(null);
            return;
          }

          const snap = await getDoc(doc(db, "users", uid));

          if (active) {
            setProfile(snap.exists() ? snap.data() : null);
            setImageError(false);
          }
        } catch (error) {
          console.error("fetchProfile error:", error);
        }
      };

      const checkNotificationStatus = async () => {
        if (IS_WEB) {
          if (active) {
            setNotificationOn(false);
            setCheckingNotifications(false);
          }
          return;
        }

        if (active) setCheckingNotifications(true);

        try {
          const permissions = await Notifications.getPermissionsAsync();

          if (active) {
            setNotificationOn(permissions.granted);
          }
        } catch (error) {
          console.error("checkNotificationStatus error:", error);

          if (active) setNotificationOn(false);
        } finally {
          if (active) setCheckingNotifications(false);
        }
      };

      void fetchProfile();
      void checkNotificationStatus();

      return () => {
        active = false;
      };
    }, [])
  );

  const toggleNotification = async () => {
    if (IS_WEB || checkingNotifications || changingNotifications) return;

    if (notificationOn) {
      showMessage(
        "通知をOFFにする",
        "端末の設定から、このアプリの通知をOFFにしてください。"
      );
      return;
    }

    try {
      setChangingNotifications(true);

      const permissions = await Notifications.requestPermissionsAsync();

      setNotificationOn(permissions.granted);

      if (!permissions.granted) {
        showMessage(
          "通知が許可されていません",
          "通知を利用する場合は、端末の設定からこのアプリの通知を許可してください。"
        );
      }
    } catch (error) {
      console.error("toggleNotification error:", error);
      showMessage("Error", error.message || "通知設定を変更できませんでした。");
    } finally {
      setChangingNotifications(false);
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;

    const logout = async () => {
      try {
        setLoggingOut(true);

        await signOut(auth);
        router.replace("/");
      } catch (error) {
        console.error("Logout error:", error);
        showMessage("Error", error.message || "ログアウトできませんでした。");
      } finally {
        setLoggingOut(false);
      }
    };

    if (IS_WEB) {
      if (window.confirm("ログアウトしますか？")) {
        await logout();
      }
      return;
    }

    Alert.alert("ログアウト", "ログアウトしますか？", [
      {
        text: "キャンセル",
        style: "cancel",
      },
      {
        text: "ログアウト",
        style: "destructive",
        onPress: () => {
          void logout();
        },
      },
    ]);
  };

  const profileImage = getProfileImage(profile);
  const canShowImage = isImageUri(profileImage) && !imageError;
  const tags = Array.isArray(profile?.tags) ? profile.tags : [];

  return (
    <YStack flex={1} backgroundColor="#F7F2EA">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          alignItems: "center",
          paddingTop: 30,
          paddingBottom: 100,
        }}
      >
        <YStack
          alignItems="center"
          gap="$5"
          width="100%"
          maxWidth={600}
        >
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
              <Text
                fontSize={40}
                fontWeight="700"
                color="#1A1A1A"
                fontFamily="$body"
              >
                {profile?.name?.charAt(0) || "?"}
              </Text>
            )}
          </Circle>

          <YStack alignItems="center" gap="$1">
            <Text
              fontSize={24}
              fontWeight="700"
              color="#111"
              fontFamily="$body"
            >
              {profile?.name || "名前なし"}
            </Text>

            <Text fontSize={18} color="#999" fontFamily="$body">
              {profile?.grade || ""}
            </Text>

            {profile?.groupName ? (
              <Text
                fontSize={13}
                color="#999"
                marginTop="$1"
                fontFamily="$body"
              >
                グループ：{profile.groupName}
              </Text>
            ) : null}
          </YStack>

          <YStack
            width="80%"
            borderRadius="$5"
            padding="$4"
            gap="$3"
          >
            <Text
              fontSize={18}
              fontWeight="700"
              color="#000"
              fontFamily="$body"
            >
              力になれること
            </Text>

            <XStack flexWrap="wrap" gap="$2">
              {tags.length > 0 ? (
                tags.map((tag) => {
                  const iconName =
                    profile?.tagIcons?.[tag] || DEFAULT_ICON_NAME[tag];
                  const Icon = ICON_BY_NAME[iconName];

                  return (
                    <XStack
                      key={tag}
                      backgroundColor="#FFF0C2"
                      paddingHorizontal="$3"
                      paddingVertical="$2"
                      borderRadius={999}
                      alignItems="center"
                      justifyContent="center"
                      gap="$2"
                      minHeight={36}
                    >
                      {Icon ? (
                        <Icon size={16} color="#B8860B" />
                      ) : null}

                      <Text
                        fontSize={13}
                        color="#B8860B"
                        fontFamily="$body"
                        lineHeight={16}
                      >
                        {tag}
                      </Text>
                    </XStack>
                  );
                })
              ) : (
                <Text color="#999" fontFamily="$body">
                  未設定
                </Text>
              )}
            </XStack>
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
            borderRadius="$5"
            padding="$4"
            gap="$3"
          >
            <Text
              fontSize={18}
              fontWeight="700"
              color="#000"
              fontFamily="$body"
            >
              通知設定
            </Text>

            <XStack
              alignItems="center"
              justifyContent="space-between"
            >
              <Text
                fontSize={16}
                color="#777"
                fontFamily="$body"
              >
                オン / オフ
              </Text>

              <Switch
                disabled={
                  IS_WEB ||
                  checkingNotifications ||
                  changingNotifications
                }
                value={notificationOn}
                onValueChange={toggleNotification}
                trackColor={{
                  false: "#E0E0E0",
                  true: "#FFD966",
                }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#E0E0E0"
              />
            </XStack>

            {IS_WEB ? (
              <Text
                fontSize={12}
                color="#999"
                lineHeight={18}
                fontFamily="$body"
              >
                通知はスマートフォン版で利用できます。
              </Text>
            ) : (
              <Text
                fontSize={12}
                color="#999"
                lineHeight={18}
                fontFamily="$body"
              >
                通知をOFFにする場合は、端末の設定から変更してください。
              </Text>
            )}
          </YStack>

          <Button
            width="55%"
            height={58}
            borderRadius="$10"
            backgroundColor="#000"
            color="#FFF"
            fontSize={16}
            fontWeight="700"
            onPress={handleLogout}
            disabled={loggingOut}
            opacity={loggingOut ? 0.6 : 1}
          >
            {loggingOut ? "ログアウト中..." : "ログアウト"}
          </Button>
        </YStack>
      </ScrollView>
    </YStack>
  );
}