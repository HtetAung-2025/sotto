import { useState, useEffect } from "react";
import { Alert, Image } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { YStack, XStack, H1, Text, Button, Input } from "tamagui";
import { File, BookOpen, Edit3, Lightbulb, GraduationCap, Briefcase, Key, Music } from "@tamagui/lucide-icons-2";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

const TAGS = [
  "授業・課題",
  "ソフト・教材",
  "作品・制作",
  "プレゼン",
  "学校生活",
  "進路・就活",
  "経験談",
  "雑談",
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

const ICON_FOR_TAG = {
  "授業・課題": File,
  "ソフト・教材": BookOpen,
  "作品・制作": Edit3,
  "プレゼン": Lightbulb,
  "学校生活": GraduationCap,
  "進路・就活": Briefcase,
  "経験談": Key,
  "雑談": Music,
};

const ICON_BY_NAME = {
  File,
  BookOpen,
  Edit3,
  Lightbulb,
  GraduationCap,
  Briefcase,
  Key,
  Music,
};

const DEFAULT_ICON_NAME = Object.fromEntries(
  Object.entries(ICON_FOR_TAG).map(([k, v]) => [k, Object.keys(ICON_BY_NAME).find((n) => ICON_BY_NAME[n] === v)])
);

export default function ProfileSetup() {
  const params = useLocalSearchParams();
  const from = params?.from;

  const [step, setStep] = useState(1);
  const [grade, setGrade] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedTagIcons, setSelectedTagIcons] = useState({});
  const [activeTagForIcon, setActiveTagForIcon] = useState(null);

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

        setSelectedTagIcons(data.tagIcons || {});

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
      const newTags = selectedTags.filter((item) => item !== tag);
      setSelectedTags(newTags);

      // remove icon mapping for deselected tag
      const newIcons = { ...selectedTagIcons };
      if (newIcons[tag]) delete newIcons[tag];
      setSelectedTagIcons(newIcons);

      // persist removal immediately (tags + tagIcons)
      try {
        const user = auth.currentUser;
        if (user) {
          setDoc(
            doc(db, "users", user.uid),
            { tags: newTags, tagIcons: newIcons },
            { merge: true }
          );
        }
      } catch (e) {
        console.log("remove tag error:", e.message);
      }
    } else {
      const newTags = [...selectedTags, tag];
      setSelectedTags(newTags);

      // ensure default icon exists for newly selected tag
      const newIcons = { ...selectedTagIcons };
      if (!newIcons[tag]) {
        newIcons[tag] = DEFAULT_ICON_NAME[tag] || Object.keys(ICON_BY_NAME)[0];
        setSelectedTagIcons(newIcons);
      }

      // persist addition immediately (tags + tagIcons)
      try {
        const user = auth.currentUser;
        if (user) {
          setDoc(
            doc(db, "users", user.uid),
            { tags: newTags, tagIcons: newIcons },
            { merge: true }
          );
        }
      } catch (e) {
        console.log("add tag error:", e.message);
      }
    }
  };

  const openIconPicker = (tag) => {
    setActiveTagForIcon(tag === activeTagForIcon ? null : tag);
  };

  const pickTagIcon = (tag, iconName) => {
    const newIcons = { ...selectedTagIcons, [tag]: iconName };
    setSelectedTagIcons(newIcons);
    setActiveTagForIcon(null);

    // persist immediately
    try {
      const user = auth.currentUser;
      if (user) {
        setDoc(doc(db, "users", user.uid), { tagIcons: newIcons }, { merge: true });
      }
    } catch (e) {
      console.log("save tagIcon error:", e.message);
    }
  };

  const pickImage = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

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
          },
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

      // Ensure tagIcons contains defaults for selected tags
      const tagIconsToSave = { ...selectedTagIcons };
      selectedTags.forEach((t) => {
        if (!tagIconsToSave[t]) {
          tagIconsToSave[t] = DEFAULT_ICON_NAME[t] || Object.keys(ICON_BY_NAME)[0];
        }
      });

      console.log("saving tagIcons:", tagIconsToSave);

      await setDoc(
        doc(db, "users", user.uid),
        {
          uid: user.uid,
          email: user.email,

          name: displayName.trim(),
          grade,
          tags: selectedTags,
          tagIcons: tagIconsToSave,

          photoURL,
          imageUrl: photoURL,
          avatarUrl: photoURL,
          imageUri: photoURL,
          profileImage: photoURL,
          profileImageUrl: photoURL,

          updatedAt: serverTimestamp(),
        },
        { merge: true },
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
      backgroundColor="#FCF0CD"
      justifyContent="center"
      alignItems="center"
      width="100%"
      overflow="hidden"
    >
      <YStack
        backgroundColor="white"
        borderTopLeftRadius={280}
        borderTopRightRadius={280}
        minHeight={850}
        padding="$6"
        marginTop={150}
        alignItems="center"
        width="150%"
        flexShrink={0}
      >
        <XStack gap="$2" marginTop="40" marginBottom="50">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <Text
              key={i}
              backgroundColor={step === i + 1 ? "#B6B6B6" : "#FFF"}
              border="1px solid #B6B6B6"
              borderRadius={100}
              height={10}
              width={10}
              margin={3}
            ></Text>
          ))}
        </XStack>

        {step === 1 && (
          <YStack width="80%" alignItems="center" marginBottom={5}>
            <Text fontSize={20} marginBottom={15}>学科を選んでください</Text>
            <Text marginBottom="40" fontSize={14}>
              &#8251;後から変更可能です。
            </Text>

            {["1年", "2年", "3年", "4年"].map((item) => (
              <Button
                key={item}
                width="50%"
                height="50"
                border="1px solid #B6B6B6"
                borderRadius="$10"
                backgroundColor={grade === item ? "#FFDF78" : "white"}
                color="black"
                borderWidth={1}
                marginBottom={25}
                onPress={() => setGrade(item)}
              >
                {item}
              </Button>
            ))}
          </YStack>
        )}

        {step === 2 && (
          <YStack gap="$4" alignItems="center">
            <Text fontSize={20}>アイコンを選択してください</Text>
            <Text marginBottom="40" fontSize={14}>
              &#8251;後から変更可能です。
            </Text>

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

            <Text color="#777" marginBottom={127}>
              画像を選択
            </Text>
          </YStack>
        )}

        {step === 3 && (
          <YStack gap="$4">
            <Text textAlign="center" marginTop={30} fontSize={20}>
              以下の内容を入力してください
            </Text>
            <Text textAlign="center" marginBottom="40" fontSize={14}>
              &#8251;後から変更可能です。
            </Text>

            <Text marginBottom={-15}>
              メールアドレス
            </Text>

            <Input
              width={320}
              value={auth.currentUser?.email || ""}
              editable={false}
              backgroundColor="#F2F2F2"
              border="#B6B6B6"
              color="#000"
              marginBottom={25}
            />

            <Text marginBottom={-15}>
              表示名　※誰でもわかる名前（本名）にしましょう
            </Text>

            <Input
              width={320}
              placeholder="表示名を記入してください"
              value={displayName}
              onChangeText={setDisplayName}
              marginBottom={79}
              backgroundColor="#F2F2F2"
              border="#B6B6B6"
              color="#000"
            />
          </YStack>
        )}

        {step === 4 && (
          <YStack gap="$4" width="60%">
            <Text textAlign="center">
              誰かのために力になれそうな分野、
              {"\n"}
              話せる内容を選んでください
            </Text>
            <Text textAlign="center" marginBottom="10" fontSize={14}>
              &#8251;後から変更可能です。
            </Text>
            <Text textAlign="center" marginBottom="10" color="#B6B6B6">
              ※３つまで選択することができます。
            </Text>

            <XStack
              display="flex"
              flexWrap="wrap"
              gap="$2"
              justifyContent="center"
              marginBottom="5"
            >
              {TAGS.map((tag) => {
                const defaultIconName = DEFAULT_ICON_NAME[tag];
                const iconName = selectedTagIcons[tag] || defaultIconName;
                const Icon = ICON_BY_NAME[iconName];
                return (
                  <YStack key={tag} alignItems="center">
                    <Button
                      width={92}
                      height={92}
                      padding={10}
                      borderRadius={12}
                      color="#000"
                      backgroundColor={
                        selectedTags.includes(tag) ? "#E8C75A" : "white"
                      }
                      borderWidth={1}
                      borderColor="#EEE"
                      onPress={() => toggleTag(tag)}
                      onLongPress={() => openIconPicker(tag)}
                      alignItems="center"
                      justifyContent="center"
                    >
                      <YStack alignItems="center" justifyContent="center" gap={6}>
                        {Icon ? (
                          <Icon size={28} color={selectedTags.includes(tag) ? "#111" : "#333"} />
                        ) : null}
                        <Text fontSize={12} lineHeight={14} textAlign="center">
                          {tag}
                        </Text>
                      </YStack>
                    </Button>

                    {activeTagForIcon === tag && (
                      <XStack gap="$2" marginTop="$2">
                        {Object.keys(ICON_BY_NAME).map((name) => {
                          const Cmp = ICON_BY_NAME[name];
                          return (
                            <Button
                              key={name}
                              width={44}
                              height={44}
                              borderRadius={8}
                              backgroundColor={selectedTagIcons[tag] === name ? "#E8C75A" : "white"}
                              onPress={() => pickTagIcon(tag, name)}
                            >
                              <Cmp size={18} color="#333" />
                            </Button>
                          );
                        })}
                      </XStack>
                    )}
                  </YStack>
                );
              })}
            </XStack>
          </YStack>
        )}

        <Button
          marginTop="100"
          alignSelf="center"
          width="65%"
          height={52}
          borderRadius={35}
          backgroundColor="#FFDF78"
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
    </YStack>
  );
}
