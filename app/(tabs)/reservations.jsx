import { useEffect, useState } from "react";
import { Alert, ScrollView, Pressable, Image } from "react-native";
import { router } from "expo-router";
import { YStack, XStack, Text, Button, Input, Card } from "tamagui";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

const FILTERS = [
  { label: "全部", value: "all" },
  { label: "今すぐ", value: "now" },
  { label: "後なら", value: "later" },
  { label: "ちょっと", value: "wait" },
];

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

const timingToFilter = (timing) => {
  if (timing === "今すぐ") return "now";
  if (timing === "後なら") return "later";
  if (timing === "ちょっと") return "wait";
  return "all";
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

function AvatarCircle({ imageUrl, name, size = 78 }) {
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
        <Text fontSize={36} color="#555" fontWeight="700">
          {name?.charAt(0) || "?"}
        </Text>
      )}
    </YStack>
  );
}

export default function Reservations() {
  const [posted, setPosted] = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState("");

  const [talkTags, setTalkTags] = useState([]);
  const [feelTag, setFeelTag] = useState("");
  const [detail, setDetail] = useState("");

  const [filter, setFilter] = useState("all");
  const [myData, setMyData] = useState(null);
  const [answeredRequests, setAnsweredRequests] = useState([]);

  useEffect(() => {
    fetchMyData();
  }, []);

  useEffect(() => {
    const unsubscribe = listenAnsweredRequests();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentRequestId]);

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

  const listenAnsweredRequests = () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return null;

    const unsubscribe = onSnapshot(collection(db, "requests"), (snapshot) => {
      const list = [];

      snapshot.forEach((d) => {
        const data = { id: d.id, ...d.data() };

        if (data.status === "cancelled") return;

        if (currentRequestId && data.id !== currentRequestId) return;

        if (
          data.fromUid === uid &&
          data.status === "responded" &&
          data.respondedBy
        ) {
          list.push(data);
        }
      });

      list.sort(
        (a, b) => (b.respondedAt?.seconds || 0) - (a.respondedAt?.seconds || 0)
      );

      setAnsweredRequests(list);
    });

    return unsubscribe;
  };

  const toggleTalkTag = (tag) => {
    if (posted) return;

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

  const handleFind = async () => {
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

      if (!feelTag) {
        Alert.alert("自分の状態を選択してください");
        return;
      }

      const myImage = getProfileImage(myData);

      const docRef = await addDoc(collection(db, "requests"), {
        type: "group",

        fromUid: uid,
        fromName: myData?.name || "匿名",
        fromGrade: myData?.grade || "",
        fromPhotoURL: myImage,

        groupId: myData?.groupId || "test",
        groupName: myData?.groupName || "",

        talkTags,
        feelTag,
        detail: detail || "",

        status: "waiting",
        createdAt: serverTimestamp(),
      });

      setCurrentRequestId(docRef.id);
      setAnsweredRequests([]);
      setPosted(true);

      Alert.alert("投稿しました", "回答を待っています");
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  const cancelCurrentRequest = async () => {
    try {
      if (currentRequestId) {
        await updateDoc(doc(db, "requests", currentRequestId), {
          status: "cancelled",
          cancelledAt: serverTimestamp(),
        });
      }

      setPosted(false);
      setCurrentRequestId("");
      setTalkTags([]);
      setFeelTag("");
      setDetail("");
      setFilter("all");
      setAnsweredRequests([]);

      Alert.alert("キャンセルしました", "投稿を取り消しました");
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      "キャンセルしますか？",
      "投稿を取り消すと、相手側の通知からも消えます。",
      [
        { text: "やめる", style: "cancel" },
        {
          text: "キャンセルする",
          style: "destructive",
          onPress: cancelCurrentRequest,
        },
      ]
    );
  };

  const filteredAnsweredRequests =
    filter === "all"
      ? answeredRequests
      : answeredRequests.filter((req) => timingToFilter(req.timing) === filter);

  return (
    <YStack flex={1} backgroundColor="#F3F3F3">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: 70,
          paddingHorizontal: 14,
          paddingBottom: 180,
        }}
      >
        <YStack gap="$4">
          {!posted && (
            <Text textAlign="center" color="#999" fontSize={12}>
              🔒 あなたの名前は相手側には表示されません。
              {"\n"}
              気軽に入力してみてくださいね
            </Text>
          )}

          {!posted ? (
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

              <YStack gap="$2">
                <Text fontWeight="700">
                  🟡 自分の状態
                  <Text fontSize={11}> ※1つまで選択できます。</Text>
                </Text>

                <XStack flexWrap="wrap" gap="$2">
                  {FEEL_TAGS.map((tag) => (
                    <Button
                      key={tag}
                      size="$2"
                      borderRadius="$10"
                      backgroundColor={feelTag === tag ? "#BDBDBD" : "white"}
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

                <Input
                  height={48}
                  placeholder="話したいことの詳細を記入してください"
                  value={detail}
                  onChangeText={setDetail}
                  backgroundColor="white"
                />
              </YStack>
            </Card>
          ) : (
            <Card
              backgroundColor="white"
              borderRadius="$6"
              padding="$4"
              gap="$3"
              shadowColor="#000"
              shadowOpacity={0.12}
              shadowRadius={8}
              shadowOffset={{ width: 0, height: 3 }}
              elevation={3}
            >
              <XStack gap="$2" flexWrap="wrap" alignItems="center">
                <Text fontSize={14} fontWeight="700">
                  ● 話したいこと
                </Text>

                {talkTags.map((tag) => (
                  <Text
                    key={tag}
                    backgroundColor="#E8C75A"
                    color="white"
                    paddingHorizontal="$2"
                    paddingVertical="$1"
                    borderRadius="$10"
                    fontSize={12}
                    fontWeight="700"
                  >
                    {tag}
                  </Text>
                ))}
              </XStack>

              <XStack gap="$2" flexWrap="wrap" alignItems="center">
                <Text fontSize={14} fontWeight="700">
                  ● 自分の状態
                </Text>

                <Text
                  backgroundColor="#BDBDBD"
                  color="white"
                  paddingHorizontal="$2"
                  paddingVertical="$1"
                  borderRadius="$10"
                  fontSize={12}
                  fontWeight="700"
                >
                  {feelTag}
                </Text>
              </XStack>

              <YStack gap="$1">
                <Text fontSize={14} fontWeight="700">
                  ● 話したいこと詳細記入
                </Text>

                <Text fontSize={13} color="#333" lineHeight={20}>
                  {detail || "詳細はまだ入力されていません。"}
                </Text>
              </YStack>
            </Card>
          )}

          {!posted && (
            <Button
              alignSelf="center"
              width="70%"
              height={58}
              borderRadius="$10"
              backgroundColor="#FFD966"
              color="black"
              fontSize={22}
              fontWeight="700"
              onPress={handleFind}
            >
              見つける
            </Button>
          )}

          {posted && (
            <>
              <XStack justifyContent="center">
                <Button
                  width={150}
                  height={48}
                  borderRadius="$10"
                  backgroundColor="#DDD"
                  color="black"
                  fontWeight="700"
                  onPress={handleCancel}
                >
                  キャンセル
                </Button>
              </XStack>

              <XStack flexWrap="wrap" gap="$2" justifyContent="center">
                {FILTERS.map((f) => (
                  <Button
                    key={f.value}
                    size="$2"
                    borderRadius="$10"
                    backgroundColor={filter === f.value ? "#FFD966" : "white"}
                    color="black"
                    onPress={() => setFilter(f.value)}
                  >
                    {f.label}
                  </Button>
                ))}
              </XStack>

              <Text textAlign="center" color="#AAA" fontSize={12}>
                回答してくれた人
              </Text>

              <XStack flexWrap="wrap" gap="$4">
                {filteredAnsweredRequests.map((req) => {
                  const responderImage = getProfileImage(req);
                  const responderName = req.respondedByName || "名前なし";

                  return (
                    <Pressable
                      key={req.id}
                      onPress={() =>
                        router.push({
                          pathname: "/request-detail",
                          params: {
                            id: req.id,
                            name: responderName,
                            timing: req.timing || "",
                            talkTags: req.talkTags?.join(",") || "",
                            feelTag: req.feelTag || "",
                            detail: req.detail || "",
                            imageUrl: responderImage || "",
                          },
                        })
                      }
                      style={{ width: "47%" }}
                    >
                      <Card
                        minHeight={175}
                        backgroundColor="white"
                        borderRadius="$6"
                        alignItems="center"
                        justifyContent="center"
                        gap="$2"
                        padding="$3"
                      >
                        <AvatarCircle
                          imageUrl={responderImage}
                          name={responderName}
                          size={78}
                        />

                        <Text fontSize={18} fontWeight="700" textAlign="center">
                          {responderName}
                          {req.respondedByGrade ? `(${req.respondedByGrade})` : ""}
                        </Text>

                        <YStack
                          backgroundColor="#D7F7EF"
                          borderRadius="$10"
                          paddingHorizontal="$3"
                          paddingVertical="$1"
                        >
                          <Text color="#2AA985" fontWeight="700" fontSize={13}>
                            {req.timing}
                          </Text>
                        </YStack>
                      </Card>
                    </Pressable>
                  );
                })}

                {filteredAnsweredRequests.length === 0 && (
                  <YStack width="100%" alignItems="center" paddingTop="$4">
                    <Text color="#999">まだ回答はありません</Text>
                  </YStack>
                )}
              </XStack>
            </>
          )}
        </YStack>
      </ScrollView>
    </YStack>
  );
}