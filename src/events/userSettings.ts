import { Client } from "discord.js";

const registerUserSettingsEvents = (client: Client) => {
  client.on("clientUserGuildSettingsUpdate", (clientUserGuildSettings) => {
    console.log(
      `clientUserGuildSettingsUpdate -> client user's settings update`
    );
  });

  client.on("clientUserSettingsUpdate", (clientUserSettings) => {
    console.log(`clientUserSettingsUpdate -> client user's settings update`);
  });
};

export { registerUserSettingsEvents };
