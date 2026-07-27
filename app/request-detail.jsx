import { useState, useEffect } from "react";
import { Alert, ScrollView, Image, Modal } from "react-native";
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
        <Text fontSize={34} fontWeight="700" color="#111" fontFamily={"$body"}>
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
      <Text color="#333" fontSize={13} fontWeight="600" fontFamily={"$body"}>
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
      <Text fontSize={13} lineHeight={14} textAlign="center" color="#333" fontFamily={"$body"}>
        {tag}
      </Text>
    </YStack>
  );
}

// ありがとう送信完了時のポップアップ（握手アイコン + メッセージ）
function ThanksSuccessModal({ visible, responderName, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <YStack
        flex={1}
        backgroundColor="rgba(0,0,0,0.45)"
        alignItems="center"
        justifyContent="center"
        padding="$5"
      >
        <YStack
          width="100%"
          maxWidth={350}
          backgroundColor="#F7F2EA"
          borderRadius="$8"
          padding="$6"
          alignItems="center"
          gap="$4"
        >
          <Text
            fontSize={20}
            fontWeight="700"
            color="#333"
            textAlign="center"
            fontFamily={"$body"}
          >
            約束が完了しました！
          </Text>

          <Text
            fontSize={14}
            color="#666"
            textAlign="center"
            lineHeight={22}
            fontFamily={"$body"}
          >
            早速話す時間や場所を決めにいきましょう！
            {"\n"}
            {responderName ? `${responderName}さんが` : "相手が"}あなたのことを待っています
          </Text>
        <Text fontSize={12} color="#666" textAlign="center" lineHeight={22} fontFamily={"$body"}>
            ※別のリクエストをしたい/解決した場合は
完了ボタンを押してください
          </Text>
          <YStack
            width={140}
            height={140}
            alignItems="center"
            justifyContent="center"
          >
            <Image
              source={require("../assets/images/hand.png")}
              style={{ width: 140, height: 140 }}
              resizeMode="contain"
            />
          </YStack>

          <Button
            width="100%"
            height={52}
            borderRadius="$10"
            backgroundColor="#FFD966"
            color="black"
            fontSize={17}
            fontWeight="700"
            onPress={onClose}
          >
            OK
          </Button>
        </YStack>
      </YStack>
    </Modal>
  );
}

