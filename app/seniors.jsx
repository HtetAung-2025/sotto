import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from "react-native";
import { router } from "expo-router";

const FILTERS = ["全部", "今すぐ", "後なら", "ちょっと"];

const STATUS_COLORS = {
  "今すぐOK": { bg: "#D6F5EC", text: "#2E9E72" },
  "後ならOK": { bg: "#FFF3CC", text: "#B8860B" },
  "ちょっと待ってね": { bg: "#FFE0DC", text: "#E05A4E" },
};

// ダミーデータ（後でFirestoreから取得）
const SENIORS = [
  { id: "1", name: "磯山(2年)", status: "今すぐOK", avatar: null },
  { id: "2", name: "江口", status: "今すぐOK", avatar: null },
  { id: "3", name: "澤田", status: "今すぐOK", avatar: null },
  { id: "4", name: "田中", status: "後ならOK", avatar: null },
  { id: "5", name: "川崎", status: "ちょっと待ってね", avatar: null },
  { id: "6", name: "設楽", status: "ちょっと待ってね", avatar: null },
];

export default function Seniors() {
  const [activeFilter, setActiveFilter] = useState("全部");

  const filtered = SENIORS.filter((s) => {
    if (activeFilter === "全部") return true;
    if (activeFilter === "今すぐ") return s.status === "今すぐOK";
    if (activeFilter === "後なら") return s.status === "後ならOK";
    if (activeFilter === "ちょっと") return s.status === "ちょっと待ってね";
    return true;
  });

  return (
    <View style={styles.container}>
      {/* 自分のステータスバー */}
      <View style={styles.myStatus}>
        <View style={styles.myAvatar}>
          <Text style={styles.myAvatarText}>自</Text>
        </View>
        <View style={styles.myStatusText}>
          <Text style={styles.myStatusLabel}>今のあなたは？？</Text>
          <Text style={styles.myStatusValue}>今すぐOK</Text>
        </View>
        <Text style={styles.chevron}>∨</Text>
      </View>

      {/* フィルタータブ */}
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              styles.filterBtn,
              activeFilter === f && styles.filterBtnActive(f),
            ]}
            onPress={() => setActiveFilter(f)}
          >
            <Text
              style={[
                styles.filterText,
                activeFilter === f && styles.filterTextActive,
              ]}
            >
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.hint}>声をかけたい人をクリックしてください</Text>

      {/* 先輩グリッド */}
      <ScrollView contentContainerStyle={styles.grid}>
        {filtered.map((senior) => {
          const statusStyle = STATUS_COLORS[senior.status] || STATUS_COLORS["今すぐOK"];
          return (
            <TouchableOpacity
              key={senior.id}
              style={styles.card}
              onPress={() => router.push(`/chat?seniorId=${senior.id}&name=${senior.name}`)}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {senior.name.charAt(0)}
                </Text>
              </View>
              <Text style={styles.name}>{senior.name}</Text>
              <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
                <Text style={[styles.badgeText, { color: statusStyle.text }]}>
                  {senior.status}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const FILTER_COLORS = {
  "今すぐ": "#2E9E72",
  "後なら": "#B8860B",
  "ちょっと": "#E05A4E",
  "全部": "#555",
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F6F2EA",
    paddingTop: 60,
  },
  myStatus: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5F0",
    marginHorizontal: 16,
    borderRadius: 50,
    padding: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 10,
  },
  myAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#5B8DB8",
    alignItems: "center",
    justifyContent: "center",
  },
  myAvatarText: {
    color: "white",
    fontWeight: "700",
  },
  myStatusText: {
    flex: 1,
  },
  myStatusLabel: {
    fontSize: 11,
    color: "#666",
  },
  myStatusValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2E9E72",
  },
  chevron: {
    fontSize: 18,
    color: "#2E9E72",
  },
  filters: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#E8E4DA",
  },
  filterBtnActive: (filter) => ({
    backgroundColor: FILTER_COLORS[filter] || "#555",
  }),
  filterText: {
    fontSize: 13,
    color: "#555",
    fontWeight: "500",
  },
  filterTextActive: {
    color: "white",
    fontWeight: "700",
  },
  hint: {
    fontSize: 11,
    color: "#999",
    textAlign: "center",
    marginBottom: 12,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    gap: 12,
    paddingBottom: 24,
  },
  card: {
    width: "46%",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#D9D9D9",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#555",
  },
  name: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
});