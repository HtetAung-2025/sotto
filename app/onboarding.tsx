import { useState } from "react";
import { Alert } from "react-native";
import { YStack, Text, Button } from "tamagui";
import { Image } from "expo-image";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { registerForPushNotificationsAsync } from "../lib/notifications";

type Step = {
  title: string;
  description?: string;
  buttonLabel: string;
};

const STEPS: Step[] = [
  {
    title: "SOTTOへようこそ",
    description:
      "話したいと思ったその気持ちの話す前と\n誰かのちょっとした力になれる\nサポートをしていきます。",
    buttonLabel: "次へ",
  },
  {
    title: "自分の話したいことを考えて\n聞いてみましょう！",
    description: "まずはジャンルを選ぶだけ！\n簡単な気持ちで聞いてみましょう",
    buttonLabel: "次へ",
  },
  {
    title: "あなたの力を貸してください！！",
    description: "自身の力になれる分野をメインに\n力を貸してあげてください！",
    buttonLabel: "次へ",
  },
  {
    title: "簡単に手助け準備が整います",
    description:
      "「今すぐ」「後なら」「ちょっと」\n3つから自分の状況を伝えましょう\n通知からも答えることができます",
    buttonLabel: "はじめる",
  },
  {
    title: "たくさんの人と出会うコツ！",
    description: "相談リクエストや相手からの返信を\nリアルタイムでお知らせします。",
    buttonLabel: "通知を許可する",
  },
];

function StepOneIllustration() {
  return (
    <Image
      source={require("../assets/images/logo.png")}
      style={{
        width: 90,
        height: 80,
      }}
      contentFit="contain"
    />
  );
}

function StepTwoIllustration() {
  return (
    <Image
      source={require("../assets/images/login1.png")}
      style={{
        width: 220,
        height: 220,
      }}
      contentFit="contain"
    />
  );
}

function StepThreeIllustration() {
  return (
    <Image
      source={require("../assets/images/login2.png")}
      style={{
        width: 220,
        height: 220,
      }}
      contentFit="contain"
    />
  );
}

function StepFourIllustration() {
  return (
    <Image
      source={require("../assets/images/login3.png")}
      style={{
        width: 220,
        height: 220,
      }}
      contentFit="contain"
    />
  );
}

function StepFiveIllustration() {
  return (
    <Image
      source={require("../assets/images/alarm_img.png")}
      style={{
        width: 220,
        height: 220,
      }}
      contentFit="contain"
    />
  );
}

export default function Onboarding() {
  const [stepIndex, setStepIndex] = useState(0);
  const [processing, setProcessing] = useState(false);

  const step = STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;

  const goToApp = () => {
    router.replace("/profile-setup");
  };

  const handleNext = async () => {
    if (!isLast) {
      setStepIndex((prev) => prev + 1);
      return;
    }

    // 最終ステップ：通知の許可をリクエストしてから次へ
    try {
      setProcessing(true);
      await registerForPushNotificationsAsync();
      goToApp();
    } catch (error: any) {
      Alert.alert("通知エラー", error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleBack = () => {
    if (isFirst) return;
    setStepIndex((prev) => prev - 1);
  };

  const handleSkipNotifications = () => {
    goToApp();
  };

  const renderIllustration = () => {
    switch (stepIndex) {
      case 0:
        return <StepOneIllustration />;
      case 1:
        return <StepTwoIllustration />;
      case 2:
        return <StepThreeIllustration />;
      case 3:
        return <StepFourIllustration />;
      case 4:
        return <StepFiveIllustration />;
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <YStack flex={1} paddingHorizontal="$5" paddingBottom="$5">
        {/* コンテンツ本体：画面中央に配置 */}
        <YStack flex={1} alignItems="center" justifyContent="center" gap="$5">
          <YStack alignItems="center" justifyContent="center">
            {renderIllustration()}
          </YStack>

          <YStack alignItems="center" gap="$2">
            <Text
              fontSize={isFirst ? 22 : 18}
              fontWeight="800"
              color="#000"
              textAlign="center"
              lineHeight={isFirst ? 30 : 26}
            >
              {step.title}
            </Text>

            {step.description ? (
              <Text
                fontSize={14}
                color="#777"
                textAlign="center"
                lineHeight={22}
              >
                {step.description}
              </Text>
            ) : null}
          </YStack>
        </YStack>

        {/* ボタンエリア：画面下部に固定 */}
        <YStack width="100%" alignItems="center" gap="$3">
          <Button
            width="80%"
            height={50}
            borderRadius="$10"
            backgroundColor="#FFD966"
            color="black"
            fontWeight="700"
            fontSize={18}
            onPress={handleNext}
            disabled={processing}
            opacity={processing ? 0.6 : 1}
          >
            {processing ? "処理中..." : step.buttonLabel}
          </Button>

          {isLast ? (
            <Text
              fontSize={14}
              color="#AAA"
              fontWeight="600"
              onPress={handleSkipNotifications}
            >
              あとで設定する
            </Text>
          ) : (
            !isFirst && (
              <Text
                fontSize={14}
                color="#AAA"
                fontWeight="600"
                onPress={handleBack}
              >
                1つ前に戻る
              </Text>
            )
          )}
        </YStack>
      </YStack>
    </SafeAreaView>
  );
}