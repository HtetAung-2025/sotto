import { useState, useEffect, useCallback } from "react";
import { ScrollView, Alert, Pressable, Image } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { YStack, XStack, Text, Button, Card } from "tamagui";
import {
  collection,
  collectionGroup,
  onSnapshot,
  doc,
  updateDoc,
  setDoc,
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

  // requestId -> true があれば「自分はこの投稿にすでに回答済み」
  const [myRespondedRequestIds, setMyRespondedRequestIds] = useState({});

  // 複数人対応：自分の投稿に来た「個別の回答」一覧（responses サブコレクション横断）
  const [myPostResponses, setMyPostResponses] = useState([]);

  // 複数人対応：自分が回答した「個別の回答」一覧（ありがとうが来たかどうか含む）
  const [myOwnResponses, setMyOwnResponses] = useState([]);

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

          if (data.fromUid === currentUid) {
            mine.push(data);
          }

          const isDirectForMe =
            data.type === "direct" &&
            data.fromUid !== currentUid &&
            data.toUid === currentUid;

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

  // 複数人対応：全投稿をまたいで responses を横断監視
  // - myPostResponses: 自分の投稿に来た回答（複数人ぶん、それぞれ個別カード表示用）
  // - myOwnResponses: 自分が回答した先（複数投稿ぶん、ありがとうが来たか確認用）
  // - myRespondedRequestIds: 自分がまだ回答していない投稿を判定するための存在チェック用
  useEffect(() => {
    if (!currentUid) return;

    const responsesGroupRef = collectionGroup(db, "responses");

    const unsubscribe = onSnapshot(
      responsesGroupRef,
      (snapshot) => {
        const toMe = [];
        const byMe = [];
        const respondedMap = {};

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const requestId = docSnap.ref.parent.parent?.id;

          if (!requestId) return;

          const entry = {
            requestId,
            responderUid: docSnap.id,
            ...data,
          };

          if (data.requestFromUid === currentUid) {
            toMe.push(entry);
          }

          if (docSnap.id === currentUid) {
            byMe.push(entry);
            respondedMap[requestId] = true;
          }
        });

        toMe.sort(
          (a, b) => (b.respondedAt?.seconds || 0) - (a.respondedAt?.seconds || 0)
        );

        byMe.sort(
          (a, b) => (b.respondedAt?.seconds || 0) - (a.respondedAt?.seconds || 0)
        );

        setMyPostResponses(toMe);
        setMyOwnResponses(byMe);
        setMyRespondedRequestIds(respondedMap);
      },
      (error) => {
        console.log("responses collectionGroup onSnapshot error:", error.message);
      }
    );

    return () => unsubscribe();
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

      const isGroup = latest.type === "group";

      const myResponseRef = doc(
        db,
        "requests",
        request.id,
        "responses",
        currentUid
      );

      if (isGroup) {
        const myResponseSnap = await getDoc(myResponseRef);

        if (myResponseSnap.exists()) {
          Alert.alert("すでに返信済みです");
          return;
        }
      } else {
        if (latest.status !== "waiting") {
          Alert.alert("すでに返信済みです");
          return;
        }
      }

      const mySnap = await getDoc(doc(db, "users", currentUid));
      const myData = mySnap.exists() ? mySnap.data() : {};
      const myName = myData.name || "名前なし";
      const myImage = getProfileImage(myData);

      if (isGroup) {
        // 複数人対応：responsesサブコレクションに自分の回答を追加
        // requestFromUid を持たせることで、投稿者側は collectionGroup で
        // 「自分宛ての全回答」を横断検索できる
        // posterSeen: 投稿者がこの回答をまだ通知タブで見ていないかどうか
        await setDoc(myResponseRef, {
          uid: currentUid,
          requestFromUid: latest.fromUid,
          name: myName,
          grade: myData.grade || "",
          photoURL: myImage,
          timing,
          timingLabel: timing,
          respondedAt: serverTimestamp(),
          thanksSent: false,
          thanksSeenByResponder: false,
          posterSeen: false,
        });

        await updateDoc(requestRef, {
          status: "responded",
          respondedBy: currentUid,
          respondedByName: myName,
          respondedByGrade: myData.grade || "",
          respondedByPhotoURL: myImage,
          timing,
          timingLabel: timing,
          respondedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(requestRef, {
          respondedBy: currentUid,
          respondedByName: myName,
          respondedByGrade: myData.grade || "",
          respondedByPhotoURL: myImage,
          timing,
          timingLabel: timing,
          status: "responded",
          respondedAt: serverTimestamp(),
          posterSeen: false,
        });
      }

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

  const openMyPostResponse = (entry) => {
    if (entry.thanksSent) {
      Alert.alert("送信済み", "この人にはすでにありがとうを送信しました");
      return;
    }

    router.push({
      pathname: "/request-detail",
      params: {
        id: entry.requestId,
        responderUid: entry.responderUid,
      },
    });
  };

  const openDirectRequestDetail = (req) => {
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

  // 自分の投稿に返事が来たもの（direct のみ、旧来通り）
  const directRespondedRequests = myRequests.filter(
    (r) => r.type === "direct" && (r.status === "responded" || r.status === "matched")
  );

  // 自分が返信したもの（direct分は respondedBy で判定、group分は myRespondedRequestIds で判定）
  const myRespondedOthers = otherRequests.filter((r) => {
    if (r.type === "direct") {
      return (
        r.respondedBy === currentUid &&
        (r.status === "responded" || r.status === "matched")
      );
    }

    if (r.type === "group") {
      return !!myRespondedRequestIds[r.id];
    }

    return false;
  });

  // 自分がまだ返信していない相談
  const waitingRequests = otherRequests.filter((r) => {
    if (r.type === "direct") {
      return r.status === "waiting" && !r.respondedBy;
    }

    if (r.type === "group") {
      return !myRespondedRequestIds[r.id];
    }

    return false;
  });

  const myRespondedOthersKey = myRespondedOthers
    .map(
      (req) =>
        `${req.id}:${req.status}:${req.thanksSent}:${req.thanksSeenByResponder}`
    )
    .join("|");

  const myOwnResponsesKey = myOwnResponses
    .map(
      (r) => `${r.requestId}:${r.thanksSent}:${r.thanksSeenByResponder}`
    )
    .join("|");

  // 通知バッジの既読化用キー（自分の投稿に来た回答の未読状態が変わったら再実行）
  const directRespondedRequestsKey = directRespondedRequests
    .map((req) => `${req.id}:${req.posterSeen}`)
    .join("|");

  const myPostResponsesKey = myPostResponses
    .map((entry) => `${entry.requestId}-${entry.responderUid}:${entry.posterSeen}`)
    .join("|");

  useFocusEffect(
    useCallback(() => {
      const markThanksAsSeen = async () => {
        try {
          if (!currentUid) return;

          // 自分の投稿への回答（direct）を既読にする → バッジのカウントから外れる
          const unseenDirectReplies = directRespondedRequests.filter(
            (req) => req.posterSeen !== true
          );

          for (const req of unseenDirectReplies) {
            await updateDoc(doc(db, "requests", req.id), {
              posterSeen: true,
            });
          }

          // 自分の投稿への回答（group、複数人ぶん）を既読にする
          const unseenGroupReplies = myPostResponses.filter(
            (entry) => entry.posterSeen !== true
          );

          for (const entry of unseenGroupReplies) {
            await updateDoc(
              doc(db, "requests", entry.requestId, "responses", entry.responderUid),
              { posterSeen: true }
            );
          }

          // direct分（ありがとう既読化）
          const unreadThanks = myRespondedOthers.filter(
            (req) =>
              req.type === "direct" &&
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

          // group分（複数人対応：responses サブコレクション側を更新）
          const unreadGroupThanks = myOwnResponses.filter(
            (r) => r.thanksSent && r.thanksSeenByResponder !== true
          );

          for (const r of unreadGroupThanks) {
            await updateDoc(
              doc(db, "requests", r.requestId, "responses", currentUid),
              {
                thanksSeenByResponder: true,
                thanksSeenAt: serverTimestamp(),
              }
            );
          }
        } catch (error) {
          console.log("markThanksAsSeen error:", error.message);
        }
      };

      markThanksAsSeen();
    }, [
      currentUid,
      myRespondedOthersKey,
      myOwnResponsesKey,
      directRespondedRequestsKey,
      myPostResponsesKey,
    ])
  );

  const hasNothing =
    directRespondedRequests.length === 0 &&
    myPostResponses.length === 0 &&
    myRespondedOthers.length === 0 &&
    waitingRequests.length === 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#F7F2EA" }}
      contentContainerStyle={{
        padding: 16,
        paddingTop: 60,
        paddingBottom: 120,
      }}
    >

      {/* 自分への返事（direct） */}
      {directRespondedRequests.length > 0 && (
        <YStack marginBottom="$5">
          <Text fontSize={14} fontWeight="700" color="#999" marginBottom="$2">
            あなたへのお返事
          </Text>

          {directRespondedRequests.map((req) => {
            const responderProfile = userProfiles[req.respondedBy] || {};
            const responderImage =
              req.respondedByPhotoURL || getProfileImage(responderProfile);

            return (
              <Pressable key={req.id} onPress={() => openDirectRequestDetail(req)}>
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

      {/* 自分の投稿に来た回答（group、複数人ぶん個別カード） */}
      {myPostResponses.length > 0 && (
        <YStack marginBottom="$5">
          <Text fontSize={14} fontWeight="700" color="#999" marginBottom="$2">
            あなたの投稿への回答
          </Text>

          {myPostResponses.map((entry) => (
            <Pressable
              key={`${entry.requestId}-${entry.responderUid}`}
              onPress={() => openMyPostResponse(entry)}
            >
              <Card
                backgroundColor="white"
                borderRadius="$6"
                marginBottom="$3"
                overflow="hidden"
              >
                <YStack
                  backgroundColor={entry.thanksSent ? "#E6FBF5" : "#FFFBE6"}
                  padding="$3"
                  alignItems="center"
                >
                  <Text
                    fontSize={18}
                    fontWeight="700"
                    color={entry.thanksSent ? "#2AA985" : "#B8860B"}
                  >
                    {entry.thanksSent
                      ? "ありがとう送信済み"
                      : "お返事が届きました！"}
                  </Text>
                </YStack>

                <YStack padding="$4" gap="$3">
                  <XStack justifyContent="space-between" alignItems="center">
                    <Text fontSize={12} color="#999">
                      投稿
                    </Text>

                    <DateBadge
                      label={entry.thanksSent ? "完了" : "返信"}
                      value={entry.thanksSent ? entry.thanksAt : entry.respondedAt}
                    />
                  </XStack>

                  <XStack gap="$3" alignItems="center">
                    <AvatarCircle
                      imageUrl={entry.photoURL}
                      name={entry.name}
                      size={58}
                      bg="#FFD966"
                    />

                    <YStack flex={1}>
                      <Text fontSize={18} fontWeight="700" color="#111">
                        {entry.name || "名前なし"}
                        {entry.grade ? ` (${entry.grade})` : ""}
                      </Text>

                      <Text fontSize={17} fontWeight="700" color="#2AA985">
                        「{entry.timingLabel || entry.timing}」で話せます
                      </Text>

                      {entry.thanksSent ? (
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
          ))}
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

            const myOwn = myOwnResponses.find((r) => r.requestId === req.id);
            const thanksSent = req.type === "group" ? myOwn?.thanksSent : req.thanksSent;
            const timingText = req.type === "group" ? (myOwn?.timingLabel || myOwn?.timing) : req.timing;

            return (
              <Card
                key={req.id}
                backgroundColor="white"
                borderRadius="$6"
                marginBottom="$3"
                overflow="hidden"
              >
                <YStack
                  backgroundColor={thanksSent ? "#E6FBF5" : "#FFFBE6"}
                  padding="$3"
                  alignItems="center"
                >
                  <Text
                    fontSize={18}
                    fontWeight="700"
                    color={thanksSent ? "#2AA985" : "#B8860B"}
                  >
                    {thanksSent ? "ありがとうが届きました！" : "お返事済み"}
                  </Text>
                </YStack>

                <YStack padding="$4" gap="$3">
                  <XStack justifyContent="space-between" alignItems="center">
                    <Text fontSize={12} color="#999">
                      {getRequestTypeLabel(req)}
                    </Text>

                    <DateBadge
                      label={thanksSent ? "ありがとう" : "返信"}
                      value={
                        thanksSent
                          ? (req.type === "group" ? myOwn?.thanksAt : req.thanksAt)
                          : (req.type === "group" ? myOwn?.respondedAt : req.respondedAt)
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
                        「{timingText}」で返信済みです
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

      {hasNothing && (
        <YStack alignItems="center" paddingTop="$10">
          <Text color="#999">まだ通知はありません</Text>
        </YStack>
      )}
    </ScrollView>
  );
}