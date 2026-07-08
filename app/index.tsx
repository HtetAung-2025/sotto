import { router } from "expo-router";
import { Image } from "react-native";
import { YStack, Text, Button } from "tamagui";

export default function LogoScreen() {
  return (
    <YStack
      flex={1}
      backgroundColor="#F7F2EA"
      alignItems="center"
      justifyContent="center"
      padding="$6"
      gap="$6"
    >
      <Image
        source={require("../assets/logo.png")}
        style={{
          width: 160,
          height: 160,
          borderRadius: 30,
        }}
        resizeMode="contain"
      />

      <YStack alignItems="center" gap="$2">
        <Text fontSize={28} fontWeight="800" color="#222">
          アプリ名
        </Text>

        <Text fontSize={14} color="#777" textAlign="center">
          気軽に相談できる、あなたの居場所
        </Text>
      </YStack>

      <Button
        width="80%"
        height={58}
        borderRadius="$10"
        backgroundColor="#FFD966"
        color="black"
        fontSize={20}
        fontWeight="700"
        marginTop="$4"
        onPress={() => router.push("/login")}
      >
        始める
      </Button>
    </YStack>
  );
}