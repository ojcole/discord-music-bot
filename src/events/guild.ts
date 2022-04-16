import { Client } from "discord.js";

const registerGuildEvents = (client: Client) => {
  client.on("guildBanAdd", (ban) => {
    console.log(`a member is banned from a guild`);
  });

  client.on("guildBanRemove", (ban) => {
    console.log(`a member is unbanned from a guild`);
  });

  client.on("guildCreate", (guild) => {
    console.log(`the client joins a guild`);
  });

  client.on("guildDelete", (guild) => {
    console.log(`the client deleted/left a guild`);
  });

  client.on("guildMemberAdd", (member) => {
    console.log(`a user joins a guild: ${member.displayName}`);
  });

  client.on("guildMemberAvailable", (member) => {
    console.log(
      `member becomes available in a large guild: ${member.displayName}`
    );
  });

  client.on("guildMemberRemove", (member) => {
    console.log(`a member leaves a guild, or is kicked: ${member.displayName}`);
  });

  client.on("guildMembersChunk", (members, guild) => {
    console.error(`a chunk of guild members is received`);
  });

  client.on("guildMemberSpeaking", (member, speaking) => {
    console.log(`a guild member starts/stops speaking: ${member.tag}`);
  });

  client.on("guildMemberUpdate", (oldMember, newMember) => {
    console.error(
      `a guild member changes - i.e. new role, removed role, nickname.`
    );
  });

  client.on("guildUnavailable", (guild) => {
    console.error(
      `a guild becomes unavailable, likely due to a server outage: ${guild}`
    );
  });

  client.on("guildUpdate", (oldGuild, newGuild) => {
    console.error(`a guild is updated`);
  });

  client.on("roleCreate", (role) => {
    console.error(`a role is created`);
  });

  client.on("roleDelete", (role) => {
    console.error(`a guild role is deleted`);
  });

  client.on("roleUpdate", (oldRole, newRole) => {
    console.error(`a guild role is updated`);
  });

  client.on("emojiCreate", (emoji) => {
    console.log(`a custom emoji is created in a guild`);
  });

  client.on("emojiDelete", (emoji) => {
    console.log(`a custom guild emoji is deleted`);
  });

  client.on("emojiUpdate", (oldEmoji, newEmoji) => {
    console.log(`a custom guild emoji is updated`);
  });
};

export { registerGuildEvents };
