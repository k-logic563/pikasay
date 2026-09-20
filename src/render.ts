export const PIKA_ASCII_ART = String.raw`   /\_/\
  ( •ᴗ• )
  / >🍃`;

export function renderMessage(message: string): string {
  const indentedMessage = message.replaceAll("\n", "\n  ");
  return `${PIKA_ASCII_ART}\n\n  ${indentedMessage}\n`;
}
