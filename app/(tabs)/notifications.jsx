import { useState, useEffect, useCallback } from "react";
import { ScrollView, Alert, Pressable, Image } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { YStack, XStack, Text, Button, Card } from "tamagui";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

const getProfileImage = (data) => {
  return (
    data?.respondedByPhotoURL ||
    data?.fromPhotoURL ||
    data?.thanksFromPhotoURL ||
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

const toDate = (value) => {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate();
  }

  if (value.seconds) {
    return new Date(value.seconds * 1000);
  }

  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
};

const formatDateTime = (value) => {
  const date = toDate(value);
  if (!date) return "";

  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
};

function DateBadge({ label, value }) {
  const text = formatDateTime(value);
  if (!text) return null;

  return (
    <Text
      fontSize={11}
      color="#777"
      backgroundColor="#F3F3F3"
      paddingHorizontal="$2"
      paddingVertical="$1"
      borderRadius="$10"
    >
      {label ? `${label} ${text}` : text}
    </Text>
  );
}

function AvatarCircle({ imageUrl, name, size = 58, bg = "#FFD966" }) {
  const canShowImage = isImageUri(imageUrl);

  return (
    <YStack
      width={size}
      height={size}
      borderRadius={999}
      backgroundColor={bg}
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
        <Text fontSize={24} fontWeight="700" color="#111">
          {name?.charAt(0) || "?"}
        </Text>
      )}
    </YStack>
  );
}

