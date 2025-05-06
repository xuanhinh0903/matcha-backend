export default function recursivelyStripNullValues(
  value: unknown,
  seen = new WeakSet(),
): unknown {
  if (Array.isArray(value)) {
    // If value is an array -> Check for null value for every property in the array
    return value.map((item) => recursivelyStripNullValues(item, seen));
  }

  if (value !== null && typeof value === 'object') {
    if (seen.has(value)) {
      // Avoid infinite recursion due to cyclic reference
      return value;
    }

    seen.add(value);

    // Return object that cleared all null value key pairs
    return Object.fromEntries(
      // Convert object to an array, then check if its value is null and strip all null values
      Object.entries(value)
        .filter(([_, val]) => val !== null) // Filter out null values directly here
        .map(([key, val]) => [key, recursivelyStripNullValues(val, seen)]),
    );
  }

  return value !== null ? value : undefined;
}
