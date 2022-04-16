import { Client } from "discord.js";

const registerUserEvents = (client: Client) => {
  client.on("userNoteUpdate", (user, oldNote, newNote) => {
    console.log(`a member's note is updated`);
  });

  client.on("userUpdate", (oldUser, newUser) => {
    console.log(`user's details (e.g. username) are changed`);
  });

  client.on("voiceStateUpdate", (oldMember, newMember) => {
    console.log(`a user changes voice state`);
  });
};

export { registerUserEvents };
