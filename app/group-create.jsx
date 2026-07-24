import { useState } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";
import { YStack, XStack, Text, Input, Button } from "tamagui";
import { Image } from "expo-image";
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
    router.replace("/reservations");
  };

  return (
    <YStack flex={1} backgroundColor="#FFF">

      <YStack flex={1} justifyContent="center" padding="$5">
        {step === 1 && (
          <YStack gap="$5" alignItems="center">

            <Text fontSize={24} fontWeight="700" marginBottom={50}>
              グループ作成
            </Text>

            <Text fontSize={20} alignItems="center">
              グループ名を記入してください
            </Text>

            <Text width="85%" fontSize={14} color="#666" lineHeight={22} marginBottom={15}>
              学校名や学部、学科名などでも構いません。
            </Text>

            <Input
              width="100%"
              height={54}
              backgroundColor="white"
              placeholder="例)Webデザイン科"
              value={groupName}
              onChangeText={setGroupName}
              backgroundColor="#F2F2F2"
              border="#B6B6B6"
              placeholderTextColor="#B6B6B6"
              marginBottom={260}
            />

            <Button
              marginTop="$8"
              width="95%"
              height={50}
              borderRadius="$10"
              backgroundColor="#FFD966"
              color="black"
              fontSize={20}
              fontWeight="700"
              onPress={createGroup}
              disabled={creating}
              opacity={creating ? 0.6 : 1}
            >
              次へ
            </Button>

            <Text
            color="#B6B6B6"
            onPress={() => {
              if (step === 1) {
                router.back();
              } else {
                setStep(1);
              }
            }}>
              １つ前に戻る
            </Text>

            {/* <XStack gap="$3" marginTop="$10">
              <Text color="#999">●</Text>
              <Text color="#DDD">○</Text>
            </XStack> */}
          </YStack>
        )}

        {step === 2 && (
          <YStack gap="$5" alignItems="center">
            <Text fontSize={22} fontWeight="700" marginBottom={50}>
              グループ作成
            </Text>

            <Text fontSize={20}>
              グループコードはこちら
            </Text>

            <Text width="85%" fontSize={13} color="#666" lineHeight={21} textAlign="center">
              参加してほしい方にこのコードを共有し、
              {"\n"}
              コードを入力してもらうことで参加できます。
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

            <XStack backgroundColor="#DBDBDB" padding={15} borderRadius={10} marginBottom={137}>
              <Image
              source={require("../assets/images/danger_mark.svg")}
              style={{
                width: 35,
                height: 31,
                marginTop: 5,
              }}>
              </Image>
              <Text marginLeft={5}>
                このグループコードは再表示できません
                {"\n"}
                必ず保存してください
              </Text>
            </XStack>

            <Button
              width="95%"
              height={50}
              borderRadius="$10"
              backgroundColor="#FFD966"
              color="black"
              fontSize={20}
              fontWeight="700"
              onPress={goToApp}
            >
              次へ
            </Button>

            <Text
            color="#B6B6B6"
            onPress={() => {
              if (step === 1) {
                router.back();
              } else {
                setStep(1);
              }
            }}>
              １つ前に戻る
            </Text>

            {/* <XStack gap="$3" marginTop="$4">
              <Text color="#DDD">○</Text>
              <Text color="#999">●</Text>
            </XStack> */}
          </YStack>
        )}
      </YStack>
    </YStack>
  );
}