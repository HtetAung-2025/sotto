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
  getDoc,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";

export default function GroupCreate() {
  const [step, setStep] = useState(1);
  const [groupName, setGroupName] = useState("");
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

      const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      const groupRef = await addDoc(collection(db, "groups"), {
        name: groupName,
        code: newCode,
        ownerId: user.uid,
        ownerEmail: user.email,
        members: [user.uid],
        createdAt: serverTimestamp(),
      });

      await setDoc(
        doc(db, "users", user.uid),
        {
          groupId: groupRef.id,
          groupCode: newCode,
          groupName,
          updatedAt: new Date(),
        },
        { merge: true }
      );

      setCode(newCode);
      setStep(2);
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
          onPress={() => {
            if (step === 1) router.back();
            else setStep(1);
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
            <Text fontSize={20} fontWeight="700">
              グループ名：
            </Text>

            <Text fontSize={14}>
              グループ名を入力してください。
            </Text>

            <Input
              width="100%"
              height={54}
              backgroundColor="white"
              placeholder="グループ名"
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
            >
              次へ
            </Button>

            <XStack gap="$3" marginTop="$10">
              <Text color="#999">●</Text>
              <Text color="#DDD">○</Text>
              <Text color="#DDD">○</Text>
            </XStack>
          </YStack>
        )}

        {step === 2 && (
          <YStack gap="$5" alignItems="center">
            <Text fontSize={18} fontWeight="700">
              参加コード：
            </Text>

            <YStack
              width="70%"
              height={80}
              backgroundColor="white"
              justifyContent="center"
              alignItems="center"
              borderRadius="$2"
            >
              <Text fontSize={30} fontWeight="700" letterSpacing={8}>
                {code}
              </Text>
            </YStack>

            <Text width="70%" fontSize={13} lineHeight={20}>
              参加して欲しい方にこのコードを教えていただき、
              入力していただくと参加することができます。
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
              onPress={() => {
                const user = auth.currentUser;
                if (user) goNextByRole(user.uid);
              }}
            >
              次へ
            </Button>

            <XStack gap="$3" marginTop="$4">
              <Text color="#DDD">○</Text>
              <Text color="#999">●</Text>
              <Text color="#DDD">○</Text>
            </XStack>
          </YStack>
        )}
      </YStack>
    </YStack>
  );
}