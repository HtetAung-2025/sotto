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
          <Text fontSize={28} fontWeight="800" color="#222">
            グループを選択
          </Text>

          <Text fontSize={15} color="#666" textAlign="center" lineHeight={22}>
            相談する相手を同じグループ内で見つけるために、
            {"\n"}
            グループを作成するか、既存のグループに参加してください。
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
            <YStack>
              <Text fontSize={22} fontWeight="700">
                グループ作成
              </Text>
              <Text fontSize={12} color="#777">
                新しいグループを作る
              </Text>
            </YStack>
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
            <YStack>
              <Text fontSize={22} fontWeight="700">
                グループ参加
              </Text>
              <Text fontSize={12} color="#777">
                コードを入力して参加する
              </Text>
            </YStack>
          </XStack>
        </Button>
      </YStack>
    </YStack>
  );
}