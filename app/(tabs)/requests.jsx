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

const getProfileImage = (user) => {
  return (
    user?.photoURL ||
    user?.imageUrl ||
    user?.avatarUrl ||
    user?.imageUri ||
    user?.profileImage ||
    user?.profileImageUrl ||
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

export default function Seniors() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [users, setUsers] = useState([]);
  const [myData, setMyData] = useState(null);

  useEffect(() => {
    const currentUid = auth.currentUser?.uid;

    if (!currentUid) {
      Alert.alert("Error", "ログインしてください");
      return;
    }

    const unsubscribe = onSnapshot(
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

          // groupId がある場合は同じグループだけ表示
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

    return () => unsubscribe();
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

  const myStatusKey = normalizeStatus(myData?.status);
  const myStatusStyle = STATUS[myStatusKey] || STATUS.now;

  const myImage = getProfileImage(myData);
  const canShowMyImage = isImageUri(myImage);

  return (
    <View style={styles.container}>
      {/* 自分のステータスバー */}
      <TouchableOpacity
        style={[styles.myStatus, { backgroundColor: myStatusStyle.bg }]}
        activeOpacity={0.8}
        onPress={openStatusMenu}
      >
        <View style={styles.myAvatar}>
          {canShowMyImage ? (
            <Image
              source={{ uri: myImage }}
              style={styles.myAvatarImage}
              resizeMode="cover"
            />
          ) : (
            <Text style={styles.myAvatarText}>
              {myData?.name?.charAt(0) || "自"}
            </Text>
          )}
        </View>

        <View style={styles.myStatusText}>
          <Text style={styles.myStatusLabel}>今のあなたは？？</Text>
          <Text style={[styles.myStatusValue, { color: myStatusStyle.text }]}>
            {myStatusStyle.label}
          </Text>
        </View>

        <Text style={[styles.chevron, { color: myStatusStyle.text }]}>∨</Text>
      </TouchableOpacity>

      {/* フィルタータブ */}
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

      <Text style={styles.hint}>声をかけたい人をクリックしてください</Text>

      {/* ユーザーグリッド */}
      <ScrollView contentContainerStyle={styles.grid}>
        {filteredUsers.map((user) => {
          const statusKey = normalizeStatus(user.status);
          const statusStyle = STATUS[statusKey] || STATUS.now;

          const userName = user.name || "名前なし";
          const displayName = user.grade
            ? `${userName}(${user.grade})`
            : userName;

          const userImage = getProfileImage(user);
          const canShowUserImage = isImageUri(userImage);

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
              <View style={styles.avatar}>
                {canShowUserImage ? (
                  <Image
                    source={{ uri: userImage }}
                    style={styles.avatarImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.avatarText}>{userName.charAt(0)}</Text>
                )}
              </View>

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

        {filteredUsers.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>該当するユーザーがいません</Text>
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

  myAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#5B8DB8",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  myAvatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },

  myAvatarText: {
    color: "white",
    fontSize: 24,
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

  filters: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },

  filterBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: "#E8E4DA",
    flex: 1,
    alignItems: "center",
  },

  filterText: {
    fontSize: 15,
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
    marginTop: 10,
    marginBottom: 18,
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
    minHeight: 195,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  avatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: "#FFD966",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  avatarImage: {
    width: 86,
    height: 86,
    borderRadius: 43,
  },

  avatarText: {
    fontSize: 36,
    fontWeight: "700",
    color: "#111",
  },

  name: {
    fontSize: 19,
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

  emptyBox: {
    width: "100%",
    paddingTop: 40,
    alignItems: "center",
  },

  emptyText: {
    color: "#999",
    fontSize: 14,
  },
});