export default function RequestDetail() {
  const params = useLocalSearchParams();

  const requestId = getParam(params.id);
  const responderUidParam = getParam(params.responderUid); // グループ投稿の場合、誰への詳細/お礼かを特定する

  const [requestData, setRequestData] = useState(null);
  const [responseData, setResponseData] = useState(null); // グループ投稿：responses サブコレクションの個別回答
  const [responderData, setResponderData] = useState(null); // 回答者本人のユーザープロフィール
  const [loading, setLoading] = useState(true);
  const [showThanksModal, setShowThanksModal] = useState(false);

  const isGroupResponse = !!responderUidParam;

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

      if (isGroupResponse) {
        // グループ投稿：この回答者個人の response ドキュメントを見る
        const responseSnap = await getDoc(
          doc(db, "requests", requestId, "responses", responderUidParam)
        );

        if (responseSnap.exists()) {
          setResponseData(responseSnap.data());
        }

        const responderSnap = await getDoc(doc(db, "users", responderUidParam));

        if (responderSnap.exists()) {
          setResponderData(responderSnap.data());
        }
      } else if (request.respondedBy) {
        // direct投稿：これまで通り request.respondedBy を見る
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

      if (request.fromUid !== myUid) {
        Alert.alert("Error", "この相談を投稿した人だけがありがとうを送れます");
        return;
      }

      const mySnap = await getDoc(doc(db, "users", myUid));
      const myData = mySnap.exists() ? mySnap.data() : {};

      const myName = myData.name || "相手";
      const myGrade = myData.grade || "";
      const myImage = getProfileImage(myData);

      if (isGroupResponse) {
        // ===== グループ投稿：この回答者だけにありがとうを送る =====
        const responseRef = doc(
          db,
          "requests",
          requestId,
          "responses",
          responderUidParam
        );
        const responseSnap = await getDoc(responseRef);

        if (!responseSnap.exists()) {
          Alert.alert("Error", "回答が見つかりません");
          return;
        }

        const response = responseSnap.data();

        if (response.thanksSent) {
          Alert.alert("送信済み", "すでにこの人にありがとうを送りました");
          router.replace("/(tabs)/reservations");
          return;
        }

        // この回答者の response だけを更新。他の回答者の response には影響しない。
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

        const responderToken = responderData?.expoPushToken;

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
      } else {
        // ===== direct投稿：従来通り request 本体を更新 =====
        if (request.status === "matched" || request.thanksSent) {
          Alert.alert("送信済み", "すでにありがとうを送りました");
          router.replace("/(tabs)/reservations");
          return;
        }

        if (!request.respondedBy) {
          Alert.alert("Error", "返事した人が見つかりません");
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
      }

      // 送信完了：カスタムモーダルを表示
      setShowThanksModal(true);
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  const closeThanksModal = () => {
    setShowThanksModal(false);
    router.replace("/(tabs)/reservations");
  };

  if (loading) {
    return (
      <YStack
        flex={1}
        backgroundColor="#F7F2EA"
        alignItems="center"
        justifyContent="center"
      >
        <Text color="#999" fontFamily={"$body"}>読み込み中...</Text>
      </YStack>
    );
  }

  const responderName = isGroupResponse
    ? responseData?.name || responderData?.name || "名前なし"
    : requestData?.respondedByName || getParam(params.name, "名前なし");

  const responderGrade = isGroupResponse
    ? responseData?.grade || ""
    : requestData?.respondedByGrade || "";

  const responderImage = isGroupResponse
    ? responseData?.photoURL || getProfileImage(responderData) || ""
    : getProfileImage(responderData) ||
      requestData?.respondedByPhotoURL ||
      getParam(params.imageUrl, "");

  const timing = isGroupResponse
    ? responseData?.timingLabel || responseData?.timing || ""
    : requestData?.timing || getParam(params.timing, "");

  const talkTags = Array.isArray(requestData?.talkTags)
    ? requestData.talkTags
    : getParam(params.talkTags)
        .split(",")
        .filter((tag) => tag);

  const responderTags = Array.isArray(responderData?.tags)
    ? responderData.tags
    : [];

  const detail = requestData?.detail || getParam(params.detail, "");

  const isMatched = isGroupResponse
    ? !!responseData?.thanksSent
    : requestData?.status === "matched" || requestData?.thanksSent;

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
            fontFamily={"$body"}
            onPress={() => router.replace("/(tabs)/reservations")}
          >
            ‹
          </Text>

          <Text fontSize={18} fontWeight="700" marginLeft="$3" fontFamily={"$body"}>
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
                <Text fontSize={18} fontWeight="700" fontFamily={"$body"}>
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
                    <Text color="#2AA985" fontSize={13} fontWeight="700" fontFamily={"$body"}>
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
                <Text fontWeight="700" fontSize={16} fontFamily={"$body"}>
                  力になってくれること
                </Text>
              </XStack>

              <XStack gap="$2" flexWrap="wrap">
                {responderTags.length > 0 ? (
                  responderTags.map((tag) => (
                    <SmallTagPill key={tag} tag={tag} />
                  ))
                ) : (
                  <Text fontSize={13} color="#999" fontFamily={"$body"}>
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
              <Text fontWeight="700" fontSize={16} fontFamily={"$body"}>
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
              <Text fontSize={14} color="#333" marginTop="$2" fontFamily={"$body"}>
                {detail}
              </Text>
            ) : null}
          </YStack>

          {/* 注意書き */}
          <Text fontSize={14} color="#666" lineHeight={22} fontFamily={"$body"}>
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
              <Text fontSize={16} fontWeight="700" color="#2AA985" fontFamily={"$body"}>
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

      <ThanksSuccessModal
        visible={showThanksModal}
        responderName={responderName}
        onClose={closeThanksModal}
      />
    </YStack>
  );
}