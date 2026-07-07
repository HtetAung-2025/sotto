import { useEffect, useState } from "react";
import { Alert, ScrollView } from "react-native";
import { router } from "expo-router";
import { YStack, XStack, Text, Button, Input, Card } from "tamagui";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  getDocs,
} from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { sendConsultationPush } from "../../lib/notifications";

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

export default function Reservations() {
  const [talkTags, setTalkTags] = useState([]);
  const [feelTag, setFeelTag] = useState("");
  const [detail, setDetail] = useState("");
  const [myData, setMyData] = useState(null);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    fetchMyData();
  }, []);

  const fetchMyData = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;

      const mySnap = await getDoc(doc(db, "users", uid));

      if (mySnap.exists()) {
        setMyData(mySnap.data());
      }
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  const toggleTalkTag = (tag) => {
    if (talkTags.includes(tag)) {
      setTalkTags(talkTags.filter((t) => t !== tag));
    } else {
      if (talkTags.length >= 3) {
        Alert.alert("3つまで選択できます");
        return;
      }

      setTalkTags([...talkTags, tag]);
    }
  };

  const sendAllPushNotifications = async ({ requestId, uid, fromName }) => {
    try {
      console.log("📢 全体通知 start:", {
        requestId,
        uid,
        fromName,
      });

      const usersSnap = await getDocs(collection(db, "users"));

      const pushPromises = [];
      let targetCount = 0;

      usersSnap.forEach((userDoc) => {
        const userData = userDoc.data();

        // 自分には通知しない
        if (userDoc.id === uid) return;

        // Expo Push Token がない人には送れない
        if (!userData.expoPushToken) {
          console.log("⚠️ tokenなし:", userDoc.id, userData.name);
          return;
        }

        targetCount += 1;

        pushPromises.push(
          sendConsultationPush({
            to: userData.expoPushToken,
            requestId,
            fromName,
            talkTags,
            feelTag,
            detail: detail || "少し困っているみたいです",
            mode: "group",
          })
        );
      });

      console.log("📢 全体通知 target count:", targetCount);

      await Promise.all(pushPromises);

      console.log("✅ 全体通知 sent");
    } catch (error) {
      console.log("sendAllPushNotifications error:", error.message);
    }
  };

  const resetForm = () => {
    setTalkTags([]);
    setFeelTag("");
    setDetail("");
  };

  const handlePost = async () => {
    try {
      const uid = auth.currentUser?.uid;

      if (!uid) {
        Alert.alert("Error", "ログインしてください");
        return;
      }

      if (talkTags.length === 0) {
        Alert.alert("話したいことを選択してください");
        return;
      }

      setPosting(true);

      let latestMyData = myData;

      if (!latestMyData) {
        const mySnap = await getDoc(doc(db, "users", uid));
        latestMyData = mySnap.exists() ? mySnap.data() : {};
        setMyData(latestMyData);
      }

      const myImage = getProfileImage(latestMyData);
      const fromName = latestMyData?.name || "匿名";

      // groupId はデータ管理用に残す
      // ただし通知は groupId で絞らず、全員に送る
      const groupId = latestMyData?.groupId || "all";

      const docRef = await addDoc(collection(db, "requests"), {
        type: "group",

        // 投稿した人
        fromUid: uid,
        fromName,
        fromGrade: latestMyData?.grade || "",
        fromPhotoURL: myImage,

        // 管理用
        groupId,
        groupName: latestMyData?.groupName || "全体",

        // 投稿内容
        talkTags,
        feelTag,
        detail: detail || "",

        // 状態
        status: "waiting",
        createdAt: serverTimestamp(),

        // リクエスト表示用
        respondedBy: "",
        respondedByName: "",
        respondedByGrade: "",
        respondedByPhotoURL: "",
        timing: "",
        timingLabel: "",
        respondedAt: null,

        thanksSent: false,
        thanksSeenByResponder: false,
      });

      await sendAllPushNotifications({
        requestId: docRef.id,
        uid,
        fromName,
      });

      resetForm();

      // 投稿完了 → リクエスト画面へ遷移
      router.push("/(tabs)/requests");

      Alert.alert(
        "投稿しました",
        "全員に通知しました。\n回答してくれた人は下に表示されます。"
      );
    } catch (error) {
      console.log("handlePost error:", error.message);
      Alert.alert("Error", error.message);
    } finally {
      setPosting(false);
    }
  };

  return (
    <YStack flex={1} backgroundColor="#F3F3F3">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: 70,
          paddingHorizontal: 14,
          paddingBottom: 160,
        }}
      >
        <YStack gap="$4">
          <YStack gap="$2" paddingHorizontal="$2">
            <Text fontSize={28} fontWeight="800" color="#222">
             使い手順
            </Text>

            <Text fontSize={14} color="#777" lineHeight={21}>
              相談したい内容を全体に投稿します。
              {"\n"}
              回答してくれた人はこの画面の下に表示されます。
            </Text>
          </YStack>

          <Text textAlign="center" color="#999" fontSize={12}>
            🔒 あなたの名前は相手側には表示されません。
            {"\n"}
            気軽に投稿してみてください。
          </Text>

          <Card backgroundColor="white" borderRadius="$6" padding="$4" gap="$4">
            <YStack gap="$2">
              <Text fontWeight="700">
                🟡 話したいこと
                <Text fontSize={11}> ※3つまで選択できます。</Text>
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
          </Card>

          <Button
            alignSelf="center"
            width="82%"
            height={58}
            borderRadius="$10"
            backgroundColor="#FFD966"
            color="black"
            fontSize={20}
            fontWeight="700"
            onPress={handlePost}
            disabled={posting}
            opacity={posting ? 0.6 : 1}
          >
            {posting ? "投稿中..." : "この内容で投稿する"}
          </Button>

          <Text textAlign="center" color="#AAA" fontSize={12} lineHeight={18}>
            投稿後、全員に通知が届きます。
            {"\n"}
            回答してくれた人はこの下に表示されます。
          </Text>
        </YStack>
      </ScrollView>
    </YStack>
  );
}