export default function NotificationsScreen() {
  const [myRequests, setMyRequests] = useState([]);
  const [otherRequests, setOtherRequests] = useState([]);
  const [userProfiles, setUserProfiles] = useState({});

  const currentUid = auth.currentUser?.uid;

  useEffect(() => {
    if (!currentUid) return;

    let unsubscribe;

    const fetchRelatedProfiles = async (requests) => {
      try {
        const ids = new Set();

        requests.forEach((req) => {
          if (req.fromUid) ids.add(req.fromUid);
          if (req.respondedBy) ids.add(req.respondedBy);
          if (req.thanksFromUid) ids.add(req.thanksFromUid);
          if (req.toUid) ids.add(req.toUid);
        });

        if (ids.size === 0) return;

        const profileMap = {};

        await Promise.all(
          [...ids].map(async (uid) => {
            const snap = await getDoc(doc(db, "users", uid));
            if (snap.exists()) {
              profileMap[uid] = snap.data();
            }
          })
        );

        setUserProfiles((prev) => ({
          ...prev,
          ...profileMap,
        }));
      } catch (error) {
        console.log("fetchRelatedProfiles error:", error.message);
      }
    };

    unsubscribe = onSnapshot(
      collection(db, "requests"),
      (snapshot) => {
        const mine = [];
        const others = [];
        const all = [];

        snapshot.forEach((d) => {
          const data = {
            id: d.id,
            ...d.data(),
          };

          if (data.status === "cancelled") return;

          all.push(data);

          // 自分が投稿した相談
          if (data.fromUid === currentUid) {
            mine.push(data);
          }

          // 個人的に自分へ届いた相談
          const isDirectForMe =
            data.type === "direct" &&
            data.fromUid !== currentUid &&
            data.toUid === currentUid;

          // 投稿タブから全体に投稿された相談
          // groupId では絞らない
          const isGroupForMe =
            data.type === "group" &&
            data.fromUid !== currentUid;

          if (isDirectForMe || isGroupForMe) {
            others.push(data);
          }
        });

        mine.sort(
          (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
        );

        others.sort(
          (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
        );

        setMyRequests(mine);
        setOtherRequests(others);
        fetchRelatedProfiles(all);
      },
      (error) => {
        Alert.alert("Error", error.message);
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentUid]);

  const handleRespond = async (request, timing) => {
    try {
      if (!currentUid) return;

      const requestRef = doc(db, "requests", request.id);
      const latestSnap = await getDoc(requestRef);

      if (!latestSnap.exists()) {
        Alert.alert("Error", "この相談は見つかりません");
        return;
      }

      const latest = latestSnap.data();

      if (latest.status === "cancelled") {
        Alert.alert("キャンセル済み", "この相談は投稿者によってキャンセルされました");
        return;
      }

      if (latest.status !== "waiting") {
        Alert.alert("すでに返信済みです");
        return;
      }

      const mySnap = await getDoc(doc(db, "users", currentUid));
      const myData = mySnap.exists() ? mySnap.data() : {};
      const myName = myData.name || "名前なし";
      const myImage = getProfileImage(myData);

      await updateDoc(requestRef, {
        respondedBy: currentUid,
        respondedByName: myName,
        respondedByGrade: myData.grade || "",
        respondedByPhotoURL: myImage,
        timing,
        timingLabel: timing,
        status: "responded",
        respondedAt: serverTimestamp(),
      });

      const fromSnap = await getDoc(doc(db, "users", request.fromUid));
      const fromToken = fromSnap.data()?.expoPushToken;

      if (fromToken) {
        await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: fromToken,
            title: "お返事が届きました！",
            body: `${myName}さんが「${timing}」で返信しました`,
            sound: "default",
            data: {
              requestId: request.id,
              type: "response",
            },
          }),
        });
      }

      Alert.alert("送信しました", `「${timing}」で返信しました`);
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  const openRequestDetail = (req) => {
    if (req.status === "matched") {
      Alert.alert("送信済み", "この相談はすでにありがとうを送信しました");
      return;
    }

    const responderProfile = userProfiles[req.respondedBy] || {};
    const responderImage =
      req.respondedByPhotoURL || getProfileImage(responderProfile);

    router.push({
      pathname: "/request-detail",
      params: {
        id: req.id,
        name: req.respondedByName || "名前なし",
        timing: req.timing || "",
        talkTags: req.talkTags?.join(",") || "",
        feelTag: req.feelTag || "",
        detail: req.detail || "",
        imageUrl: responderImage || "",
      },
    });
  };

  const getRequestTypeLabel = (req) => {
    if (req.type === "direct") return "出会う";
    if (req.type === "group") return "投稿";
    return "投稿";
  };

  const getWaitingTypeLabel = (req) => {
    if (req.type === "direct") return "あなた宛て";
    if (req.type === "group") return "全体投稿";
    return "全体投稿";
  };

  // 自分の投稿に返事が来たもの
  const respondedRequests = myRequests.filter(
    (r) => r.status === "responded" || r.status === "matched"
  );

  // 自分が返信したもの
  const myRespondedOthers = otherRequests.filter(
    (r) =>
      r.respondedBy === currentUid &&
      (r.status === "responded" || r.status === "matched")
  );

  // 自分がまだ返信していない相談
  const waitingRequests = otherRequests.filter(
    (r) => r.status === "waiting" && !r.respondedBy
  );

  const myRespondedOthersKey = myRespondedOthers
    .map(
      (req) =>
        `${req.id}:${req.status}:${req.thanksSent}:${req.thanksSeenByResponder}`
    )
    .join("|");

  useFocusEffect(
    useCallback(() => {
      const markThanksAsSeen = async () => {
        try {
          if (!currentUid) return;

          const unreadThanks = myRespondedOthers.filter(
            (req) =>
              req.respondedBy === currentUid &&
              req.status === "matched" &&
              req.thanksSent &&
              req.thanksSeenByResponder !== true
          );

          for (const req of unreadThanks) {
            await updateDoc(doc(db, "requests", req.id), {
              thanksSeenByResponder: true,
              thanksSeenAt: serverTimestamp(),
            });
          }
        } catch (error) {
          console.log("markThanksAsSeen error:", error.message);
        }
      };

      markThanksAsSeen();
    }, [currentUid, myRespondedOthersKey])
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#F3F3F3" }}
      contentContainerStyle={{
        padding: 16,
        paddingTop: 60,
        paddingBottom: 120,
      }}
    >
      <Text fontSize={28} fontWeight="700" marginBottom="$4">
        通知
      </Text>

      {/* 自分への返事 */}
      {respondedRequests.length > 0 && (
        <YStack marginBottom="$5">
          <Text fontSize={14} fontWeight="700" color="#999" marginBottom="$2">
            あなたへのお返事
          </Text>

          {respondedRequests.map((req) => {
            const responderProfile = userProfiles[req.respondedBy] || {};
            const responderImage =
              req.respondedByPhotoURL || getProfileImage(responderProfile);

            return (
              <Pressable key={req.id} onPress={() => openRequestDetail(req)}>
                <Card
                  backgroundColor="white"
                  borderRadius="$6"
                  marginBottom="$3"
                  overflow="hidden"
                >
                  <YStack
                    backgroundColor="#E6FBF5"
                    padding="$3"
                    alignItems="center"
                  >
                    <Text fontSize={18} fontWeight="700" color="#2AA985">
                      {req.status === "matched"
                        ? "ありがとう送信済み"
                        : "お返事が届きました！"}
                    </Text>
                  </YStack>

                  <YStack padding="$4" gap="$3">
                    <XStack justifyContent="space-between" alignItems="center">
                      <Text fontSize={12} color="#999">
                        {getRequestTypeLabel(req)}
                      </Text>

                      <DateBadge
                        label={req.status === "matched" ? "完了" : "返信"}
                        value={
                          req.status === "matched"
                            ? req.thanksAt
                            : req.respondedAt
                        }
                      />
                    </XStack>

                    <XStack gap="$3" alignItems="center">
                      <AvatarCircle
                        imageUrl={responderImage}
                        name={req.respondedByName}
                        size={58}
                        bg="#FFD966"
                      />

                      <YStack flex={1}>
                        <Text fontSize={18} fontWeight="700" color="#111">
                          {req.respondedByName || "名前なし"}
                          {req.respondedByGrade
                            ? ` (${req.respondedByGrade})`
                            : ""}
                        </Text>

                        <Text fontSize={17} fontWeight="700" color="#2AA985">
                          「{req.timing}」で話せます
                        </Text>

                        {req.status === "matched" ? (
                          <Text fontSize={13} color="#999">
                            相手にありがとうを送りました
                          </Text>
                        ) : (
                          <Text fontSize={13} color="#999">
                            押してありがとうを送る
                          </Text>
                        )}
                      </YStack>
                    </XStack>
                  </YStack>
                </Card>
              </Pressable>
            );
          })}
        </YStack>
      )}

      {/* 自分が返事したもの */}
      {myRespondedOthers.length > 0 && (
        <YStack marginBottom="$5">
          <Text fontSize={14} fontWeight="700" color="#999" marginBottom="$2">
            お返事済み
          </Text>

          {myRespondedOthers.map((req) => {
            const fromProfile = userProfiles[req.fromUid] || {};
            const fromImage = req.fromPhotoURL || getProfileImage(fromProfile);

            return (
              <Card
                key={req.id}
                backgroundColor="white"
                borderRadius="$6"
                marginBottom="$3"
                overflow="hidden"
              >
                <YStack
                  backgroundColor={
                    req.status === "matched" ? "#E6FBF5" : "#FFFBE6"
                  }
                  padding="$3"
                  alignItems="center"
                >
                  <Text
                    fontSize={18}
                    fontWeight="700"
                    color={req.status === "matched" ? "#2AA985" : "#B8860B"}
                  >
                    {req.status === "matched"
                      ? "ありがとうが届きました！"
                      : "お返事済み"}
                  </Text>
                </YStack>

                <YStack padding="$4" gap="$3">
                  <XStack justifyContent="space-between" alignItems="center">
                    <Text fontSize={12} color="#999">
                      {getRequestTypeLabel(req)}
                    </Text>

                    <DateBadge
                      label={req.status === "matched" ? "ありがとう" : "返信"}
                      value={
                        req.status === "matched"
                          ? req.thanksAt
                          : req.respondedAt
                      }
                    />
                  </XStack>

                  <XStack gap="$3" alignItems="center">
                    <AvatarCircle
                      imageUrl={fromImage}
                      name={req.fromName}
                      size={54}
                      bg="#D9D9D9"
                    />

                    <YStack flex={1}>
                      <Text fontSize={16} fontWeight="700" color="#111">
                        {req.fromName || "匿名"}
                        {req.fromGrade ? ` (${req.fromGrade})` : ""}
                      </Text>

                      <Text fontSize={13} color="#999">
                        「{req.timing}」で返信済みです
                      </Text>
                    </YStack>
                  </XStack>

                  <XStack gap="$2" flexWrap="wrap" alignItems="center">
                    <Text fontSize={13} color="#777">
                      話したいこと:
                    </Text>

                    {req.talkTags?.map((tag) => (
                      <Text
                        key={tag}
                        fontSize={12}
                        backgroundColor="#FFD966"
                        paddingHorizontal="$2"
                        paddingVertical="$1"
                        borderRadius="$10"
                      >
                        {tag}
                      </Text>
                    ))}
                  </XStack>

                  <XStack gap="$2" alignItems="center">
                    <Text fontSize={13} color="#777">
                      状態:
                    </Text>

                    <Text
                      fontSize={12}
                      backgroundColor="#E0E0E0"
                      paddingHorizontal="$2"
                      paddingVertical="$1"
                      borderRadius="$10"
                    >
                      {req.feelTag}
                    </Text>
                  </XStack>

                  {req.status === "matched" ? (
                    <YStack gap="$2" marginTop="$1">
                      <YStack
                        backgroundColor="#E6FBF5"
                        borderRadius="$4"
                        padding="$3"
                        alignItems="center"
                      >
                        <Text fontSize={13} color="#2AA985">
                          {req.thanksFromName || "相手"}
                          {req.thanksFromGrade
                            ? ` (${req.thanksFromGrade})`
                            : ""}
                          さんから
                        </Text>

                        <Text fontSize={16} fontWeight="700" color="#2AA985">
                          ありがとうが届きました！
                        </Text>
                      </YStack>

                      <YStack
                        backgroundColor="#F0FBF8"
                        borderRadius="$4"
                        padding="$3"
                        alignItems="center"
                      >
                        <Text fontSize={14} color="#2AA985">
                          {req.thanksMessage || "ありがとうございます！"}
                        </Text>
                      </YStack>
                    </YStack>
                  ) : null}
                </YStack>
              </Card>
            );
          })}
        </YStack>
      )}

      {/* 返事待ち */}
      {waitingRequests.length > 0 && (
        <YStack>
          <Text fontSize={14} fontWeight="700" color="#999" marginBottom="$2">
            相談が届いています
          </Text>

          {waitingRequests.map((req) => {
            const fromProfile = userProfiles[req.fromUid] || {};
            const fromImage = req.fromPhotoURL || getProfileImage(fromProfile);

            return (
              <Card
                key={req.id}
                backgroundColor="white"
                borderRadius="$6"
                marginBottom="$3"
                overflow="hidden"
              >
                <YStack backgroundColor="#FFFBE6" padding="$3" alignItems="center">
                  <Text fontSize={18} fontWeight="700" color="#B8860B">
                    話しかけてくれました！
                  </Text>
                </YStack>

                <YStack padding="$4" gap="$3">
                  <XStack justifyContent="space-between" alignItems="center">
                    <Text fontSize={12} color="#999">
                      {getWaitingTypeLabel(req)}
                    </Text>

                    <DateBadge label="投稿" value={req.createdAt} />
                  </XStack>

                  <XStack gap="$3" alignItems="center">
                    <AvatarCircle
                      imageUrl={fromImage}
                      name={req.fromName}
                      size={54}
                      bg="#D9D9D9"
                    />

                    <YStack flex={1}>
                      <Text fontSize={16} fontWeight="700" color="#111">
                        {req.fromName || "匿名"}
                        {req.fromGrade ? ` (${req.fromGrade})` : ""}
                      </Text>

                      <Text fontSize={13} color="#999">
                        {getRequestTypeLabel(req)} からの相談
                      </Text>
                    </YStack>
                  </XStack>

                  <XStack gap="$2" flexWrap="wrap" alignItems="center">
                    <Text fontSize={13} color="#777">
                      話したいこと:
                    </Text>

                    {req.talkTags?.map((tag) => (
                      <Text
                        key={tag}
                        fontSize={12}
                        backgroundColor="#FFD966"
                        paddingHorizontal="$2"
                        paddingVertical="$1"
                        borderRadius="$10"
                      >
                        {tag}
                      </Text>
                    ))}
                  </XStack>

                  <XStack gap="$2" alignItems="center">
                    <Text fontSize={13} color="#777">
                      状態:
                    </Text>

                    <Text
                      fontSize={12}
                      backgroundColor="#E0E0E0"
                      paddingHorizontal="$2"
                      paddingVertical="$1"
                      borderRadius="$10"
                    >
                      {req.feelTag}
                    </Text>
                  </XStack>

                  {req.detail ? (
                    <YStack>
                      <Text fontSize={13} color="#777">
                        詳細:
                      </Text>

                      <Text fontSize={14} color="#333" marginTop="$1">
                        {req.detail}
                      </Text>
                    </YStack>
                  ) : null}

                  <YStack gap="$2" marginTop="$2">
                    <Text fontSize={13} color="#777">
                      返事を選択してください
                    </Text>

                    <XStack gap="$2">
                      <Button
                        flex={1}
                        height={44}
                        borderRadius="$10"
                        backgroundColor="#D7F7EF"
                        color="#2AA985"
                        fontWeight="700"
                        onPress={() => handleRespond(req, "今すぐ")}
                      >
                        今すぐ
                      </Button>

                      <Button
                        flex={1}
                        height={44}
                        borderRadius="$10"
                        backgroundColor="#FFF1C7"
                        color="#C78A00"
                        fontWeight="700"
                        onPress={() => handleRespond(req, "後なら")}
                      >
                        後なら
                      </Button>

                      <Button
                        flex={1}
                        height={44}
                        borderRadius="$10"
                        backgroundColor="#FFDADA"
                        color="#E35A5A"
                        fontWeight="700"
                        onPress={() => handleRespond(req, "ちょっと")}
                      >
                        ちょっと
                      </Button>
                    </XStack>
                  </YStack>
                </YStack>
              </Card>
            );
          })}
        </YStack>
      )}

      {respondedRequests.length === 0 &&
        myRespondedOthers.length === 0 &&
        waitingRequests.length === 0 && (
          <YStack alignItems="center" paddingTop="$10">
            <Text color="#999">まだ通知はありません</Text>
          </YStack>
        )}
    </ScrollView>
  );
}