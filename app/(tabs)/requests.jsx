import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
} from "react-native";
import { router } from "expo-router";
import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

const FILTERS = [
  { label: "全部", value: "all", color: "#555" },
  { label: "今すぐ", value: "now", color: "#2E9E72" },
  { label: "後なら", value: "later", color: "#B8860B" },
  { label: "ちょっと", value: "wait", color: "#E05A4E" },
];

const STATUS = {
  now: {
    label: "今すぐOK",
    bg: "#D6F5EC",
    text: "#2E9E72",
  },
  later: {
    label: "後ならOK",
    bg: "#FFF3CC",
    text: "#B8860B",
  },
  wait: {
    label: "ちょっと待ってね",
    bg: "#FFE0DC",
    text: "#E05A4E",
  },
};

const normalizeStatus = (status) => {
  if (status === "now" || status === "今すぐOK") return "now";
  if (status === "later" || status === "後ならOK") return "later";
  if (status === "wait" || status === "ちょっと待ってね") return "wait";
  return "now";
};

const timingToFilter = (timing) => {
  if (timing === "今すぐ") return "now";
  if (timing === "後なら") return "later";
  if (timing === "ちょっと") return "wait";
  return "all";
};

const getProfileImage = (user) => {
  return (
    user?.respondedByPhotoURL ||
    user?.photoURL ||
    user?.imageUrl ||
    user?.avatarUrl ||
    user?.imageUri ||
    user?.profileImage ||
    user?.profileImageUrl ||
    user?.avatar ||
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

function AvatarCircle({
  imageUrl,
  name,
  size = 86,
  bg = "#FFD966",
  imageError,
  onImageError,
}) {
  const canShowImage = isImageUri(imageUrl) && !imageError;

  return (
    <View
      style={[
        styles.avatarBase,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
        },
      ]}
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
          onError={onImageError}
        />
      ) : (
        <Text
          style={[
            styles.avatarText,
            {
              fontSize: size >= 80 ? 36 : 24,
              color: bg === "#5B8DB8" ? "white" : "#111",
            },
          ]}
        >
          {name?.charAt(0) || "?"}
        </Text>
      )}
    </View>
  );
}

