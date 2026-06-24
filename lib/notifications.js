import { Alert, Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";

export const CONSULTATION_CATEGORY_ID = "CONSULTATION_ACTIONS";

const ACTION_NOW = "RESPOND_NOW";
const ACTION_LATER = "RESPOND_LATER";
const ACTION_WAIT = "RESPOND_WAIT";

let responseSubscription = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

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

const waitForAuthUser = async () => {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  return new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe();
      resolve(user);
    });
  });
};

const getTimingFromAction = (actionId) => {
  if (actionId === ACTION_NOW) return "今すぐ";
  if (actionId === ACTION_LATER) return "後なら";
  if (actionId === ACTION_WAIT) return "ちょっと";

  return null;
};

const getDisplayTextFromTiming = (timing) => {
  if (timing === "今すぐ") return "今すぐOK";
  if (timing === "後なら") return "後ならOK";
  if (timing === "ちょっと") return "ちょっと待ってね";

  return timing || "";
};

const sendResponsePushToPoster = async ({ request, responderName, timing }) => {
  try {
    if (!request?.fromUid) return;

    const posterSnap = await getDoc(doc(db, "users", request.fromUid));

    if (!posterSnap.exists()) return;

    const posterData = posterSnap.data();
    const token = posterData.expoPushToken;

    if (!token) {
      console.log("投稿者 token なし:", request.fromUid);
      return;
    }

    const message = {
      to: token,
      title: "お返事が届きました！",
      body: `${responderName}さんが「${timing}」で返信しました`,
      sound: "default",
      priority: "high",
      data: {
        requestId: request.id,
        type: "response",
        screen: "requests",
      },
    };

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();

    console.log("返信通知 result:", result);
  } catch (error) {
    console.log("sendResponsePushToPoster error:", error.message);
  }
};

export const respondToRequestFromNotification = async (requestId, timing) => {
  try {
    console.log("通知ボタン返信 start:", {
      requestId,
      timing,
    });

    if (!requestId) {
      console.log("requestId なし");
      return;
    }

    const user = await waitForAuthUser();

    if (!user) {
      console.log("ログインユーザーなし");
      return;
    }

    const requestRef = doc(db, "requests", requestId);
    const requestSnap = await getDoc(requestRef);

    if (!requestSnap.exists()) {
      console.log("相談が存在しません:", requestId);
      return;
    }

    const request = {
      id: requestSnap.id,
      ...requestSnap.data(),
    };

    if (request.status === "cancelled") {
      console.log("キャンセル済み:", requestId);
      return;
    }

    if (request.status !== "waiting") {
      console.log("すでに返信済み:", request.status);
      return;
    }

    if (request.fromUid === user.uid) {
      console.log("自分の投稿には返信しない");
      return;
    }

    const mySnap = await getDoc(doc(db, "users", user.uid));
    const myData = mySnap.exists() ? mySnap.data() : {};

    const myName = myData.name || "名前なし";
    const myImage = getProfileImage(myData);

    await updateDoc(requestRef, {
      respondedBy: user.uid,
      respondedByName: myName,
      respondedByGrade: myData.grade || "",
      respondedByPhotoURL: myImage,

      timing,
      timingLabel: getDisplayTextFromTiming(timing),

      status: "responded",
      respondedAt: serverTimestamp(),
    });

    console.log("Firestore 返信更新完了:", {
      requestId,
      respondedBy: user.uid,
      respondedByName: myName,
      timing,
    });

    await sendResponsePushToPoster({
      request,
      responderName: myName,
      timing,
    });

    console.log("通知ボタン返信 complete");
  } catch (error) {
    console.log("respondToRequestFromNotification error:", error);
  }
};

export const configureNotificationActions = async () => {
  try {
    await Notifications.setNotificationCategoryAsync(CONSULTATION_CATEGORY_ID, [
      {
        identifier: ACTION_NOW,
        buttonTitle: "👍 今すぐ",
        options: {
          opensAppToForeground: false,
        },
      },
      {
        identifier: ACTION_LATER,
        buttonTitle: "☕ 後なら",
        options: {
          opensAppToForeground: false,
        },
      },
      {
        identifier: ACTION_WAIT,
        buttonTitle: "⏳ ちょっと",
        options: {
          opensAppToForeground: false,
        },
      },
    ]);

    if (responseSubscription) {
      responseSubscription.remove();
      responseSubscription = null;
    }

    responseSubscription =
      Notifications.addNotificationResponseReceivedListener(async (response) => {
        try {
          const actionId = response.actionIdentifier;

          console.log("通知アクション:", actionId);

          const timing = getTimingFromAction(actionId);

          if (!timing) {
            console.log("通常タップなので返信しない");
            return;
          }

          const data = response.notification.request.content.data || {};
          const requestId = data.requestId;

          console.log("通知ボタンから返信:", {
            actionId,
            requestId,
            timing,
            data,
          });

          await respondToRequestFromNotification(requestId, timing);
        } catch (error) {
          console.log("notification response listener error:", error);
        }
      });

    console.log("✅ notification actions configured");
  } catch (error) {
    console.log("configureNotificationActions error:", error.message);
  }
};

export const registerForPushNotificationsAsync = async () => {
  try {
    await configureNotificationActions();

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FFD966",
      });
    }

    if (!Device.isDevice) {
      Alert.alert("通知", "実機で通知をテストしてください");
      return null;
    }

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      Alert.alert("通知", "通知が許可されていません");
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      Constants.easConfig?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    const token = tokenData.data;

    const user = auth.currentUser;

    if (user) {
      await updateDoc(doc(db, "users", user.uid), {
        expoPushToken: token,
        notificationEnabled: true,
        notificationUpdatedAt: serverTimestamp(),
      });
    }

    console.log("Expo Push Token:", token);

    return token;
  } catch (error) {
    console.log("registerForPushNotificationsAsync error:", error);
    Alert.alert("通知エラー", error.message);
    return null;
  }
};

export const sendBasicPush = async ({
  to,
  title,
  body,
  data = {},
  categoryId,
}) => {
  try {
    if (!to) return;

    const message = {
      to,
      title,
      body,
      sound: "default",
      priority: "high",
      data,
    };

    if (categoryId) {
      message.categoryId = categoryId;
    }

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();

    console.log("push result:", result);

    return result;
  } catch (error) {
    console.log("sendBasicPush error:", error.message);
  }
};

export const sendConsultationPush = async ({
  to,
  requestId,
  fromName,
  talkTags = [],
  feelTag = "",
  detail = "",
  mode = "group",
}) => {
  const title =
    mode === "direct"
      ? `${fromName || "誰か"}さんから相談が届きました`
      : "誰かが相談を投稿しました";

  const body =
    talkTags.length > 0
      ? `${talkTags.join("・")} / ${feelTag || "相談したい"}`
      : detail || "少し困っているみたいです";

  return sendBasicPush({
    to,
    title,
    body,
    categoryId: CONSULTATION_CATEGORY_ID,
    data: {
      requestId,
      type: mode,
      screen: "notifications",
    },
  });
};