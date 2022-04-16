import { Client, Intents } from "discord.js";
import { token } from "../token.json";
import { registerChannelEvents } from "./events/channel";
import { registerDebuggingEvents } from "./events/debugging";
import { registerGuildEvents } from "./events/guild";
import { registerMessageEvents } from "./events/message";
import { registerUserEvents } from "./events/user";
import { registerUserSettingsEvents } from "./events/userSettings";

const intents = new Intents();
intents.add(
  Intents.FLAGS.GUILDS,
  Intents.FLAGS.GUILD_MESSAGES,
  Intents.FLAGS.DIRECT_MESSAGES,
  Intents.FLAGS.GUILD_VOICE_STATES
);

const client = new Client({
  intents,
});

registerChannelEvents(client);
registerUserSettingsEvents(client);
registerDebuggingEvents(client);
registerGuildEvents(client);
registerMessageEvents(client);
registerUserEvents(client);

client.on("presenceUpdate", (oldMember, newMember) => {
  console.log(`a guild member's presence changes`);
});

client.on("ready", () => {
  console.log(`the client becomes ready to start`);
  if (client.user === null) {
    return;
  }
  console.log(`I am ready! Logged in as ${client.user.tag}!`);
  console.log(
    `Bot has started, with ${client.users.cache.size} users, in ${client.channels.cache.size} channels of ${client.guilds.cache.size} guilds.`
  );
  client.user.setActivity("playing good vibes");
});

client.login(token);
