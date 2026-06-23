import { Alert, Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
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
    }, 4000);
  });
};

const getTimingFromAction = (actionId) => {
  if (actionId === ACTION_NOW) return "今すぐ";
  if (actionId === ACTION_LATER) return "後なら";
  if (actionId === ACTION_WAIT) return "ちょっと";
  return null;
};

const getDisplayTextFromTiming = (timing) => {
  if (timing === "今すぐ") return "👍 大丈夫";
  if (timing === "後なら") return "☕ あとで";
  if (timing === "ちょっと") return "⏳ 少し待って";
  return timing || "";
};

async function sendResponsePushToPoster({ requestId, request, myName, timing }) {
  try {
    const fromSnap = await getDoc(doc(db, "users", request.fromUid));

    if (!fromSnap.exists()) {
      console.log("投稿者が見つかりません:", request.fromUid);
      return;
    }

    const fromToken = fromSnap.data()?.expoPushToken;

    if (!fromToken) {
      console.log("投稿者にexpoPushTokenがありません");
      return;
    }

    await sendBasicPush({
      to: fromToken,
      title: "お返事が届きました！",
      body: `${myName}さんが「${getDisplayTextFromTiming(
        timing
      )}」で返信しました`,
      data: {
        requestId,
        type: "response",
        timing,
      },
    });
  } catch (error) {
    console.log("sendResponsePushToPoster error:", error.message);
  }
}

async function respondToRequestFromNotification(requestId, timing) {
  try {
    const user = await waitForAuthUser();

    if (!user || !requestId || !timing) {
      console.log("通知返信できません:", {
        hasUser: !!user,
        requestId,
        timing,
      });
      return;
    }

    const requestRef = doc(db, "requests", requestId);
    const requestSnap = await getDoc(requestRef);

    if (!requestSnap.exists()) {
      console.log("request が存在しません:", requestId);
      return;
    }

    const request = requestSnap.data();

    if (request.status !== "waiting") {
      console.log("すでに返信済みです:", request.status);
      return;
    }

    if (request.fromUid === user.uid) {
      console.log("自分の投稿には返信できません");
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
      timingLabel: getDisplayTextFromTiming(timing),
      status: "responded",
      respondedAt: serverTimestamp(),
    });

    console.log("✅ 通知ボタンから返信しました:", {
      requestId,
      timing,
      myName,
    });

    await sendResponsePushToPoster({
      requestId,
      request,
      myName,
      timing,
    });
  } catch (error) {
    console.log("respondToRequestFromNotification error:", error.message);
  }
}

export async function configureNotificationActions() {
  try {
    await Notifications.setNotificationCategoryAsync(CONSULTATION_CATEGORY_ID, [
      {
        identifier: ACTION_NOW,
        buttonTitle: "👍 大丈夫",
        options: {
          opensAppToForeground: true,
        },
      },
      {
        identifier: ACTION_LATER,
        buttonTitle: "☕ あとで",
        options: {
          opensAppToForeground: true,
        },
      },
      {
        identifier: ACTION_WAIT,
        buttonTitle: "⏳ 少し待って",
        options: {
          opensAppToForeground: true,
        },
      },
    ]);

    const categories = await Notifications.getNotificationCategoriesAsync();
    console.log("✅ 通知カテゴリー登録済み:", categories);

    if (responseSubscription) {
      responseSubscription.remove();
      responseSubscription = null;
    }

    responseSubscription = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        const actionId = response.actionIdentifier;

        console.log("🔘 通知アクション:", actionId);

        const timing = getTimingFromAction(actionId);

        if (!timing) {
          console.log("通常の通知タップです。ボタン返信ではありません。");
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

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FFD966",
        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }

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

    console.log("✅ Expo Push Token:", expoPushToken);

    const uid = auth.currentUser?.uid;

    if (uid) {
      await setDoc(
        doc(db, "users", uid),
        {
          expoPushToken,
          notificationEnabled: true,
          notificationUpdatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      console.log("✅ expoPushToken saved to users:", uid);
    } else {
      console.log("⚠️ auth.currentUser がないので token 保存できません");
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

export async function sendBasicPush({
  to,
  title,
  body,
  data = {},
  categoryId,
}) {
  try {
    if (!to) {
      console.log("⚠️ Push送信できません: token がありません");
      return null;
    }

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

    console.log("📤 Push送信:", message);

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();

    console.log("📩 Expo Push Response:", result);

    return result;
  } catch (error) {
    console.log("sendBasicPush error:", error.message);
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
  mode = "consultation",
}) {
  try {
    if (!to) {
      console.log("⚠️ sendConsultationPush: expoPushToken がありません");
      return null;
    }

    if (!requestId) {
      console.log("⚠️ sendConsultationPush: requestId がありません");
      return null;
    }

    const tagsText = talkTags.length > 0 ? `「${talkTags.join("」「")}」` : "";

    const bodyText = detail
      ? detail
      : `${fromName || "誰か"}さんが少し困っているみたいです`;

    const title =
      mode === "direct"
        ? `${fromName || "誰か"}さんから相談が届きました`
        : "誰かが相談を投稿しました";

    const body =
      tagsText.length > 0
        ? `${bodyText}\n${tagsText}\n今話しかけても大丈夫そう？`
        : `${bodyText}\n今話しかけても大丈夫そう？`;

    return await sendBasicPush({
      to,
      title,
      body,
      categoryId: CONSULTATION_CATEGORY_ID,
      data: {
        requestId,
        type: "consultation",
        mode,
        fromName: fromName || "",
        talkTags,
        feelTag,
        detail,
      },
    });
  } catch (error) {
    console.log("sendConsultationPush error:", error.message);
    return null;
  }
}