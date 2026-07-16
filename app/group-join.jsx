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
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";

export default function GroupJoin() {
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);

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

      setJoining(true);

      const inputCode = code.trim().toUpperCase();

      const q = query(collection(db, "groups"), where("code", "==", inputCode));

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        Alert.alert("Error", "グループが見つかりません");
        return;
      }

      const groupDoc = snapshot.docs[0];
      const groupData = groupDoc.data();

      await updateDoc(doc(db, "groups", groupDoc.id), {
        members: arrayUnion(user.uid),
        updatedAt: serverTimestamp(),
      });

      await setDoc(
        doc(db, "users", user.uid),
        {
          uid: user.uid,
          email: user.email,

          groupId: groupDoc.id,
          groupCode: groupData.code,
          groupName: groupData.name,

          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      Alert.alert("参加しました", `${groupData.name} に参加しました`, [
        {
          text: "OK",
          onPress: () => router.replace("/(tabs)/reservations"),
        },
      ]);
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setJoining(false);
    }
  };

  return (
    <YStack flex={1} backgroundColor="#FFF">
      <YStack flex={1} justifyContent="center" padding="$5">
        <YStack gap="$5" alignItems="center">
          <Text fontSize={20} fontWeight="700" color="#000" marginBottom={35}>
            グループ参加
          </Text>

          <Text fontSize={20} fontWeight="700" color="#000">
            グループコードを入力してください
          </Text>

          <Text
            width="90%"
            fontSize={14}
            color="#000"
            lineHeight={22}
            textAlign="center"
            marginBottom={20}
          >
            グループコードを持っていない方は
            {"\n"}
            グループ作成し、コードを作成してください。
          </Text>

          <Input
            width="100%"
            height={54}
            placeholder="グループコードを入力してください"
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            backgroundColor="#F2F2F2"
            border="#B6B6B6"
            placeholderTextColor="#B6B6B6"
            marginBottom={280}
          />

          <Button
            marginTop={30}
            width="100%"
            height={45}
            borderRadius="$10"
            backgroundColor="#FFD966"
            color="black"
            fontSize={20}
            fontWeight="700"
            onPress={joinGroup}
            disabled={joining}
            opacity={joining ? 0.6 : 1}
          >
            次へ
            {/* {joining ? "参加中..." : "次へ"} */}
          </Button>

          <Text color="#B6B6B6" onPress={() => router.back()}>
            １つ前に戻る
          </Text>

          {/* <XStack gap="$3" marginTop="$4">
            <Text color="#999">●</Text>
            <Text color="#DDD">○</Text>
          </XStack> */}
        </YStack>
      </YStack>
    </YStack>
  );
}
