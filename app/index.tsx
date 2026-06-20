import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";
import { YStack, H1, Input, Button } from "tamagui";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const redirectByRole = async (uid: string) => {
    try {
      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        router.replace("/profile-setup");
        return;
      }

      // テスト用：常に通知画面へ
      router.replace("/allow-notifications");

    } catch (error: any) {
      Alert.alert("Role Check Failed", error.message);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        redirectByRole(user.uid);
      }
    });
    return unsubscribe;
  }, []);

  const handleLogin = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      await redirectByRole(userCredential.user.uid);
    } catch (error: any) {
      Alert.alert("Login Failed", error.message);
    }
  };

  return (
    <YStack flex={1} justifyContent="center" padding="$4" gap="$4">
      <H1>Login</H1>

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

      <Button onPress={handleLogin}>Login</Button>

      <Button onPress={() => router.push("/register")}>
        Create Account
      </Button>
    </YStack>
  );
}