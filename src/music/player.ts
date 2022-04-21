import {
  AudioPlayer,
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  AudioResource,
  entersState,
  joinVoiceChannel,
  NoSubscriberBehavior,
  VoiceConnection,
  VoiceConnectionStatus,
  StreamType,
} from "@discordjs/voice";
import { Mutex } from "async-mutex";
import { RBTree } from "bintrees";
import { Channel, Guild } from "discord.js";
import shuffleArray from "shuffle-array";
import ytdl from "ytdl-core-discord";

interface VideoInformation {
  youtubeId: string;
  title: string;
  duration: string;
}

type QueueEntry = VideoInformation & {
  id: bigint;
};

const createEmptyEntry = (id: bigint): QueueEntry => {
  return { id, youtubeId: "", title: "", duration: "" };
};

interface AddResult {
  id: bigint;
  currentSize: number;
}

class Player {
  queue: RBTree<QueueEntry> = new RBTree((a, b) => {
    if (a.id > b.id) return 1;
    if (a.id < b.id) return -1;
    return 0;
  });
  connection: VoiceConnection;
  audioPlayer: AudioPlayer;
  guild: Guild;
  channelId: string;
  nextId: bigint = 1n;
  nextFrontId: bigint = -1n;
  queueLock = new Mutex();
  idLock = new Mutex();
  playLock = new Mutex();
  playlist: VideoInformation[];
  playlistIdx: number;

  // Currently playing informationcheckPlay
  currentResource: AudioResource | undefined = undefined;
  youtubeId: string | undefined = undefined;

