import { useEffect, useState } from "react";
import { Alert, ScrollView } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { YStack, XStack, H1, Text, Input, Button, Card } from "tamagui";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";

export default function ChatScreen() {
  const { consultationId } = useLocalSearchParams();

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  useEffect(() => {
    if (!consultationId) return;

    const q = query(
      collection(db, "consultations", consultationId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setMessages(data);
    });

    return unsubscribe;
  }, [consultationId]);

  const sendMessage = async () => {
    try {
      const user = auth.currentUser;

      if (!user) {
        Alert.alert("Error", "Login required");
        return;
      }

      if (!text.trim()) return;

      await addDoc(
        collection(db, "consultations", consultationId, "messages"),
        {
          text,
          senderId: user.uid,
          senderEmail: user.email,
          createdAt: serverTimestamp(),
        }
      );

      setText("");
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <YStack flex={1} backgroundColor="#F6F2EA" padding="$4">
      <XStack alignItems="center" marginBottom="$4">
        <Button onPress={() => router.back()}>戻る</Button>
        <H1 marginLeft="$3">チャット</H1>
      </XStack>

      <ScrollView style={{ flex: 1 }}>
        <YStack gap="$3">
          {messages.map((message) => {
            const isMe = message.senderId === auth.currentUser?.uid;

            return (
              <XStack
                key={message.id}
                justifyContent={isMe ? "flex-end" : "flex-start"}
              >
                <Card
                  maxWidth="75%"
                  padding="$3"
                  backgroundColor={isMe ? "#FFD966" : "white"}
                  borderRadius="$5"
                >
                  <Text>{message.text}</Text>
                </Card>
              </XStack>
            );
          })}
        </YStack>
      </ScrollView>

      <XStack gap="$2" marginTop="$3">
        <Input
          flex={1}
          placeholder="メッセージを入力"
          value={text}
          onChangeText={setText}
        />

        <Button
          backgroundColor="#FFD966"
          color="black"
          onPress={sendMessage}
        >
          送信
        </Button>
      </XStack>
    </YStack>
  );
}