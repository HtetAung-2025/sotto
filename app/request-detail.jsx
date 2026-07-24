import { useState, useEffect } from "react";
import { Alert, ScrollView, Image } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { YStack, XStack, Text, Button, Card } from "tamagui";
import { File, Edit3, BookOpen, GraduationCap, Key, Briefcase, Lightbulb, Music } from "@tamagui/lucide-icons-2";
import { doc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";

const THANKS_MESSAGE = "ありがとうございます！よろしくお願いします。";

const ICON_BY_NAME = {
  File,
  Edit3,
  BookOpen,
  GraduationCap,
  Key,
  Briefcase,
  Lightbulb,
  Music,
};

const DEFAULT_ICON_NAME = {
  "授業・課題": "File",
  "制作・作品づくり": "Edit3",
  "ソフト・機材": "BookOpen",
  "学校生活": "GraduationCap",
  "経験談": "Key",
  "就活・進路": "Briefcase",
  "発表・プレゼン": "Lightbulb",
  "雑談": "Music",
};

const getParam = (value, fallback = "") => {
  if (Array.isArray(value)) return value[0] || fallback;
  return value || fallback;
};

const getProfileImage = (data) => {
  return (
    data?.respondedByPhotoURL ||
    data?.photoURL ||
    data?.imageUrl ||
    data?.avatarUrl ||
    data?.imageUri ||
    data?.profileImage ||
    data?.profileImageUrl ||
    ""
  );
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

function AvatarCircle({ imageUrl, name, size = 80 }) {
  const canShowImage = isImageUri(imageUrl);

  return (
    <YStack
      width={size}
      height={size}
      borderRadius={999}
      backgroundColor="#FFD966"
      alignItems="center"
      justifyContent="center"
      overflow="hidden"
    >
      {canShowImage ? (
        <Image
          source={{ uri: imageUrl }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
          }}
          resizeMode="cover"
        />
      ) : (
        <Text fontSize={34} fontWeight="700" color="#111">
          {name?.charAt(0) || "?"}
        </Text>
      )}
    </YStack>
  );
}

// 小さめのタグピル（力になってくれること用）
function SmallTagPill({ tag }) {
  const iconName = DEFAULT_ICON_NAME[tag];
  const Icon = ICON_BY_NAME[iconName];

  return (
    <XStack
      backgroundColor="white"
      borderWidth={1}
      borderColor="#EEE"
      paddingHorizontal="$3"
      paddingVertical="$2"
      borderRadius="$4"
      alignItems="center"
      gap="$2"
    >
      {Icon ? <Icon size={16} color="#333" /> : null}
      <Text color="#333" fontSize={13} fontWeight="600">
        {tag}
      </Text>
    </XStack>
  );
}

// 大きめのアイコンボックス（話したいこと用）
function BigTagBox({ tag }) {
  const iconName = DEFAULT_ICON_NAME[tag];
  const Icon = ICON_BY_NAME[iconName];

  return (
    <YStack
      width={92}
      height={92}
      borderRadius={12}
      backgroundColor="white"
      borderWidth={1}
      borderColor="#EEE"
      alignItems="center"
      justifyContent="center"
      gap={6}
      padding={10}
    >
      {Icon ? <Icon size={28} color="#333" /> : null}
      <Text fontSize={13} lineHeight={14} textAlign="center" color="#333">
        {tag}
      </Text>
    </YStack>
  );
}

export default function RequestDetail() {
  const params = useLocalSearchParams();

  const requestId = getParam(params.id);
  const [requestData, setRequestData] = useState(null);
  const [responderData, setResponderData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRequest();
  }, [requestId]);

  const loadRequest = async () => {
    try {
      if (!requestId) {
        Alert.alert("Error", "リクエストIDがありません");
        setLoading(false);
        return;
      }

      const requestSnap = await getDoc(doc(db, "requests", requestId));

      if (!requestSnap.exists()) {
        Alert.alert("Error", "リクエストが見つかりません");
        setLoading(false);
        return;
      }

      const request = {
        id: requestSnap.id,
        ...requestSnap.data(),
      };

      setRequestData(request);

      if (request.respondedBy) {
        const responderSnap = await getDoc(doc(db, "users", request.respondedBy));

        if (responderSnap.exists()) {
          setResponderData(responderSnap.data());
        }
      }
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const sendThanks = async () => {
    try {
      const myUid = auth.currentUser?.uid;

      if (!myUid) {
        Alert.alert("Error", "ログインしてください");
        return;
      }

      if (!requestId) {
        Alert.alert("Error", "リクエストIDがありません");
        return;
      }

      const requestRef = doc(db, "requests", requestId);
      const requestSnap = await getDoc(requestRef);

      if (!requestSnap.exists()) {
        Alert.alert("Error", "リクエストが見つかりません");
        return;
      }

      const request = requestSnap.data();

      if (request.status === "matched" || request.thanksSent) {
        Alert.alert("送信済み", "すでにありがとうを送りました");
        router.replace("/(tabs)/notifications");
        return;
      }

      if (request.fromUid !== myUid) {
        Alert.alert("Error", "この相談を投稿した人だけがありがとうを送れます");
        return;
      }

      if (!request.respondedBy) {
        Alert.alert("Error", "返事した人が見つかりません");
        return;
      }

      const mySnap = await getDoc(doc(db, "users", myUid));
      const myData = mySnap.exists() ? mySnap.data() : {};

      const myName = myData.name || "相手";
      const myGrade = myData.grade || "";
      const myImage = getProfileImage(myData);

      await updateDoc(requestRef, {
        thanksSent: true,
        thanksMessage: THANKS_MESSAGE,
        thanksFromUid: myUid,
        thanksFromName: myName,
        thanksFromGrade: myGrade,
        thanksFromPhotoURL: myImage,
        thanksSeenByResponder: false,
        thanksAt: serverTimestamp(),
        status: "matched",
      });

      const responderSnap = await getDoc(doc(db, "users", request.respondedBy));
      const responderToken = responderSnap.data()?.expoPushToken;

      if (responderToken) {
        await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: responderToken,
            title: "ありがとうが届きました！",
            body: `${myName}さんから「ありがとう」が届きました`,
            sound: "default",
          }),
        });
      }

      Alert.alert("送信しました", "相手にありがとうを送りました", [
        {
          text: "OK",
          onPress: () => router.replace("/(tabs)/notifications"),
        },
      ]);
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  if (loading) {
    return (
      <YStack
        flex={1}
        backgroundColor="#F7F2EA"
        alignItems="center"
        justifyContent="center"
      >
        <Text color="#999">読み込み中...</Text>
      </YStack>
    );
  }

  const responderName =
    requestData?.respondedByName || getParam(params.name, "名前なし");

  const responderGrade = requestData?.respondedByGrade || "";

  const responderImage =
    getProfileImage(responderData) ||
    requestData?.respondedByPhotoURL ||
    getParam(params.imageUrl, "");

  const timing = requestData?.timing || getParam(params.timing, "");

  const talkTags = Array.isArray(requestData?.talkTags)
    ? requestData.talkTags
    : getParam(params.talkTags)
        .split(",")
        .filter((tag) => tag);

  const responderTags = Array.isArray(responderData?.tags)
    ? responderData.tags
    : [];

  const detail = requestData?.detail || getParam(params.detail, "");

  const isMatched = requestData?.status === "matched" || requestData?.thanksSent;

  return (
    <YStack flex={1} backgroundColor="#F7F2EA">
      <XStack
        height={110}
        backgroundColor="white"
        alignItems="center"
        justifyContent="space-between"
        paddingHorizontal="$4"
        paddingTop={50}
      >
        <XStack alignItems="center">
          <Text
            fontSize={36}
            color="#BBB"
            onPress={() => router.replace("/(tabs)/notifications")}
          >
            ‹
          </Text>

          <Text fontSize={18} fontWeight="700" marginLeft="$3">
            話しかける
          </Text>
        </XStack>
      </XStack>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 100,
        }}
      >
        <YStack padding="$4" gap="$4">
          {/* 回答者カード */}
          <Card backgroundColor="white" borderRadius="$6" padding="$4" gap="$4">
            <XStack alignItems="center" gap="$3">
              <AvatarCircle
                imageUrl={responderImage}
                name={responderName}
                size={64}
              />

              <YStack flex={1} gap="$1">
                <Text fontSize={18} fontWeight="700">
                  {responderName}
                  {responderGrade ? `(${responderGrade})` : ""}
                </Text>

                {timing ? (
                  <YStack
                    alignSelf="flex-start"
                    backgroundColor="#D7F7EF"
                    paddingHorizontal="$3"
                    paddingVertical="$1"
                    borderRadius="$10"
                  >
                    <Text color="#2AA985" fontSize={13} fontWeight="700">
                      {timing}OK
                    </Text>
                  </YStack>
                ) : null}
              </YStack>
            </XStack>

            {/* 力になってくれること */}
            <YStack gap="$2">
              <XStack alignItems="center" gap="$2">
                <YStack
                  width={10}
                  height={10}
                  borderRadius={999}
                  backgroundColor="#FFD966"
                />
                <Text fontWeight="700" fontSize={16}>
                  力になってくれること
                </Text>
              </XStack>

              <XStack gap="$2" flexWrap="wrap">
                {responderTags.length > 0 ? (
                  responderTags.map((tag) => (
                    <SmallTagPill key={tag} tag={tag} />
                  ))
                ) : (
                  <Text fontSize={13} color="#999">
                    未設定
                  </Text>
                )}
              </XStack>
            </YStack>
          </Card>

          {/* 話したいこと */}
          <YStack gap="$2">
            <XStack alignItems="center" gap="$2">
              <YStack
                width={10}
                height={10}
                borderRadius={999}
                backgroundColor="#FFD966"
              />
              <Text fontWeight="700" fontSize={16}>
                話したいこと
              </Text>
            </XStack>

            <XStack gap="$3" flexWrap="wrap">
              {talkTags.length > 0 ? (
                talkTags.map((tag) => <BigTagBox key={tag} tag={tag} />)
              ) : (
                <Text fontSize={13} color="#999">
                  未選択
                </Text>
              )}
            </XStack>

            {detail ? (
              <Text fontSize={14} color="#333" marginTop="$2">
                {detail}
              </Text>
            ) : null}
          </YStack>

          {/* 注意書き */}
          <Text fontSize={14} color="#666" lineHeight={22}>
            ※以下のボタンより相手と話すことが約束されます。
            {"\n"}
            「ありがとう」を送って早速話しかけてみましょう
          </Text>

          {isMatched ? (
            <YStack
              backgroundColor="#E6FBF5"
              borderRadius="$6"
              padding="$4"
              alignItems="center"
            >
              <Text fontSize={16} fontWeight="700" color="#2AA985">
                ありがとう送信済みです
              </Text>
            </YStack>
          ) : (
            <Button
              alignSelf="center"
              width="70%"
              height={58}
              borderRadius="$10"
              backgroundColor="#FFD966"
              color="black"
              fontSize={22}
              fontWeight="700"
              marginTop="$2"
              marginBottom="$8"
              onPress={sendThanks}
            >
              ありがとう
            </Button>
          )}
        </YStack>
      </ScrollView>
    </YStack>
  );
}