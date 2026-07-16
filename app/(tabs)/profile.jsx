import { useState, useCallback } from "react";
import { Alert, Switch, Image, ScrollView } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { YStack, H1, Text, Button, XStack, Circle } from "tamagui";
import { File, BookOpen, Edit3, Lightbulb, GraduationCap, Briefcase, Key, Music } from "@tamagui/lucide-icons-2";
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
  "作品・制作": "Edit3",
  "プレゼン": "Lightbulb",
  "学校生活": "GraduationCap",
  "進路・就活": "Briefcase",
  "経験談": "Key",
  "雑談": "Music",
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
    <YStack flex={1} backgroundColor="#F7F2EA">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          alignItems: "center",
          paddingTop: 80,
          paddingBottom: 100,
        }}
      >
        <YStack alignItems="center" gap="$5" width="100%" marginTop={-50}>
          <Text
          position="absolute"
          left="$4"
          fontSize={34}
          color="#BBB"
          onPress={() => router.back()}>
            ‹
          </Text>
          <H1 fontSize={20} color="#000">設定</H1>

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

          <YStack
            width="80%"
            borderRadius="$5"
            padding="$4"
            gap="$3"
          >
            <Text fontSize={18} fontWeight="700" color="#000">
              力になれること
            </Text>

            <XStack flexWrap="wrap" gap="$2">
<<<<<<< HEAD
                {profile?.tags?.length > 0 ? (
                  profile.tags.map((tag) => {
                    const iconName = profile?.tagIcons?.[tag] || DEFAULT_ICON_NAME[tag];
                    const Icon = ICON_BY_NAME[iconName];
                    return (
                      <XStack
                        key={tag}
                        backgroundColor="#FFF0C2"
                        paddingHorizontal="$2"
                        paddingVertical="$1"
                        borderRadius="$10"
                        alignItems="center"
                        gap="$2"
                      >
                        {Icon ? <Icon size={16} color="#B8860B" /> : null}
                        <Text fontSize={13} color="#B8860B">
                          {tag}
                        </Text>
                      </XStack>
                    );
                  })
                ) : (
                  <Text color="#999">未設定</Text>
                )}
=======
              {profile?.tags?.length > 0 ? (
                profile.tags.map((tag) => (
                  <Text
                    key={tag}
                    backgroundColor="#FFF"
                    color="#000"
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
>>>>>>> origin/master
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
            <Text fontSize={18} fontWeight="700" color="#000">
              通知設定
            </Text>

            <XStack alignItems="center" justifyContent="space-between">
              <Text fontSize={16} color="#B6B6B6">
                OFF/ON
              </Text>

              <Switch value={notificationOn} onValueChange={toggleNotification} value={notificationOn}
                onValueChange={toggleNotification}
                trackColor={{ false: '#767577', true: '#FCF0CD' }}
                thumbColor={notificationOn ? '#FFDF78' : '#F4F3F4'}
                ios_backgroundColor="#3E3E3E"/>
            </XStack>
          </YStack>

          <Button
            width="55%"
            height={58}
            borderRadius="$10"
            backgroundColor="#000"
            color="#FFF"
            fontSize={16
            }
            fontWeight="700"
            onPress={handleLogout}
          >
            ログアウト
          </Button>
        </YStack>
      </ScrollView>
    </YStack>
  );
}