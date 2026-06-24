import { useState } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";
import { YStack, XStack, Text, Input, Button } from "tamagui";
import { Users } from "@tamagui/lucide-icons-2";
import {
  addDoc,
  collection,
  serverTimestamp,
  doc,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";

export default function GroupCreate() {
  const [step, setStep] = useState(1);
  const [groupName, setGroupName] = useState("");
  const [code, setCode] = useState("");
  const [creating, setCreating] = useState(false);

  const createGroup = async () => {
    try {
      const user = auth.currentUser;

      if (!user) {
        Alert.alert("Error", "Login required");
        return;
      }

      if (!groupName.trim()) {
        Alert.alert("Error", "グループ名を入力してください");
        return;
      }

      setCreating(true);

      const newCode = Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();

      const groupRef = await addDoc(collection(db, "groups"), {
        name: groupName.trim(),
        code: newCode,
        ownerId: user.uid,
        ownerEmail: user.email,
        members: [user.uid],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await setDoc(
        doc(db, "users", user.uid),
        {
          uid: user.uid,
          email: user.email,

          groupId: groupRef.id,
          groupCode: newCode,
          groupName: groupName.trim(),

          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setCode(newCode);
      setStep(2);
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setCreating(false);
    }
  };

  const goToApp = () => {
    router.replace("/(tabs)/reservations");
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
          onPress={() => {
            if (step === 1) {
              router.back();
            } else {
              setStep(1);
            }
          }}
        >
          ‹
        </Text>

        <XStack alignItems="center" gap="$2">
          <Users color="#FFD966" size={28} />
          <Text fontSize={24} fontWeight="700">
            グループ作成
          </Text>
        </XStack>
      </XStack>

      <YStack flex={1} justifyContent="center" padding="$5">
        {step === 1 && (
          <YStack gap="$5" alignItems="center">
            <Text fontSize={22} fontWeight="700">
              新しいグループを作成
            </Text>

            <Text width="82%" fontSize={14} color="#666" lineHeight={22}>
              同じグループの人と相談を共有できます。
              グループ名を入力してください。
            </Text>

            <Input
              width="100%"
              height={54}
              backgroundColor="white"
              placeholder="例：AW / Webデザイン2年"
              value={groupName}
              onChangeText={setGroupName}
            />

            <Button
              marginTop="$8"
              width="70%"
              height={58}
              borderRadius="$10"
              backgroundColor="#FFD966"
              color="black"
              fontSize={22}
              fontWeight="700"
              onPress={createGroup}
              disabled={creating}
              opacity={creating ? 0.6 : 1}
            >
              {creating ? "作成中..." : "作成する"}
            </Button>

            <XStack gap="$3" marginTop="$10">
              <Text color="#999">●</Text>
              <Text color="#DDD">○</Text>
            </XStack>
          </YStack>
        )}

        {step === 2 && (
          <YStack gap="$5" alignItems="center">
            <Text fontSize={22} fontWeight="700">
              グループを作成しました
            </Text>

            <Text fontSize={15} color="#666">
              参加コード
            </Text>

            <YStack
              width="74%"
              height={86}
              backgroundColor="white"
              justifyContent="center"
              alignItems="center"
              borderRadius="$4"
              borderWidth={1}
              borderColor="#EEE"
            >
              <Text fontSize={32} fontWeight="800" letterSpacing={8}>
                {code}
              </Text>
            </YStack>

            <Text width="76%" fontSize={13} color="#666" lineHeight={21}>
              参加してほしい人にこのコードを教えてください。
              相手は「グループ参加」からこのコードを入力すると参加できます。
            </Text>

            <YStack
              width="80%"
              height={1}
              backgroundColor="#D9D9D9"
              marginVertical="$6"
            />

            <Button
              width="70%"
              height={58}
              borderRadius="$10"
              backgroundColor="#FFD966"
              color="black"
              fontSize={22}
              fontWeight="700"
              onPress={goToApp}
            >
              はじめる
            </Button>

            <XStack gap="$3" marginTop="$4">
              <Text color="#DDD">○</Text>
              <Text color="#999">●</Text>
            </XStack>
          </YStack>
        )}
      </YStack>
    </YStack>
  );
}