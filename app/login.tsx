import { useEffect, useRef, useState } from "react";
import { Alert, Animated, Easing } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { YStack, H1, Input, Button, Text, XStack, Circle } from "tamagui";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
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
      delay: number,
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
        password,
      );
      await redirectByRole(userCredential.user.uid);
    } catch (error: any) {
      Alert.alert("Login Failed", error.message);
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
      <Animated.View
        style={{
          opacity: titleOpacity,
          transform: [{ translateY: titleTranslateY }],
        }}
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
          <Circle size={35} backgroundColor="#FFD966" />
          <H1 color="#000" fontSize={32}>
            ログイン
          </H1>
        </XStack>
      </Animated.View>

      <Animated.View
        style={{
          opacity: emailOpacity,
          transform: [{ translateY: emailTranslateY }],
        }}
      >
        <Text color="#000" marginLeft={15}>
          メールアドレス
        </Text>
        <Input
          placeholder="メールアドレス"
          fontSize={14}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          backgroundColor="#F2F2F2"
          border="#B6B6B6"
          color="#000"
          marginBottom={20}
        />
      </Animated.View>

      <Animated.View
        style={{
          opacity: passwordOpacity,
          transform: [{ translateY: passwordTranslateY }],
        }}
      >
        <Text color="#000" marginLeft={15}>
          パスワード
        </Text>
        <Input
          placeholder="パスワード"
          fontSize={14}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          backgroundColor="#F2F2F2"
          border="#B6B6B6"
          color="#000"
          marginBottom={40}
        />
      </Animated.View>

      <Animated.View
        style={{
          opacity: loginButtonOpacity,
          transform: [{ translateY: loginButtonTranslateY }],
        }}
      >
        <Button
          onPress={handleLogin}
          height={60}
          borderRadius={30}
          backgroundColor="#FFF"
          border="1px solid #000"
          color="#000"
          fontSize={20}
        >
          ログイン
        </Button>
      </Animated.View>

      <Animated.View
        style={{
          opacity: createButtonOpacity,
          transform: [{ translateY: createButtonTranslateY }],
        }}
      >
        <Button
          onPress={() => router.push("/register")}
          height={60}
          borderRadius={30}
          backgroundColor="#FFD966"
          color="#000"
          fontSize={20}
        >
          初めての方はこちら
        </Button>
      </Animated.View>
    </YStack>
  );
}