  constructor(guild: Guild, channel: Channel) {
    this.guild = guild;
    this.channelId = channel.id;

    this.audioPlayer = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Play,
      },
    });
    this.audioPlayer.on(AudioPlayerStatus.Idle, async () => {
      await this.checkPlay();
    });
    this.audioPlayer.on("error", async (_) => {
      console.log("An error occurred while playing " + this.youtubeId);
    });

    this.connection = joinVoiceChannel({
      guildId: this.guild.id,
      channelId: channel.id,
      adapterCreator: this.guild.voiceAdapterCreator,
      selfMute: false,
      selfDeaf: false,
    });
    this.connection.subscribe(this.audioPlayer);
    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        this.channelId = "";
        await Promise.race([
          entersState(
            this.connection,
            VoiceConnectionStatus.Signalling,
            10_000
          ),
          entersState(
            this.connection,
            VoiceConnectionStatus.Connecting,
            10_000
          ),
        ]);
        const channelId = this.connection.joinConfig.channelId;
        if (channelId !== null) this.channelId = channelId;
      } catch (error) {
        this.connection.destroy();
      }
    });

    this.playlist = [];
    this.playlistIdx = 0;
  }

  public setVoiceChannel = (channel: Channel, move: boolean): boolean => {
    if (this.channelId === channel.id) return true;
    if (!move) return false;
    this.connection = joinVoiceChannel({
      guildId: this.guild.id,
      channelId: channel.id,
      adapterCreator: this.guild.voiceAdapterCreator,
      selfMute: false,
      selfDeaf: false,
    });
    this.connection.subscribe(this.audioPlayer);
    this.channelId = channel.id;
    return true;
  };

  public setPlaylist = async (videos: VideoInformation[]) => {
    const release = await this.playLock.acquire();
    try {
      this.playlist = videos;
      this.playlistIdx = 0;
    } finally {
      release();
    }
    this.checkPlay();
  };

  public addToQueue = async (info: VideoInformation): Promise<AddResult> => {
    const id = await this.getNextId();
    const size = await this.queuePush({
      id,
      youtubeId: info.youtubeId,
      title: info.title,
      duration: info.duration,
    });
    await this.checkPlay();
    return { id, currentSize: size };
  };

  public bumpToFront = async (id: bigint): Promise<bigint> => {
    const entry = await this.queueFind(id);
    if (entry === undefined) return 0n;
    if (!(await this.queueRemove(entry))) return 0n;

    const newId = await this.getNextFrontId();
    entry.id = newId;
    if ((await this.queuePush(entry)) === 0) return 0n;
    return newId;
  };

  public queueSize = () => this.queue.size;

  public destroy = () => {
    this.connection.destroy();
    this.audioPlayer.stop();
    unloadPlayer(this.guild.id);
  };

  public play = async () => {
    await this.checkPlay();
  };

  public pause = async () => {
    this.audioPlayer.pause();
  };

  public skip = () => {
    this.audioPlayer.stop();
  };

  public shuffle = async () => {
    const release = await this.playLock.acquire();
    try {
      this.playlist = shuffleArray(this.playlist);
    } finally {
      release();
    }
  };

  public removeFromQueue = (id: bigint): Promise<boolean> => {
    return this.queueRemove(id);
  };

  public getQueue = async (): Promise<QueueEntry[]> => {
    const queue: QueueEntry[] = [];
    const release = await this.queueLock.acquire();
    try {
      this.queue.each((entry) => {
        queue.push(Object.assign({}, entry));
      });
    } finally {
      release();
    }
    return queue;
  };

  private checkPlay = async () => {
    const release = await this.playLock.acquire();
    try {
      if (this.isIdle()) {
        let nextEntry: VideoInformation | undefined = await this.queuePop();
        if (nextEntry === undefined) {
          if (this.playlist.length > 0) {
            if (this.playlistIdx > this.playlist.length) this.playlistIdx = 0;
            nextEntry = this.playlist[this.playlistIdx];
            this.playlistIdx++;
          } else {
            return;
          }
        }
        const { youtubeId } = nextEntry;
        const stream = await ytdl(
          "https://www.youtube.com/watch?v=" + youtubeId,
          {
            highWaterMark: 1 << 25,
            quality: "highestaudio",
            filter: "audioonly",
          }
        );
        this.youtubeId = youtubeId;
        this.currentResource = createAudioResource(stream, {
          inputType: StreamType.Opus,
        });
        this.audioPlayer.play(this.currentResource);
      } else if (this.audioPlayer.checkPlayable()) {
        this.audioPlayer.unpause();
      }
    } finally {
      release();
    }
  };

  private isIdle = () => {
    return this.audioPlayer.state.status === AudioPlayerStatus.Idle;
  };

  private queuePop = async (): Promise<QueueEntry | undefined> => {
    const release = await this.queueLock.acquire();
    try {
      const entry = this.queue.min();
      if (entry === null) return undefined;
      this.queue.remove(entry);
      return entry;
    } finally {
      release();
    }
  };

  private queuePush = async (entry: QueueEntry): Promise<number> => {
    const release = await this.queueLock.acquire();
    try {
      const newSize = this.queueSize() + 1;
      if (!this.queue.insert(entry)) return 0;
      return newSize;
    } finally {
      release();
    }
  };

  private queueRemove = async (
    entry: QueueEntry | bigint
  ): Promise<boolean> => {
    if (typeof entry === "bigint") {
      entry = createEmptyEntry(entry);
    }

    const release = await this.queueLock.acquire();
    try {
      return this.queue.remove(entry);
    } finally {
      release();
    }
  };

  private queueFind = async (
    entry: QueueEntry | bigint
  ): Promise<QueueEntry | undefined> => {
    if (typeof entry === "bigint") {
      entry = createEmptyEntry(entry);
    }

    const release = await this.queueLock.acquire();
    try {
      const result = this.queue.find(entry);
      if (result === null) return undefined;
      return result;
    } finally {
      release();
    }
  };

  private getNextId = async () => {
    const release = await this.idLock.acquire();
    try {
      const id = this.nextId;
      this.nextId++;
      return id;
    } finally {
      release();
    }
  };

  private getNextFrontId = async () => {
    const release = await this.idLock.acquire();
    try {
      const id = this.nextFrontId;
      this.nextFrontId--;
      return id;
    } finally {
      release();
    }
  };
}

const playersLock = new Mutex();
const players: Map<string, Player> = new Map();

const getOrCreatePlayer = async (
  guild: Guild,
  channel: Channel,
  moveChannel: boolean = false
): Promise<Player | undefined> => {
  const release = await playersLock.acquire();
  try {
    const player = players.get(guild.id);
    if (player !== undefined) {
      if (!player.setVoiceChannel(channel, moveChannel)) return undefined;
      return player;
    }
    const newPlayer = new Player(guild, channel);
    players.set(guild.id, newPlayer);
    return newPlayer;
  } finally {
    release();
  }
};

const getPlayer = (guild: Guild, channel: Channel): Player | undefined => {
  const player = players.get(guild.id);
  if (player === undefined || player.channelId !== channel.id) {
    return undefined;
  }
  return player;
};

const destroyAllPlayers = () => {
  for (const player of players.values()) {
    player.destroy();
  }
};

const unloadPlayer = (guildId: string) => {
  players.delete(guildId);
};

const destroyPlayer = (guild: Guild, channel: Channel): boolean => {
  const player = players.get(guild.id);
  if (player === undefined) return false;
  player.destroy();
  return true;
};

export {
  getOrCreatePlayer,
  destroyAllPlayers,
  getPlayer,
  destroyPlayer,
  Player,
  QueueEntry,
  VideoInformation,
};
