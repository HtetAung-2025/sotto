import { useEffect, useRef, useState } from "react";
import { Alert, Animated, Easing } from "react-native";
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

  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(-10)).current;

  const emailOpacity = useRef(new Animated.Value(0)).current;
  const emailTranslateY = useRef(new Animated.Value(15)).current;

  const passwordOpacity = useRef(new Animated.Value(0)).current;
  const passwordTranslateY = useRef(new Animated.Value(15)).current;

  const loginButtonOpacity = useRef(new Animated.Value(0)).current;
  const loginButtonTranslateY = useRef(new Animated.Value(15)).current;

  const createButtonOpacity = useRef(new Animated.Value(0)).current;
  const createButtonTranslateY = useRef(new Animated.Value(15)).current;

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

  useEffect(() => {
    const fadeSlide = (
      opacity: Animated.Value,
      translateY: Animated.Value,
      delay: number
    ) =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 450,
            easing: Easing.out(Easing.exp),
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: 450,
            easing: Easing.out(Easing.exp),
            useNativeDriver: true,
          }),
        ]),
      ]);

    Animated.parallel([
      fadeSlide(titleOpacity, titleTranslateY, 0),
      fadeSlide(emailOpacity, emailTranslateY, 150),
      fadeSlide(passwordOpacity, passwordTranslateY, 250),
      fadeSlide(loginButtonOpacity, loginButtonTranslateY, 350),
      fadeSlide(createButtonOpacity, createButtonTranslateY, 450),
    ]).start();
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
      <Animated.View
        style={{
          opacity: titleOpacity,
          transform: [{ translateY: titleTranslateY }],
        }}
      >
        <H1>Login</H1>
      </Animated.View>

      <Animated.View
        style={{
          opacity: emailOpacity,
          transform: [{ translateY: emailTranslateY }],
        }}
      >
        <Input
          placeholder="School Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </Animated.View>

      <Animated.View
        style={{
          opacity: passwordOpacity,
          transform: [{ translateY: passwordTranslateY }],
        }}
      >
        <Input
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
      </Animated.View>

      <Animated.View
        style={{
          opacity: loginButtonOpacity,
          transform: [{ translateY: loginButtonTranslateY }],
        }}
      >
        <Button onPress={handleLogin}>Login</Button>
      </Animated.View>

      <Animated.View
        style={{
          opacity: createButtonOpacity,
          transform: [{ translateY: createButtonTranslateY }],
        }}
      >
        <Button onPress={() => router.push("/register")}>
          Create Account
        </Button>
      </Animated.View>
    </YStack>
  );
}