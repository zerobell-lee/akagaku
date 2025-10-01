import { logger } from '../config/logger';
import Store from 'electron-store'
import { IRelationshipRepository } from 'main/domain/repositories/IRelationshipRepository';

let relationshipStore: Store | null = null;

const getRelationshipStore = (): Store => {
    if (!relationshipStore) {
        relationshipStore = new Store({ name: 'relationship' });
    }
    return relationshipStore;
};

// Start Generation Here
export type Relationship = {
    character: string;
    affection_to_user: number;
    attitude_to_user: string;
}

class ElectronStoreRelationshipRepository implements IRelationshipRepository {
    private character_relationships: Relationship[];

    constructor() {
        this.character_relationships = (() => {
            if (getRelationshipStore().has('relationship')) {
                return getRelationshipStore().get('relationship') as Relationship[];
            } else {
                return [];
            }
        })();
    }

    getCharacterRelationships(character_name: string): Relationship {
        let character_relationship = this.character_relationships.find((relationship: Relationship) => relationship.character === character_name);
        if (!character_relationship) {
            character_relationship = {
                character: character_name,
                affection_to_user: 50,
                attitude_to_user: "neutral"
            };
            this.character_relationships.push(character_relationship);
        }
        return character_relationship;
    }

    async updateCharacterRelationships(character_name: string, affection_to_user: number, attitude_to_user: string): Promise<Relationship> {
        const character_relationship = this.character_relationships.find((relationship: Relationship) => relationship.character === character_name);
        if (!character_relationship) {
            throw new Error(`Character relationship not found for ${character_name}`);
        }
        character_relationship.affection_to_user = affection_to_user;
        character_relationship.attitude_to_user = attitude_to_user;
        getRelationshipStore().set('relationship', this.character_relationships);
        return character_relationship;
    }
}

// Singleton instance
const relationshipRepository = new ElectronStoreRelationshipRepository();

// Backward compatibility - keep old interface
export const getCharacterRelationships = (character_name: string): Relationship => {
    return relationshipRepository.getCharacterRelationships(character_name);
};

export const updateCharacterRelationships = async (character_name: string, affection_to_user: number, attitude_to_user: string): Promise<Relationship> => {
    return relationshipRepository.updateCharacterRelationships(character_name, affection_to_user, attitude_to_user);
};

export { relationshipRepository };

