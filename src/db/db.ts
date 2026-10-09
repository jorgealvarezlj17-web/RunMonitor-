import Dexie, { Table } from 'dexie';

export interface AppConfig {
  id?: string;
  key: string;
  value: any;
}

export interface Equipment {
  id?: string;
  name: string;
  // Add other fields as needed based on the actual Firestore documents
  [key: string]: any;
}

export class MyDatabase extends Dexie {
  configs!: Table<AppConfig, string>;
  equipment!: Table<Equipment, string>;
  categories!: Table<Category, string>; // Add Category table

  constructor() {
    super('AppDatabase');
    this.version(1).stores({
      configs: 'key',
      equipment: 'id',
      categories: '++id, name, ownerUid', // 'id' as auto-incremented primary key
    });
  }
}

export interface Category {
  id?: string; // Dexie handles string keys
  name: string;
  ownerUid?: string;
  order: number;
}

export const dexieDb = new MyDatabase();
