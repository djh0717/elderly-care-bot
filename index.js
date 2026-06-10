const express = require("express");
const line = require("@line/bot-sdk");

const app = express();

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};

const client = new line.Client(config);

const FAMILY_USER_ID = process.env.FAMILY_USER_ID;
const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;

const users = {};

app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    for (const event of req.body.events) {
      if (event.type !== "message") continue;
      if (event.message.type !== "text") continue;

      const userId = event.source.userId;
      const text = event.message.text.trim();

      if (!users[userId]) {
        users[userId] = {
          step: null,
          profile: {}
        };
      }

      const user = users[userId];
      let replyText = "";

      if (text === "我是家屬") {
        replyText =
          "這是你的家屬 LINE userId：\n\n" +
          userId +
          "\n\n請貼到 Render 的 FAMILY_USER_ID。";
      }

      else if (text === "開始設定" || text === "基本資料") {
        user.step = "name";
        replyText = "請輸入長輩姓名：";
      }

      else if (user.step === "name") {
        user.profile.name = text;
        user.step = "age";
        replyText = "請輸入年齡：";
      }

      else if (user.step === "age") {
        user.profile.age = text;
        user.step = "disease";
        replyText = "請輸入是否有疾病：\n例如：高血壓、糖尿病\n如果沒有請輸入：無";
      }

      else if (user.step === "disease") {
        user.profile.disease = text;
        user.step = "medicine";
        replyText = "請輸入目前服用藥物：\n如果沒有請輸入：無";
      }

      else if (user.step === "medicine") {
        user.profile.medicine = text;
        user.step = "familyPhone";
        replyText = "請輸入家屬電話：";
      }

      else if (user.step === "familyPhone") {
        user.profile.familyPhone = text;
        user.step = null;

        replyText =
          "✅ 基本資料設定完成\n\n" +
          getProfileText(user.profile);

        await saveToGoogleSheet(userId, user.profile, "基本資料設定", "完成");
      }

      else if (text === "查看資料") {
        replyText = getProfileText(user.profile);
      }

      else if (text === "我已吃藥") {
        const now = getTaiwanTime();

        replyText = "✅ 已記錄您吃藥了\n時間：" + now;

        await saveToGoogleSheet(userId, user.profile, "我已吃藥", now);
      }

      else if (text === "今日提醒" || text === "今天提醒") {
        replyText =
          "📅 今日提醒\n\n" +
          "💊 早上 08:00 吃藥\n" +
          "💊 中午 12:00 吃藥\n" +
          "💊 晚上 18:00 吃藥\n\n" +
          "吃完請按「我已吃藥」。";
      }

      else if (text === "防詐騙" || text === "防詐幫忙") {
        replyText =
          "🛡️ 防詐提醒\n\n" +
          "陌生來電要求匯款、提供密碼、操作 ATM、點不明連結，請先不要做，先問家人。";
      }

      else if (text === "我要叫車") {
        replyText =
          "🚕 叫車資訊\n\n" +
          "台灣大車隊：55688\n" +
          "大都會車隊：55178";

        await saveToGoogleSheet(userId, user.profile, "我要叫車", "顯示叫車資訊");
      }

      else if (text === "聯絡家人") {
        replyText = "👨‍👩‍👧 已通知家人，請稍候。";

        await saveToGoogleSheet(userId, user.profile, "聯絡家人", "通知家屬");

        await notifyFamily(
          "👨‍👩‍👧 長輩想聯絡家人\n\n" +
          getProfileText(user.profile)
        );
      }

      else if (text === "緊急求助") {
        replyText =
          "🆘 緊急求助已送出！\n\n" +
          "請保持手機暢通，家人會盡快聯絡您。";

        await saveToGoogleSheet(userId, user.profile, "緊急求助", "SOS");

        await notifyFamily(
          "🚨 緊急求助通知！\n\n" +
          "長輩按下了「緊急求助」。\n\n" +
          getProfileText(user.profile)
        );
      }

      else {
        replyText =
          "請點選功能選單：\n\n" +
          "📝 開始設定\n" +
          "👤 查看資料\n" +
          "💊 我已吃藥\n" +
          "📅 今日提醒\n" +
          "🛡️ 防詐騙\n" +
          "🚕 我要叫車\n" +
          "👨‍👩‍👧 聯絡家人\n" +
          "🆘 緊急求助";
      }

      await client.replyMessage(event.replyToken, {
        type: "text",
        text: replyText
      });
    }

    res.sendStatus(200);
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

function getProfileText(profile) {
  if (!profile || !profile.name) {
    return "尚未設定基本資料，請先輸入「開始設定」。";
  }

  return (
    "📋 長輩基本資料\n" +
    "姓名：" + profile.name + "\n" +
    "年齡：" + profile.age + "\n" +
    "疾病：" + profile.disease + "\n" +
    "藥物：" + profile.medicine + "\n" +
    "家屬電話：" + profile.familyPhone
  );
}

function getTaiwanTime() {
  return new Date().toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei"
  });
}

async function notifyFamily(message) {
  if (!FAMILY_USER_ID) {
    console.log("FAMILY_USER_ID 尚未設定");
    return;
  }

  await client.pushMessage(FAMILY_USER_ID, {
    type: "text",
    text: message
  });
}

async function saveToGoogleSheet(userId, profile, action, note) {
  if (!GOOGLE_SCRIPT_URL) {
    console.log("GOOGLE_SCRIPT_URL 尚未設定");
    return;
  }

  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userId: userId,
        name: profile.name || "",
        age: profile.age || "",
        disease: profile.disease || "",
        medicine: profile.medicine || "",
        familyPhone: profile.familyPhone || "",
        action: action,
        note: note
      })
    });
  } catch (error) {
    console.error("寫入 Google Sheet 失敗：", error);
  }
}
app.get("/check-medication", async (req, res) => {
  try {
    const response = await fetch(GOOGLE_SCRIPT_URL);
    const data = await response.json();

    for (const item of data) {
      await notifyFamily(
        "⚠️ 未確認服藥通知\n\n" +
        "姓名：" + item.name + "\n" +
        "年齡：" + item.age + "\n" +
        "疾病：" + item.disease + "\n" +
        "藥物：" + item.medicine + "\n" +
        "預定服藥時間：08:00\n\n" +
        "目前尚未收到服藥確認，請主動關心。"
      );
    }
    await fetch(GOOGLE_SCRIPT_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    mode: "markNotified",
    rowNumber: item.rowNumber
  })
});

    res.send("checked");
  } catch (error) {
    console.error(error);
    res.status(500).send("error");
  }
});
app.get("/", (req, res) => {
  res.send("LINE BOT RUNNING");
});

app.listen(process.env.PORT || 3000);
