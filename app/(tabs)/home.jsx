import { router } from "expo-router";
import { YStack, H1, Text, Button, Card } from "tamagui";

export default function JuniorHome() {
  return (
    <YStack
      flex={1}
      backgroundColor="#F6F2EA"
      padding="$5"
      gap="$5"
      paddingTop="$8"
    >
      <YStack gap="$2">
        <H1 fontSize={34} marginTop={70}>
          ホーム
        </H1>
        <Text fontSize={16} color="#777">
          相談したい内容を選んでください
        </Text>
      </YStack>

      <Card
        padding="$5"
        backgroundColor="white"
        borderRadius="$8"
        gap="$3"
      >
        <Text fontSize={26} fontWeight="700">
          先輩に相談する
        </Text>

        <Text fontSize={16} color="#555" lineHeight={24}>
          進路・就活・学校生活について相談できます。
        </Text>

        <Button
          marginTop="$3"
          height={52}
          borderRadius="$10"
          backgroundColor="#FFD966"
          color="black"
          fontWeight="700"
          onPress={() => router.push("/reservations")}
        >
          相談を投稿する
        </Button>
      </Card>

      <Card
        padding="$5"
        backgroundColor="white"
        borderRadius="$8"
        gap="$3"
      >
        <Text fontSize={26} fontWeight="700">
          先輩一覧
        </Text>

        <Text fontSize={16} color="#555" lineHeight={24}>
          相談できる先輩を探します。
        </Text>

        <Button
          marginTop="$3"
          height={52}
          borderRadius="$10"
          backgroundColor="#D9D9D9"
          color="black"
          fontWeight="700"
          onPress={() => router.push("/requests")}
        >
          先輩を見る
        </Button>
      </Card>
    </YStack>
  );
}