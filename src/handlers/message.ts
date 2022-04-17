import { Awaitable, Channel, Guild, Message } from "discord.js";
import { getOrCreatePlayer, destroyPlayer, getPlayer } from "../music/player";
import { createResponse } from "./common";

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

const withGuildAndChannel = (
  message: Message,
  func: (guild: Guild, channel: Channel) => void
) => {
  const guild = message.guild;
  const member = guild?.members.cache.get(message.author.id);
  const voiceChannel = member?.voice.channel;
  if (voiceChannel !== undefined && voiceChannel !== null && guild !== null) {
    func(guild, voiceChannel);
  }
};

const longRegex =
  /^(https:\/\/)?(www\.)?youtube\.com\/watch\?v=[A-z0-9_\-]+((&|\?).*)?$/gi;
const shortRegex = /^(https:\/\/)?youtu\.be\/[A-z0-9_\-]+((&|\?).*)?$/gi;

const respondSuccess = (message: Message, id: bigint, queueSize: number) => {
  const response = createResponse(
    `Added to the queue. Currently position #${queueSize} in the queue`,
    id
  );
  message.reply(response);
};

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
    withGuildAndChannel(message, (guild, channel) => {
      const player = getOrCreatePlayer(guild, channel, true);
      if (player === undefined) {
        message.reply("Bot is already in a channel");
        return;
      }
      const queueSize = player.queueSize() + 1;
      const id = player.addToQueue(youtubeId);
      respondSuccess(message, id, queueSize);
    });
  } else {
    message.reply("The bot currently only supports links");
  }
};

const pingHandler = async (message: Message) => {
  await message.reply("pong");
};

const leaveHandler = async (message: Message) => {
  withGuildAndChannel(message, destroyPlayer);
};

const skipHandler = async (message: Message) => {
  withGuildAndChannel(message, (guild, channel) => {
    const player = getPlayer(guild, channel);
    if (player !== undefined) {
      player.skip();
    }
  });
};

const handlers = new Map<string, (message: Message) => Awaitable<void>>([
  ["play", playHandler],
  ["ping", pingHandler],
  ["leave", leaveHandler],
  ["skip", skipHandler],
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
