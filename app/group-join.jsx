import { useState } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";
import { YStack, XStack, Text, Input, Button } from "tamagui";
import { UserPlus } from "@tamagui/lucide-icons-2";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  arrayUnion,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";

export default function GroupJoin() {
  const [code, setCode] = useState("");

  const goNextByRole = async (uid) => {
    const userSnap = await getDoc(doc(db, "users", uid));
    const userData = userSnap.exists() ? userSnap.data() : {};

    if (userData.role === "senior") {
      router.replace("/(tabs)/home");
    } else {
      router.replace("/(tabs)/home");
    }
  };

  const joinGroup = async () => {
    try {
      const user = auth.currentUser;

      if (!user) {
        Alert.alert("Error", "Login required");
        return;
      }

      if (!code.trim()) {
        Alert.alert("Error", "参加コードを入力してください");
        return;
      }

      const q = query(
        collection(db, "groups"),
        where("code", "==", code.trim().toUpperCase())
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        Alert.alert("Error", "グループが見つかりません");
        return;
      }

      const groupDoc = snapshot.docs[0];
      const groupData = groupDoc.data();

      await updateDoc(doc(db, "groups", groupDoc.id), {
        members: arrayUnion(user.uid),
      });

      await setDoc(
        doc(db, "users", user.uid),
        {
          groupId: groupDoc.id,
          groupCode: groupData.code,
          groupName: groupData.name,
          updatedAt: new Date(),
        },
        { merge: true }
      );

      goNextByRole(user.uid);
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <YStack flex={1} backgroundColor="#F3F3F3">
      <XStack
        height={86}
        backgroundColor="white"
        alignItems="center"
        justifyContent="center"
        borderBottomWidth={1}
        borderBottomColor="#EEE"
      >
        <Text
          position="absolute"
          left="$4"
          fontSize={34}
          color="#BBB"
          onPress={() => router.back()}
        >
          ‹
        </Text>

        <XStack alignItems="center" gap="$2">
          <UserPlus color="#FFD966" size={28} />
          <Text fontSize={24} fontWeight="700">
            グループ参加
          </Text>
        </XStack>
      </XStack>

      <YStack flex={1} justifyContent="center" padding="$5">
        <YStack gap="$5" alignItems="center">
          <Text fontSize={18} fontWeight="700">
            参加コード
          </Text>

          <Text width="80%" fontSize={13} lineHeight={20}>
            グループ作成時のコードを確認し、参加コードを
            入力してください。
          </Text>

          <Input
            width="100%"
            height={54}
            backgroundColor="white"
            placeholder="参加コード"
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
          />

          <Button
            marginTop="$10"
            width="70%"
            height={58}
            borderRadius="$10"
            backgroundColor="#FFD966"
            color="black"
            fontSize={22}
            fontWeight="700"
            onPress={joinGroup}
          >
            次へ
          </Button>

          <XStack gap="$3" marginTop="$4">
            <Text color="#999">●</Text>
            <Text color="#DDD">○</Text>
            <Text color="#DDD">○</Text>
          </XStack>
        </YStack>
      </YStack>
    </YStack>
  );
}