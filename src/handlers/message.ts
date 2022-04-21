import { Awaitable, Channel, Guild, Message, MessageEmbed } from "discord.js";
import {
  getOrCreatePlayer,
  destroyPlayer,
  getPlayer,
  Player,
} from "../music/player";
import { createResponse } from "./common";
import * as yt from "youtube-search-without-api-key";

const isCommand = (message: Message) => {
  return message.content[0] === "$";
};

const getParts = (message: Message): string[] => {
  const [_, ...rest] = message.content.split(" ");
  return rest;
};

const getArguments = (message: Message): string => {
  const [_, ...rest] = message.content.split(" ");
  return rest.join(" ");
};

const getCommand = (message: Message): string => {
  return message.content.split(" ", 1)[0].substring(1);
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

const withGuildAndChannel = async (
  message: Message,
  func: (guild: Guild, channel: Channel) => Awaitable<void> | boolean
) => {
  const guild = message.guild;
  const member = guild?.members.cache.get(message.author.id);
  const voiceChannel = member?.voice.channel;
  if (voiceChannel !== undefined && voiceChannel !== null && guild !== null) {
    await func(guild, voiceChannel);
  }
};

const withPlayer = async (
  message: Message,
  func: (player: Player) => Awaitable<void>
) => {
  await withGuildAndChannel(message, async (guild, channel) => {
    const player = getPlayer(guild, channel);
    if (player !== undefined) {
      await func(player);
    }
  });
};

const longRegex =
  /^(https:\/\/)?(www\.)?youtube\.com\/watch\?v=[A-z0-9_\-]+((&|\?).*)?$/gi;
const shortRegex = /^(https:\/\/)?youtu\.be\/[A-z0-9_\-]+((&|\?).*)?$/gi;

const respondSuccess = async (
  message: Message,
  id: bigint,
  queueSize: number
) => {
  const response = createResponse(
    `Added to the queue. Currently position #${queueSize} in the queue`,
    id
  );
  await message.reply(response);
};

// https://youtu.be/5Ba2HU2mStI
// https://www.youtube.com/watch?v=5Ba2HU2mStI
const playHandler = async (message: Message) => {
  const parts = getParts(message);
  if (parts.length === 0) {
    await message.reply("No arguments provided to the command");
    return;
  }

  let youtubeId: string | undefined = undefined;
  if (
    parts.length === 1 &&
    (parts[0].match(longRegex) || parts[0].match(shortRegex))
  ) {
    youtubeId = extractId(parts[0]);
  } else {
    const query = getArguments(message);
    const results = await yt.search(query);
    if (results.length === 0) {
      await message.reply("Unable to find any videos matching your search");
    } else {
      youtubeId = results[0].id.videoId;
    }
  }

  if (youtubeId !== undefined) {
    await withGuildAndChannel(message, async (guild, channel) => {
      const player = await getOrCreatePlayer(guild, channel, true);
      if (player === undefined) {
        await message.reply("Bot is already in a channel");
        return;
      }
      const { id, currentSize } = await player.addToQueue(youtubeId!);
      await respondSuccess(message, id, currentSize);
    });
  }
};

const pingHandler = async (message: Message) => {
  await message.reply("pong");
};

const leaveHandler = async (message: Message) => {
  await withGuildAndChannel(message, destroyPlayer);
};

const skipHandler = async (message: Message) => {
  await withPlayer(message, (player) => {
    player.skip();
  });
};

const listHandler = async (message: Message) => {
  await withPlayer(message, async (player) => {
    const queue = await player.getQueue();
    const embed = new MessageEmbed().setDescription(
      queue.map((entry, i) => `#${i + 1} ${entry.youtubeId}`).join("\n")
    );
    await message.reply({ embeds: [embed] });
  });
};

const searchHandler = async (message: Message) => {
  const search = getArguments(message);
  const results = await yt.search(search);

  results;
};

const handlers = new Map<string, (message: Message) => Awaitable<void>>([
  ["play", playHandler],
  ["ping", pingHandler],
  ["leave", leaveHandler],
  ["skip", skipHandler],
  ["search", searchHandler],
  ["list", listHandler],
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
    await handler(message);
  }
};

export { messageRouter };
