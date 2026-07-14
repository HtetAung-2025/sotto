import { useState } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";
import { YStack, H1, Input, Button, Text, XStack, Circle } from "tamagui";
import { Image } from "expo-image";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async () => {
    try {
      if (!email.endsWith("@jec.ac.jp")) {
        Alert.alert("Error", "学校メール（@jec.ac.jp）だけ登録できます");
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );

      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: user.email,
        role: "student",
        createdAt: new Date(),
      });

      Alert.alert("Register Success", user.email || "", [
        {
          text: "OK",
          onPress: () => router.push("/profile-setup"),
        },
      ]);
    } catch (error) {
      Alert.alert("Register Failed", error.message);
    }
  };

  return (
    <YStack
      flex={1}
      justifyContent="center"
      padding="$4"
      gap="$4"
      backgroundColor="#FFF"
    >
      <Image
        source={require("../assets/images/logo.svg")}
        style={{
          width: 70,
          height: 60,
          alignSelf: "center",
          paddingBlock: 80,
          marginBottom: 70,
        }}
      />

      <XStack alignItems="center" gap="$1" marginLeft={5}>
        <Circle size={35} marginBottom={25} backgroundColor="#FFD966" />

        <H1 color="#000" marginBottom={25}>
          新規登録
        </H1>
      </XStack>

      <Text color="#000" marginLeft={15} marginBlock={-15}>
        メールアドレス
      </Text>
      <Input
        placeholder="メールアドレス"
        value={email}
        fontSize={14}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        backgroundColor="#F2F2F2"
        border="#B6B6B6"
        color="#000"
        marginBottom={40}
      />

      <Text color="#000" marginLeft={15} marginBlock={-15}>
        パスワード
      </Text>
      <Input
        placeholder="パスワード"
        value={password}
        fontSize={14}
        onChangeText={setPassword}
        secureTextEntry
        backgroundColor="#F2F2F2"
        border="#B6B6B6"
        color="#000"
        marginBottom={40}
      />

      <Button
        onPress={handleRegister}
        height={60}
        borderRadius={30}
        backgroundColor="#FFD966"
        color="#000"
        fontSize={20}
      >
        はじめる
      </Button>

      <Text onPress={() => router.push("/")}>ログインへ</Text>
    </YStack>
  );
}
