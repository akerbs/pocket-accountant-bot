type PendingIntent =
  | { type: 'add_purchase' }
  | { type: 'add_purchase_note'; categoryId: string }
  | { type: 'add_purchase_amount'; categoryId: string; note: string }
  | { type: 'set_limit' }
  | { type: 'set_limit_amount'; categoryId: string };

export class PendingIntentStore {
  private store = new Map<string, PendingIntent>();

  set(userId: string | number, intent: PendingIntent) {
    this.store.set(String(userId), intent);
  }

  get(userId: string | number) {
    return this.store.get(String(userId));
  }

  clear(userId: string | number) {
    this.store.delete(String(userId));
  }
}

