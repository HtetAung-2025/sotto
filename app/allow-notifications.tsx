import { Alert } from "react-native";
import { router } from "expo-router";
import { YStack, Text, Button, Image } from "tamagui";
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
      <Text fontSize={20} fontWeight="700" color="#000">
        たくさんの人と出会うコツ！
      </Text>

      <Text fontSize={14} color="#777" textAlign="center" lineHeight={22}>
        相談リクエストや相手からの返信を
        {"\n"}
        リアルタイムでお知らせします。
      </Text>

      <Image
        src={require("../assets/images/alarm_img.png")}
        width={250}
        height={250}
        objectFit="contain"
        marginTop={40}
        marginBottom={100}
      />

      <Button
        width="80%"
        height={50}
        borderRadius="$10"
        backgroundColor="#FFD966"
        color="black"
        fontWeight="700"
        fontSize={18}
        onPress={handleAllow}
      >
        通知を許可する
      </Button>

      <Text fontSize={16} color="#777" fontWeight="700" onPress={handleSkip}>
        後で設定する
      </Text>
    </YStack>
  );
}
