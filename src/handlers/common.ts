import { MessageActionRow, MessageButton } from "discord.js";
import { MessageButtonStyles } from "discord.js/typings/enums";

const createResponse = (
  message: string,
  id: bigint,
  disabled: boolean = false,
  bumped: boolean = false
) => {
  const row = new MessageActionRow().addComponents(
    new MessageButton()
      .setCustomId(`song_bump_${id}`)
      .setLabel(bumped ? "Bumped" : "Bump")
      .setStyle(MessageButtonStyles.PRIMARY)
      .setDisabled(disabled),
    new MessageButton()
      .setCustomId(`song_remove_${id}`)
      .setLabel(disabled ? "Deleted" : "Remove")
      .setStyle(MessageButtonStyles.DANGER)
      .setDisabled(disabled)
  );
  return {
    content: message,
    components: [row],
  };
};

export { createResponse };
