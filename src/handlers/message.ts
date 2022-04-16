import { Awaitable, Message } from "discord.js";
import { getOrCreatePlayer, destroyPlayer } from "../music/player";

const isCommand = (message: Message) => {
  return message.content[0] === "$";
};

const getParts = (message: Message): string[] => {
  const parts = message.content.split(" ");
  parts.shift();
  return parts;
};

const getCommand = (message: Message): string => {
  return message.content.split(" ")[0].substring(1);
};

const extractId = (link: string): string => {
  let splits = link.split("watch?v=");
  if (splits.length === 1) {
    splits = link.split(".be/");
  }
  let last = splits[splits.length - 1];
  last = last.split("&")[0];
  last = last.split("?")[0];

  return last;
};

const longRegex =
  /^(https:\/\/)?(www\.)?youtube\.com\/watch\?v=[A-z0-9_\-]+((&|\?).*)?$/gi;
const shortRegex = /^(https:\/\/)?youtu\.be\/[A-z0-9_\-]+((&|\?).*)?$/gi;

// https://youtu.be/5Ba2HU2mStI
// https://www.youtube.com/watch?v=5Ba2HU2mStI
const playHandler = async (message: Message) => {
  const parts = getParts(message);
  if (parts.length === 0) {
    await message.reply("No arguments provided to the command");
  }

  if (
    parts.length === 1 &&
    (parts[0].match(longRegex) || parts[0].match(shortRegex))
  ) {
    const youtubeId = extractId(parts[0]);
    message.reply(youtubeId);
    const guild = message.guild;
    const member = guild?.members.cache.get(message.author.id);
    const voiceChannel = member?.voice.channel;
    if (voiceChannel !== undefined && voiceChannel !== null && guild !== null) {
      const player = getOrCreatePlayer(guild, voiceChannel, true);
      if (player === undefined) {
        message.reply("Bot is already in a channel");
        return;
      }
      player.addToQueue(youtubeId);
    }
  } else {
    message.reply("The bot currently only supports links");
  }
};

const pingHandler = async (message: Message) => {
  await message.reply("pong");
};

const leaveHandler = async (message: Message) => {
  const guild = message.guild;
  const member = guild?.members.cache.get(message.author.id);
  const voiceChannel = member?.voice.channel;
  if (voiceChannel !== undefined && voiceChannel !== null && guild !== null) {
    destroyPlayer(guild, voiceChannel);
  }
};

const handlers = new Map<string, (message: Message) => Awaitable<void>>([
  ["play", playHandler],
  ["ping", pingHandler],
  ["leave", leaveHandler],
]);

const messageRouter = async (message: Message) => {
  if (!isCommand(message)) {
    return;
  }

  const command = getCommand(message);
  const handler = handlers.get(command);
  if (handler === undefined) {
    await message.reply(`Unknown command: ${command}`);
  } else {
    handler(message);
  }
};

export { messageRouter };
