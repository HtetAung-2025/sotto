import { useState, useEffect } from "react";
import { Alert, ScrollView, Image } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { YStack, XStack, Text, Button, Input, Card } from "tamagui";
import { doc, updateDoc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";

const THANKS_MESSAGE = "ありがとうございます！よろしくお願いします。";

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

function TagPill({ tag }) {
  const iconName = DEFAULT_ICON_NAME[tag];
  const Icon = ICON_BY_NAME[iconName];

  return (
    <XStack
      backgroundColor="#E8C75A"
      paddingHorizontal="$2"
      paddingVertical="$1"
      borderRadius="$10"
      alignItems="center"
      gap="$1"
    >
      {Icon ? <Icon size={14} color="white" /> : null}
      <Text color="white" fontSize={12}>
        {tag}
      </Text>
    </XStack>
  );
}

export default function RequestDetail() {
  const params = useLocalSearchParams();

  const requestId = getParam(params.id);
  const responderUidParam = getParam(params.responderUid);

  const [requestData, setRequestData] = useState(null);
  const [responseData, setResponseData] = useState(null); // 複数人対応：この回答者個別のデータ
  const [responderProfile, setResponderProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRequest();
  }, [requestId, responderUidParam]);

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

      const isGroup = request.type === "group";
      const targetResponderUid = responderUidParam || request.respondedBy;

      if (isGroup && targetResponderUid) {
        // 複数人対応：responses サブコレクションからこの回答者のデータを取得
        const responseSnap = await getDoc(
          doc(db, "requests", requestId, "responses", targetResponderUid)
        );

        if (responseSnap.exists()) {
          setResponseData({ uid: targetResponderUid, ...responseSnap.data() });
        }
      }

      if (targetResponderUid) {
        const responderSnap = await getDoc(doc(db, "users", targetResponderUid));

        if (responderSnap.exists()) {
          setResponderProfile(responderSnap.data());
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

      if (request.fromUid !== myUid) {
        Alert.alert("Error", "この相談を投稿した人だけがありがとうを送れます");
        return;
      }

      const isGroup = request.type === "group";
      const targetResponderUid = responderUidParam || request.respondedBy;

      if (!targetResponderUid) {
        Alert.alert("Error", "返事した人が見つかりません");
        return;
      }

      const mySnap = await getDoc(doc(db, "users", myUid));
      const myData = mySnap.exists() ? mySnap.data() : {};

      const myName = myData.name || "相手";
      const myGrade = myData.grade || "";
      const myImage = getProfileImage(myData);

      if (isGroup) {
        // 複数人対応：この回答者のresponsesドキュメントだけを更新
        const responseRef = doc(
          db,
          "requests",
          requestId,
          "responses",
          targetResponderUid
        );

        const responseSnap = await getDoc(responseRef);

        if (responseSnap.exists() && responseSnap.data().thanksSent) {
          Alert.alert("送信済み", "すでにこの人にありがとうを送りました");
          return;
        }

        await updateDoc(responseRef, {
          thanksSent: true,
          thanksMessage: THANKS_MESSAGE,
          thanksFromUid: myUid,
          thanksFromName: myName,
          thanksFromGrade: myGrade,
          thanksFromPhotoURL: myImage,
          thanksSeenByResponder: false,
          thanksAt: serverTimestamp(),
        });
      } else {
        // 個人宛て(direct)は今まで通り
        if (request.status === "matched" || request.thanksSent) {
          Alert.alert("送信済み", "すでにありがとうを送りました");
          router.replace("/(tabs)/requests");
          return;
        }

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
      }

      const responderSnap = await getDoc(doc(db, "users", targetResponderUid));
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
          onPress: () => router.replace("/(tabs)/requests"),
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
        backgroundColor="#F3F3F3"
        alignItems="center"
        justifyContent="center"
      >
        <Text color="#999">読み込み中...</Text>
      </YStack>
    );
  }

  const isGroup = requestData?.type === "group";

  const responderName =
    (isGroup ? responseData?.name : requestData?.respondedByName) ||
    responderProfile?.name ||
    getParam(params.name, "名前なし");

  const responderGrade =
    (isGroup ? responseData?.grade : requestData?.respondedByGrade) ||
    responderProfile?.grade ||
    "";

  const responderImage =
    (isGroup ? responseData?.photoURL : requestData?.respondedByPhotoURL) ||
    getProfileImage(responderProfile) ||
    getParam(params.imageUrl, "");

  const timing =
    (isGroup ? responseData?.timingLabel || responseData?.timing : requestData?.timing) ||
    getParam(params.timing, "");

  const talkTags = Array.isArray(requestData?.talkTags)
    ? requestData.talkTags
    : getParam(params.talkTags)
        .split(",")
        .filter((tag) => tag);

  const detail = requestData?.detail || getParam(params.detail, "");

  const requestType = requestData?.type === "direct" ? "出会う" : "見つける";

  const isMatched = isGroup
    ? !!responseData?.thanksSent
    : requestData?.status === "matched" || requestData?.thanksSent;

  return (
    <YStack flex={1} backgroundColor="#F3F3F3">
      <XStack
        height={110}
        backgroundColor="white"
        alignItems="center"
        paddingHorizontal="$4"
        paddingTop={50}
      >
        <Text
          fontSize={36}
          color="#BBB"
          onPress={() => router.replace("/(tabs)/requests")}
        >
          ‹
        </Text>

        <Text fontSize={18} fontWeight="700" marginLeft="$3">
          お返事の詳細
        </Text>
      </XStack>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 100,
        }}
      >
        <YStack padding="$4" gap="$4">
          <XStack alignItems="center" gap="$3">
            <AvatarCircle
              imageUrl={responderImage}
              name={responderName}
              size={80}
            />

            <YStack flex={1}>
              <XStack alignItems="center" gap="$2" flexWrap="wrap">
                <Text fontSize={22} fontWeight="700">
                  {responderName}
                  {responderGrade ? ` (${responderGrade})` : ""}
                </Text>

                <Text
                  backgroundColor="#D7F7EF"
                  color="#2AA985"
                  paddingHorizontal="$2"
                  paddingVertical="$1"
                  borderRadius="$10"
                  fontSize={12}
                >
                  {timing || "返事あり"}
                </Text>
              </XStack>

              <Text fontSize={13} color="#999" marginTop="$1">
                {requestType} からの相談
              </Text>

              <XStack gap="$2" flexWrap="wrap" marginTop="$2">
                {talkTags.map((tag) => (
                  <Text
                    key={tag}
                    backgroundColor="#E8C75A"
                    color="white"
                    paddingHorizontal="$2"
                    paddingVertical="$1"
                    borderRadius="$10"
                    fontSize={12}
                  >
                    {tag}
                  </Text>
                ))}
              </XStack>
            </YStack>
          </XStack>

          <Card backgroundColor="white" borderRadius="$6" padding="$4" gap="$4">
            <YStack gap="$2">
              <Text fontWeight="700">● 話したいこと</Text>

              <XStack gap="$2" flexWrap="wrap">
                {talkTags.length > 0 ? (
                  talkTags.map((tag) => (
                    <Text
                      key={tag}
                      backgroundColor="#E8C75A"
                      color="white"
                      paddingHorizontal="$2"
                      paddingVertical="$1"
                      borderRadius="$10"
                      fontSize={12}
                    >
                      {tag}
                    </Text>
                  ))
                ) : (
                  <Text fontSize={13} color="#999">
                    未選択
                  </Text>
                )}
              </XStack>
            </YStack>

            <YStack gap="$2">
              <Text fontWeight="700">● 話したいこと詳細</Text>

              <Text fontSize={13} color="#333">
                {detail || "詳細はありません。"}
              </Text>
            </YStack>
          </Card>

          <Card backgroundColor="white" borderRadius="$6" padding="$4" gap="$3">
            <Text fontWeight="700">送るメッセージ</Text>

            <Input
              height={48}
              backgroundColor="white"
              value={THANKS_MESSAGE}
              editable={false}
            />
          </Card>

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
              ありがとうを送る
            </Button>
          )}
        </YStack>
      </ScrollView>
    </YStack>
  );
}