import { useEffect, useState } from "react";
import { Alert, ScrollView,Image} from "react-native";
import { router } from "expo-router";
import { YStack, XStack, Text, Button, Card } from "tamagui";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

const FILTERS = [
  { key: "all", label: "全部" },
  { key: "now", label: "今すぐ" },
  { key: "later", label: "後なら" },
  { key: "little", label: "ちょっと" },
];

function ResponderAvatar({
  name,
  photoURL,
  size = 80,
}) {
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
      <Text
        fontWeight="700"
        color="#111"
        fontSize={size * 0.4}
      >
        {name?.charAt(0) || "?"}
      </Text>
    </YStack>
  );
}

export default function Requests() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [myActivePost, setMyActivePost] = useState(null);
  const [responders, setResponders] = useState([]);
  const [cancelling, setCancelling] = useState(false);

  // 自分の「投稿中」の相談を1件だけ監視（waiting or responded で、まだ matched/cancelled ではないもの）
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
          if (data.status === "matched" || data.thanksSent) return;

          active.push({ id: docSnap.id, ...data });
        });

        // 最新の投稿を優先
        active.sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime;
        });

        const latest = active[0] || null;
        setMyActivePost(latest);

        if (latest?.respondedBy) {
          setResponders([
            {
              uid: latest.respondedBy,
              name: latest.respondedByName,
              grade: latest.respondedByGrade,
              photoURL: latest.respondedByPhotoURL,
              timing: latest.timingLabel || latest.timing,
              requestId: latest.id,
            },
          ]);
        } else {
          setResponders([]);
        }
      },
      (error) => {
        console.log("myActivePost onSnapshot error:", error.message);
      }
    );

    return () => unsubscribe();
  }, []);

  const filteredResponders =
    activeFilter === "all"
      ? responders
      : responders.filter((r) => {
          if (activeFilter === "now") return r.timing === "今すぐ";
          if (activeFilter === "later") return r.timing === "後なら";
          if (activeFilter === "little") return r.timing === "ちょっと";
          return true;
        });

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

            setMyActivePost(null);
            setResponders([]);
          } catch (error) {
            Alert.alert("Error", error.message);
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  const handleOpenResponder = (requestId) => {
    router.push({
      pathname: "/requestDetail",
      params: { id: requestId },
    });
  };

  return (
    <YStack flex={1} backgroundColor="#F3F3F3">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: 60,
          paddingHorizontal: 14,
          paddingBottom: 160,
        }}
      >
        <YStack gap="$4">
          {/* フィルター */}
          {/* タイトル */}
<YStack
  alignItems="center"
  marginBottom="$4"
>
  <Text
    fontSize={30}
    fontWeight="800"
    color="#222"
  >
    リクエスト
  </Text>
</YStack>

{/* フィルター */}
<XStack
  gap="$2"
  flexWrap="wrap"
  justifyContent="center"
>
  {FILTERS.map((f) => (
    <Button
      key={f.key}
      size="$3"
      borderRadius="$10"
      backgroundColor={activeFilter === f.key ? "#333" : "#EDEAE3"}
      color={activeFilter === f.key ? "white" : "#999"}
      fontWeight="700"
      onPress={() => setActiveFilter(f.key)}
    >
      {f.label}
    </Button>
  ))}
</XStack>

          {myActivePost ? (
            <>
              <Text color="#999" fontSize={14}>
                最新の投稿に回答してくれた人です
              </Text>

              {/* 自分の投稿カード + キャンセル */}
              <Card
                backgroundColor="white"
                borderRadius="$6"
                padding="$4"
                gap="$4"
                alignItems="center"
              >
                <XStack alignItems="center" gap="$2" flexWrap="wrap" alignSelf="flex-start">
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
                <YStack gap="$2">
                  {filteredResponders.map((r) => (
                    <Card
  key={r.uid}
  backgroundColor="white"
  width={170}
  height={230}
  borderRadius="$7"
  alignItems="center"
  justifyContent="center"
  pressStyle={{ opacity: 0.8 }}
  onPress={() => handleOpenResponder(r.requestId)}
>
  <ResponderAvatar
    name={r.name}
    photoURL={r.photoURL}
    size={100}
  />

  <Text
    marginTop="$3"
    fontSize={20}
    fontWeight="800"
  >
    {r.name}
    {r.grade ? ` (${r.grade})` : ""}
  </Text>

  <Text
    marginTop="$2"
    backgroundColor="#FFE8A3"
    color="#C58B00"
    paddingHorizontal="$4"
    paddingVertical="$2"
    borderRadius={999}
    fontWeight="700"
  >
    {r.timing}
  </Text>
</Card>
                  ))}
                </YStack>
              ) : (
                <YStack alignItems="center" paddingVertical="$6">
                  <Text color="#AAA" fontSize={14}>
                    まだこの投稿に回答してくれた人はいません
                  </Text>
                </YStack>
              )}
            </>
          ) : (
            <YStack alignItems="center" paddingVertical="$8">
              <Text color="#AAA" fontSize={14}>
                現在、投稿中の相談はありません
              </Text>
            </YStack>
          )}
        </YStack>
      </ScrollView>
    </YStack>
  );
}