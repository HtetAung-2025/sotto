import { Alert } from "react-native";
import { router } from "expo-router";
import { YStack, Text, Button } from "tamagui";
import { registerForPushNotificationsAsync } from "../lib/notifications";

export default function AllowNotifications() {
  const handleAllow = async () => {
    try {
      await registerForPushNotificationsAsync();
      router.replace("/(tabs)/reservations");
    } catch (error: any) {
      Alert.alert("通知エラー", error.message);
    }
  };

  const handleSkip = () => {
    router.replace("/(tabs)/reservations");
  };

  return (
    <YStack
      flex={1}
      backgroundColor="#F7F2EA"
      alignItems="center"
      justifyContent="center"
      padding="$5"
      gap="$5"
    >
      <Text fontSize={28} fontWeight="700">
        通知を許可しますか？
      </Text>

      <Text fontSize={15} color="#777" textAlign="center" lineHeight={22}>
        相談が届いた時や、返事・ありがとうが届いた時に通知を受け取れます。
      </Text>

      <Button
        width="80%"
        height={56}
        borderRadius="$10"
        backgroundColor="#FFD966"
        color="black"
        fontWeight="700"
        fontSize={18}
        onPress={handleAllow}
      >
        通知を許可する
      </Button>

      <Button
        width="80%"
        height={52}
        borderRadius="$10"
        backgroundColor="white"
        color="#777"
        fontWeight="700"
        onPress={handleSkip}
      >
        今はしない
      </Button>
    </YStack>
  );
}