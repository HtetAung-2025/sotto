import { useState, useEffect } from "react";
import { Alert, Image } from "react-native";
import { router } from "expo-router";
import { YStack, XStack, H1, Text, Button, Input } from "tamagui";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "../lib/firebase";
import * as ImagePicker from "expo-image-picker";

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

const isRemoteImage = (uri) => {
  if (!uri || typeof uri !== "string") return false;
  return uri.startsWith("http://") || uri.startsWith("https://");
};

export default function ProfileSetup() {
  const [step, setStep] = useState(1);
  const [grade, setGrade] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [imageUri, setImageUri] = useState(null);
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
        quality: 0.8,
      });

      if (!result.canceled) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  const uploadProfileImage = async (uri, uid) => {
    try {
      if (!uri) return null;

      // すでにFirebase StorageなどのURLなら、そのまま使う
      if (isRemoteImage(uri)) {
        return uri;
      }

      const response = await fetch(uri);
      const blob = await response.blob();

      const imageRef = ref(storage, `profileImages/${uid}.jpg`);

      await uploadBytes(imageRef, blob, {
        contentType: "image/jpeg",
      });

      const downloadURL = await getDownloadURL(imageRef);

      return downloadURL;
    } catch (error) {
      console.log("uploadProfileImage error:", error);

      // Storageに失敗しても、プロフィール保存は止めない
      // この端末では local uri で画像表示できる
      return uri;
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

      let photoURL = oldPhotoURL || null;

      if (imageUri) {
        photoURL = await uploadProfileImage(imageUri, user.uid);
      }

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

          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      Alert.alert("保存しました", "プロフィールを更新しました", [
        {
          text: "OK",
          onPress: () => router.replace("/(tabs)/profile"),
        },
      ]);
    } catch (error) {
      console.log("saveProfile error:", error);
      Alert.alert("Error", error.message);
    } finally {
      setSaving(false);
    }
  };

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
              {imageUri ? (
                <Image
                  source={{ uri: imageUri }}
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