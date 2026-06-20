import { Alert, Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
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

const waitForAuthUser = () => {
  return new Promise((resolve) => {
    if (auth.currentUser) {
      resolve(auth.currentUser);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });

    setTimeout(() => {
      unsubscribe();
      resolve(auth.currentUser);
    }, 3000);
  });
};

const getTimingFromAction = (actionId) => {
  if (actionId === ACTION_NOW) return "今すぐ";
  if (actionId === ACTION_LATER) return "後なら";
  if (actionId === ACTION_WAIT) return "ちょっと";
  return null;
};

async function respondToRequestFromNotification(requestId, timing) {
  try {
    const user = await waitForAuthUser();

    if (!user || !requestId || !timing) {
      return;
    }

    const requestRef = doc(db, "requests", requestId);
    const requestSnap = await getDoc(requestRef);

    if (!requestSnap.exists()) {
      return;
    }

    const request = requestSnap.data();

    if (request.status !== "waiting") {
      return;
    }

    const mySnap = await getDoc(doc(db, "users", user.uid));
    const myData = mySnap.exists() ? mySnap.data() : {};

    const myName = myData.name || "名前なし";
    const myGrade = myData.grade || "";
    const myImage = getProfileImage(myData);

    await updateDoc(requestRef, {
      respondedBy: user.uid,
      respondedByName: myName,
      respondedByGrade: myGrade,
      respondedByPhotoURL: myImage,
      timing,
      status: "responded",
      respondedAt: serverTimestamp(),
    });

    const fromSnap = await getDoc(doc(db, "users", request.fromUid));
    const fromToken = fromSnap.data()?.expoPushToken;

    if (fromToken) {
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: fromToken,
          title: "お返事が届きました！",
          body: `${myName}さんが「${timing}」で返信しました`,
          sound: "default",
          data: {
            requestId,
            type: "response",
          },
        }),
      });
    }
  } catch (error) {
    console.log("respondToRequestFromNotification error:", error.message);
  }
}

export async function configureNotificationActions() {
  try {
    await Notifications.setNotificationCategoryAsync(CONSULTATION_CATEGORY_ID, [
      {
        identifier: ACTION_NOW,
        buttonTitle: "今すぐ",
        options: {
          opensAppToForeground: true,
        },
      },
      {
        identifier: ACTION_LATER,
        buttonTitle: "後なら",
        options: {
          opensAppToForeground: true,
        },
      },
      {
        identifier: ACTION_WAIT,
        buttonTitle: "ちょっと",
        options: {
          opensAppToForeground: true,
        },
      },
    ]);

    if (responseSubscription) {
      responseSubscription.remove();
      responseSubscription = null;
    }

    responseSubscription = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        const actionId = response.actionIdentifier;
        const timing = getTimingFromAction(actionId);

        if (!timing) {
          return;
        }

        const data = response.notification.request.content.data || {};
        const requestId = data.requestId;

        await respondToRequestFromNotification(requestId, timing);
      }
    );
  } catch (error) {
    console.log("configureNotificationActions error:", error.message);
  }
}

export async function registerForPushNotificationsAsync() {
  try {
    await configureNotificationActions();

    if (!Device.isDevice) {
      Alert.alert(
        "通知テストについて",
        "スマホ上部に出る本物のプッシュ通知は実機とDevelopment Buildで確認してください。"
      );
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
      Alert.alert("通知が許可されませんでした");
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      Constants.easConfig?.projectId;

    if (!projectId) {
      Alert.alert(
        "projectId がありません",
        "app.json / app.config.js の extra.eas.projectId を確認してください。"
      );
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    const expoPushToken = tokenData.data;

    const uid = auth.currentUser?.uid;

    if (uid) {
      await setDoc(
        doc(db, "users", uid),
        {
          expoPushToken,
          notificationEnabled: true,
        },
        { merge: true }
      );
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FFD966",
      });
    }

    return expoPushToken;
  } catch (error) {
    console.log("registerForPushNotificationsAsync error:", error);
    Alert.alert(
      "通知エラー",
      error?.message || "通知設定でエラーが発生しました"
    );
    return null;
  }
}

export async function sendConsultationPush({
  to,
  requestId,
  fromName,
  talkTags = [],
  feelTag = "",
  detail = "",
}) {
  try {
    if (!to || !requestId) return;

    const tagsText = talkTags.length > 0 ? `「${talkTags.join("」「")}」` : "";
    const bodyText = detail
      ? `${detail}`
      : `${fromName || "誰か"}さんが少し困っているみたいです`;

    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to,
        title: fromName || "相談が届きました",
        subtitle: "相談が届きました",
        body: `${bodyText}\n${tagsText}`,
        sound: "default",

        // iOSの通知アクション用
        categoryIdentifier: CONSULTATION_CATEGORY_ID,

        data: {
          requestId,
          type: "consultation",
          fromName: fromName || "",
          talkTags,
          feelTag,
          detail,
        },
      }),
    });
  } catch (error) {
    console.log("sendConsultationPush error:", error.message);
  }
}