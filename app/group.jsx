import { router } from "expo-router";
import { YStack, XStack, Text, Button } from "tamagui";
import { Users, UserPlus } from "@tamagui/lucide-icons-2";

export default function Group() {
  return (
    <YStack
      flex={1}
      backgroundColor="#F3F3F3"
      padding="$6"
      justifyContent="center"
    >
      <YStack alignItems="center" gap="$5">
        <YStack alignItems="center" gap="$3" marginBottom="$8">
          <Text fontSize={18} color="#333">
            ちょっとした
            <Text backgroundColor="#FFE08A"> 悩みも相談 </Text>
            も、
          </Text>

          <Text fontSize={20} fontWeight="700" color="#333">
            <Text backgroundColor="#FFE08A">話してみたい</Text>
            のその気持ちも、
          </Text>

          <YStack height={36} />

          <Text fontSize={16} color="#555">
            皆さんと一緒に
          </Text>

          <Text fontSize={20} fontWeight="700" color="#333">
            <Text backgroundColor="#FFE08A">
              “会話の0.5歩前”に寄り添う
            </Text>
          </Text>

          <Text fontSize={16} color="#555">
            アプリです。
          </Text>
        </YStack>

        <Button
          width="90%"
          height={82}
          backgroundColor="white"
          borderRadius="$4"
          shadowColor="#000"
          shadowOpacity={0.15}
          shadowRadius={8}
          shadowOffset={{ width: 0, height: 4 }}
          onPress={() => router.push("/group-create")}
        >
          <XStack alignItems="center" gap="$3">
            <Users color="#FFD966" size={28} />
            <Text fontSize={24} fontWeight="700">
              グループ作成
            </Text>
          </XStack>
        </Button>

        <Button
          width="90%"
          height={82}
          backgroundColor="white"
          borderRadius="$4"
          shadowColor="#000"
          shadowOpacity={0.15}
          shadowRadius={8}
          shadowOffset={{ width: 0, height: 4 }}
          onPress={() => router.push("/group-join")}
        >
          <XStack alignItems="center" gap="$3">
            <UserPlus color="#FFD966" size={28} />
            <Text fontSize={24} fontWeight="700">
              グループ参加
            </Text>
          </XStack>
        </Button>
      </YStack>
    </YStack>
  );
}