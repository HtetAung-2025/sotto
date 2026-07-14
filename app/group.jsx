import { router } from "expo-router";
import { YStack, XStack, Text, Button } from "tamagui";
import { Image } from "expo-image";
import { Users, UserPlus } from "@tamagui/lucide-icons-2";

export default function Group() {
  return (
    <YStack
      flex={1}
      backgroundColor="#FFF"
      padding="$6"
      justifyContent="center"
    >
      <YStack alignItems="center" gap="$5">
        <Image
          source={require("../assets/images/logo.svg")}
          style={{
            width: 70,
            height: 60,
            alignSelf: "center",
            paddingBlock: 80,
          }}
        />

        <YStack alignItems="center" gap="$3" marginBottom={150}>
          <Text fontSize={28} fontWeight="800" color="#000">
            SOTTOへようこそ！
          </Text>

          <Text fontSize={15} color="#000" textAlign="center" lineHeight={22}>
            「話してみたい」その気持ちを、
            {"\n"}
            “会話の0.5歩前”から寄り添うアプリです。
          </Text>
        </YStack>

        <Button
          width="90%"
          height={60}
          backgroundColor="white"
          borderRadius={40}
          shadowColor="#000"
          backgroundColor="#FFD966"
          shadowOpacity={0.15}
          shadowRadius={8}
          shadowOffset={{ width: 0, height: 4 }}
          onPress={() => router.push("/group-create")}
        >
          <XStack alignItems="center" gap="$3">
            <Users color="#FFF" size={28} />
            <YStack>
              <Text fontSize={20} fontWeight="600" color="000">
                グループ作成
              </Text>
            </YStack>
          </XStack>
        </Button>

        <Button
          width="90%"
          height={60}
          backgroundColor="white"
          borderRadius={40}
          border="1px solid #FFD966"
          shadowColor="#000"
          shadowOpacity={0.15}
          shadowRadius={8}
          shadowOffset={{ width: 0, height: 4 }}
          onPress={() => router.push("/group-join")}
        >
          <XStack alignItems="center" gap="$3">
            <UserPlus color="#FFD966" size={28} />
            <YStack>
              <Text fontSize={20} fontWeight="600" color="000">
                グループ参加
              </Text>
            </YStack>
          </XStack>
        </Button>
      </YStack>
    </YStack>
  );
}
