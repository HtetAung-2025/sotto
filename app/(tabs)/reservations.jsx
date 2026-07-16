import { useEffect, useState } from "react";
import { Alert, ScrollView, Image, Pressable } from "react-native";
import { YStack, XStack, Text, Button, Card } from "tamagui";
import { File, Edit3, BookOpen, GraduationCap, Key, Briefcase, Lightbulb, Music } from "@tamagui/lucide-icons-2";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { sendConsultationPush } from "../../lib/notifications";
import { router } from "expo-router";

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

const FILTERS = [
  { key: "all", label: "全部" },
  { key: "now", label: "今すぐ" },
  { key: "later", label: "後なら" },
  { key: "little", label: "ちょっと" },
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

function ResponderAvatar({ name, photoURL, size = 80 }) {
  if (photoURL) {
    return (
      <Image
        source={{ uri: photoURL }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1,
          borderColor: "#EEE",
        }}
      />
    );
  }

  return (
    <YStack
      width={size}
      height={size}
      borderRadius={999}
      backgroundColor="#FFD966"
      alignItems="center"
      justifyContent="center"
    >
      <Text fontWeight="700" color="#111" fontSize={size * 0.4}>
        {name?.charAt(0) || "?"}
      </Text>
    </YStack>
  );
}

export default function Reservations() {
  // ===== 投稿フォーム用 state =====
  const [talkTags, setTalkTags] = useState([]);
  const [feelTag, setFeelTag] = useState("");
  const [detail, setDetail] = useState("");
  const [myData, setMyData] = useState(null);
  const [posting, setPosting] = useState(false);

  // ===== 投稿中の相談＆回答者一覧用 state =====
  const [myActivePost, setMyActivePost] = useState(null);
  const [checkingActivePost, setCheckingActivePost] = useState(true);
  const [responders, setResponders] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [cancelling, setCancelling] = useState(false);

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

  // 自分の「投稿中（キャンセルされていない）」相談を常に監視
  // これにより、どのタブに行って戻っても Firestore の状態がそのまま画面に反映される
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const q = query(
      collection(db, "requests"),
      where("fromUid", "==", uid),
      where("type", "==", "group")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const active = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();

          if (data.status === "cancelled") return;

          active.push({ id: docSnap.id, ...data });
        });

        active.sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime;
        });

        setMyActivePost(active[0] || null);
        setCheckingActivePost(false);
      },
      (error) => {
        console.log("myActivePost onSnapshot error:", error.message);
        setCheckingActivePost(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // 投稿中の相談があれば、その回答者一覧（複数人対応）を監視
  useEffect(() => {
    if (!myActivePost?.id) {
      setResponders([]);
      return;
    }

    const responsesRef = collection(
      db,
      "requests",
      myActivePost.id,
      "responses"
    );

    const unsubscribe = onSnapshot(
      responsesRef,
      (snapshot) => {
        const list = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();

          list.push({
            uid: docSnap.id,
            name: data.name,
            grade: data.grade,
            photoURL: data.photoURL,
            timing: data.timingLabel || data.timing,
            thanksSent: data.thanksSent,
            requestId: myActivePost.id,
          });
        });

        list.sort((a, b) => {
          const aTime = a.respondedAt?.seconds || 0;
          const bTime = b.respondedAt?.seconds || 0;
          return bTime - aTime;
        });

        setResponders(list);
      },
      (error) => {
        console.log("responses onSnapshot error:", error.message);
      }
    );

    return () => unsubscribe();
  }, [myActivePost?.id]);

  const filteredResponders =
    activeFilter === "all"
      ? responders
      : responders.filter((r) => {
          if (activeFilter === "now") return r.timing === "今すぐ";
          if (activeFilter === "later") return r.timing === "後なら";
          if (activeFilter === "little") return r.timing === "ちょっと";
          return true;
        });

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
      const usersSnap = await getDocs(collection(db, "users"));

      const pushPromises = [];

      usersSnap.forEach((userDoc) => {
        const userData = userDoc.data();

        if (userDoc.id === uid) return;
        if (!userData.expoPushToken) return;

        const userTags = Array.isArray(userData.tags) ? userData.tags : [];
        const isMatch = talkTags.some((tag) => userTags.includes(tag));

        if (!isMatch) return;

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

      await Promise.all(pushPromises);
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
      const groupId = latestMyData?.groupId || "all";

      const docRef = await addDoc(collection(db, "requests"), {
        type: "group",
        fromUid: uid,
        fromName,
        fromGrade: latestMyData?.grade || "",
        fromPhotoURL: myImage,
        groupId,
        groupName: latestMyData?.groupName || "全体",
        talkTags,
        feelTag,
        detail: detail || "",
        status: "waiting",
        createdAt: serverTimestamp(),
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

      // ここではもう画面遷移しない
      // myActivePost が Firestore の onSnapshot で自動的にセットされ、
      // この画面自体が自動的にリクエスト表示に切り替わる
    } catch (error) {
      console.log("handlePost error:", error.message);
      Alert.alert("Error", error.message);
    } finally {
      setPosting(false);
    }
  };

  const handleCancel = async () => {
    if (!myActivePost) return;

    Alert.alert("投稿をキャンセルしますか？", "この投稿を取り消します。", [
      { text: "戻る", style: "cancel" },
      {
        text: "キャンセルする",
        style: "destructive",
        onPress: async () => {
          try {
            setCancelling(true);

            await updateDoc(doc(db, "requests", myActivePost.id), {
              status: "cancelled",
            });
          } catch (error) {
            Alert.alert("Error", error.message);
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  const handleOpenResponder = (requestId, responderUid) => {
    if (!requestId || !responderUid) {
      Alert.alert("Error", "リクエストIDが見つかりません");
      return;
    }

    router.push({
      pathname: "/request-detail",
      params: { id: requestId, responderUid },
    });
  };

  // ===== 読み込み中 =====
  if (checkingActivePost) {
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

  // ===== 投稿中の相談がある → リクエスト画面を表示 =====
  if (myActivePost) {
    return (
      <YStack flex={1} backgroundColor="#F7F2EA">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: 60,
            paddingHorizontal: 14,
            paddingBottom: 160,
          }}
        >
          <YStack gap="$4">
            <YStack alignItems="center" marginBottom="$2">
              <Text fontSize={28} fontWeight="800" color="#222">
                リクエスト
              </Text>
            </YStack>

            {/* フィルター */}
            <Card backgroundColor="white" borderRadius="$6" padding="$4" gap="$4">
              <XStack gap="$2" flexWrap="wrap" justifyContent="center">
                {TALK_TAGS.map((tag) => {
                  const iconName = myData?.tagIcons?.[tag] || DEFAULT_ICON_NAME[tag];
                  const Icon = ICON_BY_NAME[iconName];
                  return (
                    <Button
                      key={tag}
                      width={92}
                      height={92}
                      padding={10}
                      borderRadius={12}
                      backgroundColor={
                        talkTags.includes(tag) ? "#E8C75A" : "white"
                      }
                      borderWidth={1}
                      borderColor="#EEE"
                      color={talkTags.includes(tag) ? "white" : "#999"}
                      onPress={() => toggleTalkTag(tag)}
                      alignItems="center"
                      justifyContent="center"
                    >
                      <YStack alignItems="center" justifyContent="center" gap={6}>
                        {Icon ? (
                          <Icon size={28} color={talkTags.includes(tag) ? "#111" : "#333"} />
                        ) : null}
                        <Text fontSize={12} lineHeight={14} textAlign="center">
                          {tag}
                        </Text>
                      </YStack>
                    </Button>
                  );
                })}
                <YStack
                  width={10}
                  height={10}
                  borderRadius={999}
                  backgroundColor="#FFD966"
                />
                <Text fontWeight="700" fontSize={16}>
                  話したいこと
                </Text>

                {Array.isArray(myActivePost.talkTags) &&
                  myActivePost.talkTags.map((tag) => (
                    <Text
                      key={tag}
                      backgroundColor="#E8C75A"
                      color="white"
                      paddingHorizontal="$3"
                      paddingVertical="$1"
                      borderRadius="$10"
                      fontSize={13}
                      fontWeight="700"
                    >
                      {tag}
                    </Text>
                  ))}
              </XStack>

              <Button
                width="90%"
                height={54}
                borderRadius="$10"
                backgroundColor="#E5E5E5"
                color="#333"
                fontSize={18}
                fontWeight="700"
                onPress={handleCancel}
                disabled={cancelling}
                opacity={cancelling ? 0.6 : 1}
              >
                {cancelling ? "処理中..." : "キャンセル"}
              </Button>
            </Card>

            {/* 回答者一覧 or 空メッセージ */}
            {filteredResponders.length > 0 ? (
              <XStack gap="$3" flexWrap="wrap">
                {filteredResponders.map((r) => (
                  <Pressable
                    key={r.uid}
                    onPress={() => handleOpenResponder(r.requestId, r.uid)}
                    style={({ pressed }) => ({
                      width: 170,
                      height: 230,
                      borderRadius: 20,
                      backgroundColor: "white",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: pressed ? 0.7 : 1,
                      shadowColor: "#000",
                      shadowOpacity: 0.05,
                      shadowRadius: 6,
                      shadowOffset: { width: 0, height: 2 },
                      elevation: 2,
                    })}
                  >
                    <ResponderAvatar
                      name={r.name}
                      photoURL={r.photoURL}
                      size={100}
                    />

                    <Text marginTop="$3" fontSize={20} fontWeight="800">
                      {r.name}
                      {r.grade ? ` (${r.grade})` : ""}
                    </Text>

                    <Text
                      marginTop="$2"
                      backgroundColor={r.thanksSent ? "#E6FBF5" : "#FFE8A3"}
                      color={r.thanksSent ? "#2AA985" : "#C58B00"}
                      paddingHorizontal="$4"
                      paddingVertical="$2"
                      borderRadius={999}
                      fontWeight="700"
                    >
                      {r.thanksSent ? "ありがとう送信済み" : r.timing}
                    </Text>
                  </Pressable>
                ))}
              </XStack>
            ) : (
              <YStack alignItems="center" paddingVertical="$6">
                <Text color="#AAA" fontSize={14}>
                  まだこの投稿に回答してくれた人はいません
                </Text>
              </YStack>
            )}
          </YStack>
        </ScrollView>
      </YStack>
    );
  }

  // ===== 投稿中の相談がない → 通常の投稿フォームを表示 =====
  return (
    <YStack flex={1} backgroundColor="#F7F2EA">
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

              <XStack flexWrap="wrap" gap="$2" justifyContent="center" alignItems="center">
                {TALK_TAGS.map((tag) => {
                  const iconName = myData?.tagIcons?.[tag] || DEFAULT_ICON_NAME[tag];
                  const Icon = ICON_BY_NAME[iconName];
                  return (
                    <Button
                      key={tag}
                      width={92}
                      height={92}
                      padding={10}
                      borderRadius={12}
                      backgroundColor={
                        talkTags.includes(tag) ? "#E8C75A" : "white"
                      }
                      borderWidth={1}
                      borderColor="#EEE"
                      color={talkTags.includes(tag) ? "white" : "#999"}
                      onPress={() => toggleTalkTag(tag)}
                      alignItems="center"
                      justifyContent="center"
                    >
                      <YStack alignItems="center" justifyContent="center" gap={6}>
                        {Icon ? (
                          <Icon size={28} color={talkTags.includes(tag) ? "#111" : "#333"} />
                        ) : null}
                        <Text fontSize={13} lineHeight={14} textAlign="center">
                          {tag}
                        </Text>
                      </YStack>
                    </Button>
                  );
                })}
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