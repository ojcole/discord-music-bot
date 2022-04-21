import { Awaitable, Channel, Guild, Message, MessageEmbed } from "discord.js";
import {
  getOrCreatePlayer,
  destroyPlayer,
  getPlayer,
  Player,
  VideoInformation,
} from "../music/player";
import { createResponse } from "./common";
import ytdl from "ytdl-core";
import ytpl from "ytpl";
import ytsr from "ytsr";

interface Playlist {
  title: string;
  items: VideoInformation[];
}

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

const withOrCreatePlayer = async (
  message: Message,
  func: (player: Player) => Awaitable<void>
) => {
  await withGuildAndChannel(message, async (guild, channel) => {
    const player = await getOrCreatePlayer(guild, channel, true);
    if (player === undefined) {
      await message.reply("Bot is already in a channel");
      return;
    }
    await func(player);
  });
};

const longRegex =
  /^(https:\/\/)?(www\.)?youtube\.com\/watch\?v=[A-z0-9_\-]+((&|\?).*)?$/gi;
const shortRegex = /^(https:\/\/)?youtu\.be\/[A-z0-9_\-]+((&|\?).*)?$/gi;

const respondSuccess = async (
  message: Message,
  id: bigint,
  queueSize: number,
  info: VideoInformation
) => {
  const { title, duration } = info;
  const response = createResponse(
    `:notes: **${title}** (\`${duration}\`) added to the queue at **Position #${queueSize}** :notes:`,
    id
  );
  await message.reply(response);
};

const durationToString = (duration: number) => {
  const hours = Math.trunc(duration / 3600);
  const remaining = duration % 3600;
  const minutes = Math.trunc(remaining / 60);
  const seconds = remaining % 60;
  let strDuration = "";
  if (hours > 0) {
    strDuration += `${hours}:` + `${minutes}:`.padStart(2, "0");
  } else {
    strDuration += `${minutes}:`;
  }
  strDuration += `${seconds}`.padStart(2, "0");
  return strDuration;
};

const playHandler = async (message: Message) => {
  const parts = getParts(message);
  if (parts.length === 0) {
    await message.reply("No arguments provided to the command");
    return;
  }

  let youtubeId: string | undefined = undefined;
  let title: string | undefined = undefined;
  let duration: string | undefined = undefined;
  if (
    parts.length === 1 &&
    (parts[0].match(longRegex) || parts[0].match(shortRegex))
  ) {
    youtubeId = extractId(parts[0]);
    try {
      const information = await ytdl.getBasicInfo(parts[0]);
      title = information.videoDetails.title;
      duration = durationToString(
        parseInt(information.videoDetails.lengthSeconds, 10)
      );
    } catch (err) {
      console.log("Invalid link");
      return;
    }
  } else {
    const query = getArguments(message);
    const filter = await ytsr.getFilters(query);
    let newURL = filter.get("Type")?.get("Video")?.url;
    if (newURL === undefined || newURL === null) {
      newURL = query;
    }
    const results = (await ytsr(newURL, { limit: 10 })).items;
    if (results.length === 0) {
      await message.reply("Unable to find any videos matching your search");
    } else {
      for (const result of results) {
        if (result.type === "video" && !result.isLive) {
          youtubeId = result.id;
          title = result.title;
          duration = `${result.duration}`;
          break;
        }
      }
    }
  }

  if (
    youtubeId !== undefined &&
    title !== undefined &&
    duration !== undefined
  ) {
    await withOrCreatePlayer(message, async (player) => {
      const info: VideoInformation = {
        youtubeId: youtubeId!,
        title: title!,
        duration: duration!,
      };
      const { id, currentSize } = await player.addToQueue(info);
      await respondSuccess(message, id, currentSize, info);
    });
  }
};

const extractPlaylistId = (playlistURL: string) => {
  const parts = playlistURL.split("?list=");
  let last = parts[parts.length - 1];
  last = last.split("&")[0];
  return last;
};

const ytplItemsToVideos = (items: ytpl.Item[], base: VideoInformation[]) => {
  items
    .filter((item) => !item.isLive)
    .forEach((item) =>
      base.push({
        youtubeId: item.id,
        title: item.title,
        duration: item.duration || "Unknown",
      })
    );
};

const playlistLoadAll = async (playlistId: string): Promise<Playlist> => {
  const base = await ytpl(playlistId, { pages: 1 });
  const result: Playlist = {
    title: base.title,
    items: [],
  };
  ytplItemsToVideos(base.items, result.items);

  let nextContinuation = base.continuation;
  while (nextContinuation !== null) {
    try {
      const next = await ytpl.continueReq(nextContinuation);
      nextContinuation = next.continuation;
      ytplItemsToVideos(next.items, result.items);
    } catch (err) {
      break;
    }
  }

  return result;
};

const playlistRegex =
  /^(https:\/\/)?(www\.)?youtube\.com\/playlist\?list=[A-z0-9_\-]+((&|\?).*)?$/gi;
const playlistHandler = async (message: Message) => {
  const parts = getParts(message);
  if (parts.length === 0) {
    await message.reply("No arguments provided to the command");
    return;
  }

  let playlistId: string | undefined = undefined;

  if (parts.length === 1 && parts[0].match(playlistRegex)) {
    playlistId = extractPlaylistId(parts[0]);
  } else {
    const query = getArguments(message);
    const filter = await ytsr.getFilters(query);
    const newUrl = filter.get("Type")?.get("Playlist")?.url;
    if (newUrl === undefined || newUrl === null) {
      return;
    }
    const results = (await ytsr(newUrl, { limit: 10 })).items;
    for (const result of results) {
      if (result.type === "playlist") {
        playlistId = result.playlistID;
        break;
      }
    }
  }

  if (playlistId !== undefined) {
    try {
      const { title, items } = await playlistLoadAll(playlistId);
      await withOrCreatePlayer(message, async (player) => {
        await player.setPlaylist(items);
      });
      await message.reply(
        `:notes: **${title}** (\`${items.length}\` songs) set as the current playlist :notes:`
      );
    } catch (err) {
      console.log("Playlist not found");
    }
  }
};

const removePlaylistHandler = async (message: Message) => {
  await withPlayer(message, async (player) => {
    await player.setPlaylist([]);
  });
};

const pauseHandler = async (message: Message) => {
  await withPlayer(message, async (player) => {
    await player.pause();
  });
};

const resumeHandler = async (message: Message) => {
  await withPlayer(message, async (player) => {
    await player.play();
  });
};

const shuffleHandler = async (message: Message) => {
  await withPlayer(message, async (player) => {
    await player.shuffle();
    await message.reply("Shuffled playlist");
  });
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
    if (queue.length > 0) {
      const embed = new MessageEmbed().setDescription(
        queue.map((entry, i) => `#${i + 1} ${entry.youtubeId}`).join("\n")
      );
      await message.reply({ embeds: [embed] });
    } else {
      await message.reply("The queue is currently empty");
    }
  });
};

const searchHandler = async (message: Message) => {
  const search = getArguments(message);
  // TODO filter
  const results = (await ytsr(search)).items;

  results;
};

const handlers = new Map<string, (message: Message) => Awaitable<void>>([
  ["play", playHandler],
  ["ping", pingHandler],
  ["leave", leaveHandler],
  ["skip", skipHandler],
  ["search", searchHandler],
  ["list", listHandler],
  ["playlist", playlistHandler],
  ["removeplaylist", removePlaylistHandler],
  ["shuffle", shuffleHandler],
  ["resume", resumeHandler],
  ["pause", pauseHandler],
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
