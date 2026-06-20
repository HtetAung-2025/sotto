import { useEffect, useState } from "react";
import { Alert, ScrollView, Image } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { YStack, XStack, Text, Button, Input, Card } from "tamagui";
import {
  addDoc,
  collection,
  serverTimestamp,
  doc,
  getDoc,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";

const TALK_TAGS = [
  "授業・課題",
  "制作・作品づくり",
  "ソフト・機材",
  "学校生活",
  "経験談",
  "就活・進路",
  "発表・プレゼン",
  "雑談",
];

const FEEL_TAGS = [
  "教えて欲しい",
  "話を聞いてみたい",
  "一緒に考えて欲しい",
  "相談したい",
];

const getParam = (value, fallback = "") => {
  if (Array.isArray(value)) return value[0] || fallback;
  return value || fallback;
};

const getProfileImage = (data) => {
  return (
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

const statusLabel = (status) => {
  if (status === "now") return "今すぐOK";
  if (status === "later") return "後ならOK";
  if (status === "wait") return "ちょっと待ってね";
  return status || "今すぐOK";
};

function AvatarCircle({ imageUrl, name, size = 86 }) {
  const canShowImage = isImageUri(imageUrl);

  return (
    <YStack
      width={size}
      height={size}
      borderRadius={999}
      backgroundColor="#D9D9D9"
      justifyContent="center"
      alignItems="center"
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
        <Text fontSize={34} fontWeight="700" color="#555">
          {name?.charAt(0) || "?"}
        </Text>
      )}
    </YStack>
  );
}

export default function SeniorDetail() {
  const params = useLocalSearchParams();

  const [talkTags, setTalkTags] = useState([]);
  const [feelTag, setFeelTag] = useState("");
  const [detail, setDetail] = useState("");
  const [seniorData, setSeniorData] = useState(null);

  const toUid = getParam(params.userId);
  const paramName = getParam(params.name, "名前なし");
  const paramStatus = getParam(params.status, "今すぐOK");
  const paramImageUrl = getParam(params.imageUrl, "");
  const paramTags = getParam(params.tags, "");

  useEffect(() => {
    loadSenior();
  }, [toUid]);

  const loadSenior = async () => {
    try {
      if (!toUid) return;

      const snap = await getDoc(doc(db, "users", toUid));

      if (snap.exists()) {
        setSeniorData(snap.data());
      }
    } catch (error) {
      console.log("loadSenior error:", error.message);
    }
  };

  const seniorName = seniorData?.name
    ? seniorData.grade
      ? `${seniorData.name}(${seniorData.grade})`
      : seniorData.name
    : paramName;

  const seniorStatus = statusLabel(seniorData?.status || paramStatus);

  const seniorImage = getProfileImage(seniorData) || paramImageUrl;

  const seniorTags =
    seniorData?.tags?.length > 0
      ? seniorData.tags.slice(0, 3)
      : paramTags
          .split(",")
          .filter((tag) => tag)
          .slice(0, 3);

  const toggleTalkTag = (tag) => {
    if (talkTags.includes(tag)) {
      setTalkTags(talkTags.filter((item) => item !== tag));
    } else {
      if (talkTags.length >= 3) {
        Alert.alert("3つまで選択できます");
        return;
      }

      setTalkTags([...talkTags, tag]);
    }
  };

  const sendPushToSenior = async (targetUid, fromName) => {
    try {
      const seniorSnap = await getDoc(doc(db, "users", targetUid));
      if (!seniorSnap.exists()) return;

      const seniorToken = seniorSnap.data()?.expoPushToken;
      if (!seniorToken) return;

      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: seniorToken,
          title: "相談が届きました！",
          body: `${fromName}さんから相談が届きました`,
          sound: "default",
        }),
      });
    } catch (error) {
      console.log("push error:", error.message);
    }
  };

  const submitConsultation = async () => {
    try {
      const user = auth.currentUser;

      if (!user) {
        Alert.alert("Error", "ログインしてください");
        return;
      }

      if (!toUid) {
        Alert.alert("Error", "相手のIDがありません");
        return;
      }

      if (talkTags.length === 0) {
        Alert.alert("話したいことを選択してください");
        return;
      }

      if (!feelTag) {
        Alert.alert("自分の状態を選択してください");
        return;
      }

      const mySnap = await getDoc(doc(db, "users", user.uid));
      const myData = mySnap.exists() ? mySnap.data() : {};

      const fromName = myData.name || user.displayName || "匿名";
      const fromGrade = myData.grade || "";
      const fromImage = getProfileImage(myData);

      await addDoc(collection(db, "requests"), {
        type: "direct",

        fromUid: user.uid,
        fromName,
        fromGrade,
        fromPhotoURL: fromImage,

        toUid,
        toName: seniorName,
        toPhotoURL: seniorImage,

        groupId: myData.groupId || "test",
        groupName: myData.groupName || "",

        seniorName,
        seniorStatus,
        seniorPhotoURL: seniorImage,

        talkTags,
        feelTag,
        detail,

        status: "waiting",
        respondedBy: "",
        respondedByName: "",
        respondedByGrade: "",
        respondedByPhotoURL: "",
        timing: "",
        thanksSent: false,

        createdAt: serverTimestamp(),
      });

      await sendPushToSenior(toUid, fromName);

      Alert.alert("送信しました", `${seniorName} に相談を送りました`, [
        {
          text: "OK",
          onPress: () => router.replace("/(tabs)/notifications"),
        },
      ]);
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <YStack flex={1} backgroundColor="#F3F3F3">
      <XStack height={90} backgroundColor="white" alignItems="center">
        <Text
          fontSize={36}
          color="#BBB"
          marginLeft="$4"
          onPress={() => router.back()}
        >
          ‹
        </Text>
      </XStack>

      <ScrollView>
        <YStack padding="$4" gap="$4">
          <XStack alignItems="center" gap="$3">
            <AvatarCircle imageUrl={seniorImage} name={seniorName} size={86} />

            <YStack flex={1}>
              <XStack alignItems="center" gap="$2" flexWrap="wrap">
                <Text fontSize={22} fontWeight="700">
                  {seniorName}
                </Text>

                <Text
                  backgroundColor="#D7F7EF"
                  color="#2AA985"
                  paddingHorizontal="$2"
                  paddingVertical="$1"
                  borderRadius="$10"
                  fontSize={12}
                >
                  {seniorStatus}
                </Text>
              </XStack>

              <XStack gap="$2" marginTop="$2" flexWrap="wrap">
                {seniorTags.length > 0 ? (
                  seniorTags.map((tag) => (
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
                  ["授業・課題", "学校生活", "雑談"].map((tag) => (
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
                )}
              </XStack>
            </YStack>
          </XStack>

          <Card backgroundColor="white" borderRadius="$6" padding="$4" gap="$5">
            <YStack gap="$2">
              <Text fontWeight="700">
                🟡 話したいこと
                <Text fontSize={11}> ※3つまで選択することができます。</Text>
              </Text>

              <XStack flexWrap="wrap" gap="$2">
                {TALK_TAGS.map((tag) => (
                  <Button
                    key={tag}
                    size="$2"
                    borderRadius="$10"
                    backgroundColor={
                      talkTags.includes(tag) ? "#E8C75A" : "white"
                    }
                    borderWidth={1}
                    borderColor="#CCC"
                    color={talkTags.includes(tag) ? "white" : "#999"}
                    onPress={() => toggleTalkTag(tag)}
                  >
                    {tag}
                  </Button>
                ))}
              </XStack>
            </YStack>

            <YStack gap="$2">
              <Text fontWeight="700">
                🟡 自分の状態
                <Text fontSize={11}> ※1つまで選択することができます。</Text>
              </Text>

              <XStack flexWrap="wrap" gap="$2">
                {FEEL_TAGS.map((tag) => (
                  <Button
                    key={tag}
                    size="$2"
                    borderRadius="$10"
                    backgroundColor={feelTag === tag ? "#E8C75A" : "white"}
                    borderWidth={1}
                    borderColor="#CCC"
                    color={feelTag === tag ? "white" : "#999"}
                    onPress={() => setFeelTag(tag)}
                  >
                    {tag}
                  </Button>
                ))}
              </XStack>
            </YStack>

            <YStack gap="$2">
              <Text fontWeight="700">🟡 話したいこと詳細記入</Text>

              <Text fontSize={11}>
                ※具体的に聞きたいことがあったら自由に記入してください。
              </Text>

              <Input
                height={48}
                placeholder="話したいことの詳細を記入してください"
                value={detail}
                onChangeText={setDetail}
                backgroundColor="white"
              />
            </YStack>
          </Card>

          <Button
            alignSelf="center"
            width="70%"
            height={58}
            borderRadius="$10"
            backgroundColor="#FFD966"
            color="black"
            fontSize={22}
            fontWeight="700"
            marginTop="$3"
            marginBottom="$8"
            onPress={submitConsultation}
          >
            相談を送る
          </Button>
        </YStack>
      </ScrollView>
    </YStack>
  );
}