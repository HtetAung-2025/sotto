import { useState } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";
import { YStack, H1, Input, Button, Text } from "tamagui";
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
        password
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
    <YStack flex={1} justifyContent="center" padding="$4" gap="$4">
      <H1>Create Account</H1>

      <Input
        placeholder="School Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <Input
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Button onPress={handleRegister}>Register</Button>

      <Text onPress={() => router.push("/")}>
        Already have an account? Login
      </Text>
    </YStack>
  );
}