/**
 * User Entity
 *
 * Domain entity representing the application user.
 * Pure domain object without framework dependencies.
 */
export class User {
  private readonly name: string;
  private readonly occupation: string;
  private readonly birthDate: string;
  private readonly location: string;
  private readonly locale: string;

  private constructor(
    name: string,
    occupation: string,
    birthDate: string,
    location: string,
    locale: string
  ) {
    this.name = name;
    this.occupation = occupation;
    this.birthDate = birthDate;
    this.location = location;
    this.locale = locale;
  }

  /**
   * Create User from raw data
   */
  static create(data: {
    name: string;
    occupation: string;
    birthDate: string;
    location: string;
    locale: string;
  }): User {
    return new User(
      data.name,
      data.occupation,
      data.birthDate,
      data.location,
      data.locale
    );
  }

  /**
   * Create default User (unknown profile)
   */
  static createDefault(): User {
    return new User(
      "(unknown)",
      "(unknown)",
      "(unknown)",
      "(unknown)",
      Intl.DateTimeFormat().resolvedOptions().locale
    );
  }

  /**
   * Update user information (immutable)
   */
  updateName(name: string): User {
    return new User(name, this.occupation, this.birthDate, this.location, this.locale);
  }

  updateOccupation(occupation: string): User {
    return new User(this.name, occupation, this.birthDate, this.location, this.locale);
  }

  updateBirthDate(birthDate: string): User {
    return new User(this.name, this.occupation, birthDate, this.location, this.locale);
  }

  updateLocation(location: string): User {
    return new User(this.name, this.occupation, this.birthDate, location, this.locale);
  }

  updateLocale(locale: string): User {
    return new User(this.name, this.occupation, this.birthDate, this.location, locale);
  }

  /**
   * Check if user profile is complete
   */
  isProfileComplete(): boolean {
    return (
      this.name !== "(unknown)" &&
      this.occupation !== "(unknown)" &&
      this.birthDate !== "(unknown)" &&
      this.location !== "(unknown)"
    );
  }

  /**
   * Check if user profile is anonymous
   */
  isAnonymous(): boolean {
    return this.name === "(unknown)";
  }

  // Getters
  getName(): string {
    return this.name;
  }

  getOccupation(): string {
    return this.occupation;
  }

  getBirthDate(): string {
    return this.birthDate;
  }

  getLocation(): string {
    return this.location;
  }

  getLocale(): string {
    return this.locale;
  }

  /**
   * Convert to raw format for persistence
   */
  toRaw(): {
    name: string;
    occupation: string;
    birthDate: string;
    location: string;
    locale: string;
  } {
    return {
      name: this.name,
      occupation: this.occupation,
      birthDate: this.birthDate,
      location: this.location,
      locale: this.locale
    };
  }

  /**
   * String representation
   */
  toString(): string {
    return `User(${this.name}, ${this.occupation})`;
  }
}