import { Topic, TopicEntity } from '../entities/Topic';

/**
 * TopicManager - Domain service for managing conversation topics
 *
 * Responsibilities:
 * - Select appropriate topics based on affection, cooldown, and weight
 * - Track topic usage to prevent repetition
 * - Provide random topic selection with weighted probability
 */
export class TopicManager {
  private topics: Map<string, TopicEntity> = new Map();

  /**
   * Load topics for a character
   */
  loadTopics(topics: Topic[]): void {
    this.topics.clear();
    topics.forEach(topic => {
      this.topics.set(topic.id, new TopicEntity(topic));
    });
    console.log(`[TopicManager] Loaded ${this.topics.size} topics`);
  }

  /**
   * Get a random topic based on current context
   * @param currentAffection - Current affection level with user
   * @param category - Optional category filter (e.g., 'morning', 'evening')
   * @param tags - Optional tag filters
   */
  selectTopic(
    currentAffection: number,
    category?: string,
    tags?: string[]
  ): TopicEntity | null {
    const currentTime = new Date();

    // Filter available topics
    let availableTopics = Array.from(this.topics.values()).filter(topic => {
      // Check affection and cooldown
      if (!topic.isAvailable(currentAffection, currentTime)) {
        return false;
      }

      // Check category filter
      if (category && topic.metadata.category !== category) {
        return false;
      }

      // Check tag filters
      if (tags && tags.length > 0) {
        const topicTags = topic.metadata.tags || [];
        const hasMatchingTag = tags.some(tag => topicTags.includes(tag));
        if (!hasMatchingTag) {
          return false;
        }
      }

      return true;
    });

    if (availableTopics.length === 0) {
      console.warn('[TopicManager] No available topics found');
      return null;
    }

    // Calculate total weight
    const totalWeight = availableTopics.reduce((sum, topic) => sum + topic.metadata.weight, 0);

    // Select topic using weighted random selection
    let random = Math.random() * totalWeight;
    for (const topic of availableTopics) {
      random -= topic.metadata.weight;
      if (random <= 0) {
        console.log(`[TopicManager] Selected topic: ${topic.id} (type: ${topic.metadata.type})`);
        return topic;
      }
    }

    // Fallback to first topic (should not happen)
    return availableTopics[0];
  }

  /**
   * Mark a topic as used
   */
  markTopicUsed(topicId: string, timestamp: Date = new Date()): void {
    const topic = this.topics.get(topicId);
    if (topic) {
      topic.markAsUsed(timestamp);
      console.log(`[TopicManager] Marked topic as used: ${topicId}`);
    }
  }

  /**
   * Get all topics for a character
   */
  getAllTopics(): TopicEntity[] {
    return Array.from(this.topics.values());
  }

  /**
   * Get topic by ID
   */
  getTopic(topicId: string): TopicEntity | undefined {
    return this.topics.get(topicId);
  }

  /**
   * Get available topics count
   */
  getAvailableTopicsCount(currentAffection: number): number {
    const currentTime = new Date();
    return Array.from(this.topics.values())
      .filter(topic => topic.isAvailable(currentAffection, currentTime))
      .length;
  }

  /**
   * Reset all topic usage timestamps (for testing)
   */
  resetAllTopicUsage(): void {
    this.topics.forEach(topic => {
      topic.lastUsed = undefined;
    });
    console.log('[TopicManager] Reset all topic usage');
  }
}
