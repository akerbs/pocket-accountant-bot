type PendingIntent =
  | { type: 'add_purchase' }
  | { type: 'add_purchase_note'; categoryId: string }
  | { type: 'add_purchase_amount'; categoryId: string; note: string }
  | { type: 'set_limit' }
  | { type: 'set_limit_amount'; categoryId: string };

export class PendingIntentStore {
  private store = new Map<number, PendingIntent>();

  set(userId: number, intent: PendingIntent) {
    this.store.set(userId, intent);
  }

  get(userId: number) {
    return this.store.get(userId);
  }

  clear(userId: number) {
    this.store.delete(userId);
  }
}

