import { useState, useEffect } from "react";
import { Alert, Image } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { YStack, XStack, H1, Text, Button, Input } from "tamagui";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

const TAGS = [
  "企画",
  "デザイン",
  "コーディング",
  "雑談",
  "相談",
  "課題",
  "Illustrator",
  "Photoshop",
  "HTML CSS",
  "Figma",
  "就活",
  "その他",
];

const TOTAL_STEPS = 4;

const getProfileImage = (data) => {
  return (
    data?.photoURL ||
    data?.imageUrl ||
    data?.avatarUrl ||
    data?.imageUri ||
    data?.profileImage ||
    data?.profileImageUrl ||
    ""
  );
};

export default function ProfileSetup() {
  const params = useLocalSearchParams();
  const from = params?.from;

  const [step, setStep] = useState(1);
  const [grade, setGrade] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);

  const [imageUri, setImageUri] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [oldPhotoURL, setOldPhotoURL] = useState(null);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const snap = await getDoc(doc(db, "users", user.uid));

      if (snap.exists()) {
        const data = snap.data();

        setGrade(data.grade || "");
        setDisplayName(data.name || "");
        setSelectedTags(data.tags || []);

        const savedImage = getProfileImage(data) || null;

        setImageUri(savedImage);
        setOldPhotoURL(savedImage);
      }
    } catch (error) {
      console.log("loadProfile error:", error.message);
    }
  };

  const toggleTag = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((item) => item !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const pickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert("写真へのアクセスを許可してください");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.4,
      });

      if (!result.canceled) {
        const asset = result.assets[0];

        // 画像を 240px × 240px に縮小して軽くする
        const resizedImage = await ImageManipulator.manipulateAsync(
          asset.uri,
          [
            {
              resize: {
                width: 240,
                height: 240,
              },
            },
          ],
          {
            compress: 0.35,
            format: ImageManipulator.SaveFormat.JPEG,
            base64: true,
          }
        );

        setImageUri(resizedImage.uri);

        if (resizedImage.base64) {
          const dataUrl = `data:image/jpeg;base64,${resizedImage.base64}`;
          setImageBase64(dataUrl);
        }
      }
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  const handleNext = () => {
    if (step === 1 && !grade) {
      Alert.alert("学年を選択してください");
      return;
    }

    if (step === 3 && !displayName.trim()) {
      Alert.alert("表示名を入力してください");
      return;
    }

    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    } else {
      saveProfile();
    }
  };

  const saveProfile = async () => {
    try {
      const user = auth.currentUser;

      if (!user) {
        Alert.alert("Error", "Login required");
        return;
      }

      setSaving(true);

      // 新しく画像を選んだ場合は軽量化した base64 を保存
      // 選び直していない場合は前の画像をそのまま使う
      const photoURL = imageBase64 || oldPhotoURL || null;

      await setDoc(
        doc(db, "users", user.uid),
        {
          uid: user.uid,
          email: user.email,

          name: displayName.trim(),
          grade,
          tags: selectedTags,

          photoURL,
          imageUrl: photoURL,
          avatarUrl: photoURL,
          imageUri: photoURL,
          profileImage: photoURL,
          profileImageUrl: photoURL,

          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      Alert.alert("保存しました", "プロフィールを更新しました", [
        {
          text: "OK",
          onPress: () => {
            if (from === "settings") {
              router.replace("/(tabs)/profile");
            } else {
              router.replace("/group");
            }
          },
        },
      ]);
    } catch (error) {
      console.log("saveProfile error:", error);
      Alert.alert("Error", error.message);
    } finally {
      setSaving(false);
    }
  };

  const previewImage = imageBase64 || imageUri;

  return (
    <YStack
      flex={1}
      backgroundColor="#F7F2EA"
      padding="$5"
      justifyContent="center"
    >
      <YStack
        backgroundColor="white"
        borderRadius={220}
        minHeight={520}
        padding="$6"
        justifyContent="center"
        alignItems="center"
        gap="$4"
      >
        <H1 fontSize={26}>プロフィール</H1>

        <Text fontSize={12}>後から変更可能です。</Text>

        {step === 1 && (
          <YStack gap="$3" width="80%" alignItems="center">
            {["1年", "2年", "3年", "4年"].map((item) => (
              <Button
                key={item}
                width="70%"
                borderRadius="$10"
                backgroundColor={grade === item ? "#222" : "white"}
                color={grade === item ? "white" : "black"}
                borderWidth={1}
                onPress={() => setGrade(item)}
              >
                {item}
              </Button>
            ))}
          </YStack>
        )}

        {step === 2 && (
          <YStack gap="$4" alignItems="center">
            <Text>アイコン</Text>

            <Button
              width={120}
              height={120}
              borderRadius={999}
              backgroundColor="#EEE"
              padding={0}
              overflow="hidden"
              onPress={pickImage}
            >
              {previewImage ? (
                <Image
                  source={{ uri: previewImage }}
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: 60,
                  }}
                  resizeMode="cover"
                />
              ) : (
                <Text fontSize={30}>📷</Text>
              )}
            </Button>

            <Text color="#777">画像を選択</Text>
          </YStack>
        )}

        {step === 3 && (
          <YStack gap="$4" width="100%">
            <Text>メールアドレス</Text>

            <Input value={auth.currentUser?.email || ""} editable={false} />

            <Text>表示名（ニックネーム可）</Text>

            <Input
              placeholder="表示名を記入してください"
              value={displayName}
              onChangeText={setDisplayName}
            />
          </YStack>
        )}

        {step === 4 && (
          <YStack gap="$4" width="100%">
            <Text textAlign="center">
              自身に当てはまるキーワードを選択してください
            </Text>

            <XStack flexWrap="wrap" gap="$2" justifyContent="center">
              {TAGS.map((tag) => (
                <Button
                  key={tag}
                  size="$2"
                  borderRadius="$10"
                  backgroundColor={
                    selectedTags.includes(tag) ? "#E8C75A" : "white"
                  }
                  borderWidth={1}
                  borderColor="#CCC"
                  onPress={() => toggleTag(tag)}
                >
                  {tag}
                </Button>
              ))}
            </XStack>
          </YStack>
        )}

        <XStack gap="$2" marginTop="$4">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <Text key={i} color={step === i + 1 ? "#999" : "#DDD"}>
              ●
            </Text>
          ))}
        </XStack>
      </YStack>

      <Button
        marginTop="$6"
        alignSelf="center"
        width="70%"
        height={52}
        borderRadius="$10"
        backgroundColor="#FFD966"
        color="black"
        fontWeight="700"
        onPress={handleNext}
        disabled={saving}
        opacity={saving ? 0.6 : 1}
      >
        {saving ? "保存中..." : step === TOTAL_STEPS ? "確定" : "次へ"}
      </Button>

      {step > 1 && (
        <Text
          marginTop="$3"
          textAlign="center"
          color="#999"
          onPress={() => setStep(step - 1)}
        >
          1つ前へ戻る
        </Text>
      )}
    </YStack>
  );
}