export function generateRandomString(length = 16) {
    return Math.random().toString(36).substring(2, length + 2);
  }
  