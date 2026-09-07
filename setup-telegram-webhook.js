#!/usr/bin/env node
/**
 * Setup Telegram webhook for UPeak bot.
 * This script:
 * 1. Exposes local server via ngrok
 * 2. Gets the public URL
 * 3. Configures webhook with Telegram API
 * 4. Verifies webhook is set
 */

const ngrok = require("ngrok");
require("dotenv").config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PORT = process.env.PORT || 3000;

async function setupWebhook() {
  try {
    if (!TELEGRAM_BOT_TOKEN) {
      console.error("❌ TELEGRAM_BOT_TOKEN is not set in .env");
      process.exit(1);
    }

    console.log("🚀 Starting Telegram webhook setup...\n");

    // 1. Start ngrok tunnel
    console.log("📡 Connecting ngrok tunnel to localhost:3000...");
    const url = await ngrok.connect(PORT);
    console.log(`✅ Tunnel established: ${url}\n`);

    // 2. Configure webhook
    const webhookUrl = `${url}/api/telegram/webhook`;
    console.log(`🔗 Setting Telegram webhook to: ${webhookUrl}\n`);

    const setWebhookUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;

    const setResponse = await fetch(setWebhookUrl);
    const setData = await setResponse.json();

    if (!setData.ok) {
      console.error("❌ Failed to set webhook:", setData);
      process.exit(1);
    }

    console.log("✅ Webhook set successfully!\n");

    // 3. Verify webhook
    const getWebhookUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`;
    const getResponse = await fetch(getWebhookUrl);
    const getInfo = await getResponse.json();

    if (getInfo.ok) {
      console.log("📋 Webhook Info:");
      console.log(`   URL: ${getInfo.result.url}`);
      console.log(`   Pending updates: ${getInfo.result.pending_update_count}`);
      console.log(`   Has custom certificate: ${getInfo.result.has_custom_certificate}\n`);
    }

    console.log("✨ Setup complete! Bot is ready to receive Telegram messages.\n");
    console.log("🎯 Next steps:");
    console.log("   1. Open Telegram and find your bot");
    console.log("   2. Send /start command");
    console.log("   3. Follow the registration flow\n");
    console.log("💡 Keep this script running to maintain the tunnel.\n");
    console.log("Press Ctrl+C to stop.\n");

  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

setupWebhook();

// Keep process alive
process.on("SIGINT", async () => {
  console.log("\n\n🛑 Stopping...");
  await ngrok.kill();
  process.exit(0);
});
