import { logger } from '../config/logger';
import Store from 'electron-store'

const relationshipStore = new Store({ name: 'relationship' });

// Start Generation Here
export type Relationship = {
    character: string;
    affection_to_user: number;
    attitude_to_user: string;
}

const character_relationships: Relationship[] = (() => {
    if (relationshipStore.has('relationship')) {
        return relationshipStore.get('relationship') as Relationship[];
    } else {
        return [];
    }
})();


export const getCharacterRelationships = (character_name: string): Relationship => {
    let character_relationship = character_relationships.find((relationship: Relationship) => relationship.character === character_name);
    if (!character_relationship) {
        character_relationship = {
            character: character_name,
            affection_to_user: 50,
            attitude_to_user: "neutral"
        };
        character_relationships.push(character_relationship);
    }
    return character_relationship;
};

export const updateCharacterRelationships = async (character_name: string, affection_to_user: number, attitude_to_user: string) => {
    const character_relationship = character_relationships.find((relationship: Relationship) => relationship.character === character_name);
    if (!character_relationship) {
        throw new Error(`Character relationship not found for ${character_name}`);
    }
    character_relationship.affection_to_user = affection_to_user;
    character_relationship.attitude_to_user = attitude_to_user;
    relationshipStore.set('relationship', character_relationships);
    return character_relationship;
};

