export class MessageTracker {
  private readonly store = new Map<number, number[]>();
  private readonly limitPerChat = 200;

  track(chatId: number, messageId: number) {
    const existing = this.store.get(chatId) ?? [];
    existing.push(messageId);
    if (existing.length > this.limitPerChat) {
      existing.splice(0, existing.length - this.limitPerChat);
    }
    this.store.set(chatId, existing);
  }

  pull(chatId: number) {
    const ids = this.store.get(chatId) ?? [];
    this.store.delete(chatId);
    return ids;
  }
}

