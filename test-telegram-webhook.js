#!/usr/bin/env node
/**
 * Test Telegram webhook locally.
 * This script simulates what Telegram sends to your webhook endpoint.
 */

const http = require("http");
require("dotenv").config();

const PORT = 3000;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Simulate user sending /start command
async function testWebhook() {
  const testUpdate = {
    update_id: 123456,
    message: {
      message_id: 1,
      date: Math.floor(Date.now() / 1000),
      chat: {
        id: 987654,
        type: "private",
        first_name: "Test",
        username: "testuser"
      },
      from: {
        id: 987654,
        is_bot: false,
        first_name: "Test",
        username: "testuser"
      },
      text: "/start"
    }
  };

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(testUpdate);

    const options = {
      hostname: "localhost",
      port: PORT,
      path: "/api/telegram/webhook",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        resolve({ status: res.statusCode, body: data });
      });
    });

    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

async function run() {
  console.log("🧪 Testing Telegram webhook locally...\n");
  
  try {
    console.log("📤 Sending test /start message to localhost:3000...");
    const result = await testWebhook();
    
    console.log(`✅ Response status: ${result.status}`);
    console.log(`📋 Response body: ${result.body}\n`);
    
    if (result.status === 200) {
      console.log("✨ Webhook endpoint is working!\n");
      console.log("📌 Next steps for production:");
      console.log("   1. Deploy server to a public URL (e.g., Heroku, Railway, etc.)");
      console.log("   2. Install ngrok on your machine: npm install -g ngrok");
      console.log("   3. Run: ngrok http 3000");
      console.log("   4. Get the ngrok URL (e.g., https://abc123.ngrok.io)");
      console.log("   5. Set webhook with Telegram API:");
      console.log(`      curl https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=https://your-url.com/api/telegram/webhook`);
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error("\n⚠️  Make sure the server is running on port 3000");
  }
}

run();
