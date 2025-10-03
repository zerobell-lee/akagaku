/**
 * Topic - Domain entity representing a conversation topic for chit-chat
 */

export interface TopicMetadata {
  type: 'question' | 'episode' | 'observation' | 'casual';
  category: string; // 'past', 'user_info', 'daily', 'morning', 'evening', etc.
  weight: number; // Selection probability weight (higher = more likely)
  requires_affection?: number; // Minimum affection required to use this topic
  cooldown_days?: number; // Days before topic can be reused
  tags?: string[]; // Additional filtering tags
}

export interface Topic {
  id: string; // Unique identifier (filename without extension)
  characterId: string; // Character this topic belongs to
  metadata: TopicMetadata;
  content: string; // Topic instruction/description for the character
  lastUsed?: Date; // Last time this topic was used
}

export class TopicEntity implements Topic {
  id: string;
  characterId: string;
  metadata: TopicMetadata;
  content: string;
  lastUsed?: Date;

  constructor(data: Topic) {
    this.id = data.id;
    this.characterId = data.characterId;
    this.metadata = data.metadata;
    this.content = data.content;
    this.lastUsed = data.lastUsed;
  }

  /**
   * Check if this topic is available based on affection level
   */
  isAvailableForAffection(currentAffection: number): boolean {
    if (this.metadata.requires_affection === undefined) {
      return true;
    }
    return currentAffection >= this.metadata.requires_affection;
  }

  /**
   * Check if this topic is available based on cooldown
   */
  isAvailableForCooldown(currentTime: Date = new Date()): boolean {
    if (!this.metadata.cooldown_days || !this.lastUsed) {
      return true;
    }

    const cooldownMs = this.metadata.cooldown_days * 24 * 60 * 60 * 1000;
    const timeSinceLastUse = currentTime.getTime() - this.lastUsed.getTime();

    return timeSinceLastUse >= cooldownMs;
  }

  /**
   * Check if this topic is currently available
   */
  isAvailable(currentAffection: number, currentTime: Date = new Date()): boolean {
    return this.isAvailableForAffection(currentAffection) &&
           this.isAvailableForCooldown(currentTime);
  }

  /**
   * Mark this topic as used
   */
  markAsUsed(timestamp: Date = new Date()): void {
    this.lastUsed = timestamp;
  }
}
