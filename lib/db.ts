import { openDB, DBSchema } from 'idb';

export interface Character {
    id: string;
    name: string;
    description: string;
    imageIds: string[];
    createdAt: number;
}

interface MangaDB extends DBSchema {
    images: {
        key: string;
        value: {
            id: string;
            name: string;
            type: string;
            data: Blob;
            createdAt: number;
        };
        indexes: { 'by-date': number };
    };
    characters: {
        key: string;
        value: Character;
        indexes: { 'by-date': number };
    };
}

const DB_NAME = 'manga-gen-db';
const STORE_NAME = 'images';

export async function initDB() {
    return openDB<MangaDB>(DB_NAME, 2, {
        upgrade(db, oldVersion, newVersion, transaction) {
            if (oldVersion < 1) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('by-date', 'createdAt');
            }
            if (oldVersion < 2) {
                const charStore = db.createObjectStore('characters', { keyPath: 'id' });
                charStore.createIndex('by-date', 'createdAt');
            }
        },
    });
}

export async function saveImage(file: File) {
    const db = await initDB();
    const id = crypto.randomUUID();
    const imageRecord = {
        id,
        name: file.name,
        type: file.type,
        data: file,
        createdAt: Date.now(),
    };
    await db.add(STORE_NAME, imageRecord);
    return imageRecord;
}

export async function getAllImages() {
    const db = await initDB();
    return db.getAllFromIndex(STORE_NAME, 'by-date');
}

export async function deleteImage(id: string) {
    const db = await initDB();
    await db.delete(STORE_NAME, id);
}

export async function getImage(id: string) {
    const db = await initDB();
    return db.get(STORE_NAME, id);
}

// Character Functions
export async function saveCharacter(character: Omit<Character, 'id' | 'createdAt'>) {
    const db = await initDB();
    const id = crypto.randomUUID();
    const record: Character = {
        ...character,
        id,
        createdAt: Date.now(),
    };
    await db.add('characters', record);
    return record;
}

export async function getAllCharacters() {
    const db = await initDB();
    return db.getAllFromIndex('characters', 'by-date');
}

export async function deleteCharacter(id: string) {
    const db = await initDB();
    await db.delete('characters', id);
}

export async function getCharacter(id: string) {
    const db = await initDB();
    return db.get('characters', id);
}