function PostSummaryCard({ post, onCancel }) {
  if (!post) return null;

  const canCancel = post.status !== "matched" && post.thanksSent !== true;

  return (
    <View style={styles.postSummaryCard}>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryDot}>●</Text>
        <Text style={styles.summaryTitle}>話したいこと</Text>

        <View style={styles.summaryTags}>
          {post.talkTags?.length > 0 ? (
            post.talkTags.map((tag) => (
              <Text key={tag} style={styles.summaryTagYellow}>
                {tag}
              </Text>
            ))
          ) : (
            <Text style={styles.summaryEmpty}>未選択</Text>
          )}
        </View>
      </View>

      {canCancel && (
        <TouchableOpacity
          style={styles.cancelButton}
          activeOpacity={0.8}
          onPress={onCancel}
        >
          <Text style={styles.cancelButtonText}>キャンセル</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function Seniors() {
  const [topTab, setTopTab] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");

  const [users, setUsers] = useState([]);
  const [myData, setMyData] = useState(null);

  const [requestResponses, setRequestResponses] = useState([]);
  const [latestMyPost, setLatestMyPost] = useState(null);

  const [imageErrors, setImageErrors] = useState({});

  useEffect(() => {
    const currentUid = auth.currentUser?.uid;

    if (!currentUid) {
      Alert.alert("Error", "ログインしてください");
      return;
    }

    const unsubscribeUsers = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        const allUsers = [];

        snapshot.forEach((d) => {
          allUsers.push({
            id: d.id,
            ...d.data(),
          });
        });

        const me = allUsers.find((u) => u.id === currentUid) || null;
        setMyData(me);

        const others = allUsers.filter((u) => {
          if (u.id === currentUid) return false;

          if (me?.groupId && u.groupId && u.groupId !== me.groupId) {
            return false;
          }

          return true;
        });

        setUsers(others);
      },
      (error) => {
        Alert.alert("Error", error.message);
      }
    );

    const unsubscribeRequests = onSnapshot(
      collection(db, "requests"),
      (snapshot) => {
        const myPosts = [];

        snapshot.forEach((d) => {
          const data = {
            id: d.id,
            ...d.data(),
          };

          if (data.status === "cancelled") return;

          const isMyGroupPost =
            data.type === "group" && data.fromUid === currentUid;

          if (isMyGroupPost) {
            myPosts.push(data);
          }
        });

        myPosts.sort(
          (a, b) =>
            (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
        );

        const latestPost = myPosts[0] || null;

        if (!latestPost) {
          setLatestMyPost(null);
          setRequestResponses([]);
          return;
        }

        setLatestMyPost(latestPost);

        const responses = [];

        if (
          latestPost.respondedBy &&
          (latestPost.status === "responded" || latestPost.status === "matched")
        ) {
          responses.push(latestPost);
        }

        setRequestResponses(responses);
      },
      (error) => {
        Alert.alert("Error", error.message);
      }
    );

    return () => {
      unsubscribeUsers();
      unsubscribeRequests();
    };
  }, []);

  const changeMyStatus = async (newStatus) => {
    try {
      const currentUid = auth.currentUser?.uid;

      if (!currentUid) {
        Alert.alert("Error", "ログインしてください");
        return;
      }

      await updateDoc(doc(db, "users", currentUid), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  const cancelLatestPost = async () => {
    try {
      if (!latestMyPost?.id) {
        Alert.alert("Error", "キャンセルする投稿がありません");
        return;
      }

      Alert.alert(
        "投稿をキャンセルしますか？",
        "キャンセルすると、相手の通知画面からこの相談が消えます。",
        [
          {
            text: "やめる",
            style: "cancel",
          },
          {
            text: "キャンセルする",
            style: "destructive",
            onPress: async () => {
              await updateDoc(doc(db, "requests", latestMyPost.id), {
                status: "cancelled",
                cancelledAt: serverTimestamp(),
              });

              setLatestMyPost(null);
              setRequestResponses([]);

              Alert.alert("キャンセルしました", "投稿を取り消しました");
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  const openStatusMenu = () => {
    Alert.alert("今のあなたは？", "ステータスを選んでください", [
      {
        text: "今すぐOK",
        onPress: () => changeMyStatus("now"),
      },
      {
        text: "後ならOK",
        onPress: () => changeMyStatus("later"),
      },
      {
        text: "ちょっと待ってね",
        onPress: () => changeMyStatus("wait"),
      },
      {
        text: "キャンセル",
        style: "cancel",
      },
    ]);
  };

  const filteredUsers = users.filter((user) => {
    const statusKey = normalizeStatus(user.status);

    if (activeFilter === "all") return true;
    return statusKey === activeFilter;
  });

  const filteredRequestResponses =
    activeFilter === "all"
      ? requestResponses
      : requestResponses.filter(
          (req) => timingToFilter(req.timing) === activeFilter
        );

  const myStatusKey = normalizeStatus(myData?.status);
  const myStatusStyle = STATUS[myStatusKey] || STATUS.now;

  const myImage = getProfileImage(myData);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.myStatus, { backgroundColor: myStatusStyle.bg }]}
        activeOpacity={0.8}
        onPress={openStatusMenu}
      >
        <AvatarCircle
          imageUrl={myImage}
          name={myData?.name || "自"}
          size={64}
          bg="#5B8DB8"
          imageError={imageErrors[myData?.id || "me"]}
          onImageError={() => {
            setImageErrors((prev) => ({
              ...prev,
              [myData?.id || "me"]: true,
            }));
          }}
        />

        <View style={styles.myStatusText}>
          <Text style={styles.myStatusLabel}>今のあなたは？？</Text>
          <Text style={[styles.myStatusValue, { color: myStatusStyle.text }]}>
            {myStatusStyle.label}
          </Text>
        </View>

        <Text style={[styles.chevron, { color: myStatusStyle.text }]}>∨</Text>
      </TouchableOpacity>

      <View style={styles.topTabs}>
        <TouchableOpacity
          style={[styles.topTabButton, topTab === "all" && styles.topTabActive]}
          onPress={() => setTopTab("all")}
        >
          <Text
            style={[
              styles.topTabText,
              topTab === "all" && styles.topTabTextActive,
            ]}
          >
            全体
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.topTabButton,
            topTab === "request" && styles.topTabActive,
          ]}
          onPress={() => setTopTab("request")}
        >
          <Text
            style={[
              styles.topTabText,
              topTab === "request" && styles.topTabTextActive,
            ]}
          >
            リクエスト
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filters}>
        {FILTERS.map((filter) => {
          const isActive = activeFilter === filter.value;

          return (
            <TouchableOpacity
              key={filter.value}
              style={[
                styles.filterBtn,
                isActive && { backgroundColor: filter.color },
              ]}
              onPress={() => setActiveFilter(filter.value)}
            >
              <Text
                style={[
                  styles.filterText,
                  isActive && styles.filterTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {topTab === "all" ? (
        <Text style={styles.hint}>
          今相談できる人を選んで、個人的に相談できます
        </Text>
      ) : (
        <Text style={styles.hint}>
          最新の投稿に回答してくれた人です
        </Text>
      )}

      {topTab === "request" && (
        <PostSummaryCard post={latestMyPost} onCancel={cancelLatestPost} />
      )}

      <ScrollView contentContainerStyle={styles.grid}>
        {topTab === "all" &&
          filteredUsers.map((user) => {
            const statusKey = normalizeStatus(user.status);
            const statusStyle = STATUS[statusKey] || STATUS.now;

            const userName = user.name || "名前なし";
            const displayName = user.grade
              ? `${userName}(${user.grade})`
              : userName;

            const userImage = getProfileImage(user);
            const userImageError = imageErrors[user.id];

            return (
              <TouchableOpacity
                key={user.id}
                style={styles.card}
                activeOpacity={0.8}
                onPress={() =>
                  router.push({
                    pathname: "/senior-detail",
                    params: {
                      userId: user.id,
                      name: displayName,
                      status: statusStyle.label,
                      avatar: userName.charAt(0),
                      imageUrl: userImage,
                      tags: user.tags?.join(",") || "",
                    },
                  })
                }
              >
                <AvatarCircle
                  imageUrl={userImage}
                  name={userName}
                  size={86}
                  bg="#FFD966"
                  imageError={userImageError}
                  onImageError={() => {
                    setImageErrors((prev) => ({
                      ...prev,
                      [user.id]: true,
                    }));
                  }}
                />

                <Text style={styles.name}>{displayName}</Text>

                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: statusStyle.bg,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      {
                        color: statusStyle.text,
                      },
                    ]}
                  >
                    {statusStyle.label}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}

        {topTab === "request" &&
          filteredRequestResponses.map((req) => {
            const responderName = req.respondedByName || "名前なし";
            const responderGrade = req.respondedByGrade || "";
            const responderImage = getProfileImage(req);
            const responderImageError = imageErrors[req.id];

            const timingKey = timingToFilter(req.timing);
            const timingStyle = STATUS[timingKey] || STATUS.now;

            const alreadyThanks = req.thanksSent === true;

            return (
              <TouchableOpacity
                key={req.id}
                style={styles.card}
                activeOpacity={0.8}
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
              >
                <AvatarCircle
                  imageUrl={responderImage}
                  name={responderName}
                  size={86}
                  bg="#FFD966"
                  imageError={responderImageError}
                  onImageError={() => {
                    setImageErrors((prev) => ({
                      ...prev,
                      [req.id]: true,
                    }));
                  }}
                />

                <Text style={styles.name}>
                  {responderName}
                  {responderGrade ? `(${responderGrade})` : ""}
                </Text>

                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: alreadyThanks
                        ? "#E8E8E8"
                        : timingStyle.bg,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      {
                        color: alreadyThanks ? "#777" : timingStyle.text,
                      },
                    ]}
                  >
                    {alreadyThanks ? "ありがとう済み" : req.timing || "回答あり"}
                  </Text>
                </View>

                <Text style={styles.smallText} numberOfLines={2}>
                  {req.talkTags?.join("・") || "相談内容"}
                </Text>
              </TouchableOpacity>
            );
          })}

        {topTab === "all" && filteredUsers.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>該当するユーザーがいません</Text>
          </View>
        )}

        {topTab === "request" &&
          latestMyPost &&
          filteredRequestResponses.length === 0 && (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                まだこの投稿に回答してくれた人はいません
              </Text>
            </View>
          )}

        {topTab === "request" && !latestMyPost && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>まだ投稿がありません</Text>
            <Text style={styles.emptySubText}>
              投稿タブから相談を投稿すると、ここに表示されます
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F6F2EA",
    paddingTop: 60,
  },

  myStatus: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    borderRadius: 50,
    padding: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 10,
  },

  avatarBase: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  avatarText: {
    fontWeight: "700",
  },

  myStatusText: {
    flex: 1,
  },

  myStatusLabel: {
    fontSize: 16,
    color: "#777",
  },

  myStatusValue: {
    fontSize: 28,
    fontWeight: "800",
  },

  chevron: {
    fontSize: 24,
    fontWeight: "700",
  },

  topTabs: {
    flexDirection: "row",
    backgroundColor: "#E8E4DA",
    marginHorizontal: 16,
    borderRadius: 999,
    padding: 4,
    marginBottom: 12,
  },

  topTabButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: "center",
  },

  topTabActive: {
    backgroundColor: "white",
  },

  topTabText: {
    fontSize: 15,
    color: "#777",
    fontWeight: "700",
  },

  topTabTextActive: {
    color: "#111",
  },

  filters: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },

  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: "#E8E4DA",
    flex: 1,
    alignItems: "center",
  },

  filterText: {
    fontSize: 14,
    color: "#555",
    fontWeight: "700",
  },

  filterTextActive: {
    color: "white",
    fontWeight: "700",
  },

  hint: {
    fontSize: 13,
    color: "#999",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 18,
    paddingHorizontal: 16,
  },

  postSummaryCard: {
    backgroundColor: "white",
    marginHorizontal: 16,
    marginBottom: 18,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },

  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 10,
    gap: 6,
  },

  summaryDot: {
    color: "#FFD966",
    fontSize: 14,
    fontWeight: "700",
  },

  summaryTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111",
  },

  summaryTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    flex: 1,
  },

  summaryTagYellow: {
    backgroundColor: "#E8C75A",
    color: "white",
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },

  summaryTagGray: {
    backgroundColor: "#BDBDBD",
    color: "white",
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },

  summaryEmpty: {
    color: "#999",
    fontSize: 12,
  },

  summaryDetailBox: {
    marginTop: 2,
  },

  summaryDetailTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },

  summaryDetailText: {
    fontSize: 13,
    color: "#333",
    lineHeight: 19,
    paddingLeft: 20,
  },

  cancelButton: {
    marginTop: 16,
    alignSelf: "center",
    backgroundColor: "#E0E0E0",
    paddingHorizontal: 48,
    paddingVertical: 12,
    borderRadius: 999,
  },

  cancelButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 16,
    paddingBottom: 120,
  },

  card: {
    width: "47%",
    backgroundColor: "white",
    borderRadius: 20,
    padding: 16,
    alignItems: "center",
    gap: 10,
    minHeight: 205,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  name: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
    textAlign: "center",
  },

  badge: {
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: 20,
  },

  badgeText: {
    fontSize: 13,
    fontWeight: "700",
  },

  smallText: {
    fontSize: 12,
    color: "#999",
    textAlign: "center",
    lineHeight: 16,
  },

  emptyBox: {
    width: "100%",
    paddingTop: 40,
    alignItems: "center",
    paddingHorizontal: 24,
  },

  emptyText: {
    color: "#999",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },

  emptySubText: {
    color: "#AAA",
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 18,
  },
});